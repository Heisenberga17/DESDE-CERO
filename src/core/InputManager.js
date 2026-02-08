/**
 * Centralized input state: keyboard, mouse (with pointer lock), gamepad.
 * Uses KeyboardEvent.code for layout-independent bindings.
 */
class InputManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._keys = new Set();
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._pointerLocked = false;

    // Bound handlers (stored for cleanup)
    this._onKeyDown = (e) => {
      this._keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this._keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      if (!this._pointerLocked) return;
      this._mouseDX += e.movementX;
      this._mouseDY += e.movementY;
    };
    this._onPointerLockChange = () => {
      this._pointerLocked = document.pointerLockElement === this._canvas;
    };
    this._onCanvasClick = () => {
      if (!this._pointerLocked) {
        this._canvas.requestPointerLock();
      }
    };

    // Attach listeners
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.addEventListener('click', this._onCanvasClick);
  }

  /** Check if a key is currently held. Use KeyboardEvent.code, e.g. 'KeyW', 'ShiftLeft'. */
  isKeyDown(code) {
    return this._keys.has(code);
  }

  /** Returns accumulated mouse delta since last call and resets it. */
  getMouseDelta() {
    const dx = this._mouseDX;
    const dy = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;
    return { x: dx, y: dy };
  }

  isPointerLocked() {
    return this._pointerLocked;
  }

  requestPointerLock() {
    if (!this._pointerLocked) {
      this._canvas.requestPointerLock();
    }
  }

  releasePointerLock() {
    if (this._pointerLocked) {
      document.exitPointerLock();
    }
  }

  /** Returns first connected gamepad or null. */
  getGamepad() {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp) return gp;
    }
    return null;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.removeEventListener('click', this._onCanvasClick);
  }
}

export default InputManager;
