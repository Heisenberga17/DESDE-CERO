import EventBus from '../core/EventBus.js';
import GameState from '../core/GameState.js';

/**
 * Head-up display: shows the current game mode, contextual controls hint,
 * and player state feedback (speed, jump indicator, interaction prompts).
 *
 * Listens to EventBus for:
 *   - 'gamestate:modeChanged'  -> updates mode label and controls text
 *   - 'player:stateChanged'    -> updates player state indicator
 *   - 'camera:modeChanged'     -> updates camera label
 *
 * Expects the following DOM elements (from index.html):
 *   #hud-camera-mode   - text span for the current camera/mode label
 *   .hud-controls      - text row for contextual key bindings
 *
 * Usage:
 *   const hud = new HUD();
 *   engine.addUpdatable(hud);   // optional, for future animated elements
 */

/** Contextual control hints per game mode. */
const MODE_CONTROLS = {
  free:     'WASD Move \u00B7 Q/E Up/Down \u00B7 Mouse Look \u00B7 Shift Boost \u00B7 C Camera \u00B7 M Models',
  play:     'WASD Move \u00B7 Shift Sprint \u00B7 Space Jump \u00B7 F Enter Vehicle \u00B7 C Camera \u00B7 M Models',
  drive:    'W/S Accel \u00B7 A/D Steer \u00B7 Space Brake \u00B7 Shift Boost \u00B7 F Exit \u00B7 C Camera',
  director: 'WASD+QE Fly \u00B7 Mouse Look \u00B7 Click Select \u00B7 1-6 Cameras \u00B7 G Post-FX \u00B7 Tab Back',
};

class HUD {
  constructor() {
    // --- Cached DOM references ---
    /** @private */ this._modeEl = document.getElementById('hud-camera-mode');
    /** @private */ this._controlsEl = document.querySelector('.hud-controls');

    // --- Player state element (created dynamically if not present) ---
    /** @private */ this._playerStateEl = document.getElementById('hud-player-state');

    // --- Bind event listeners (store references for cleanup) ---
    /** @private */
    this._onModeChanged = ({ mode }) => this._updateMode(mode);
    /** @private */
    this._onPlayerState = ({ state }) => this._updatePlayerState(state);
    /** @private */
    this._onCameraChanged = ({ mode }) => this._updateCameraLabel(mode);

    EventBus.on('gamestate:modeChanged', this._onModeChanged);
    EventBus.on('player:stateChanged', this._onPlayerState);
    EventBus.on('camera:modeChanged', this._onCameraChanged);

    // Initialize display with current state
    this._updateMode(GameState.mode);
  }

  // ---------------------------------------------------------------------------
  // Internal update methods
  // ---------------------------------------------------------------------------

  /**
   * Update the mode label and controls hint when the game mode changes.
   * @param {string} mode
   * @private
   */
  _updateMode(mode) {
    if (this._modeEl) {
      this._modeEl.textContent = mode.toUpperCase();
    }

    if (this._controlsEl) {
      this._controlsEl.textContent = MODE_CONTROLS[mode] || '';
    }
  }

  /**
   * Update the camera label independently of game mode
   * (camera can cycle within the same mode).
   * @param {string} cameraName
   * @private
   */
  _updateCameraLabel(cameraName) {
    if (this._modeEl) {
      this._modeEl.textContent = cameraName.toUpperCase();
    }
  }

  /**
   * React to player locomotion state changes.
   * Can be extended to show speed bars, jump icons, stamina, etc.
   * @param {string} state - 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'falling'
   * @private
   */
  _updatePlayerState(state) {
    if (this._playerStateEl) {
      this._playerStateEl.textContent = state.toUpperCase();
    }
  }

  // ---------------------------------------------------------------------------
  // Updatable interface (for Engine.addUpdatable)
  // ---------------------------------------------------------------------------

  /**
   * Per-frame hook. Currently a no-op; reserved for animated HUD elements
   * (e.g. speed-bar tweening, notification timers).
   * @param {number} _delta
   */
  update(_delta) {
    // Reserved for future animated HUD elements
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose() {
    EventBus.off('gamestate:modeChanged', this._onModeChanged);
    EventBus.off('player:stateChanged', this._onPlayerState);
    EventBus.off('camera:modeChanged', this._onCameraChanged);
  }
}

export default HUD;
