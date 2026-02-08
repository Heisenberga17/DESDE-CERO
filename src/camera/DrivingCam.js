import { Vector3, MathUtils } from 'three';
import GameState from '../core/GameState.js';
import { MOUSE_SENSITIVITY } from '../utils/constants.js';

/**
 * Third-person chase camera for driving mode.
 *
 * Default: follows behind the active vehicle with smooth interpolation.
 * Right-click (or gamepad right stick): orbit freely around vehicle.
 * Release: smooth snap-back to default behind position.
 * Mouse wheel: zoom in/out.
 *
 * Implements the CameraSystem mode interface.
 */
class DrivingCam {
  constructor() {
    this.name = 'driving';

    // ── Follow parameters ────────────────────────────────────────────
    this._distance    = 8;     // distance behind vehicle
    this._height      = 3.5;   // elevation above vehicle origin
    this._lookAhead   = 10;    // how far ahead to aim the camera
    this._smoothFactor = 4;    // lerp speed

    // ── Zoom limits ────────────────────────────────────────────────
    this._distanceMin = 3;
    this._distanceMax = 18;

    // ── FOV settings ─────────────────────────────────────────────────
    this._defaultFOV  = 60;
    this._drivingFOV  = 70;
    this._maxFOVBoost = 10;

    // ── Free-look orbit (right-click / right stick) ──────────────────
    this._orbitYaw   = 0;      // horizontal orbit offset (radians)
    this._orbitPitch = 0;      // vertical orbit offset (radians)
    this._sensitivity = MOUSE_SENSITIVITY;
    this._pitchMin   = -0.5;
    this._pitchMax   = 1.2;
    this._isFreeLook = false;  // true while right-click or right stick active
    this._snapBackSpeed = 8;   // speed of snap-back lerp

    // ── Scroll listener ────────────────────────────────────────────
    this._onWheel = (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 1 : -1;
      this._distance = MathUtils.clamp(
        this._distance + zoomDelta * 1.5,
        this._distanceMin,
        this._distanceMax,
      );
    };

    // ── Reusable scratch vectors ───────────────────────────────────
    this._currentPos  = new Vector3();
    this._targetPos   = new Vector3();
    this._behind      = new Vector3();
    this._ahead       = new Vector3();
    this._lookTarget  = new Vector3();
  }

  // ── CameraSystem interface ──────────────────────────────────────────

  activate(camera) {
    camera.fov = this._drivingFOV;
    camera.updateProjectionMatrix();

    // Seed smoothed position
    const vehicle = GameState.vehicle;
    if (vehicle) {
      this._behind.set(0, 0, this._distance).applyQuaternion(vehicle.mesh.quaternion);
      this._currentPos.set(
        vehicle.mesh.position.x + this._behind.x,
        vehicle.mesh.position.y + this._height,
        vehicle.mesh.position.z + this._behind.z,
      );
    }

    // Reset orbit offsets
    this._orbitYaw = 0;
    this._orbitPitch = 0;
    this._isFreeLook = false;

    window.addEventListener('wheel', this._onWheel, { passive: false });
  }

  deactivate(camera) {
    camera.fov = this._defaultFOV;
    camera.updateProjectionMatrix();
    window.removeEventListener('wheel', this._onWheel);
  }

  update(camera, inputManager, delta) {
    const vehicle = GameState.vehicle;
    if (!vehicle) return;

    const vPos  = vehicle.mesh.position;
    const vQuat = vehicle.mesh.quaternion;

    // ── Free-look: right-click held or right stick active ───────────
    const rightMouseDown = inputManager.isMouseButtonDown(2);
    const rightStick = inputManager.getRightStick();
    const stickActive = Math.abs(rightStick.x) > 0 || Math.abs(rightStick.y) > 0;

    this._isFreeLook = rightMouseDown || stickActive;

    if (this._isFreeLook) {
      // Mouse orbit
      if (rightMouseDown && inputManager.isPointerLocked()) {
        const mouse = inputManager.getMouseDelta();
        this._orbitYaw -= mouse.x * this._sensitivity;
        this._orbitPitch += mouse.y * this._sensitivity;
      }
      // Gamepad right stick orbit
      if (stickActive) {
        this._orbitYaw -= rightStick.x * 2.5 * delta;
        this._orbitPitch += rightStick.y * 2.0 * delta;
      }
      this._orbitPitch = MathUtils.clamp(this._orbitPitch, this._pitchMin, this._pitchMax);
    } else {
      // Snap back to behind position
      const snapT = Math.min(1, this._snapBackSpeed * delta);
      this._orbitYaw *= (1 - snapT);
      this._orbitPitch *= (1 - snapT);
      // Snap to zero when close
      if (Math.abs(this._orbitYaw) < 0.001) this._orbitYaw = 0;
      if (Math.abs(this._orbitPitch) < 0.001) this._orbitPitch = 0;
    }

    // ── Compute desired camera position ────────────────────────────
    if (this._orbitYaw !== 0 || this._orbitPitch !== 0) {
      // Free-look: orbit around vehicle
      const cosP = Math.cos(this._orbitPitch);
      const sinP = Math.sin(this._orbitPitch);

      // Get vehicle's forward direction yaw
      this._behind.set(0, 0, 1).applyQuaternion(vQuat);
      const vehicleYaw = Math.atan2(this._behind.x, this._behind.z);
      const totalYaw = vehicleYaw + this._orbitYaw;

      this._targetPos.set(
        vPos.x + Math.sin(totalYaw) * cosP * this._distance,
        vPos.y + this._height + sinP * this._distance,
        vPos.z + Math.cos(totalYaw) * cosP * this._distance,
      );
    } else {
      // Default: behind and above the vehicle
      this._behind.set(0, 0, this._distance).applyQuaternion(vQuat);
      this._targetPos.set(
        vPos.x + this._behind.x,
        vPos.y + this._height,
        vPos.z + this._behind.z,
      );
    }

    // ── Smooth follow ──────────────────────────────────────────────
    const t = 1 - Math.pow(0.05, delta * this._smoothFactor);
    this._currentPos.lerp(this._targetPos, t);
    camera.position.copy(this._currentPos);

    // ── Look target ────────────────────────────────────────────────
    this._ahead.set(0, 0, -this._lookAhead).applyQuaternion(vQuat);
    this._lookTarget.copy(vPos).add(this._ahead);
    this._lookTarget.y += 1;

    // In free-look, look at the vehicle instead of ahead
    if (this._isFreeLook) {
      this._lookTarget.copy(vPos);
      this._lookTarget.y += 1;
    }

    camera.lookAt(this._lookTarget);

    // ── Speed-reactive FOV ─────────────────────────────────────────
    const speedRatio = Math.abs(vehicle.speed) / vehicle.maxSpeed;
    camera.fov = MathUtils.lerp(this._drivingFOV, this._drivingFOV + this._maxFOVBoost, speedRatio);
    camera.updateProjectionMatrix();
  }
}

export default DrivingCam;
