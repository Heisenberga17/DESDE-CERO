import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import EventBus from '../core/EventBus.js';

/**
 * Post-processing effects manager.
 *
 * Manages an EffectComposer pipeline with the following passes:
 *   1. RenderPass   — standard scene render
 *   2. SAOPass      — scalable ambient occlusion
 *   3. UnrealBloom  — soft glow / bloom effect
 *   4. Vignette     — darkened edges (custom shader)
 *   5. SMAAPass     — subpixel morphological anti-aliasing
 *   6. OutputPass   — tone-mapping / colour-space output
 *
 * Toggle all effects on/off with the G key.
 *
 * When enabled, call `postProcessing.render()` instead of `renderer.render()`.
 * When disabled, `render()` falls back to a standard renderer pass.
 *
 * Usage:
 *   const pp = new PostProcessing(engine.renderer, engine.scene, engine.camera);
 *   // In your render loop, replace renderer.render() with:
 *   pp.render();
 */
class PostProcessing {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(renderer, scene, camera) {
    /** Whether post-processing is active. Toggle with G key. */
    this.enabled = false;

    /** @private */ this._renderer = renderer;
    /** @private */ this._scene = scene;
    /** @private */ this._camera = camera;

    // --- Effect Composer ---
    /** @private */
    this._composer = new EffectComposer(renderer);

    // --- Pass 1: Render pass ---
    /** @private */
    this._renderPass = new RenderPass(scene, camera);
    this._composer.addPass(this._renderPass);

    // --- Pass 2: SAO (Scalable Ambient Occlusion) ---
    /** @private */
    this._sao = new SAOPass(scene, camera);
    this._sao.params.saoBias = 0.5;
    this._sao.params.saoIntensity = 0.02;
    this._sao.params.saoScale = 4;
    this._sao.params.saoKernelRadius = 30;
    this._sao.params.saoMinResolution = 0;
    this._composer.addPass(this._sao);

    // --- Pass 3: Unreal Bloom ---
    /** @private */
    this._bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,   // strength — subtle glow
      0.4,   // radius
      0.85   // threshold — only bright areas bloom
    );
    this._composer.addPass(this._bloom);

    // --- Pass 4: Vignette (custom shader) ---
    /** @private */
    this._vignette = new ShaderPass({
      uniforms: {
        tDiffuse:  { value: null },
        offset:    { value: 1.0 },
        darkness:  { value: 0.8 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
          gl_FragColor = vec4(
            mix(texel.rgb, vec3(1.0 - darkness), dot(uv, uv)),
            texel.a
          );
        }
      `,
    });
    this._composer.addPass(this._vignette);

    // --- Pass 5: SMAA anti-aliasing ---
    /** @private */
    this._smaa = new SMAAPass(window.innerWidth, window.innerHeight);
    this._composer.addPass(this._smaa);

    // --- Pass 6: Output (tone-mapping / colour-space) ---
    /** @private */
    this._output = new OutputPass();
    this._composer.addPass(this._output);

    // --- G key toggle ---
    /** @private */
    this._onKeyDown = (e) => {
      if (e.code === 'KeyG') {
        this.enabled = !this.enabled;
        EventBus.emit('postprocessing:toggled', { enabled: this.enabled });
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    // --- Resize handler ---
    /** @private */
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this._composer.setSize(w, h);
      this._smaa.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Render the scene. When post-processing is enabled, uses the EffectComposer;
   * otherwise falls back to a standard renderer pass.
   */
  render() {
    if (this.enabled) {
      this._composer.render();
    } else {
      this._renderer.render(this._scene, this._camera);
    }
  }

  // ---------------------------------------------------------------------------
  // Effect controls
  // ---------------------------------------------------------------------------

  /**
   * Set bloom intensity.
   * @param {number} v - strength value (0 = off, ~0.3 = subtle, 1+ = strong)
   */
  setBloomStrength(v) {
    this._bloom.strength = v;
  }

  /**
   * Get the current bloom strength.
   * @returns {number}
   */
  getBloomStrength() {
    return this._bloom.strength;
  }

  /**
   * Set the luminance threshold above which bloom is applied.
   * @param {number} v - threshold (0-1)
   */
  setBloomThreshold(v) {
    this._bloom.threshold = v;
  }

  /**
   * Set the bloom blur radius.
   * @param {number} v
   */
  setBloomRadius(v) {
    this._bloom.radius = v;
  }

  /**
   * Set vignette darkness.
   * @param {number} v - darkness value (0 = none, 1.2 = default, 2+ = heavy)
   */
  setVignetteDarkness(v) {
    this._vignette.uniforms.darkness.value = v;
  }

  /**
   * Set vignette offset (controls how far from center the darkening starts).
   * @param {number} v
   */
  setVignetteOffset(v) {
    this._vignette.uniforms.offset.value = v;
  }

  /**
   * Set SAO intensity.
   * @param {number} v
   */
  setSAOIntensity(v) {
    this._sao.params.saoIntensity = v;
  }

  /**
   * Set SAO scale.
   * @param {number} v
   */
  setSAOScale(v) {
    this._sao.params.saoScale = v;
  }

  // ---------------------------------------------------------------------------
  // Camera update
  // ---------------------------------------------------------------------------

  /**
   * Update the render pass camera reference. Call this if the active camera
   * changes (e.g., switching between perspective cameras).
   * @param {THREE.Camera} camera
   */
  setCamera(camera) {
    this._camera = camera;
    this._renderPass.camera = camera;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove all event listeners and dispose of GPU resources.
   */
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);

    // Dispose each pass
    this._bloom.dispose();
    this._composer.passes.forEach((pass) => {
      if (pass.dispose) pass.dispose();
    });
  }
}

export default PostProcessing;
