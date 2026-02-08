import { Vector3, Spherical, MathUtils } from 'three';
import { MOUSE_SENSITIVITY } from '../utils/constants.js';

/**
 * Orbit camera that revolves around a target point.
 *
 * Supports an optional follow target (Object3D) — when set, the orbit
 * center automatically tracks the follow target's world position each frame.
 * This allows OrbitCam to follow the player/vehicle in play/drive modes.
 *
 * Controls:
 *   - Mouse drag (pointer-locked): orbit horizontally and vertically
 *   - Scroll wheel: zoom in / out
 *   - Smooth damping on rotation for cinematic feel
 */
class OrbitCam {
  constructor() {
    this.name = 'orbit';

    // --- Target ---
    /** @private */ this._target = new Vector3(0, 1, 0);

    /**
     * Optional Object3D whose world position is copied to _target each frame.
     * Set via setFollowTarget(). When null, _target is static.
     * @private
     * @type {THREE.Object3D|null}
     */
    this._followTarget = null;

    /** Y offset above the follow target's origin (e.g. 1.5 for chest height). */
    this._followYOffset = 1.5;

    // --- Spherical coordinates ---
    /** @private */ this._spherical = new Spherical(10, Math.PI / 3, 0);
    /** @private */ this._targetSpherical = new Spherical(10, Math.PI / 3, 0);

    // --- Limits ---
    /** @private */ this._distanceMin = 2;
    /** @private */ this._distanceMax = 50;
    /** @private */ this._polarMin = MathUtils.degToRad(10);
    /** @private */ this._polarMax = MathUtils.degToRad(170);

    // --- Sensitivity ---
    /** @private */ this._rotateSensitivity = MOUSE_SENSITIVITY;
    /** @private */ this._zoomSpeed = 2;

    // --- Damping ---
    /** @private */ this._dampingFactor = 6;

    // --- Scroll listener ---
    /** @private */ this._onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      this._targetSpherical.radius = MathUtils.clamp(
        this._targetSpherical.radius + delta * this._zoomSpeed,
        this._distanceMin,
        this._distanceMax,
      );
    };

    // Reusable vector
    /** @private */ this._offset = new Vector3();
  }

  // ── CameraSystem interface ──────────────────────────────────────────

  activate(camera) {
    this._offset.copy(camera.position).sub(this._target);
    this._spherical.setFromVector3(this._offset);
    this._spherical.radius = MathUtils.clamp(
      this._spherical.radius,
      this._distanceMin,
      this._distanceMax,
    );
    this._targetSpherical.copy(this._spherical);

    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  deactivate(_camera) {
    window.removeEventListener('wheel', this._onWheel);
  }

  update(camera, inputManager, delta) {
    // --- Follow target: auto-track Object3D position ---
    if (this._followTarget) {
      this._followTarget.getWorldPosition(this._target);
      this._target.y += this._followYOffset;
    }

    // --- Mouse orbit (pointer locked) ---
    if (inputManager.isPointerLocked()) {
      const mouse = inputManager.getMouseDelta();
      this._targetSpherical.theta -= mouse.x * this._rotateSensitivity;
      this._targetSpherical.phi += mouse.y * this._rotateSensitivity;
    }

    // --- Gamepad right stick ---
    const rightStick = inputManager.getRightStick();
    if (Math.abs(rightStick.x) > 0 || Math.abs(rightStick.y) > 0) {
      this._targetSpherical.theta -= rightStick.x * 3.0 * delta;
      this._targetSpherical.phi += rightStick.y * 2.5 * delta;
    }

    // Clamp
    this._targetSpherical.phi = MathUtils.clamp(
      this._targetSpherical.phi,
      this._polarMin,
      this._polarMax,
    );
    this._targetSpherical.radius = MathUtils.clamp(
      this._targetSpherical.radius,
      this._distanceMin,
      this._distanceMax,
    );

    // --- Smooth damping ---
    const t = 1 - Math.pow(0.01, delta * this._dampingFactor);
    this._spherical.radius = MathUtils.lerp(this._spherical.radius, this._targetSpherical.radius, t);
    this._spherical.theta = MathUtils.lerp(this._spherical.theta, this._targetSpherical.theta, t);
    this._spherical.phi = MathUtils.lerp(this._spherical.phi, this._targetSpherical.phi, t);

    // --- Position ---
    this._offset.setFromSpherical(this._spherical);
    camera.position.copy(this._target).add(this._offset);
    camera.lookAt(this._target);
  }

  // ── Public helpers ──────────────────────────────────────────────────

  /**
   * Set a static target point for the orbit center.
   * @param {THREE.Vector3} vector3
   */
  setTarget(vector3) {
    this._target.copy(vector3);
  }

  /**
   * Set a follow target Object3D. When set, the orbit center automatically
   * tracks this object's world position each frame.
   * Pass null to stop following and revert to static target.
   *
   * @param {THREE.Object3D|null} object3D
   * @param {number} [yOffset=1.5] — vertical offset above the object
   */
  setFollowTarget(object3D, yOffset = 1.5) {
    this._followTarget = object3D;
    this._followYOffset = yOffset;
  }

  getTarget() {
    return this._target.clone();
  }

  setDistance(d) {
    this._targetSpherical.radius = MathUtils.clamp(d, this._distanceMin, this._distanceMax);
  }

  get distance() {
    return this._spherical.radius;
  }
}

export default OrbitCam;
