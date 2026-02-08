import { Vector3, MathUtils } from 'three';
import Entity from './Entity.js';

/**
 * Drivable vehicle entity with arcade-style driving physics.
 *
 * When occupied, call `drive(inputManager, delta)` each frame to process
 * acceleration, steering, braking and boost inputs. Wheel child meshes
 * (names containing "wheel") are auto-detected and spun proportionally to speed.
 */
class Vehicle extends Entity {
  /**
   * @param {THREE.Object3D} mesh       — Root Object3D (e.g. loaded GLB scene)
   * @param {THREE.AnimationClip[]} animations — GLB animation clips (reserved for future use)
   * @param {string} name               — Display name for this vehicle
   */
  constructor(mesh, animations = [], name = 'vehicle') {
    super(mesh, 'vehicle', name);

    // ── Physics tuning ───────────────────────────────────────────────
    this.speed          = 0;
    this.maxSpeed       = 40;    // units / second
    this.acceleration   = 20;    // units / second²
    this.braking        = 30;    // braking deceleration
    this.friction       = 8;     // passive deceleration when coasting
    this.steerSpeed     = 2.5;   // radians / second at full lock
    this.boostMultiplier = 1.8;  // top-speed multiplier while boosting

    // ── Runtime state ────────────────────────────────────────────────
    this.steering = 0;           // current visual steer angle (reserved)
    this.occupied = false;       // true while a player is driving
    this.driver   = null;        // reference to the occupying player controller

    // ── Wheel references ─────────────────────────────────────────────
    // Automatically collect any child mesh whose name contains "wheel"
    // so we can spin them during driving.
    this.wheels = [];
    mesh.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('wheel')) {
        this.wheels.push(child);
      }
    });

    // ── Reusable scratch vector (avoids allocation in hot loop) ──────
    this._forward = new Vector3();
  }

  /**
   * Process driving inputs and update vehicle position / rotation.
   * Called every frame while the vehicle is occupied.
   *
   * Controls:
   *   W / S       — accelerate / reverse
   *   A / D       — steer (effectiveness scales with speed)
   *   Space       — brake
   *   Shift       — boost (raises top speed)
   *
   * @param {InputManager} input — Input manager instance
   * @param {number}       delta — Frame time in seconds
   */
  drive(input, delta) {
    // ── Acceleration input ────────────────────────────────────────────
    let accelInput = 0;
    if (input.isKeyDown('KeyW')) accelInput =  1;
    if (input.isKeyDown('KeyS')) accelInput = -1;

    const boosting = input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');
    const isBraking = input.isKeyDown('Space');

    // Determine effective top speed
    const maxSpd = boosting ? this.maxSpeed * this.boostMultiplier : this.maxSpeed;

    // Apply throttle / reverse
    if (accelInput !== 0) {
      this.speed += accelInput * this.acceleration * delta;
    }

    // ── Friction (always opposes motion) ──────────────────────────────
    if (Math.abs(this.speed) > 0.1) {
      this.speed -= Math.sign(this.speed) * this.friction * delta;
    } else if (accelInput === 0) {
      this.speed = 0;
    }

    // ── Braking ───────────────────────────────────────────────────────
    if (isBraking && Math.abs(this.speed) > 0.1) {
      this.speed -= Math.sign(this.speed) * this.braking * delta;
    }

    // Clamp: reverse limited to 30 % of forward top speed
    this.speed = MathUtils.clamp(this.speed, -maxSpd * 0.3, maxSpd);

    // ── Steering (only effective when moving) ─────────────────────────
    let steerInput = 0;
    if (input.isKeyDown('KeyA')) steerInput =  1;
    if (input.isKeyDown('KeyD')) steerInput = -1;

    if (Math.abs(this.speed) > 0.5) {
      // Scale steering effectiveness with speed so it feels natural
      const steerFactor = Math.min(1, Math.abs(this.speed) / 10);
      this.mesh.rotation.y +=
        steerInput * this.steerSpeed * steerFactor * delta * Math.sign(this.speed);
    }

    // ── Translation along local forward axis ─────────────────────────
    this._forward.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    this.mesh.position.addScaledVector(this._forward, this.speed * delta);

    // Keep the vehicle on the ground plane
    this.mesh.position.y = Math.max(0, this.mesh.position.y);

    // ── Wheel animation ──────────────────────────────────────────────
    for (const wheel of this.wheels) {
      wheel.rotation.x += this.speed * delta * 2;
    }
  }

  /**
   * Per-frame update hook (called via Entity contract).
   * Driving physics are handled by `drive()` through VehicleInteraction,
   * so this intentionally remains a no-op.
   */
  update(delta) {
    // Driving updates are driven externally — see VehicleInteraction.
  }

  /** Clean up resources. */
  dispose() {
    this.wheels.length = 0;
    this.driver = null;
    super.dispose();
  }
}

export default Vehicle;
