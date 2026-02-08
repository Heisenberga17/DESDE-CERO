import { Vector3, MathUtils } from 'three';
import GameState from '../core/GameState.js';

/**
 * Third-person chase camera for driving mode.
 *
 * Follows behind the active vehicle with smooth interpolation. FOV
 * widens dynamically with speed to enhance the sense of velocity.
 *
 * Implements the CameraSystem mode interface:
 *   name              — unique string identifier
 *   activate(camera)  — called when mode becomes active
 *   deactivate(camera)— called when switching away
 *   update(camera, inputManager, delta) — per-frame update
 */
class DrivingCam {
  constructor() {
    this.name = 'driving';

    // ── Follow parameters ────────────────────────────────────────────
    this._distance    = 8;     // distance behind vehicle
    this._height      = 3.5;   // elevation above vehicle origin
    this._lookAhead   = 10;    // how far ahead of the vehicle to aim the camera
    this._smoothFactor = 4;    // lerp speed — higher = snappier follow

    // ── FOV settings ─────────────────────────────────────────────────
    this._defaultFOV  = 60;    // FOV restored on deactivate
    this._drivingFOV  = 70;    // base FOV while driving
    this._maxFOVBoost = 10;    // extra degrees added at top speed

    // ── Reusable scratch vectors (avoid allocations in update loop) ──
    this._currentPos  = new Vector3();
    this._targetPos   = new Vector3();
    this._behind      = new Vector3();
    this._ahead       = new Vector3();
    this._lookTarget  = new Vector3();
  }

  /**
   * Called when this camera mode becomes active.
   * Sets the driving FOV immediately.
   * @param {THREE.PerspectiveCamera} camera
   */
  activate(camera) {
    camera.fov = this._drivingFOV;
    camera.updateProjectionMatrix();

    // Seed the smoothed position to avoid a jarring snap on first frame
    const vehicle = GameState.vehicle;
    if (vehicle) {
      this._behind.set(0, 0, this._distance).applyQuaternion(vehicle.mesh.quaternion);
      this._currentPos.set(
        vehicle.mesh.position.x + this._behind.x,
        vehicle.mesh.position.y + this._height,
        vehicle.mesh.position.z + this._behind.z,
      );
    }
  }

  /**
   * Called when switching away from driving camera.
   * Restores the default FOV.
   * @param {THREE.PerspectiveCamera} camera
   */
  deactivate(camera) {
    camera.fov = this._defaultFOV;
    camera.updateProjectionMatrix();
  }

  /**
   * Per-frame camera update. Smoothly follows the vehicle from behind and
   * dynamically adjusts FOV based on speed.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {InputManager}            inputManager — (unused, required by interface)
   * @param {number}                  delta        — Frame time in seconds
   */
  update(camera, inputManager, delta) {
    const vehicle = GameState.vehicle;
    if (!vehicle) return;

    const vPos  = vehicle.mesh.position;
    const vQuat = vehicle.mesh.quaternion;

    // ── Desired position: behind and above the vehicle ───────────────
    this._behind.set(0, 0, this._distance).applyQuaternion(vQuat);
    this._targetPos.set(
      vPos.x + this._behind.x,
      vPos.y + this._height,
      vPos.z + this._behind.z,
    );

    // ── Smooth follow using exponential lerp ─────────────────────────
    // The pow(0.05, ...) formulation keeps interpolation frame-rate independent.
    const t = 1 - Math.pow(0.05, delta * this._smoothFactor);
    this._currentPos.lerp(this._targetPos, t);
    camera.position.copy(this._currentPos);

    // ── Look target: a point ahead of the vehicle ────────────────────
    this._ahead.set(0, 0, -this._lookAhead).applyQuaternion(vQuat);
    this._lookTarget.copy(vPos).add(this._ahead);
    this._lookTarget.y += 1; // slight upward offset for a more cinematic angle
    camera.lookAt(this._lookTarget);

    // ── Speed-reactive FOV ───────────────────────────────────────────
    const speedRatio = Math.abs(vehicle.speed) / vehicle.maxSpeed;
    camera.fov = MathUtils.lerp(this._drivingFOV, this._drivingFOV + this._maxFOVBoost, speedRatio);
    camera.updateProjectionMatrix();
  }
}

export default DrivingCam;
