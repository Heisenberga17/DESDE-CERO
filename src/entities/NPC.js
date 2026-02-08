import { AnimationMixer, Vector3 } from 'three';
import Entity from './Entity.js';
import AnimationManager from '../animation/AnimationManager.js';

/**
 * NPC entity with built-in locomotion behaviours and animation playback.
 *
 * Supported behaviours:
 *   idle   -- stand still, play the "idle" clip
 *   wander -- pick random points within a radius and walk between them
 *   patrol -- follow an ordered list of waypoints in a loop
 *
 * Animation clips are resolved in two stages:
 *   1. Clips embedded in the loaded model (passed via constructor).
 *   2. Shared clips registered in the global AnimationManager.
 */
class NPC extends Entity {
  /**
   * @param {THREE.Object3D}       mesh       -- Root Object3D for this NPC
   * @param {THREE.AnimationClip[]} animations -- Clips bundled with the model
   * @param {string}               [name]     -- Display name
   */
  constructor(mesh, animations = [], name = 'NPC') {
    super(mesh, 'character', name);

    // ---- Animation state ----
    this.mixer = new AnimationMixer(mesh);
    /** @type {Object.<string, THREE.AnimationAction>} */
    this.actions = {};
    /** @type {THREE.AnimationAction|null} */
    this.currentAction = null;

    // Cache actions for every clip that shipped with the model
    for (const clip of animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }

    // ---- Behaviour state ----
    /** @type {'idle'|'wander'|'patrol'} */
    this._behavior = 'idle';

    this._speed = 2;              // units per second (slow walk)
    this._wanderRadius = 30;
    this._wanderCenter = mesh.position.clone();
    this._targetPoint = new Vector3();

    this._waitTimer = 0;
    this._waitDuration = 3;       // base seconds to pause at each stop
    this._isWaiting = true;

    /** @type {THREE.Vector3[]|null} */
    this._waypoints = null;
    this._waypointIndex = 0;

    // Begin in idle
    this.playAction('idle');
  }

  /* -----------------------------------------------------------
   * Animation helpers
   * --------------------------------------------------------- */

  /**
   * Cross-fade to the named animation.
   * Checks local actions first, then falls back to the global
   * AnimationManager clip cache.
   *
   * @param {string} name      -- Clip name (e.g. 'idle', 'walk', 'run')
   * @param {number} [fadeTime] -- Cross-fade duration in seconds
   */
  playAction(name, fadeTime = 0.3) {
    // Resolve action: local cache -> AnimationManager
    let action = this.actions[name];
    if (!action) {
      action = AnimationManager.createAction(this.mixer, name);
      if (action) this.actions[name] = action;
    }
    if (!action) return;

    // Already playing -- nothing to do
    if (this.currentAction === action) return;

    // Cross-fade
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeTime);
    }
    action.reset().fadeIn(fadeTime).play();
    this.currentAction = action;
  }

  /* -----------------------------------------------------------
   * Behaviour API
   * --------------------------------------------------------- */

  /**
   * Switch the NPC's locomotion behaviour.
   * @param {'idle'|'wander'|'patrol'} behavior
   */
  setBehavior(behavior) {
    this._behavior = behavior;

    if (behavior === 'idle') {
      this._isWaiting = true;
      this.playAction('idle');
    } else if (behavior === 'wander') {
      this._pickWanderTarget();
    }
    // patrol relies on setWaypoints having been called first
  }

  /**
   * Assign an ordered list of world-space points and start patrolling.
   * @param {THREE.Vector3[]} points
   */
  setWaypoints(points) {
    this._waypoints = points;
    this._waypointIndex = 0;
    this._isWaiting = false;
    this._behavior = 'patrol';
    this.playAction('walk');
  }

  /**
   * Set movement speed in world units per second.
   * @param {number} speed
   */
  setSpeed(speed) {
    this._speed = speed;
  }

  /**
   * Set the maximum distance from center for wander behaviour.
   * @param {number} radius
   */
  setWanderRadius(radius) {
    this._wanderRadius = radius;
  }

  /* -----------------------------------------------------------
   * Internal: wander logic
   * --------------------------------------------------------- */

  /** @private Pick a random point within the wander radius. */
  _pickWanderTarget() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this._wanderRadius;
    this._targetPoint.set(
      this._wanderCenter.x + Math.cos(angle) * dist,
      0,
      this._wanderCenter.z + Math.sin(angle) * dist
    );
    this._isWaiting = false;
    this.playAction('walk');
  }

  /** @private */
  _updateWander(delta) {
    if (this._isWaiting) {
      this._waitTimer -= delta;
      if (this._waitTimer <= 0) {
        this._pickWanderTarget();
      }
      return;
    }

    this._moveToward(this._targetPoint, delta, () => {
      this._isWaiting = true;
      this._waitTimer = this._waitDuration * (0.5 + Math.random());
      this.playAction('idle');
    });
  }

  /* -----------------------------------------------------------
   * Internal: patrol logic
   * --------------------------------------------------------- */

  /** @private */
  _updatePatrol(delta) {
    if (!this._waypoints || this._waypoints.length === 0) return;

    if (this._isWaiting) {
      this._waitTimer -= delta;
      if (this._waitTimer <= 0) {
        this._isWaiting = false;
        this._waypointIndex =
          (this._waypointIndex + 1) % this._waypoints.length;
        this.playAction('walk');
      }
      return;
    }

    const target = this._waypoints[this._waypointIndex];
    this._moveToward(target, delta, () => {
      this._isWaiting = true;
      this._waitTimer = this._waitDuration;
      this.playAction('idle');
    });
  }

  /* -----------------------------------------------------------
   * Internal: shared movement
   * --------------------------------------------------------- */

  /**
   * Move the NPC toward `target`. When within arrival threshold, call
   * `onArrive`. Also rotates the mesh to face the movement direction.
   *
   * @private
   * @param {THREE.Vector3} target
   * @param {number}        delta
   * @param {Function}      onArrive
   */
  _moveToward(target, delta, onArrive) {
    const pos = this.mesh.position;
    const dir = _dir.subVectors(target, pos);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
      onArrive();
      return;
    }

    dir.normalize();
    pos.addScaledVector(dir, this._speed * delta);

    // Face movement direction
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /* -----------------------------------------------------------
   * Frame update
   * --------------------------------------------------------- */

  /** @override */
  update(delta) {
    // Advance animation mixer
    this.mixer.update(delta);

    // Execute active behaviour
    if (this._behavior === 'wander') {
      this._updateWander(delta);
    } else if (this._behavior === 'patrol') {
      this._updatePatrol(delta);
    }
  }

  /* -----------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------- */

  /** @override */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mesh);
    super.dispose();
  }
}

// Shared Vector3 to avoid per-frame allocations in _moveToward
const _dir = new Vector3();

export default NPC;
