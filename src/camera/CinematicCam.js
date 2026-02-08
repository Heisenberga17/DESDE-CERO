import { Vector3, Euler, MathUtils, Quaternion } from 'three';
import EventBus from '../core/EventBus.js';

/**
 * Cinematic camera with preset shots triggered by number keys 1-6.
 *
 * Implements the CameraSystem mode interface:
 *   - name            (string)
 *   - activate(camera)
 *   - deactivate(camera)
 *   - update(camera, inputManager, delta)
 *
 * Presets:
 *   1 — Dolly Zoom   : camera advances toward target while FOV widens (vertigo)
 *   2 — Crane Shot   : smooth vertical sweep from high to low
 *   3 — Tracking Shot : lateral tracking at fixed distance
 *   4 — Fly-by        : fast sweep past the target
 *   5 — Low Angle     : ground-level hero shot looking up
 *   6 — Dutch Angle   : tilted camera for dramatic tension
 *
 * Usage:
 *   const cinematic = new CinematicCam();
 *   cameraSystem.registerMode(cinematic);
 *   cameraSystem.setMode('cinematic');
 */
class CinematicCam {
  constructor() {
    /** Mode name used by CameraSystem. */
    this.name = 'cinematic';

    // --- Target position that presets orbit around ---
    /** @private */ this._target = new Vector3(0, 0, 0);

    // --- Preset definitions ---
    /** @private */ this._presets = this._buildPresets();

    // --- Animation state ---
    /** @private */ this._playing = false;
    /** @private */ this._elapsed = 0;
    /** @private */ this._duration = 0;
    /** @private */ this._activePreset = null;

    // --- Snapshot of camera state before a preset plays ---
    /** @private */ this._originalFov = 60;
    /** @private */ this._startPos = new Vector3();
    /** @private */ this._endPos = new Vector3();
    /** @private */ this._startLookAt = new Vector3();
    /** @private */ this._endLookAt = new Vector3();
    /** @private */ this._startFov = 60;
    /** @private */ this._endFov = 60;
    /** @private */ this._startRoll = 0;
    /** @private */ this._endRoll = 0;

    // --- Reusable temporaries ---
    /** @private */ this._tempPos = new Vector3();
    /** @private */ this._tempLook = new Vector3();
    /** @private */ this._tempQuat = new Quaternion();
    /** @private */ this._tempEuler = new Euler(0, 0, 0, 'YXZ');

    // --- Key edge detection for number keys ---
    /** @private */ this._prevKeys = new Array(6).fill(false);

    // --- Listen for cinematic:preset events from DirectorMode ---
    /** @private */ this._onPresetEvent = ({ preset }) => {
      this._triggerPreset(preset);
    };
    EventBus.on('cinematic:preset', this._onPresetEvent);
  }

  // ---------------------------------------------------------------------------
  // Preset definitions
  // ---------------------------------------------------------------------------

  /**
   * Build the preset configuration objects.
   * Each preset defines: duration, and a setup function that receives
   * the target position and returns { startPos, endPos, startLookAt, endLookAt,
   * startFov, endFov, startRoll, endRoll }.
   * @private
   * @returns {Object[]}
   */
  _buildPresets() {
    return [
      // 1 — Dolly Zoom (vertigo effect)
      {
        name: 'Dolly Zoom',
        duration: 4.0,
        setup: (target) => ({
          startPos: new Vector3(target.x, target.y + 1.5, target.z + 20),
          endPos:   new Vector3(target.x, target.y + 1.5, target.z + 4),
          startLookAt: target.clone(),
          endLookAt:   target.clone(),
          startFov: 30,
          endFov:   90,
          startRoll: 0,
          endRoll:   0,
        }),
      },
      // 2 — Crane Shot (high to low vertical sweep)
      {
        name: 'Crane Shot',
        duration: 5.0,
        setup: (target) => ({
          startPos: new Vector3(target.x + 8, target.y + 20, target.z + 8),
          endPos:   new Vector3(target.x + 8, target.y + 1, target.z + 8),
          startLookAt: new Vector3(target.x, target.y + 5, target.z),
          endLookAt:   target.clone(),
          startFov: 50,
          endFov:   50,
          startRoll: 0,
          endRoll:   0,
        }),
      },
      // 3 — Tracking Shot (lateral movement at fixed distance)
      {
        name: 'Tracking Shot',
        duration: 4.0,
        setup: (target) => ({
          startPos: new Vector3(target.x - 15, target.y + 2, target.z + 10),
          endPos:   new Vector3(target.x + 15, target.y + 2, target.z + 10),
          startLookAt: target.clone().add(new Vector3(0, 1, 0)),
          endLookAt:   target.clone().add(new Vector3(0, 1, 0)),
          startFov: 55,
          endFov:   55,
          startRoll: 0,
          endRoll:   0,
        }),
      },
      // 4 — Fly-by (fast sweep past the target)
      {
        name: 'Fly-by',
        duration: 2.5,
        setup: (target) => ({
          startPos: new Vector3(target.x - 30, target.y + 5, target.z - 10),
          endPos:   new Vector3(target.x + 30, target.y + 3, target.z + 5),
          startLookAt: target.clone(),
          endLookAt:   target.clone(),
          startFov: 70,
          endFov:   70,
          startRoll: 0,
          endRoll:   0,
        }),
      },
      // 5 — Low Angle (ground-level hero shot looking up)
      {
        name: 'Low Angle',
        duration: 3.5,
        setup: (target) => ({
          startPos: new Vector3(target.x + 5, target.y + 0.3, target.z + 5),
          endPos:   new Vector3(target.x - 5, target.y + 0.3, target.z + 5),
          startLookAt: new Vector3(target.x, target.y + 4, target.z),
          endLookAt:   new Vector3(target.x, target.y + 4, target.z),
          startFov: 40,
          endFov:   40,
          startRoll: 0,
          endRoll:   0,
        }),
      },
      // 6 — Dutch Angle (tilted camera for dramatic tension)
      {
        name: 'Dutch Angle',
        duration: 3.0,
        setup: (target) => ({
          startPos: new Vector3(target.x + 6, target.y + 3, target.z + 6),
          endPos:   new Vector3(target.x + 6, target.y + 3, target.z + 6),
          startLookAt: target.clone().add(new Vector3(0, 1, 0)),
          endLookAt:   target.clone().add(new Vector3(0, 1, 0)),
          startFov: 50,
          endFov:   50,
          startRoll: MathUtils.degToRad(-15),
          endRoll:   MathUtils.degToRad(15),
        }),
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // CameraSystem interface
  // ---------------------------------------------------------------------------

  /**
   * Called when this mode becomes active.
   * @param {THREE.PerspectiveCamera} camera
   */
  activate(camera) {
    this._originalFov = camera.fov;
    this._playing = false;
    this._elapsed = 0;
    this._activePreset = null;
  }

  /**
   * Called when switching away from this mode.
   * Restores the original FOV and resets roll.
   * @param {THREE.PerspectiveCamera} camera
   */
  deactivate(camera) {
    // Restore original FOV
    camera.fov = this._originalFov;
    camera.updateProjectionMatrix();

    // Reset roll (z rotation)
    const euler = this._tempEuler;
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);

    this._playing = false;
    this._activePreset = null;

    // Clean up event listener
    EventBus.off('cinematic:preset', this._onPresetEvent);
  }

  /**
   * Per-frame update driven by CameraSystem.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('../core/InputManager.js').default} inputManager
   * @param {number} delta - seconds since last frame
   */
  update(camera, inputManager, delta) {
    // --- Check for number key presses (edge-detected) ---
    for (let i = 0; i < 6; i++) {
      const code = `Digit${i + 1}`;
      const down = inputManager.isKeyDown(code);
      if (down && !this._prevKeys[i]) {
        this._triggerPreset(i + 1);
      }
      this._prevKeys[i] = down;
    }

    // --- Animate active preset ---
    if (!this._playing || !this._activePreset) return;

    this._elapsed += delta;
    const progress = MathUtils.clamp(this._elapsed / this._duration, 0, 1);

    // Smooth easing using THREE.MathUtils.smoothstep
    const t = MathUtils.smoothstep(progress, 0, 1);

    // Interpolate position
    this._tempPos.lerpVectors(this._startPos, this._endPos, t);
    camera.position.copy(this._tempPos);

    // Interpolate look-at target
    this._tempLook.lerpVectors(this._startLookAt, this._endLookAt, t);
    camera.lookAt(this._tempLook);

    // Interpolate FOV
    const fov = MathUtils.lerp(this._startFov, this._endFov, t);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Interpolate roll (z rotation)
    const roll = MathUtils.lerp(this._startRoll, this._endRoll, t);
    if (Math.abs(roll) > 0.001) {
      const euler = this._tempEuler;
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      euler.z = roll;
      camera.quaternion.setFromEuler(euler);
    }

    // End of animation
    if (progress >= 1) {
      this._playing = false;
      EventBus.emit('cinematic:presetEnded', { preset: this._activePreset.name });
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Trigger a cinematic preset by number (1-6).
   * @private
   * @param {number} presetNumber - 1 through 6
   */
  _triggerPreset(presetNumber) {
    const index = presetNumber - 1;
    if (index < 0 || index >= this._presets.length) return;

    const preset = this._presets[index];
    const params = preset.setup(this._target);

    // Store animation endpoints
    this._startPos.copy(params.startPos);
    this._endPos.copy(params.endPos);
    this._startLookAt.copy(params.startLookAt);
    this._endLookAt.copy(params.endLookAt);
    this._startFov = params.startFov;
    this._endFov = params.endFov;
    this._startRoll = params.startRoll;
    this._endRoll = params.endRoll;

    // Start animation
    this._activePreset = preset;
    this._duration = preset.duration;
    this._elapsed = 0;
    this._playing = true;

    EventBus.emit('cinematic:presetStarted', {
      preset: preset.name,
      number: presetNumber,
    });
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Set the target position that all presets reference.
   * @param {THREE.Vector3} pos
   */
  setTarget(pos) {
    this._target.copy(pos);
  }

  /**
   * Get a copy of the current target.
   * @returns {THREE.Vector3}
   */
  getTarget() {
    return this._target.clone();
  }

  /**
   * Whether a cinematic preset is currently animating.
   * @returns {boolean}
   */
  get isPlaying() {
    return this._playing;
  }
}

export default CinematicCam;
