import { Vector3, MathUtils } from 'three';
import { MOUSE_SENSITIVITY } from '../utils/constants.js';

/**
 * Third-person camera that orbits behind and above the player character.
 *
 * Mouse movement (pointer-locked) orbits the camera around the player.
 * Gamepad right stick also orbits the camera.
 * The horizontal yaw is fed back to PlayerController so movement stays
 * camera-relative.
 */
class ThirdPersonCam {
  /**
   * @param {import('../player/PlayerController.js').default} playerController
   */
  constructor(playerController) {
    this.name = 'thirdperson';

    /** @private */ this._player = playerController;

    // --- Orbit parameters ---
    /** @private */ this._distance = 5;
    /** @private */ this._height = 2;
    /** @private */ this._yaw = 0;
    /** @private */ this._pitch = 0.3;
    /** @private */ this._sensitivity = MOUSE_SENSITIVITY;
    /** @private */ this._pitchMin = -0.5;
    /** @private */ this._pitchMax = 1.2;

    // --- Zoom limits ---
    /** @private */ this._distanceMin = 2;
    /** @private */ this._distanceMax = 15;

    // --- Smooth follow ---
    /** @private */ this._currentPos = new Vector3();
    /** @private */ this._targetPos = new Vector3();
    /** @private */ this._smoothFactor = 5;

    // --- Gamepad right stick sensitivity (radians/second) ---
    /** @private */ this._stickSensitivity = 3.0;

    /** @private */ this._lookOffset = new Vector3(0, 1.5, 0);
    /** @private */ this._lookTarget = new Vector3();
  }

  // ── CameraSystem interface ──────────────────────────────────────────

  activate(camera) {
    if (this._player) {
      const pp = this._player.position;
      this._currentPos.set(pp.x, pp.y + this._height, pp.z + this._distance);
      camera.position.copy(this._currentPos);
    }
  }

  deactivate(_camera) {}

  update(camera, inputManager, delta) {
    if (!this._player) return;

    // --- Mouse orbit (pointer locked) ---
    if (inputManager.isPointerLocked()) {
      const mouse = inputManager.getMouseDelta();
      this._yaw -= mouse.x * this._sensitivity;
      this._pitch += mouse.y * this._sensitivity;
    }

    // --- Gamepad right stick orbit ---
    const rightStick = inputManager.getRightStick();
    if (Math.abs(rightStick.x) > 0 || Math.abs(rightStick.y) > 0) {
      this._yaw -= rightStick.x * this._stickSensitivity * delta;
      this._pitch += rightStick.y * this._stickSensitivity * delta;
    }

    this._pitch = MathUtils.clamp(this._pitch, this._pitchMin, this._pitchMax);

    // Feed yaw back to PlayerController for camera-relative movement
    this._player.setCameraYaw(this._yaw);

    // --- Compute look-at target ---
    const playerPos = this._player.position;
    this._lookTarget.copy(playerPos).add(this._lookOffset);

    // --- Spherical offset ---
    const cosP = Math.cos(this._pitch);
    const sinP = Math.sin(this._pitch);
    const cosY = Math.cos(this._yaw);
    const sinY = Math.sin(this._yaw);

    this._targetPos.set(
      playerPos.x + sinY * cosP * this._distance,
      playerPos.y + this._height + sinP * this._distance,
      playerPos.z + cosY * cosP * this._distance,
    );

    // --- Smooth follow ---
    const t = 1 - Math.pow(0.01, delta * this._smoothFactor);
    this._currentPos.lerp(this._targetPos, t);

    camera.position.copy(this._currentPos);
    camera.lookAt(this._lookTarget);
  }

  // ── Public helpers ──────────────────────────────────────────────────

  setDistance(d) {
    this._distance = MathUtils.clamp(d, this._distanceMin, this._distanceMax);
  }

  get yaw() {
    return this._yaw;
  }
}

export default ThirdPersonCam;
