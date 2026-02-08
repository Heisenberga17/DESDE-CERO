import EventBus from '../core/EventBus.js';

/**
 * Registry for all active entities in the scene.
 *
 * Provides fast type-based lookups and spatial queries (nearest, within
 * radius). Entities can be added directly or via the 'entity:added' event.
 *
 * Exported as a singleton -- one shared registry for the whole application.
 *
 * Events listened:
 *   entity:added   { entity }  -- auto-registers the entity
 *   entity:removed { entity }  -- auto-unregisters the entity
 */
class EntityManager {
  constructor() {
    /** @type {Entity[]} */
    this._entities = [];

    /** @type {Map<string, Entity[]>} type -> Entity[] */
    this._byType = new Map();

    // Auto-register / unregister via EventBus
    this._onAdded = ({ entity }) => this.add(entity);
    this._onRemoved = ({ entity }) => this.remove(entity);
    EventBus.on('entity:added', this._onAdded);
    EventBus.on('entity:removed', this._onRemoved);
  }

  /* -----------------------------------------------------------
   * Registration
   * --------------------------------------------------------- */

  /**
   * Add an entity to the registry.
   * Duplicate adds are silently ignored.
   *
   * @param {Entity} entity
   */
  add(entity) {
    if (this._entities.indexOf(entity) !== -1) return;

    this._entities.push(entity);

    const type = entity.type;
    if (!this._byType.has(type)) this._byType.set(type, []);
    this._byType.get(type).push(entity);
  }

  /**
   * Remove an entity from the registry.
   *
   * @param {Entity} entity
   */
  remove(entity) {
    const idx = this._entities.indexOf(entity);
    if (idx !== -1) this._entities.splice(idx, 1);

    const typeArr = this._byType.get(entity.type);
    if (typeArr) {
      const tidx = typeArr.indexOf(entity);
      if (tidx !== -1) typeArr.splice(tidx, 1);
    }
  }

  /* -----------------------------------------------------------
   * Queries
   * --------------------------------------------------------- */

  /**
   * Get all entities of a specific type.
   * @param {string} type -- e.g. 'character', 'prop', 'vehicle'
   * @returns {Entity[]}
   */
  getByType(type) {
    return this._byType.get(type) || [];
  }

  /**
   * Get every registered entity.
   * @returns {Entity[]}
   */
  getAll() {
    return this._entities;
  }

  /**
   * @returns {number} Total entity count.
   */
  get count() {
    return this._entities.length;
  }

  /* -----------------------------------------------------------
   * Spatial queries
   * --------------------------------------------------------- */

  /**
   * Find all entities within `radius` of `position`.
   *
   * @param {THREE.Vector3} position -- Centre of search sphere
   * @param {number}        radius   -- Search radius (world units)
   * @param {string|null}   [type]   -- Optional type filter
   * @returns {Entity[]}
   */
  findNearby(position, radius, type = null) {
    const radiusSq = radius * radius;
    const source = type ? (this._byType.get(type) || []) : this._entities;
    return source.filter(
      (e) => e.position.distanceToSquared(position) < radiusSq
    );
  }

  /**
   * Find the single closest entity to `position`.
   *
   * @param {THREE.Vector3} position
   * @param {string|null}   [type] -- Optional type filter
   * @returns {Entity|null}
   */
  findNearest(position, type = null) {
    const source = type ? (this._byType.get(type) || []) : this._entities;
    let nearest = null;
    let minDist = Infinity;

    for (const e of source) {
      const d = e.position.distanceToSquared(position);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  /* -----------------------------------------------------------
   * Frame update
   * --------------------------------------------------------- */

  /**
   * Tick every registered entity.
   * @param {number} delta -- Seconds since last frame
   */
  update(delta) {
    for (const entity of this._entities) {
      entity.update(delta);
    }
  }

  /* -----------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------- */

  /**
   * Dispose every entity and clear the registry.
   */
  dispose() {
    for (const entity of this._entities) {
      entity.dispose();
    }
    this._entities = [];
    this._byType.clear();

    EventBus.off('entity:added', this._onAdded);
    EventBus.off('entity:removed', this._onRemoved);
  }
}

export default new EntityManager();
