import { AnimationClip } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import EventBus from '../core/EventBus.js';

/**
 * Central animation clip registry.
 *
 * Loads, caches, and distributes AnimationClips that can be applied to any
 * character via an AnimationMixer. Supports both FBX (Mixamo) and GLB sources.
 *
 * Exported as a singleton -- every import shares the same clip cache.
 *
 * Events emitted:
 *   animation:loaded  { name, clip }   -- clip registered successfully
 *   animation:error   { name, error }  -- clip failed to load
 */
class AnimationManager {
  constructor() {
    /** @type {Map<string, THREE.AnimationClip>} */
    this._clips = new Map();
    this._fbxLoader = new FBXLoader();
  }

  /* -----------------------------------------------------------
   * Loading
   * --------------------------------------------------------- */

  /**
   * Load an animation clip from an FBX file (Mixamo format).
   * The first animation found in the file is cached under `name`.
   *
   * @param {string} name  -- Unique key for the clip (e.g. 'walk', 'idle')
   * @param {string} url   -- Path or URL to the .fbx file
   * @returns {Promise<THREE.AnimationClip>}
   */
  async loadClip(name, url) {
    if (this._clips.has(name)) return this._clips.get(name);

    return new Promise((resolve, reject) => {
      this._fbxLoader.load(
        url,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0];
            clip.name = name;
            this._clips.set(name, clip);
            EventBus.emit('animation:loaded', { name, clip });
            resolve(clip);
          } else {
            const err = new Error(`No animations found in ${url}`);
            EventBus.emit('animation:error', { name, error: err });
            reject(err);
          }
        },
        undefined,
        (error) => {
          EventBus.emit('animation:error', { name, error });
          reject(error);
        }
      );
    });
  }

  /**
   * Load an animation clip from a GLB/GLTF file via ModelLoader.
   * Uses the project's shared ModelLoader singleton so Draco & caching
   * stay consistent.
   *
   * @param {string} name  -- Unique key for the clip
   * @param {string} url   -- Path or URL to the .glb/.gltf file
   * @returns {Promise<THREE.AnimationClip>}
   */
  async loadClipFromGLB(name, url) {
    if (this._clips.has(name)) return this._clips.get(name);

    const ModelLoader = (await import('../loaders/ModelLoader.js')).default;
    const result = await ModelLoader.load(url);

    if (result.animations.length > 0) {
      const clip = result.animations[0];
      clip.name = name;
      this._clips.set(name, clip);
      EventBus.emit('animation:loaded', { name, clip });
      return clip;
    }

    const err = new Error(`No animations found in ${url}`);
    EventBus.emit('animation:error', { name, error: err });
    throw err;
  }

  /**
   * Register a clip that was already loaded elsewhere (e.g. embedded in a
   * character model).
   *
   * @param {string} name
   * @param {THREE.AnimationClip} clip
   */
  registerClip(name, clip) {
    clip.name = name;
    this._clips.set(name, clip);
  }

  /* -----------------------------------------------------------
   * Queries
   * --------------------------------------------------------- */

  /**
   * Retrieve a cached clip by name.
   * @param {string} name
   * @returns {THREE.AnimationClip|null}
   */
  getClip(name) {
    return this._clips.get(name) || null;
  }

  /**
   * @returns {string[]} All registered clip names.
   */
  getAllClipNames() {
    return Array.from(this._clips.keys());
  }

  /**
   * Check whether a clip with the given name exists in the cache.
   * @param {string} name
   * @returns {boolean}
   */
  hasClip(name) {
    return this._clips.has(name);
  }

  /* -----------------------------------------------------------
   * Playback helpers
   * --------------------------------------------------------- */

  /**
   * Create an AnimationAction on the supplied mixer from a cached clip.
   *
   * @param {THREE.AnimationMixer} mixer
   * @param {string} clipName
   * @returns {THREE.AnimationAction|null}
   */
  createAction(mixer, clipName) {
    const clip = this._clips.get(clipName);
    if (!clip) return null;
    return mixer.clipAction(clip);
  }

  /* -----------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------- */

  dispose() {
    this._clips.clear();
  }
}

export default new AnimationManager();
