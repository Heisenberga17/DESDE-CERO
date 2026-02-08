import * as THREE from 'three';

const BONE_MAP = {
  'mixamorig:Hips': 'Hips',
  'mixamorig:Spine': 'Spine',
  'mixamorig:Spine1': 'Spine1',
  'mixamorig:Spine2': 'Spine2',
  'mixamorig:Neck': 'Neck',
  'mixamorig:Head': 'Head',

  'mixamorig:LeftShoulder': 'LeftShoulder',
  'mixamorig:LeftArm': 'LeftArm',
  'mixamorig:LeftForeArm': 'LeftForeArm',
  'mixamorig:LeftHand': 'LeftHand',

  'mixamorig:RightShoulder': 'RightShoulder',
  'mixamorig:RightArm': 'RightArm',
  'mixamorig:RightForeArm': 'RightForeArm',
  'mixamorig:RightHand': 'RightHand',

  'mixamorig:LeftUpLeg': 'LeftUpLeg',
  'mixamorig:LeftLeg': 'LeftLeg',
  'mixamorig:LeftFoot': 'LeftFoot',
  'mixamorig:LeftToeBase': 'LeftToeBase',

  'mixamorig:RightUpLeg': 'RightUpLeg',
  'mixamorig:RightLeg': 'RightLeg',
  'mixamorig:RightFoot': 'RightFoot',
  'mixamorig:RightToeBase': 'RightToeBase',

  'mixamorig:LeftHandThumb1': 'LeftHandThumb1',
  'mixamorig:LeftHandThumb2': 'LeftHandThumb2',
  'mixamorig:LeftHandThumb3': 'LeftHandThumb3',
  'mixamorig:LeftHandIndex1': 'LeftHandIndex1',
  'mixamorig:LeftHandIndex2': 'LeftHandIndex2',
  'mixamorig:LeftHandIndex3': 'LeftHandIndex3',
  'mixamorig:LeftHandMiddle1': 'LeftHandMiddle1',
  'mixamorig:LeftHandMiddle2': 'LeftHandMiddle2',
  'mixamorig:LeftHandMiddle3': 'LeftHandMiddle3',
  'mixamorig:LeftHandRing1': 'LeftHandRing1',
  'mixamorig:LeftHandRing2': 'LeftHandRing2',
  'mixamorig:LeftHandRing3': 'LeftHandRing3',
  'mixamorig:LeftHandPinky1': 'LeftHandPinky1',
  'mixamorig:LeftHandPinky2': 'LeftHandPinky2',
  'mixamorig:LeftHandPinky3': 'LeftHandPinky3',

  'mixamorig:RightHandThumb1': 'RightHandThumb1',
  'mixamorig:RightHandThumb2': 'RightHandThumb2',
  'mixamorig:RightHandThumb3': 'RightHandThumb3',
  'mixamorig:RightHandIndex1': 'RightHandIndex1',
  'mixamorig:RightHandIndex2': 'RightHandIndex2',
  'mixamorig:RightHandIndex3': 'RightHandIndex3',
  'mixamorig:RightHandMiddle1': 'RightHandMiddle1',
  'mixamorig:RightHandMiddle2': 'RightHandMiddle2',
  'mixamorig:RightHandMiddle3': 'RightHandMiddle3',
  'mixamorig:RightHandRing1': 'RightHandRing1',
  'mixamorig:RightHandRing2': 'RightHandRing2',
  'mixamorig:RightHandRing3': 'RightHandRing3',
  'mixamorig:RightHandPinky1': 'RightHandPinky1',
  'mixamorig:RightHandPinky2': 'RightHandPinky2',
  'mixamorig:RightHandPinky3': 'RightHandPinky3',
};

class MixamoRetargeter {

  static retargetClip(clip, targetSkeleton) {
    const tracks = clip.tracks.map(track => {
      const dotIndex = track.name.indexOf('.');
      const boneName = track.name.substring(0, dotIndex);
      const property = track.name.substring(dotIndex);

      let newBoneName;
      if (BONE_MAP[boneName] !== undefined) {
        newBoneName = BONE_MAP[boneName];
      } else if (boneName.startsWith('mixamorig:')) {
        newBoneName = boneName.replace('mixamorig:', '');
      } else {
        newBoneName = boneName;
      }

      const newTrack = track.clone();
      newTrack.name = newBoneName + property;
      return newTrack;
    });

    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  static stripRootMotion(clip) {
    for (const track of clip.tracks) {
      if (track.name.endsWith('.position') &&
          (track.name.startsWith('Hips') || track.name.startsWith('mixamorig:Hips'))) {
        const values = track.values;
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0;
          values[i + 2] = 0;
        }
        break;
      }
    }
    return clip;
  }

  static isMixamoClip(clip) {
    return clip.tracks.some(track => track.name.includes('mixamorig:'));
  }

  static retargetAndClean(clip) {
    let processed = clip;
    if (MixamoRetargeter.isMixamoClip(processed)) {
      processed = MixamoRetargeter.retargetClip(processed);
    }
    processed = MixamoRetargeter.stripRootMotion(processed);
    return processed;
  }
}

export default MixamoRetargeter;
