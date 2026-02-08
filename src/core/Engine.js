import * as THREE from 'three';
import InputManager from './InputManager.js';
import EventBus from './EventBus.js';

/**
 * Core engine: renderer, scene, camera, clock, and game loop.
 */
class Engine {
  constructor(canvas) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 50, 100);

    // Clock
    this._clock = new THREE.Clock();

    // Input
    this.input = new InputManager(canvas);

    // Subsystems
    this._updateables = [];

    // Stats (optional)
    this._stats = null;

    // Post-processing (optional — set via setPostProcessing)
    this._postProcessing = null;

    // Resize
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  /** Register any object with an update(delta) method. */
  addUpdatable(system) {
    this._updateables.push(system);
  }

  /** Attach Stats.js instance for FPS monitoring. */
  setStats(stats) {
    this._stats = stats;
  }

  /** Attach post-processing pipeline. When set, replaces default render call. */
  setPostProcessing(pp) {
    this._postProcessing = pp;
  }

  /** Start the render loop. */
  start() {
    EventBus.emit('engine:ready', {});
    this.renderer.setAnimationLoop(this._gameLoop.bind(this));
  }

  _gameLoop() {
    const delta = this._clock.getDelta();
    if (this._stats) this._stats.begin();

    for (const system of this._updateables) {
      system.update(delta);
    }

    if (this._postProcessing) {
      this._postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    if (this._stats) this._stats.end();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}

export default Engine;
