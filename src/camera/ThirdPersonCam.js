import { Vector3, MathUtils } from 'three';
import { MOUSE_SENSITIVITY } from '../utils/constants.js';

/**
 * Third-person camera that orbits behind and above the player character.
 *
 * Implements the CameraSystem mode interface:
 *   - name            (string)
 *   - activate(camera)
 *   - deactivate(camera)
 *   - update(camera, inputManager, delta)
 *
 * Mouse movement (when pointer-locked) orbits the camera around the player.
 * The horizontal yaw is fed back to PlayerController so movement stays
 * camera-relative.
 *
 * Usage:
 *   const tpCam = new ThirdPersonCam(playerController);
 *   cameraSystem.registerMode(tpCam);
 *   cameraSystem.setMode('thirdperson');
 */
class ThirdPersonCam {
  /**
   * @param {import('../player/PlayerController.js').default} playerController
   */
  constructor(playerController) {
    /** Mode name used by CameraSystem.registerMode / setMode. */
    this.name = 'thirdperson';

    /** @private */ this._player = playerController;

    // --- Orbit parameters ---
    /** @private */ this._distance = 5;        // distance behind the player
    /** @private */ this._height = 2;          // base height above the player
    /** @private */ this._yaw = 0;             // horizontal orbit angle (radians)
    /** @private */ this._pitch = 0.3;         // vertical orbit angle (radians, positive = above)
    /** @private */ this._sensitivity = MOUSE_SENSITIVITY;
    /** @private */ this._pitchMin = -0.5;     // looking up limit
    /** @private */ this._pitchMax = 1.2;      // looking down limit

    // --- Zoom limits ---
    /** @private */ this._distanceMin = 2;
    /** @private */ this._distanceMax = 15;

    // --- Smooth follow ---
    /** @private */ this._currentPos = new Vector3();
    /** @private */ this._targetPos = new Vector3();
    /** @private */ this._smoothFactor = 5;    // higher = snappier

    /**
     * Offset above the character's feet where the camera looks.
     * Keeps the crosshair roughly at chest/head height.
     * @private
     */
    this._lookOffset = new Vector3(0, 1.5, 0);

    // Reusable vector to avoid per-frame allocation
    /** @private */ this._lookTarget = new Vector3();
  }

  // ---------------------------------------------------------------------------
  // CameraSystem interface
  // ---------------------------------------------------------------------------

  /**
   * Called when this mode becomes active.
   * @param {THREE.PerspectiveCamera} camera
   */
  activate(camera) {
    if (this._player) {
      const pp = this._player.position;
      // Start directly behind the player at the default orbit
      this._currentPos.set(
        pp.x,
        pp.y + this._height,
        pp.z + this._distance
      );
      camera.position.copy(this._currentPos);
    }
  }

  /**
   * Called when switching away from this mode.
   * @param {THREE.PerspectiveCamera} camera
   */
  deactivate(_camera) {
    // Nothing to clean up
  }

  /**
   * Per-frame update driven by CameraSystem.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('../core/InputManager.js').default} inputManager
   * @param {number} delta - seconds since last frame
   */
  update(camera, inputManager, delta) {
    if (!this._player) return;

    // --- Mouse orbit (only when pointer is locked) ---
    if (inputManager.isPointerLocked()) {
      const mouse = inputManager.getMouseDelta();
      this._yaw -= mouse.x * this._sensitivity;
      this._pitch += mouse.y * this._sensitivity;
      this._pitch = MathUtils.clamp(this._pitch, this._pitchMin, this._pitchMax);
    }

    // Feed the current yaw back to the player controller so WASD movement
    // stays relative to the camera facing direction.
    this._player.setCameraYaw(this._yaw);

    // --- Compute look-at target (above player's feet) ---
    const playerPos = this._player.position;
    this._lookTarget.copy(playerPos).add(this._lookOffset);

    // --- Spherical offset from the player ---
    const cosP = Math.cos(this._pitch);
    const sinP = Math.sin(this._pitch);
    const cosY = Math.cos(this._yaw);
    const sinY = Math.sin(this._yaw);

    this._targetPos.set(
      playerPos.x + sinY * cosP * this._distance,
      playerPos.y + this._height + sinP * this._distance,
      playerPos.z + cosY * cosP * this._distance
    );

    // --- Smooth follow via exponential decay lerp ---
    // `1 - 0.01^(delta * factor)` gives frame-rate-independent smoothing.
    const t = 1 - Math.pow(0.01, delta * this._smoothFactor);
    this._currentPos.lerp(this._targetPos, t);

    camera.position.copy(this._currentPos);
    camera.lookAt(this._lookTarget);
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Programmatically set the orbit distance (clamped to min/max).
   * @param {number} d
   */
  setDistance(d) {
    this._distance = MathUtils.clamp(d, this._distanceMin, this._distanceMax);
  }

  /** Current horizontal yaw angle in radians. */
  get yaw() {
    return this._yaw;
  }
}

export default ThirdPersonCam;
