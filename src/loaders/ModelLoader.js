import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import EventBus from '../core/EventBus.js';

/**
 * Generic GLB/GLTF loader with Draco support, caching, and progress events.
 *
 * Events emitted:
 *   model:loading  { url, progress }   — progress 0..1
 *   model:loaded   { url, gltf }       — load complete
 *   model:error    { url, error }      — load failed
 */
class ModelLoader {
  constructor() {
    this._cache = new Map();

    // DRACO decoder from CDN
    this._dracoLoader = new DRACOLoader();
    this._dracoLoader.setDecoderPath(
      'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/'
    );

    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._dracoLoader);
  }

  /**
   * Load a GLB/GLTF from URL. Returns cached result if available.
   * @param {string} url — URL or object URL (from File)
   * @returns {Promise<{scene, animations, mixer}>}
   */
  load(url) {
    if (this._cache.has(url)) {
      const cached = this._cache.get(url);
      // Clone the scene so each instance is independent
      const clone = cached.scene.clone(true);
      return Promise.resolve({
        scene: clone,
        animations: cached.animations,
      });
    }

    return new Promise((resolve, reject) => {
      this._gltfLoader.load(
        url,
        (gltf) => {
          // Enable shadows on all meshes
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const result = {
            scene: gltf.scene,
            animations: gltf.animations || [],
          };

          this._cache.set(url, result);
          EventBus.emit('model:loaded', { url, gltf: result });
          resolve({
            scene: gltf.scene.clone(true),
            animations: result.animations,
          });
        },
        (progress) => {
          const pct = progress.total > 0 ? progress.loaded / progress.total : 0;
          EventBus.emit('model:loading', { url, progress: pct });
        },
        (error) => {
          EventBus.emit('model:error', { url, error });
          reject(error);
        }
      );
    });
  }

  /**
   * Load a GLB from a local File object (drag-and-drop or file input).
   * Creates an object URL, loads via GLTFLoader, then revokes.
   * @param {File} file
   * @returns {Promise<{scene, animations}>}
   */
  loadFile(file) {
    const objectUrl = URL.createObjectURL(file);
    return this.load(objectUrl).finally(() => {
      // Don't revoke immediately — Three.js may still need textures
      // Revoke after a short delay
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    });
  }

  clearCache() {
    this._cache.clear();
  }

  dispose() {
    this._dracoLoader.dispose();
    this._cache.clear();
  }
}

// Singleton
export default new ModelLoader();
