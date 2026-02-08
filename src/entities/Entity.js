import { Vector3, Euler, Box3 } from 'three';

/**
 * Base class for all scene objects (characters, vehicles, props, environments).
 * Wraps a Three.js Object3D with a consistent interface.
 */
class Entity {
  /**
   * @param {THREE.Object3D} mesh — The root Object3D for this entity
   * @param {string} type — 'character' | 'vehicle' | 'prop' | 'environment'
   * @param {string} name — Display name
   */
  constructor(mesh, type, name) {
    this.mesh = mesh;
    this.type = type;
    this.name = name || mesh.name || type;
    this.mesh.name = this.name;

    this._boundingBox = new Box3();
    this._size = new Vector3();
    this._updateBounds();
  }

  get position() {
    return this.mesh.position;
  }

  get rotation() {
    return this.mesh.rotation;
  }

  get scale() {
    return this.mesh.scale;
  }

  /** Recalculate bounding box. Call after scale changes. */
  _updateBounds() {
    this._boundingBox.setFromObject(this.mesh);
    this._boundingBox.getSize(this._size);
  }

  /** Get world-space bounding box. */
  getBounds() {
    this._boundingBox.setFromObject(this.mesh);
    return this._boundingBox;
  }

  /** Get dimensions (width, height, depth). */
  getSize() {
    this._updateBounds();
    return this._size.clone();
  }

  /** Override in subclasses for per-frame logic. */
  update(delta) {}

  /** Remove from scene and free GPU resources. */
  dispose() {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}

export default Entity;
