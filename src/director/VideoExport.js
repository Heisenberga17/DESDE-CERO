import EventBus from '../core/EventBus.js';

/**
 * Video recording from a canvas element using the MediaRecorder API.
 *
 * Captures the WebGL canvas stream and records it as a WebM video file.
 * When recording stops, the video is automatically downloaded to the user's
 * machine.
 *
 * Usage:
 *   const videoExport = new VideoExport(canvas);
 *   videoExport.start();          // begin recording
 *   // ... some time later ...
 *   videoExport.stop();           // stop and auto-download
 *   // or use toggle():
 *   videoExport.toggle();
 */
class VideoExport {
  /**
   * @param {HTMLCanvasElement} canvas - the WebGL canvas to record
   */
  constructor(canvas) {
    /** @private */ this._canvas = canvas;
    /** @private */ this._recorder = null;
    /** @private */ this._chunks = [];
    /** @private */ this._recording = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether a recording is currently in progress.
   * @returns {boolean}
   */
  get recording() {
    return this._recording;
  }

  /**
   * Start recording the canvas.
   *
   * @param {Object} [options]
   * @param {number} [options.fps=60]          - target frame rate
   * @param {number} [options.bitrate=8000000] - video bitrate in bits/second
   */
  start(options = {}) {
    if (this._recording) {
      console.warn('[VideoExport] Already recording.');
      return;
    }

    const fps = options.fps || 60;
    const bitrate = options.bitrate || 8_000_000;

    // Capture the canvas as a media stream
    const stream = this._canvas.captureStream(fps);

    // Determine a supported MIME type
    const mimeType = this._getSupportedMimeType();

    // Create the MediaRecorder
    this._recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
    });

    this._chunks = [];

    // Collect data chunks as they become available
    this._recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this._chunks.push(e.data);
      }
    };

    // When recording stops, assemble and download the video
    this._recorder.onstop = () => {
      const blob = new Blob(this._chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Trigger browser download
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `desde-cero-${Date.now()}.webm`;
      anchor.click();

      // Clean up the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this._recording = false;
      EventBus.emit('recording:stopped', { blob });
    };

    // Handle errors gracefully
    this._recorder.onerror = (e) => {
      console.error('[VideoExport] Recording error:', e.error);
      this._recording = false;
      EventBus.emit('recording:error', { error: e.error });
    };

    // Start capturing
    this._recorder.start();
    this._recording = true;
    EventBus.emit('recording:started');
  }

  /**
   * Stop the current recording. Triggers auto-download of the video file.
   */
  stop() {
    if (this._recorder && this._recording) {
      this._recorder.stop();
    }
  }

  /**
   * Toggle recording on or off.
   */
  toggle() {
    if (this._recording) {
      this.stop();
    } else {
      this.start();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine a supported MIME type for video recording.
   * Prefers VP9, falls back to VP8, then default WebM.
   * @private
   * @returns {string}
   */
  _getSupportedMimeType() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    // Fallback — let the browser decide
    return '';
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Stop any active recording and clean up.
   */
  dispose() {
    this.stop();
    this._recorder = null;
    this._chunks = [];
  }
}

export default VideoExport;
