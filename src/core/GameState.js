import EventBus from './EventBus.js';

/**
 * Global game state singleton.
 * Tracks the current mode, player/vehicle references, time of day, and pause state.
 */

const VALID_MODES = ['free', 'play', 'drive', 'director'];

class GameState {
  constructor() {
    this.mode = 'free';
    this.player = null;
    this.vehicle = null;
    this.timeOfDay = 17.5; // hours (0-24)
    this.paused = false;
  }

  setMode(mode) {
    if (!VALID_MODES.includes(mode)) {
      console.warn(`[GameState] Invalid mode: "${mode}". Valid modes: ${VALID_MODES.join(', ')}`);
      return;
    }
    const previous = this.mode;
    this.mode = mode;
    EventBus.emit('gamestate:modeChanged', { mode, previous });
  }

  getMode() {
    return this.mode;
  }

  setPaused(paused) {
    this.paused = paused;
    EventBus.emit('gamestate:paused', { paused });
  }

  isPaused() {
    return this.paused;
  }
}

export default new GameState();
