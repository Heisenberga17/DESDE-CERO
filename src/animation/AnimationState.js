import * as THREE from 'three';

const STATES = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'drive', 'dance', 'wave'];

const TRANSITIONS = {
  'idle->walk': 0.4,
  'walk->run': 0.3,
  'run->sprint': 0.2,
  'any->jump': 0.1,
  'jump->fall': 0.2,
  'fall->idle': 0.3,
  'any->idle': 0.4,
};

const DEFAULT_CROSSFADE = 0.3;

function getTransitionDuration(from, to) {
  const specific = TRANSITIONS[`${from}->${to}`];
  if (specific !== undefined) return specific;

  const wildcard = TRANSITIONS[`any->${to}`];
  if (wildcard !== undefined) return wildcard;

  return DEFAULT_CROSSFADE;
}

class AnimationState {
  constructor(mixer) {
    this.mixer = mixer;
    this.actions = {};
    this.currentState = null;
    this.currentAction = null;
  }

  registerAction(stateName, clip) {
    const action = this.mixer.clipAction(clip);

    if (stateName === 'jump') {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat);
    }

    this.actions[stateName] = action;
  }

  setState(name) {
    if (this.currentState === name) return false;

    const newAction = this.actions[name];
    if (!newAction) return false;

    const duration = getTransitionDuration(this.currentState, name);

    if (this.currentAction) {
      this.currentAction.fadeOut(duration);
    }

    newAction.reset().setEffectiveWeight(1).fadeIn(duration).play();

    this.currentState = name;
    this.currentAction = newAction;

    return true;
  }

  setStateBySpeed(speed) {
    let state;

    if (speed < 0.1) {
      state = 'idle';
    } else if (speed < 4) {
      state = 'walk';
    } else if (speed < 8) {
      state = 'run';
    } else {
      state = 'sprint';
    }

    this.setState(state);
  }

  getState() {
    return this.currentState;
  }

  hasAction(name) {
    return name in this.actions;
  }

  update(delta) {}
}

export default AnimationState;
