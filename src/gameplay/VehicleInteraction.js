import { Vector3 } from 'three';
import EventBus from '../core/EventBus.js';
import GameState from '../core/GameState.js';
import { VEHICLE_ENTER_DISTANCE, GP_Y } from '../utils/constants.js';

/**
 * Manages proximity-based enter / exit interaction between the player and
 * vehicles in the scene.
 *
 * While in "play" mode the system checks for nearby vehicles each frame and
 * shows a prompt when one is within VEHICLE_ENTER_DISTANCE. Pressing F enters
 * the nearest vehicle (switches to "drive" mode). Pressing F again exits.
 *
 * Usage:
 *   const interaction = new VehicleInteraction(playerCtrl, vehicles, inputManager);
 *   // in game loop:
 *   interaction.update(delta);
 */
class VehicleInteraction {
  /**
   * @param {Object}         playerController — Player controller with `.position` and `._body.container`
   * @param {Vehicle[]}      vehicles         — Array of Vehicle entity instances
   * @param {InputManager}   inputManager     — Input manager instance
   */
  constructor(playerController, vehicles, inputManager) {
    this._player   = playerController;
    this._vehicles = vehicles;        // live array — can be extended via addVehicle()
    this._input    = inputManager;

    /** @type {Vehicle|null} Closest vehicle within interaction range */
    this._nearestVehicle = null;

    /** @type {HTMLElement|null} On-screen prompt element */
    this._promptEl = null;

    // Edge-detection flag so holding F doesn't toggle repeatedly
    this._fPressed = false;

    // Reusable scratch vector for exit offset calculation
    this._exitOffset = new Vector3();

    /** Current operating mode: 'play' or 'drive'. Set by ModeController. */
    this._mode = 'play';

    this._createPrompt();
  }

  // ── UI ──────────────────────────────────────────────────────────────

  /** Create the "Press F to enter vehicle" HUD prompt. */
  _createPrompt() {
    this._promptEl = document.createElement('div');
    this._promptEl.className = 'interaction-prompt';
    this._promptEl.textContent = 'Press F to enter vehicle';
    this._promptEl.style.cssText = [
      'position: fixed',
      'bottom: 80px',
      'left: 50%',
      'transform: translateX(-50%)',
      "font-family: 'Courier New', monospace",
      'font-size: 13px',
      'color: rgba(255,200,100,0.9)',
      'background: rgba(0,0,0,0.55)',
      'padding: 8px 16px',
      'border-radius: 4px',
      'border: 1px solid rgba(255,255,255,0.08)',
      'pointer-events: none',
      'z-index: 15',
      'display: none',
      'backdrop-filter: blur(4px)',
    ].join('; ');
    document.body.appendChild(this._promptEl);
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Register an additional vehicle at runtime (e.g. after spawning).
   * @param {Vehicle} vehicle
   */
  addVehicle(vehicle) {
    this._vehicles.push(vehicle);
  }

  setMode(mode) {
    this._mode = mode;
  }

  /**
   * Per-frame update. Must be called from the main game loop.
   * Handles proximity detection, prompt visibility and enter/exit logic
   * depending on the current mode (set externally by ModeController).
   *
   * @param {number} delta — Frame time in seconds
   */
  update(delta) {
    // F key edge detection (keyboard or gamepad Y button)
    const fDown = this._input.isKeyDown('KeyF');
    const fJustPressed = (fDown && !this._fPressed) || this._input.isButtonJustPressed(GP_Y);
    this._fPressed = fDown;

    if (this._mode === 'play') {
      // Proximity check for nearby vehicles
      this._nearestVehicle = null;
      let minDist = VEHICLE_ENTER_DISTANCE;
      const playerPos = this._player.position;

      for (const v of this._vehicles) {
        const dist = playerPos.distanceTo(v.position);
        if (dist < minDist) {
          minDist = dist;
          this._nearestVehicle = v;
        }
      }

      this._promptEl.style.display = this._nearestVehicle ? 'block' : 'none';

      if (fJustPressed && this._nearestVehicle) {
        this._enterVehicle(this._nearestVehicle);
      }
    } else if (this._mode === 'drive') {
      this._promptEl.style.display = 'none';

      if (GameState.vehicle) {
        GameState.vehicle.drive(this._input, delta);
      }

      if (fJustPressed) {
        this._exitVehicle();
      }
    } else {
      this._promptEl.style.display = 'none';
    }
  }

  // ── Internal transitions ────────────────────────────────────────────

  /**
   * Seat the player inside the given vehicle and switch to drive mode.
   * @param {Vehicle} vehicle
   */
  _enterVehicle(vehicle) {
    vehicle.occupied = true;
    vehicle.driver   = this._player;
    GameState.vehicle = vehicle;
    GameState.setMode('drive');

    // Hide the player model — camera will follow the vehicle instead
    this._player._body.container.visible = false;

    EventBus.emit('vehicle:entered', { vehicle });
  }

  /**
   * Remove the player from the current vehicle and return to play mode.
   * The player is placed to the right side of the vehicle (local +X).
   */
  _exitVehicle() {
    const vehicle = GameState.vehicle;
    if (!vehicle) return;

    // Reset vehicle state
    vehicle.occupied = false;
    vehicle.driver   = null;
    vehicle.speed    = 0;

    // Position the player to the right of the vehicle so they don't overlap
    this._exitOffset.set(3, 0, 0).applyQuaternion(vehicle.mesh.quaternion);
    this._player.position.copy(vehicle.position).add(this._exitOffset);
    this._player.position.y = 0;

    // Show the player model again
    this._player._body.container.visible = true;

    GameState.vehicle = null;
    GameState.setMode('play');

    EventBus.emit('vehicle:exited', { vehicle });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  /** Remove the prompt element from the DOM. */
  dispose() {
    if (this._promptEl && this._promptEl.parentNode) {
      this._promptEl.parentNode.removeChild(this._promptEl);
      this._promptEl = null;
    }
  }
}

export default VehicleInteraction;
