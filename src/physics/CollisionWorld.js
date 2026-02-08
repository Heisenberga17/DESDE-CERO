import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Vector3, Sphere } from 'three';

/**
 * Singleton collision world using Three.js Octree.
 * Builds an octree from the city mesh and provides capsule (player)
 * and sphere (vehicle) collision queries.
 *
 * Usage:
 *   import CollisionWorld from './physics/CollisionWorld.js';
 *   CollisionWorld.build(cityScene);         // once after loading
 *   const result = CollisionWorld.capsuleCollision(capsule);
 *   const result = CollisionWorld.sphereCollision(sphere);
 */

class CollisionWorldSingleton {
  constructor() {
    /** @type {Octree|null} */
    this._octree = null;

    /** Whether the octree has been built. */
    this._ready = false;
  }

  /** Whether collision queries will function. */
  get ready() {
    return this._ready;
  }

  /**
   * Build the octree from a scene object (typically the city mesh).
   * Call once after the city GLB is loaded and added to the scene.
   * @param {THREE.Object3D} sceneObject — root of the geometry to collide against
   */
  build(sceneObject) {
    console.log('[CollisionWorld] Building octree...');
    const start = performance.now();

    this._octree = new Octree();
    this._octree.fromGraphNode(sceneObject);

    this._ready = true;
    const elapsed = (performance.now() - start).toFixed(1);
    console.log(`[CollisionWorld] Octree built in ${elapsed}ms`);
  }

  /**
   * Test a capsule against the octree and resolve penetration.
   * Returns { collided, normal, depth } or null if octree not built.
   *
   * @param {Capsule} capsule — the capsule to test (will NOT be modified)
   * @returns {{ collided: boolean, normal: Vector3, depth: number }|null}
   */
  capsuleCollision(capsule) {
    if (!this._ready) return null;

    const result = this._octree.capsuleIntersect(capsule);
    if (result) {
      return {
        collided: true,
        normal: result.normal,
        depth: result.depth,
      };
    }
    return { collided: false, normal: new Vector3(), depth: 0 };
  }

  /**
   * Test a sphere against the octree and resolve penetration.
   * Returns { collided, normal, depth } or null if octree not built.
   *
   * @param {Sphere} sphere — the sphere to test
   * @returns {{ collided: boolean, normal: Vector3, depth: number }|null}
   */
  sphereCollision(sphere) {
    if (!this._ready) return null;

    const result = this._octree.sphereIntersect(sphere);
    if (result) {
      return {
        collided: true,
        normal: result.normal,
        depth: result.depth,
      };
    }
    return { collided: false, normal: new Vector3(), depth: 0 };
  }

  /**
   * Discard the octree and free memory.
   */
  dispose() {
    this._octree = null;
    this._ready = false;
  }
}

const CollisionWorld = new CollisionWorldSingleton();
export default CollisionWorld;
