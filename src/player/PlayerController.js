import { Vector3 } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import EventBus from '../core/EventBus.js';
import CollisionWorld from '../physics/CollisionWorld.js';
import {
  WALK_SPEED,
  RUN_SPEED,
  SPRINT_SPEED,
  JUMP_FORCE,
  GRAVITY,
  GROUND_Y,
  PLAYER_ACCEL_RATE,
  PLAYER_DECEL_RATE,
  PLAYER_AIR_CONTROL,
  COYOTE_TIME,
  JUMP_BUFFER_TIME,
  GP_A,
  GP_LB,
} from '../utils/constants.js';

/**
 * Player controller: translates keyboard/mouse/gamepad input into character
 * movement with acceleration curves, coyote time, jump buffering, air control,
 * and capsule-based collision resolution.
 *
 * Movement is relative to the camera yaw (set by ThirdPersonCam via
 * `setCameraYaw()`). The character mesh rotates to face the direction
 * of travel while the camera orbits independently.
 *
 * Integrates with GameState -- only processes input when mode === 'play'.
 *
 * Usage:
 *   const ctrl = new PlayerController(characterBody, inputManager);
 *   engine.addUpdatable(ctrl);              // gets update(delta) each frame
 *   thirdPersonCam = new ThirdPersonCam(ctrl);
 */

/** Two-pi constant for angle wrapping. */
const TWO_PI = Math.PI * 2;

/** Capsule dimensions. */
const CAPSULE_RADIUS = 0.35;
const CAPSULE_HEIGHT = 1.8;

class PlayerController {
  /**
   * @param {import('./CharacterBody.js').default} characterBody
   * @param {import('../core/InputManager.js').default} inputManager
   */
  constructor(characterBody, inputManager) {
    /** @private */ this._body = characterBody;
    /** @private */ this._input = inputManager;

    // --- Physics state ---
    /** @private */ this._velocity = new Vector3();
    /** @private */ this._grounded = true;

    /**
     * Current locomotion state.
     * One of: 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'falling'
     * @private
     */
    this._state = 'idle';

    /** Whether the controller processes input. Managed by ModeController. */
    this._enabled = true;

    // --- Reusable direction vectors (avoid per-frame allocation) ---
    /** @private */ this._forward = new Vector3();
    /** @private */ this._right = new Vector3();
    /** @private */ this._moveDir = new Vector3();
    /** @private */ this._targetVelocity = new Vector3();
    /** @private */ this._collisionOffset = new Vector3();

    /** @private */ this._upAxis = new Vector3(0, 1, 0);

    /**
     * Horizontal camera yaw in radians.
     * Updated every frame by ThirdPersonCam so movement stays relative
     * to the camera orientation.
     * @private
     */
    this._cameraYaw = 0;

    // --- Coyote time ---
    /** @private */ this._coyoteTimer = COYOTE_TIME;

    // --- Jump buffer ---
    /** @private */ this._jumpBufferTimer = 0;

    // --- Capsule collider ---
    /** @private */
    this._capsule = new Capsule(
      new Vector3(0, CAPSULE_RADIUS, 0),
      new Vector3(0, CAPSULE_HEIGHT - CAPSULE_RADIUS, 0),
      CAPSULE_RADIUS,
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Called by ThirdPersonCam each frame to keep the controller aware
   * of where the camera is facing.
   * @param {number} yaw - Camera yaw in radians
   */
  setCameraYaw(yaw) {
    this._cameraYaw = yaw;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /** World position of the character container. */
  get position() {
    return this._body.container.position;
  }

  /** Current locomotion state string. */
  get state() {
    return this._state;
  }

  /** The underlying CharacterBody. */
  get body() {
    return this._body;
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * @param {number} delta - Seconds since last frame
   */
  update(delta) {
    if (!this._enabled) return;

    const input = this._input;

    // --- Gather movement input (keyboard) ---
    this._moveDir.set(0, 0, 0);

    // Camera-relative basis vectors (horizontal plane only)
    this._forward.set(0, 0, -1).applyAxisAngle(this._upAxis, this._cameraYaw);
    this._right.set(1, 0, 0).applyAxisAngle(this._upAxis, this._cameraYaw);

    if (input.isKeyDown('KeyW')) this._moveDir.add(this._forward);
    if (input.isKeyDown('KeyS')) this._moveDir.sub(this._forward);
    if (input.isKeyDown('KeyA')) this._moveDir.sub(this._right);
    if (input.isKeyDown('KeyD')) this._moveDir.add(this._right);

    // --- Blend in gamepad left stick ---
    const stick = input.getLeftStick();
    if (Math.abs(stick.x) > 0 || Math.abs(stick.y) > 0) {
      // Stick Y is inverted: negative = forward
      this._moveDir.addScaledVector(this._forward, -stick.y);
      this._moveDir.addScaledVector(this._right, stick.x);
    }

    const hasInput = this._moveDir.lengthSq() > 0;
    if (hasInput) this._moveDir.normalize();

    // --- Determine target speed and provisional state ---
    let speed = 0;
    let newState = 'idle';

    if (hasInput) {
      const sprinting =
        input.isKeyDown('ShiftLeft') ||
        input.isKeyDown('ShiftRight') ||
        input.isButtonDown(GP_LB);

      if (sprinting) {
        speed = SPRINT_SPEED;
        newState = 'sprint';
      } else if (input.isKeyDown('ControlLeft') || input.isKeyDown('ControlRight')) {
        speed = WALK_SPEED;
        newState = 'walk';
      } else {
        speed = RUN_SPEED;
        newState = 'run';
      }
    }

    // --- Coyote timer ---
    if (this._grounded) {
      this._coyoteTimer = COYOTE_TIME;
    } else {
      this._coyoteTimer -= delta;
    }

    // --- Jump input detection (keyboard + gamepad) ---
    const jumpPressed =
      input.isKeyDown('Space') || input.isButtonJustPressed(GP_A);

    // --- Jump buffer ---
    if (jumpPressed && this._coyoteTimer <= 0) {
      // Airborne and can't jump right now -- buffer the request
      this._jumpBufferTimer = JUMP_BUFFER_TIME;
    } else {
      this._jumpBufferTimer -= delta;
    }

    // --- Execute jump ---
    const canJump = this._coyoteTimer > 0;
    const wantsJump = jumpPressed || this._jumpBufferTimer > 0;

    if (wantsJump && canJump) {
      this._velocity.y = JUMP_FORCE;
      this._grounded = false;
      this._coyoteTimer = 0;
      this._jumpBufferTimer = 0;
      newState = 'jump';
    }

    // --- Gravity ---
    if (!this._grounded) {
      this._velocity.y += GRAVITY * delta;
      // Override state to 'falling' once vertical velocity is negative
      if (this._velocity.y < 0) newState = 'falling';
    }

    // --- Acceleration curves (horizontal) ---
    this._targetVelocity.set(
      this._moveDir.x * speed,
      0,
      this._moveDir.z * speed,
    );

    let accelRate = hasInput ? PLAYER_ACCEL_RATE : PLAYER_DECEL_RATE;

    // Air control: reduce acceleration when airborne
    if (!this._grounded) {
      accelRate *= PLAYER_AIR_CONTROL;
    }

    const lerpFactor = Math.min(1, accelRate * delta);

    this._velocity.x += (this._targetVelocity.x - this._velocity.x) * lerpFactor;
    this._velocity.z += (this._targetVelocity.z - this._velocity.z) * lerpFactor;

    // --- Integrate position ---
    const pos = this._body.container.position;
    pos.x += this._velocity.x * delta;
    pos.y += this._velocity.y * delta;
    pos.z += this._velocity.z * delta;

    // --- Capsule collision resolution ---
    this._resolveCapsuleCollision(pos);

    // --- Ground-plane fallback (when octree isn't built) ---
    if (pos.y <= GROUND_Y) {
      pos.y = GROUND_Y;
      this._velocity.y = 0;
      this._grounded = true;

      // Landing: revert to grounded locomotion state
      if (newState === 'falling' || newState === 'jump') {
        newState = hasInput ? 'run' : 'idle';
      }

      // Auto-fire buffered jump on landing
      if (this._jumpBufferTimer > 0) {
        this._velocity.y = JUMP_FORCE;
        this._grounded = false;
        this._jumpBufferTimer = 0;
        newState = 'jump';
      }
    }

    // --- Rotate character to face movement direction (smooth) ---
    if (hasInput && this._grounded) {
      const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z);
      const current = this._body.container.rotation.y;

      // Shortest-arc difference with proper wrapping for negative angles
      let diff = targetAngle - current;
      diff = diff - Math.floor((diff + Math.PI) / TWO_PI) * TWO_PI;

      const rotationSpeed = 10; // radians/sec responsiveness
      this._body.container.rotation.y += diff * Math.min(1, rotationSpeed * delta);
    }

    // --- State transition: trigger animation + event ---
    if (newState !== this._state) {
      this._state = newState;
      EventBus.emit('player:stateChanged', { state: newState });
    }

    // Speed-based animation blending
    const horizontalSpeed = Math.sqrt(
      this._velocity.x ** 2 + this._velocity.z ** 2,
    );
    this._body.setAnimBySpeed(horizontalSpeed);

    // --- Advance animation mixer ---
    this._body.update(delta);
  }

  // ---------------------------------------------------------------------------
  // Capsule collision
  // ---------------------------------------------------------------------------

  /**
   * Sync the capsule to the player position, test against the CollisionWorld
   * octree, push out on penetration, and detect ground contact.
   * @param {Vector3} pos - The player container position (mutated in place)
   * @private
   */
  _resolveCapsuleCollision(pos) {
    if (!CollisionWorld.ready) return;

    // Sync capsule bottom to player position
    this._capsule.start.set(pos.x, pos.y + CAPSULE_RADIUS, pos.z);
    this._capsule.end.set(pos.x, pos.y + CAPSULE_HEIGHT - CAPSULE_RADIUS, pos.z);

    const result = CollisionWorld.capsuleCollision(this._capsule);
    if (!result || !result.collided) return;

    // Push capsule out of penetration
    this._collisionOffset
      .copy(result.normal)
      .multiplyScalar(result.depth);

    this._capsule.translate(this._collisionOffset);

    // Ground detection: if collision normal points mostly upward
    if (result.normal.y > 0.5) {
      this._grounded = true;
      this._velocity.y = Math.max(0, this._velocity.y);
    }

    // Sync player position back from resolved capsule
    pos.x = this._capsule.start.x;
    pos.y = this._capsule.start.y - CAPSULE_RADIUS;
    pos.z = this._capsule.start.z;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose() {
    // PlayerController owns no listeners or GPU resources itself;
    // CharacterBody.dispose() handles animation/mesh cleanup.
  }
}

export default PlayerController;
