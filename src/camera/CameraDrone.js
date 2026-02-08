import { Vector3, Euler, MathUtils } from 'three';

/**
 * Free-fly drone camera with inertia.
 * WASD horizontal, Q/E up/down, mouse look, Shift boost.
 */
class CameraDrone {
  constructor() {
    this.name = 'drone';
    this.moveSpeed = 30;
    this.boostMultiplier = 3;
    this.lookSensitivity = 0.002;
    this.dampingFactor = 0.9;

    this._velocity = new Vector3();
    this._euler = new Euler(0, 0, 0, 'YXZ'); // YXZ for FPS-style look
    this._pitchLimit = MathUtils.degToRad(85);

    // Reusable vectors (avoid allocations in update loop)
    this._forward = new Vector3();
    this._right = new Vector3();
    this._moveDir = new Vector3();
  }

  /**
   * Called when this camera mode becomes active.
   */
  activate(camera) {
    // Sync euler from current camera rotation
    this._euler.setFromQuaternion(camera.quaternion, 'YXZ');
  }

  /**
   * Called when switching away from this mode.
   */
  deactivate(camera) {
    this._velocity.set(0, 0, 0);
  }

  /**
   * Update camera each frame.
   */
  update(camera, inputManager, delta) {
    // Mouse look (only when pointer is locked)
    if (inputManager.isPointerLocked()) {
      const mouse = inputManager.getMouseDelta();
      this._euler.y -= mouse.x * this.lookSensitivity;
      this._euler.x -= mouse.y * this.lookSensitivity;
      this._euler.x = MathUtils.clamp(this._euler.x, -this._pitchLimit, this._pitchLimit);
      camera.quaternion.setFromEuler(this._euler);
    }

    // Movement direction
    this._moveDir.set(0, 0, 0);

    // Forward/backward (camera direction projected to XZ plane)
    camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();

    // Right vector
    this._right.crossVectors(this._forward, camera.up).normalize();

    // WASD
    if (inputManager.isKeyDown('KeyW')) this._moveDir.add(this._forward);
    if (inputManager.isKeyDown('KeyS')) this._moveDir.sub(this._forward);
    if (inputManager.isKeyDown('KeyA')) this._moveDir.sub(this._right);
    if (inputManager.isKeyDown('KeyD')) this._moveDir.add(this._right);

    // Q/E for world-space vertical
    if (inputManager.isKeyDown('KeyE')) this._moveDir.y += 1;
    if (inputManager.isKeyDown('KeyQ')) this._moveDir.y -= 1;

    // Normalize and apply speed
    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
      const speed = inputManager.isKeyDown('ShiftLeft') || inputManager.isKeyDown('ShiftRight')
        ? this.moveSpeed * this.boostMultiplier
        : this.moveSpeed;
      this._velocity.add(this._moveDir.multiplyScalar(speed * delta));
    }

    // Frame-rate-independent damping
    this._velocity.multiplyScalar(Math.pow(this.dampingFactor, delta * 60));

    // Apply velocity
    camera.position.add(this._velocity);
  }
}

export default CameraDrone;
