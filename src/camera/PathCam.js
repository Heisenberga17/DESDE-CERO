import { Vector3, CatmullRomCurve3, MathUtils } from 'three';
import EventBus from '../core/EventBus.js';

/**
 * Spline-based camera path mode.
 *
 * Implements the CameraSystem mode interface:
 *   - name            (string)
 *   - activate(camera)
 *   - deactivate(camera)
 *   - update(camera, inputManager, delta)
 *
 * The camera follows a CatmullRomCurve3 spline, smoothly interpolating
 * both position and lookAt target along keyframe points.
 *
 * Usage:
 *   const pathCam = new PathCam();
 *   pathCam.setPoints([
 *     { position: new Vector3(0, 5, 20), lookAt: new Vector3(0, 0, 0) },
 *     { position: new Vector3(20, 10, 0), lookAt: new Vector3(0, 0, 0) },
 *     { position: new Vector3(0, 5, -20), lookAt: new Vector3(0, 0, 0) },
 *   ]);
 *   cameraSystem.registerMode(pathCam);
 *   cameraSystem.setMode('path');
 *   pathCam.play();
 */
class PathCam {
  constructor() {
    /** Mode name used by CameraSystem. */
    this.name = 'path';

    // --- Path data ---
    /** @private */ this._positionCurve = null;
    /** @private */ this._lookAtCurve = null;
    /** @private */ this._points = [];       // array of { position: Vector3, lookAt: Vector3 }

    // --- Playback state ---
    /** @private */ this._playing = false;
    /** @private */ this._elapsed = 0;
    /** @private */ this._duration = 8;      // total duration in seconds (adjustable)
    /** @private */ this._loop = false;

    // --- Reusable temporaries ---
    /** @private */ this._tempPos = new Vector3();
    /** @private */ this._tempLook = new Vector3();
  }

  // ---------------------------------------------------------------------------
  // CameraSystem interface
  // ---------------------------------------------------------------------------

  /**
   * Called when this mode becomes active.
   * @param {THREE.PerspectiveCamera} camera
   */
  activate(camera) {
    // Auto-play if a path is defined
    if (this._positionCurve) {
      this.reset();
    }
  }

  /**
   * Called when switching away from this mode.
   * @param {THREE.PerspectiveCamera} camera
   */
  deactivate(_camera) {
    this._playing = false;
  }

  /**
   * Per-frame update driven by CameraSystem.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('../core/InputManager.js').default} inputManager
   * @param {number} delta - seconds since last frame
   */
  update(camera, inputManager, delta) {
    if (!this._playing || !this._positionCurve) return;

    this._elapsed += delta;
    let progress = this._elapsed / this._duration;

    // Handle end of path
    if (progress >= 1) {
      if (this._loop) {
        // Wrap around for looping
        this._elapsed = this._elapsed % this._duration;
        progress = this._elapsed / this._duration;
      } else {
        // Clamp to end and stop
        progress = 1;
        this._playing = false;
        EventBus.emit('path:ended');
      }
    }

    // Use smoothstep for smoother acceleration/deceleration at endpoints
    const t = MathUtils.smoothstep(progress, 0, 1);

    // Get interpolated position along the spline
    this._positionCurve.getPointAt(t, this._tempPos);
    camera.position.copy(this._tempPos);

    // Get interpolated lookAt target along the spline
    if (this._lookAtCurve) {
      this._lookAtCurve.getPointAt(t, this._tempLook);
      camera.lookAt(this._tempLook);
    }
  }

  // ---------------------------------------------------------------------------
  // Path construction
  // ---------------------------------------------------------------------------

  /**
   * Add a single keyframe point to the path.
   * @param {THREE.Vector3} position   - camera position at this keyframe
   * @param {THREE.Vector3} lookTarget - point the camera looks at
   */
  addPoint(position, lookTarget) {
    this._points.push({
      position: position.clone(),
      lookAt: lookTarget.clone(),
    });
    this._rebuildCurves();
  }

  /**
   * Replace the entire path with a new set of points.
   * @param {Array<{ position: THREE.Vector3, lookAt: THREE.Vector3 }>} pointsArray
   */
  setPoints(pointsArray) {
    this._points = pointsArray.map((p) => ({
      position: p.position.clone(),
      lookAt: p.lookAt.clone(),
    }));
    this._rebuildCurves();
  }

  /**
   * Remove all keyframe points and clear the path.
   */
  clearPoints() {
    this._points = [];
    this._positionCurve = null;
    this._lookAtCurve = null;
    this._playing = false;
  }

  /**
   * Rebuild the CatmullRom spline curves from the current points array.
   * Requires at least 2 points to form a valid curve.
   * @private
   */
  _rebuildCurves() {
    if (this._points.length < 2) {
      this._positionCurve = null;
      this._lookAtCurve = null;
      return;
    }

    const positions = this._points.map((p) => p.position.clone());
    const lookAts = this._points.map((p) => p.lookAt.clone());

    // CatmullRomCurve3: closed = false, curveType = 'centripetal', tension = 0.5
    this._positionCurve = new CatmullRomCurve3(positions, false, 'centripetal', 0.5);
    this._lookAtCurve = new CatmullRomCurve3(lookAts, false, 'centripetal', 0.5);

    EventBus.emit('path:updated', { pointCount: this._points.length });
  }

  // ---------------------------------------------------------------------------
  // Playback controls
  // ---------------------------------------------------------------------------

  /**
   * Start or resume playback.
   */
  play() {
    if (!this._positionCurve) {
      console.warn('[PathCam] No path defined. Use addPoint() or setPoints() first.');
      return;
    }
    this._playing = true;
    EventBus.emit('path:playing');
  }

  /**
   * Pause playback at the current position.
   */
  pause() {
    this._playing = false;
    EventBus.emit('path:paused');
  }

  /**
   * Reset playback to the beginning (does not auto-play).
   */
  reset() {
    this._elapsed = 0;
    this._playing = false;
    EventBus.emit('path:reset');
  }

  /**
   * Toggle between play and pause.
   */
  togglePlayPause() {
    if (this._playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Set the total duration of the path animation in seconds.
   * @param {number} seconds
   */
  setDuration(seconds) {
    this._duration = Math.max(0.1, seconds);
  }

  /**
   * Get the current duration.
   * @returns {number}
   */
  get duration() {
    return this._duration;
  }

  /**
   * Enable or disable looping.
   * @param {boolean} loop
   */
  setLoop(loop) {
    this._loop = loop;
  }

  /**
   * Whether the path is currently playing.
   * @returns {boolean}
   */
  get isPlaying() {
    return this._playing;
  }

  /**
   * Current progress as a value between 0 and 1.
   * @returns {number}
   */
  get progress() {
    if (this._duration <= 0) return 0;
    return MathUtils.clamp(this._elapsed / this._duration, 0, 1);
  }

  /**
   * Number of keyframe points in the current path.
   * @returns {number}
   */
  get pointCount() {
    return this._points.length;
  }
}

export default PathCam;
