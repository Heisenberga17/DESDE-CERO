/**
 * Centralized input state: keyboard, mouse (with pointer lock), gamepad.
 * Uses KeyboardEvent.code for layout-independent bindings.
 */

const GAMEPAD_DEADZONE = 0.15;

class InputManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._keys = new Set();
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._pointerLocked = false;

    // Mouse buttons (0=left, 1=middle, 2=right)
    this._mouseButtons = new Set();

    // Gamepad state
    this._gamepadAxes = [0, 0, 0, 0];
    this._gamepadButtons = new Array(17).fill(false);
    this._prevGamepadButtons = new Array(17).fill(false);

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
    this._onMouseDown = (e) => {
      this._mouseButtons.add(e.button);
    };
    this._onMouseUp = (e) => {
      this._mouseButtons.delete(e.button);
    };
    this._onContextMenu = (e) => {
      e.preventDefault(); // prevent right-click menu during gameplay
    };

    // Attach listeners
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.addEventListener('click', this._onCanvasClick);
    this._canvas.addEventListener('mousedown', this._onMouseDown);
    this._canvas.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mouseup', this._onMouseUp); // catch releases outside canvas
    this._canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  // ── Keyboard ───────────────────────────────────────────────────────

  /** Check if a key is currently held. Use KeyboardEvent.code, e.g. 'KeyW', 'ShiftLeft'. */
  isKeyDown(code) {
    return this._keys.has(code);
  }

  // ── Mouse ──────────────────────────────────────────────────────────

  /** Returns accumulated mouse delta since last call and resets it. */
  getMouseDelta() {
    const dx = this._mouseDX;
    const dy = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;
    return { x: dx, y: dy };
  }

  /** Check if a mouse button is held (0=left, 1=middle, 2=right). */
  isMouseButtonDown(button) {
    return this._mouseButtons.has(button);
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

  // ── Gamepad ────────────────────────────────────────────────────────

  /** Returns first connected gamepad or null. */
  getGamepad() {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp) return gp;
    }
    return null;
  }

  /**
   * Poll gamepad state. Call once per frame from Engine._gameLoop().
   * Reads axes (with deadzone) and buttons into internal arrays.
   */
  pollGamepad() {
    const gp = this.getGamepad();
    if (!gp) return;

    // Swap previous buttons
    for (let i = 0; i < this._gamepadButtons.length; i++) {
      this._prevGamepadButtons[i] = this._gamepadButtons[i];
    }

    // Read axes with deadzone
    for (let i = 0; i < 4 && i < gp.axes.length; i++) {
      const raw = gp.axes[i];
      this._gamepadAxes[i] = Math.abs(raw) > GAMEPAD_DEADZONE ? raw : 0;
    }

    // Read buttons
    for (let i = 0; i < this._gamepadButtons.length && i < gp.buttons.length; i++) {
      this._gamepadButtons[i] = gp.buttons[i].pressed;
    }
  }

  /** Left stick: { x, y } where x=right, y=down (standard mapping). */
  getLeftStick() {
    return { x: this._gamepadAxes[0], y: this._gamepadAxes[1] };
  }

  /** Right stick: { x, y }. */
  getRightStick() {
    return { x: this._gamepadAxes[2], y: this._gamepadAxes[3] };
  }

  /** Is a gamepad button currently held? */
  isButtonDown(index) {
    return this._gamepadButtons[index] || false;
  }

  /** Was a gamepad button pressed this frame (edge detection)? */
  isButtonJustPressed(index) {
    return this._gamepadButtons[index] && !this._prevGamepadButtons[index];
  }

  /** Analog trigger value (0–1). LT=6, RT=7. */
  getTrigger(index) {
    const gp = this.getGamepad();
    if (!gp || index >= gp.buttons.length) return 0;
    return gp.buttons[index].value;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.removeEventListener('click', this._onCanvasClick);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    this._canvas.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mouseup', this._onMouseUp);
    this._canvas.removeEventListener('contextmenu', this._onContextMenu);
  }
}

export default InputManager;
