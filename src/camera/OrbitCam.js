import { Vector3, Spherical, MathUtils } from 'three';
import { MOUSE_SENSITIVITY } from '../utils/constants.js';

/**
 * Orbit camera that revolves around a target point.
 *
 * Implements the CameraSystem mode interface:
 *   - name            (string)
 *   - activate(camera)
 *   - deactivate(camera)
 *   - update(camera, inputManager, delta)
 *
 * Controls:
 *   - Mouse drag (pointer-locked): orbit horizontally and vertically
 *   - Scroll wheel: zoom in / out (handled via a DOM listener)
 *   - Smooth damping on rotation for cinematic feel
 *
 * Usage:
 *   const orbitCam = new OrbitCam();
 *   cameraSystem.registerMode(orbitCam);
 *   cameraSystem.setMode('orbit');
 */
class OrbitCam {
  constructor() {
    /** Mode name used by CameraSystem. */
    this.name = 'orbit';

    // --- Target ---
    /** @private */ this._target = new Vector3(0, 1, 0);

    // --- Spherical coordinates ---
    /** @private */ this._spherical = new Spherical(10, Math.PI / 3, 0);
    /** @private */ this._targetSpherical = new Spherical(10, Math.PI / 3, 0);

    // --- Limits ---
    /** @private */ this._distanceMin = 2;
    /** @private */ this._distanceMax = 50;
    /** @private */ this._polarMin = MathUtils.degToRad(10);   // avoid looking straight down
    /** @private */ this._polarMax = MathUtils.degToRad(170);  // avoid looking straight up

    // --- Sensitivity ---
    /** @private */ this._rotateSensitivity = MOUSE_SENSITIVITY;
    /** @private */ this._zoomSpeed = 2;

    // --- Damping ---
    /** @private */ this._dampingFactor = 6; // higher = snappier

    // --- Scroll listener ---
    /** @private */ this._onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      this._targetSpherical.radius = MathUtils.clamp(
        this._targetSpherical.radius + delta * this._zoomSpeed,
        this._distanceMin,
        this._distanceMax
      );
    };

    // Reusable vector to avoid per-frame allocation
    /** @private */ this._offset = new Vector3();
  }

  // ---------------------------------------------------------------------------
  // CameraSystem interface
  // ---------------------------------------------------------------------------

  /**
   * Called when this mode becomes active.
   * @param {THREE.PerspectiveCamera} camera
   */
  activate(camera) {
    // Derive initial spherical coordinates from current camera position
    this._offset.copy(camera.position).sub(this._target);
    this._spherical.setFromVector3(this._offset);
    this._spherical.radius = MathUtils.clamp(
      this._spherical.radius,
      this._distanceMin,
      this._distanceMax
    );
    this._targetSpherical.copy(this._spherical);

    // Attach scroll listener (passive: false to allow preventDefault)
    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  /**
   * Called when switching away from this mode.
   * @param {THREE.PerspectiveCamera} camera
   */
  deactivate(_camera) {
    window.removeEventListener('wheel', this._onWheel);
  }

  /**
   * Per-frame update driven by CameraSystem.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('../core/InputManager.js').default} inputManager
   * @param {number} delta - seconds since last frame
   */
  update(camera, inputManager, delta) {
    // --- Mouse orbit (only when pointer is locked) ---
    if (inputManager.isPointerLocked()) {
      const mouse = inputManager.getMouseDelta();
      this._targetSpherical.theta -= mouse.x * this._rotateSensitivity;
      this._targetSpherical.phi += mouse.y * this._rotateSensitivity;
    }

    // Clamp polar angle to prevent gimbal flipping
    this._targetSpherical.phi = MathUtils.clamp(
      this._targetSpherical.phi,
      this._polarMin,
      this._polarMax
    );

    // Clamp distance
    this._targetSpherical.radius = MathUtils.clamp(
      this._targetSpherical.radius,
      this._distanceMin,
      this._distanceMax
    );

    // --- Smooth damping (frame-rate independent) ---
    const t = 1 - Math.pow(0.01, delta * this._dampingFactor);
    this._spherical.radius = MathUtils.lerp(this._spherical.radius, this._targetSpherical.radius, t);
    this._spherical.theta = MathUtils.lerp(this._spherical.theta, this._targetSpherical.theta, t);
    this._spherical.phi = MathUtils.lerp(this._spherical.phi, this._targetSpherical.phi, t);

    // --- Compute camera position from spherical coordinates ---
    this._offset.setFromSpherical(this._spherical);
    camera.position.copy(this._target).add(this._offset);
    camera.lookAt(this._target);
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Set the point the camera orbits around.
   * @param {THREE.Vector3} vector3
   */
  setTarget(vector3) {
    this._target.copy(vector3);
  }

  /**
   * Get a copy of the current target position.
   * @returns {THREE.Vector3}
   */
  getTarget() {
    return this._target.clone();
  }

  /**
   * Programmatically set the orbit distance (clamped).
   * @param {number} d
   */
  setDistance(d) {
    this._targetSpherical.radius = MathUtils.clamp(d, this._distanceMin, this._distanceMax);
  }

  /**
   * Current orbit distance.
   * @returns {number}
   */
  get distance() {
    return this._spherical.radius;
  }
}

export default OrbitCam;
