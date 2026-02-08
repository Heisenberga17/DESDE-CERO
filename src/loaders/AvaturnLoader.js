import ModelLoader from './ModelLoader.js';

const HUMANOID_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2',
  'Head', 'Neck',
  'LeftUpLeg', 'RightUpLeg',
  'LeftLeg', 'RightLeg',
  'LeftFoot', 'RightFoot',
  'LeftArm', 'RightArm',
  'LeftForeArm', 'RightForeArm',
  'LeftHand', 'RightHand',
];

class AvaturnLoader {

  /**
   * Load an Avaturn avatar GLB and return a structured result.
   * @param {string} url
   * @returns {Promise<{ mesh, skeleton, morphTargets, animations, bones }>}
   */
  static async load(url) {
    const gltf = await ModelLoader.load(url);
    const mesh = gltf.scene;
    const animations = gltf.animations || [];

    let skeleton = null;
    const morphTargets = [];

    mesh.traverse((child) => {
      if (child.isSkinnedMesh) {
        // Grab the first skeleton found
        if (!skeleton && child.skeleton) {
          skeleton = child.skeleton;
        }

        // Collect morph target info
        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          morphTargets.push({
            mesh: child,
            names: Object.keys(child.morphTargetDictionary),
            influences: child.morphTargetInfluences,
          });
        }
      }
    });

    const bones = skeleton
      ? skeleton.bones.map((b) => b.name)
      : [];

    return { mesh, skeleton, morphTargets, animations, bones };
  }

  /**
   * Returns true if the skeleton uses standard humanoid bone names
   * (not prefixed with mixamorig:).
   * @param {THREE.Skeleton} skeleton
   * @returns {boolean}
   */
  static isAvaturnSkeleton(skeleton) {
    if (!skeleton || !skeleton.bones) return false;

    const boneNames = skeleton.bones.map((b) => b.name);
    let matches = 0;

    for (const name of HUMANOID_BONES) {
      if (boneNames.includes(name)) {
        matches++;
      }
    }

    return matches >= 3;
  }

  /**
   * Traverse the mesh and return an array of all bone names
   * found in any skeleton.
   * @param {THREE.Object3D} mesh
   * @returns {string[]}
   */
  static getBoneNames(mesh) {
    const names = [];

    mesh.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        for (const bone of child.skeleton.bones) {
          if (!names.includes(bone.name)) {
            names.push(bone.name);
          }
        }
      }
    });

    return names;
  }

  /**
   * Traverse the mesh and collect all morph target names from
   * SkinnedMeshes into a flat array.
   * @param {THREE.Object3D} mesh
   * @returns {string[]}
   */
  static getMorphTargetNames(mesh) {
    const names = [];

    mesh.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        for (const name of Object.keys(child.morphTargetDictionary)) {
          if (!names.includes(name)) {
            names.push(name);
          }
        }
      }
    });

    return names;
  }

  /**
   * Enable castShadow and receiveShadow on all child meshes.
   * @param {THREE.Object3D} mesh
   */
  static configureShadows(mesh) {
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
}

export default AvaturnLoader;
