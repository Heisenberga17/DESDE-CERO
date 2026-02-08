import { Group, AnimationMixer, LoopRepeat, LoopOnce } from 'three';
import AnimationState from '../animation/AnimationState.js';
import AnimationManager from '../animation/AnimationManager.js';

/**
 * Character body wrapper that holds a loaded GLB mesh and manages animations.
 *
 * The mesh is parented under an internal `container` Group. PlayerController
 * moves the container while the mesh inside keeps its own animation offsets.
 *
 * Usage:
 *   const body = new CharacterBody(gltf.scene, gltf.animations);
 *   scene.add(body.container);
 *   body.playAction('run');
 *   body.update(delta);
 */
class CharacterBody {
  /**
   * @param {THREE.Object3D} mesh  - Root Object3D from the loaded GLB
   * @param {THREE.AnimationClip[]} animations - Array of AnimationClips from the GLB
   */
  constructor(mesh, animations = []) {
    /**
     * Outer container that PlayerController positions and rotates.
     * The actual mesh is a child so animation root-motion offsets
     * stay local and don't fight the controller.
     */
    this.container = new Group();
    this.container.name = 'player-container';

    this.mesh = mesh;
    this.mesh.name = 'player-character';
    this.container.add(this.mesh);

    // Enable shadow casting/receiving on all child meshes
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // --- Animation ---
    this.mixer = new AnimationMixer(this.mesh);

    /** @type {Map<string, THREE.AnimationAction>} */
    this.actions = {};
    for (const clip of animations) {
      const action = this.mixer.clipAction(clip);
      this.actions[clip.name] = action;
    }

    /** Currently playing action (or null) */
    this.currentAction = null;

    /** Animation state machine for automatic speed-based blending */
    this.animState = new AnimationState(this.mixer);

    /**
     * Approximate character height (meters).
     * Used by the camera to compute the look-at offset above feet.
     */
    this.height = 1.8;
  }

  // ---------------------------------------------------------------------------
  // Animation helpers
  // ---------------------------------------------------------------------------

  /**
   * Cross-fade from the current action to a new one.
   * If the requested action is already playing, this is a no-op.
   * One-shot actions (jump) play once then hold the last frame.
   *
   * @param {string} name     - Clip name stored in this.actions
   * @param {number} fadeTime - Cross-fade duration in seconds (default 0.3)
   */
  playAction(name, fadeTime = 0.3) {
    const next = this.actions[name];
    if (!next) return; // clip not found in this model

    if (this.currentAction === next) return; // already playing

    // Configure loop mode: jump is a one-shot, everything else loops
    if (name === 'jump') {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(LoopRepeat);
      next.clampWhenFinished = false;
    }

    // Cross-fade transition
    next.reset().setEffectiveWeight(1).fadeIn(fadeTime).play();

    if (this.currentAction && this.currentAction !== next) {
      this.currentAction.fadeOut(fadeTime);
    }

    this.currentAction = next;
  }

  /**
   * Register all available clips from AnimationManager into the state machine.
   */
  registerAnimations() {
    const defaultClips = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'dance', 'wave'];
    for (const name of defaultClips) {
      const clip = AnimationManager.getClip(name);
      if (clip) {
        this.animState.registerAction(name, clip);
      }
    }
    // Also register any clips already in this.actions
    for (const [name, action] of Object.entries(this.actions)) {
      if (!this.animState.hasAction(name)) {
        this.animState.registerAction(name, action.getClip());
      }
    }
    // Auto-start idle if available
    if (this.animState.hasAction('idle')) {
      this.animState.setState('idle');
    }
  }

  /**
   * Delegates animation selection to the state machine based on speed.
   * @param {number} speed
   */
  setAnimBySpeed(speed) {
    this.animState.setStateBySpeed(speed);
  }

  /**
   * Hot-swap the avatar mesh at runtime.
   * @param {THREE.Object3D} newMesh
   * @param {THREE.AnimationClip[]} newAnimations
   */
  async swapMesh(newMesh, newAnimations = []) {
    // Stop current animations
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mesh);

    // Remove old mesh from container
    this.container.remove(this.mesh);

    // Dispose old mesh GPU resources
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) mat.dispose();
      }
    });

    // Set new mesh
    this.mesh = newMesh;
    this.mesh.name = 'player-character';
    this.container.add(this.mesh);

    // Enable shadows
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Rebuild mixer and actions
    this.mixer = new AnimationMixer(this.mesh);
    this.animState = new AnimationState(this.mixer);
    this.actions = {};
    this.currentAction = null;

    for (const clip of newAnimations) {
      const action = this.mixer.clipAction(clip);
      this.actions[clip.name] = action;
    }

    // Re-register from AnimationManager
    this.registerAnimations();
  }

  /**
   * Stop all animations immediately.
   */
  stopAll() {
    this.mixer.stopAllAction();
    this.currentAction = null;
  }

  // ---------------------------------------------------------------------------
  // Per-frame
  // ---------------------------------------------------------------------------

  /**
   * Advance the animation mixer.
   * @param {number} delta - Time elapsed since last frame (seconds)
   */
  update(delta) {
    this.mixer.update(delta);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Release all animation resources and remove the container from the scene.
   */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mesh);

    if (this.container.parent) {
      this.container.parent.remove(this.container);
    }

    // Dispose GPU resources on child meshes
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const mat of materials) {
            mat.dispose();
          }
        }
      }
    });
  }
}

export default CharacterBody;
