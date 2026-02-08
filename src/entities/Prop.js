import { AnimationMixer } from 'three';
import Entity from './Entity.js';

/**
 * Static or animated world object (buildings, trees, props).
 * If the GLB contains animations, they auto-play.
 */
class Prop extends Entity {
  /**
   * @param {THREE.Object3D} mesh
   * @param {THREE.AnimationClip[]} animations
   * @param {string} name
   */
  constructor(mesh, animations = [], name = 'prop') {
    super(mesh, 'prop', name);
    this._mixer = null;

    if (animations.length > 0) {
      this._mixer = new AnimationMixer(mesh);
      // Play all animations by default
      for (const clip of animations) {
        this._mixer.clipAction(clip).play();
      }
    }
  }

  update(delta) {
    if (this._mixer) {
      this._mixer.update(delta);
    }
  }

  dispose() {
    if (this._mixer) {
      this._mixer.stopAllAction();
      this._mixer = null;
    }
    super.dispose();
  }
}

export default Prop;
