import EventBus from '../core/EventBus.js';
import GameState from '../core/GameState.js';

/**
 * Director mode controller.
 *
 * Press Tab to toggle between play mode and director mode.
 * While in director mode:
 *   - The game state is set to 'director'
 *   - Number keys 1-6 trigger cinematic camera presets
 *   - P key switches to the path camera mode
 *   - The default camera is set to 'drone' for free movement
 *
 * Usage:
 *   const director = new DirectorMode(cameraSystem, inputManager);
 *   engine.addUpdatable(director);
 */
class DirectorMode {
  /**
   * @param {import('../camera/CameraSystem.js').default} cameraSystem
   * @param {import('../core/InputManager.js').default} inputManager
   */
  constructor(cameraSystem, inputManager) {
    /** @private */ this._cameraSystem = cameraSystem;
    /** @private */ this._input = inputManager;
    /** @private */ this._active = false;

    // --- State to restore when leaving director mode ---
    /** @private */ this._previousMode = 'free';
    /** @private */ this._previousCameraMode = 'drone';

    // --- Tab key edge detection ---
    /** @private */ this._tabPressed = false;

    // --- Cinematic key codes ---
    /** @private */ this._cinematicKeys = [
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    ];

    // --- P key edge detection ---
    /** @private */ this._pPressed = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether director mode is currently active.
   * @returns {boolean}
   */
  get active() {
    return this._active;
  }

  /**
   * Toggle director mode on or off.
   */
  toggle() {
    if (this._active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * Enter director mode.
   * Saves the current game mode and switches to 'director' state
   * with a free-fly drone camera.
   */
  activate() {
    this._active = true;

    // Save current state for restoration
    this._previousMode = GameState.mode;
    this._previousCameraMode = this._cameraSystem.getActiveModeName() || 'drone';

    // Switch to director state
    GameState.setMode('director');

    // Default to free-fly camera in director mode
    this._cameraSystem.setMode('drone');

    EventBus.emit('director:activated');
  }

  /**
   * Leave director mode.
   * Restores the previous game mode.
   */
  deactivate() {
    this._active = false;

    // Restore previous game mode (avoid recursive 'director' restore)
    const restoreMode = this._previousMode === 'director' ? 'free' : this._previousMode;
    GameState.setMode(restoreMode);

    EventBus.emit('director:deactivated');
  }

  // ---------------------------------------------------------------------------
  // Update (called every frame via engine.addUpdatable)
  // ---------------------------------------------------------------------------

  /**
   * Per-frame update. Handles Tab toggle and director-mode key bindings.
   * @param {number} delta - seconds since last frame
   */
  update(delta) {
    // --- Tab key toggle (edge-detected) ---
    const tabDown = this._input.isKeyDown('Tab');
    if (tabDown && !this._tabPressed) {
      this.toggle();
    }
    this._tabPressed = tabDown;

    // Only process director-specific keys when active
    if (!this._active) return;

    // --- Number keys 1-6: trigger cinematic presets ---
    for (let i = 0; i < this._cinematicKeys.length; i++) {
      if (this._input.isKeyDown(this._cinematicKeys[i])) {
        // Switch to cinematic camera mode and fire the preset event
        this._cameraSystem.setMode('cinematic');
        EventBus.emit('cinematic:preset', { preset: i + 1 });
        break;
      }
    }

    // --- P key: switch to path camera (edge-detected) ---
    const pDown = this._input.isKeyDown('KeyP');
    if (pDown && !this._pPressed) {
      this._cameraSystem.setMode('path');
    }
    this._pPressed = pDown;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Clean up references. Safe to call multiple times.
   */
  dispose() {
    if (this._active) {
      this.deactivate();
    }
  }
}

export default DirectorMode;
