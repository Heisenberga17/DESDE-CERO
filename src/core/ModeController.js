import EventBus from './EventBus.js';
import GameState from './GameState.js';

/**
 * Central coordinator that manages which systems are active in each mode.
 * Replaces scattered mode-checking logic that was previously in main.js.
 *
 * Valid modes: 'free', 'play', 'drive', 'director'
 */

const MODE_CONFIG = {
  free:     { defaultCam: 'drone',       allowedCams: ['drone', 'orbit', 'cinematic', 'path'] },
  play:     { defaultCam: 'thirdperson', allowedCams: ['thirdperson', 'orbit', 'drone'] },
  drive:    { defaultCam: 'driving',     allowedCams: ['driving', 'orbit', 'drone'] },
  director: { defaultCam: 'drone',       allowedCams: null }, // all cameras
};

class ModeController {
  /**
   * @param {object} params
   * @param {object} params.cameraSystem    — has .setMode(name), .setAllowedModes(names), .getActiveModeName()
   * @param {object|null} params.playerController — has .update(delta), .position, .body; may be null
   * @param {object|null} params.vehicleInteraction — has .update(delta); may be null
   * @param {object} params.director        — DirectorMode with .update(delta), .active, .toggle(), .activate(), .deactivate()
   */
  constructor({ cameraSystem, playerController = null, vehicleInteraction = null, director }) {
    this.cameraSystem = cameraSystem;
    this.playerController = playerController;
    this.vehicleInteraction = vehicleInteraction;
    this.director = director;

    // React to mode changes for camera switching and subsystem notification
    EventBus.on('gamestate:modeChanged', ({ mode }) => {
      const config = MODE_CONFIG[mode];
      if (config) {
        this.cameraSystem.setAllowedModes(config.allowedCams);
        this.cameraSystem.setMode(config.defaultCam);
      }
      // Notify VehicleInteraction of mode changes
      if (this.vehicleInteraction) {
        this.vehicleInteraction.setMode(mode === 'drive' ? 'drive' : 'play');
      }
    });
  }

  /** Set/update the player controller reference (called after async asset loading). */
  setPlayerController(ctrl) {
    this.playerController = ctrl;
  }

  /** Set/update the vehicle interaction reference. */
  setVehicleInteraction(vi) {
    this.vehicleInteraction = vi;
  }

  /** Switch to a new mode. Delegates to GameState which emits the event. */
  enterMode(mode) {
    GameState.setMode(mode);
  }

  /**
   * Called every frame. Updates only the systems relevant to the current mode.
   * @param {number} delta — time since last frame in seconds
   */
  update(delta) {
    const mode = GameState.mode;

    switch (mode) {
      case 'free':
        this.director?.update(delta);
        break;

      case 'play':
        this.playerController?.update(delta);
        this.vehicleInteraction?.update(delta);
        this.director?.update(delta);
        break;

      case 'drive':
        this.vehicleInteraction?.update(delta);
        this.director?.update(delta);
        break;

      case 'director':
        this.director?.update(delta);
        break;
    }
  }
}

export default ModeController;
