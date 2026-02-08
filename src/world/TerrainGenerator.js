import * as THREE from 'three';

/**
 * Flat ground plane with a grid of roads forming city blocks.
 * Ground at Y=0, roads slightly elevated to avoid z-fighting.
 */
class TerrainGenerator {
  constructor(scene) {
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = 'terrain';

    this._createGround();
    this._createRoads();

    scene.add(this._group);
  }

  _createGround() {
    const geometry = new THREE.PlaneGeometry(500, 500);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a5f0b,
      roughness: 0.9,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this._group.add(ground);
  }

  _createRoads() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.1,
    });

    const terrainSize = 500;
    const spacing = 50;    // Road every 50 units
    const roadWidth = 8;
    const roadY = 0.01;    // Slight elevation to prevent z-fighting
    const halfTerrain = terrainSize / 2;

    // Roads along X axis (East-West)
    for (let z = -halfTerrain; z <= halfTerrain; z += spacing) {
      const geo = new THREE.PlaneGeometry(terrainSize, roadWidth);
      const road = new THREE.Mesh(geo, roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, roadY, z);
      road.receiveShadow = true;
      road.name = `road_ew_${z}`;
      this._group.add(road);
    }

    // Roads along Z axis (North-South)
    for (let x = -halfTerrain; x <= halfTerrain; x += spacing) {
      const geo = new THREE.PlaneGeometry(roadWidth, terrainSize);
      const road = new THREE.Mesh(geo, roadMaterial);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, roadY + 0.001, 0); // Tiny extra offset for crossings
      road.receiveShadow = true;
      road.name = `road_ns_${x}`;
      this._group.add(road);
    }
  }

  dispose() {
    this._group.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    this._scene.remove(this._group);
  }
}

export default TerrainGenerator;
