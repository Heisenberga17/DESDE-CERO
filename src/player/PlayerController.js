import { Vector3 } from 'three';
import EventBus from '../core/EventBus.js';
import {
  WALK_SPEED,
  RUN_SPEED,
  SPRINT_SPEED,
  JUMP_FORCE,
  GRAVITY,
  GROUND_Y,
} from '../utils/constants.js';

/**
 * Player controller: translates keyboard/mouse input into character movement.
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

    /** @private */ this._upAxis = new Vector3(0, 1, 0);

    /**
     * Horizontal camera yaw in radians.
     * Updated every frame by ThirdPersonCam so movement stays relative
     * to the camera orientation.
     * @private
     */
    this._cameraYaw = 0;
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

    // --- Gather movement input ---
    this._moveDir.set(0, 0, 0);

    // Camera-relative basis vectors (horizontal plane only)
    this._forward.set(0, 0, -1).applyAxisAngle(this._upAxis, this._cameraYaw);
    this._right.set(1, 0, 0).applyAxisAngle(this._upAxis, this._cameraYaw);

    if (input.isKeyDown('KeyW')) this._moveDir.add(this._forward);
    if (input.isKeyDown('KeyS')) this._moveDir.sub(this._forward);
    if (input.isKeyDown('KeyA')) this._moveDir.sub(this._right);
    if (input.isKeyDown('KeyD')) this._moveDir.add(this._right);

    const hasInput = this._moveDir.lengthSq() > 0;
    if (hasInput) this._moveDir.normalize();

    // --- Determine speed and provisional state ---
    let speed = 0;
    let newState = 'idle';

    if (hasInput) {
      if (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) {
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

    // --- Jump ---
    if (input.isKeyDown('Space') && this._grounded) {
      this._velocity.y = JUMP_FORCE;
      this._grounded = false;
      newState = 'jump';
    }

    // --- Gravity ---
    if (!this._grounded) {
      this._velocity.y += GRAVITY * delta;
      // Override state to 'falling' once vertical velocity is negative
      if (this._velocity.y < 0) newState = 'falling';
    }

    // --- Horizontal velocity ---
    this._velocity.x = this._moveDir.x * speed;
    this._velocity.z = this._moveDir.z * speed;

    // --- Integrate position ---
    const pos = this._body.container.position;
    pos.x += this._velocity.x * delta;
    pos.y += this._velocity.y * delta;
    pos.z += this._velocity.z * delta;

    // --- Ground collision ---
    if (pos.y <= GROUND_Y) {
      pos.y = GROUND_Y;
      this._velocity.y = 0;
      this._grounded = true;
      // Landing: revert to grounded locomotion state
      if (newState === 'falling' || newState === 'jump') {
        newState = hasInput ? 'run' : 'idle';
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
    const horizontalSpeed = Math.sqrt(this._velocity.x ** 2 + this._velocity.z ** 2);
    this._body.setAnimBySpeed(horizontalSpeed);

    // --- Advance animation mixer ---
    this._body.update(delta);
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
