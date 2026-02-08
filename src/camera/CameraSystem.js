import EventBus from '../core/EventBus.js';

/**
 * Manages camera modes and delegates updates to the active mode.
 * Press C to cycle between registered modes (filtered by allowed list).
 */
class CameraSystem {
  constructor(camera, inputManager) {
    this._camera = camera;
    this._inputManager = inputManager;
    this._modes = new Map();
    this._modeNames = [];
    this._activeIndex = -1;
    this._activeMode = null;

    /**
     * When set, C key only cycles through these mode names.
     * null = all modes allowed (director mode).
     * @type {string[]|null}
     */
    this._allowedModes = null;

    // C key to cycle modes (edge-detected via keydown event)
    this._onKeyDown = (e) => {
      if (e.code === 'KeyC') this.cycleMode();
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  registerMode(mode) {
    this._modes.set(mode.name, mode);
    this._modeNames.push(mode.name);
  }

  /**
   * Restrict which camera modes can be cycled with C key.
   * @param {string[]|null} names — array of allowed mode names, or null for all
   */
  setAllowedModes(names) {
    this._allowedModes = names;
  }

  setMode(name) {
    const mode = this._modes.get(name);
    if (!mode) {
      console.warn(`[CameraSystem] Unknown mode: ${name}`);
      return;
    }
    if (this._activeMode) {
      this._activeMode.deactivate(this._camera);
    }
    this._activeMode = mode;
    this._activeIndex = this._modeNames.indexOf(name);
    mode.activate(this._camera);
    EventBus.emit('camera:modeChanged', { mode: name });
  }

  cycleMode() {
    if (this._modeNames.length === 0) return;

    // Build the list of cyclable modes
    const cyclable = this._allowedModes
      ? this._modeNames.filter((n) => this._allowedModes.includes(n))
      : this._modeNames;

    if (cyclable.length === 0) return;

    // Find current position in the cyclable list
    const currentName = this._activeMode ? this._activeMode.name : null;
    const currentIdx = cyclable.indexOf(currentName);
    const nextIdx = (currentIdx + 1) % cyclable.length;
    this.setMode(cyclable[nextIdx]);
  }

  getActiveModeName() {
    return this._activeMode ? this._activeMode.name : null;
  }

  update(delta) {
    if (this._activeMode) {
      this._activeMode.update(this._camera, this._inputManager, delta);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._activeMode) {
      this._activeMode.deactivate(this._camera);
    }
  }
}

export default CameraSystem;
