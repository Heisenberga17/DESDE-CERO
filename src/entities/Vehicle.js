import { Vector3, MathUtils, Sphere } from 'three';
import Entity from './Entity.js';
import CollisionWorld from '../physics/CollisionWorld.js';
import EventBus from '../core/EventBus.js';
import {
  VEHICLE_ACCEL_SMOOTHING,
  VEHICLE_STEER_SMOOTHING,
  VEHICLE_GRIP_THRESHOLD,
  VEHICLE_BODY_TILT_MAX,
  GP_B,
  GP_LB,
  GP_LT,
  GP_RT,
} from '../utils/constants.js';

/**
 * Drivable vehicle entity with upgraded arcade-style driving physics.
 *
 * Features:
 *   - Exponential-lerp acceleration and friction for smooth speed ramp
 *   - Smoothed steering with speed-dependent effectiveness
 *   - Drift mechanics with grip threshold and event emission
 *   - Visual body tilt proportional to steering and speed
 *   - Simple spring-damper suspension bounce on Y axis
 *   - Sphere-based collision against the CollisionWorld
 *   - Full gamepad support (triggers, stick, buttons) merged with keyboard
 *
 * When occupied, call `drive(inputManager, delta)` each frame to process
 * acceleration, steering, braking and boost inputs. Wheel child meshes
 * (names containing "wheel") are auto-detected and spun proportionally to speed.
 */
class Vehicle extends Entity {
  /**
   * @param {THREE.Object3D}        mesh       — Root Object3D (e.g. loaded GLB scene)
   * @param {THREE.AnimationClip[]} animations — GLB animation clips (reserved for future use)
   * @param {string}                name       — Display name for this vehicle
   */
  constructor(mesh, animations = [], name = 'vehicle') {
    super(mesh, 'vehicle', name);

    // ── Physics tuning ───────────────────────────────────────────────
    this.speed            = 0;
    this.maxSpeed         = 40;    // units / second
    this.acceleration     = 20;    // units / second² (used for target calculation)
    this.braking          = 30;    // braking lerp rate
    this.friction         = 8;     // exponential friction half-life factor
    this.steerSpeed       = 2.5;   // radians / second at full lock
    this.boostMultiplier  = 1.8;   // top-speed multiplier while boosting

    // ── Runtime state ────────────────────────────────────────────────
    this.steering  = 0;            // current visual steer angle (exposed for HUD / camera)
    this.occupied  = false;        // true while a player is driving
    this.driver    = null;         // reference to the occupying player controller

    // ── Internal smoothing state ─────────────────────────────────────
    /** @private */ this._steerAngle    = 0;   // smoothed steer input (-1 to 1)
    /** @private */ this._driftFactor   = 0;   // 0 = full grip, 1 = full drift
    /** @private */ this._prevSpeed     = 0;   // speed last frame (for suspension impulse)
    /** @private */ this._prevSteer     = 0;   // steer angle last frame (for suspension impulse)

    // ── Suspension spring-damper ─────────────────────────────────────
    /** @private */ this._suspensionY   = 0;   // current vertical displacement
    /** @private */ this._suspensionVel = 0;   // current vertical velocity

    // ── Wheel references ─────────────────────────────────────────────
    // Automatically collect any child mesh whose name contains "wheel"
    // so we can spin them during driving.
    this.wheels = [];
    mesh.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('wheel')) {
        this.wheels.push(child);
      }
    });

    // ── Reusable scratch objects (avoids allocation in hot loop) ─────
    /** @private */ this._forward = new Vector3();

    // ── Collision sphere (reused every frame) ────────────────────────
    const collisionRadius = 1.5;
    /** @private */ this._collisionRadius = collisionRadius;
    /** @private */ this._collisionSphere = new Sphere(
      new Vector3().copy(mesh.position).add(new Vector3(0, collisionRadius, 0)),
      collisionRadius,
    );
  }

  // ===================================================================
  //  DRIVE  —  main per-frame driving update
  // ===================================================================

  /**
   * Process driving inputs and update vehicle position / rotation.
   * Called every frame while the vehicle is occupied.
   *
   * Keyboard controls:
   *   W / S       — accelerate / reverse
   *   A / D       — steer (effectiveness scales with speed)
   *   Space       — brake / handbrake
   *   Shift       — boost (raises top speed)
   *
   * Gamepad controls (merged, analog values override digital):
   *   RT          — analog accelerate (0-1)
   *   LT          — analog brake / reverse (0-1)
   *   Left stick X — analog steer
   *   B button    — handbrake
   *   LB          — boost
   *
   * @param {InputManager} input — Input manager instance
   * @param {number}       delta — Frame time in seconds
   */
  drive(input, delta) {
    // ── Gather raw inputs (keyboard + gamepad merge) ─────────────────
    const { accelInput, brakeInput, steerInput, isBraking, boosting } =
      this._gatherInput(input);

    // ── Effective top speed ──────────────────────────────────────────
    const maxSpd = boosting ? this.maxSpeed * this.boostMultiplier : this.maxSpeed;

    // ── Smooth acceleration (exponential lerp toward target speed) ───
    this._applyAcceleration(accelInput, brakeInput, isBraking, maxSpd, delta);

    // ── Smooth steering ─────────────────────────────────────────────
    this._applySteering(steerInput, delta);

    // ── Drift mechanics ─────────────────────────────────────────────
    this._applyDrift(delta);

    // ── Body tilt (visual only) ─────────────────────────────────────
    this._applyBodyTilt(delta);

    // ── Suspension bounce (visual spring-damper on Y) ────────────────
    this._applySuspension(delta);

    // ── Translation along local forward axis ─────────────────────────
    this._forward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    this.mesh.position.addScaledVector(this._forward, this.speed * delta);

    // ── Sphere collision ─────────────────────────────────────────────
    this._applyCollision();

    // Keep the vehicle on the ground plane
    this.mesh.position.y = Math.max(0, this.mesh.position.y);

    // Apply suspension visual offset (after ground clamp)
    this.mesh.position.y += this._suspensionY;

    // ── Wheel animation ──────────────────────────────────────────────
    for (const wheel of this.wheels) {
      wheel.rotation.x += this.speed * delta * 2;
    }

    // ── Bookkeeping for next frame ──────────────────────────────────
    this._prevSpeed = this.speed;
    this._prevSteer = this._steerAngle;
  }

  // ===================================================================
  //  INPUT GATHERING
  // ===================================================================

  /**
   * Merge keyboard and gamepad inputs into a single set of driving values.
   * Analog gamepad values override their digital keyboard counterparts when
   * they carry a meaningful signal.
   *
   * @private
   * @param   {InputManager} input
   * @returns {{ accelInput: number, brakeInput: number, steerInput: number,
   *             isBraking: boolean, boosting: boolean }}
   */
  _gatherInput(input) {
    // -- Keyboard defaults --
    let accelInput = 0;
    if (input.isKeyDown('KeyW')) accelInput = 1;
    if (input.isKeyDown('KeyS')) accelInput = -1;

    let steerInput = 0;
    if (input.isKeyDown('KeyA')) steerInput =  1;
    if (input.isKeyDown('KeyD')) steerInput = -1;

    let isBraking = input.isKeyDown('Space');
    let boosting  = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');
    let brakeInput = isBraking ? 1 : 0;

    // -- Gamepad overrides --
    const gpRT = input.getTrigger(GP_RT);   // accelerate 0-1
    const gpLT = input.getTrigger(GP_LT);   // brake / reverse 0-1

    if (gpRT > 0) {
      accelInput = gpRT;                     // analog throttle overrides W
    }
    if (gpLT > 0) {
      brakeInput = gpLT;                     // analog brake overrides S / Space
      // If already stopped or very slow, LT acts as reverse throttle
      if (Math.abs(this.speed) < 0.5) {
        accelInput = -gpLT;
      }
    }

    const stick = input.getLeftStick();
    if (Math.abs(stick.x) > 0) {
      steerInput = -stick.x;                 // analog steer overrides A/D
    }

    if (input.isButtonDown(GP_B)) {
      isBraking  = true;
      brakeInput = 1;
    }
    if (input.isButtonDown(GP_LB)) {
      boosting = true;
    }

    return { accelInput, brakeInput, steerInput, isBraking, boosting };
  }

  // ===================================================================
  //  ACCELERATION & FRICTION
  // ===================================================================

  /**
   * Exponential-lerp acceleration toward a target speed, with exponential
   * friction when coasting and lerp-based braking.
   *
   * @private
   * @param {number}  accelInput — -1 to 1 (throttle / reverse)
   * @param {number}  brakeInput — 0 to 1 (brake intensity)
   * @param {boolean} isBraking  — true when handbrake / space is held
   * @param {number}  maxSpd     — current effective top speed
   * @param {number}  delta      — frame time in seconds
   */
  _applyAcceleration(accelInput, brakeInput, isBraking, maxSpd, delta) {
    if (accelInput !== 0) {
      // Determine target: forward uses full maxSpd, reverse limited to 30 %
      const targetSpeed = accelInput > 0
        ? accelInput * maxSpd
        : accelInput * maxSpd * 0.3;

      // Exponential lerp toward target
      this.speed += (targetSpeed - this.speed) *
        Math.min(1, VEHICLE_ACCEL_SMOOTHING * delta);
    } else {
      // No throttle — exponential friction (half-life decay)
      this.speed *= Math.pow(0.5, this.friction * delta);

      // Snap to zero when very slow
      if (Math.abs(this.speed) < 0.05) {
        this.speed = 0;
      }
    }

    // ── Braking (lerp toward zero) ──────────────────────────────────
    if (isBraking && Math.abs(this.speed) > 0.05) {
      const brakeLerp = Math.min(1, this.braking * brakeInput * delta);
      this.speed = MathUtils.lerp(this.speed, 0, brakeLerp);

      // Snap to zero when nearly stopped under braking
      if (Math.abs(this.speed) < 0.05) {
        this.speed = 0;
      }
    }

    // Final clamp: reverse limited to 30 % of forward top speed
    this.speed = MathUtils.clamp(this.speed, -maxSpd * 0.3, maxSpd);
  }

  // ===================================================================
  //  STEERING
  // ===================================================================

  /**
   * Smooth the raw steer input and apply it to the vehicle's Y rotation.
   * Steering effectiveness scales with speed and is reduced during drifts.
   *
   * @private
   * @param {number} steerInput — raw steer input (-1 to 1)
   * @param {number} delta      — frame time in seconds
   */
  _applySteering(steerInput, delta) {
    // Lerp _steerAngle toward input for smooth transitions
    this._steerAngle += (steerInput - this._steerAngle) *
      Math.min(1, VEHICLE_STEER_SMOOTHING * delta);

    // Expose for external consumers (HUD, camera)
    this.steering = this._steerAngle;

    // Only steer when moving
    if (Math.abs(this.speed) > 0.5) {
      const steerFactor = Math.min(1, Math.abs(this.speed) / 10);

      // Reduce steering effectiveness when drifting (grip loss)
      const gripMult = 1 - this._driftFactor * 0.4;

      this.mesh.rotation.y +=
        this._steerAngle * this.steerSpeed * steerFactor * gripMult *
        delta * Math.sign(this.speed);
    }
  }

  // ===================================================================
  //  DRIFT MECHANICS
  // ===================================================================

  /**
   * Blend drift factor based on speed ratio and steer angle.
   * When drifting, emits `vehicle:drifting` on the EventBus.
   * When grip is recovered, lerps drift factor back to zero.
   *
   * @private
   * @param {number} delta — frame time in seconds
   */
  _applyDrift(delta) {
    const speedRatio = Math.abs(this.speed) / this.maxSpeed;
    const steerMag   = Math.abs(this._steerAngle);

    const shouldDrift = speedRatio * steerMag > VEHICLE_GRIP_THRESHOLD &&
                        speedRatio > 0.4;

    if (shouldDrift) {
      // Blend drift factor toward 1
      this._driftFactor += (1 - this._driftFactor) * Math.min(1, 4 * delta);

      EventBus.emit('vehicle:drifting', {
        vehicle: this,
        driftFactor: this._driftFactor,
      });
    } else {
      // Recover grip — lerp back to 0
      this._driftFactor += (0 - this._driftFactor) * Math.min(1, 3 * delta);

      // Snap when negligible
      if (this._driftFactor < 0.01) {
        this._driftFactor = 0;
      }
    }
  }

  // ===================================================================
  //  BODY TILT (visual only)
  // ===================================================================

  /**
   * Tilt the vehicle body on the Z axis proportional to steer angle and
   * speed ratio for a satisfying visual lean into turns.
   *
   * @private
   * @param {number} delta — frame time in seconds
   */
  _applyBodyTilt(delta) {
    const speedRatio = MathUtils.clamp(
      Math.abs(this.speed) / this.maxSpeed, 0, 1,
    );
    const tiltTarget = -this._steerAngle * speedRatio * VEHICLE_BODY_TILT_MAX;

    this.mesh.rotation.z += (tiltTarget - this.mesh.rotation.z) *
      Math.min(1, 5 * delta);
  }

  // ===================================================================
  //  SUSPENSION (spring-damper on Y)
  // ===================================================================

  /**
   * Simple spring-damper system that produces a visual bounce on the Y axis.
   * Impulses are injected by speed changes (bumps from accel/decel) and
   * steering changes (weight transfer in turns).
   *
   * @private
   * @param {number} delta — frame time in seconds
   */
  _applySuspension(delta) {
    const springK  = 80;  // spring constant
    const dampingK = 8;   // damping coefficient

    // Inject impulses from driving events
    const speedDelta = this.speed - this._prevSpeed;
    const steerDelta = this._steerAngle - this._prevSteer;

    this._suspensionVel += -speedDelta * 0.02;    // bump from accel changes
    this._suspensionVel += Math.abs(steerDelta) * 0.01; // bump from steering

    // Spring-damper integration
    const springForce  = -springK  * this._suspensionY;
    const dampingForce = -dampingK * this._suspensionVel;
    this._suspensionVel += (springForce + dampingForce) * delta;
    this._suspensionY   += this._suspensionVel * delta;

    // Clamp to avoid runaway
    this._suspensionY = MathUtils.clamp(this._suspensionY, -0.15, 0.15);
  }

  // ===================================================================
  //  SPHERE COLLISION
  // ===================================================================

  /**
   * Test the vehicle's bounding sphere against the CollisionWorld.
   * On frontal collision, the vehicle loses 70 % of its speed and is
   * pushed out of the obstacle.
   *
   * @private
   */
  _applyCollision() {
    if (!CollisionWorld.ready) return;

    // Update sphere center to current mesh position + radius offset
    this._collisionSphere.center.copy(this.mesh.position);
    this._collisionSphere.center.y += this._collisionRadius;

    const result = CollisionWorld.sphereCollision(this._collisionSphere);
    if (!result || !result.collided) return;

    const { normal, depth } = result;

    // Check if the collision is frontal (normal opposing travel direction)
    this._forward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    const dot = this._forward.dot(normal);

    if (dot < -0.3) {
      // Frontal collision — lose 70 % of speed
      this.speed *= 0.3;
    }

    // Push the vehicle out of the obstacle
    this.mesh.position.addScaledVector(normal, depth);
  }

  // ===================================================================
  //  UPDATE (Entity contract)
  // ===================================================================

  /**
   * Per-frame update hook (called via Entity contract).
   * Driving physics are handled by `drive()` through VehicleInteraction,
   * so this intentionally remains a no-op.
   *
   * @param {number} delta — frame time in seconds
   */
  update(delta) {
    // Driving updates are driven externally — see VehicleInteraction.
  }

  // ===================================================================
  //  DISPOSE
  // ===================================================================

  /** Clean up resources. */
  dispose() {
    this.wheels.length = 0;
    this.driver = null;
    this._driftFactor   = 0;
    this._steerAngle    = 0;
    this._suspensionY   = 0;
    this._suspensionVel = 0;
    super.dispose();
  }
}

export default Vehicle;
