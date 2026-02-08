// Physics
export const GRAVITY = -9.81;
export const GROUND_Y = 0;

// Player movement speeds (units/second)
export const WALK_SPEED = 3;
export const RUN_SPEED = 7;
export const SPRINT_SPEED = 12;
export const JUMP_FORCE = 8;

// Vehicle
export const VEHICLE_ENTER_DISTANCE = 4;

// Camera
export const DRONE_SPEED = 30;
export const DRONE_BOOST_MULT = 3;
export const MOUSE_SENSITIVITY = 0.002;
export const PITCH_LIMIT = Math.PI / 2 - 0.05; // ~85 degrees

// City
export const CITY_SIZE = 800;
export const MAIN_ROAD_SPACING = 160;
export const SECONDARY_ROAD_SPACING = 80;
export const MAIN_ROAD_WIDTH = 12;
export const SECONDARY_ROAD_WIDTH = 8;
export const SIDEWALK_WIDTH = 3;
export const SIDEWALK_HEIGHT = 0.1;

// Key bindings (KeyboardEvent.code)
export const KEYS = {
  FORWARD: 'KeyW',
  BACKWARD: 'KeyS',
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  UP: 'KeyQ',
  DOWN: 'KeyE',
  SPRINT: 'ShiftLeft',
  JUMP: 'Space',
  INTERACT: 'KeyF',
  CAMERA: 'KeyC',
  MODELS: 'KeyM',
  DIRECTOR: 'Tab',
  PAUSE: 'Escape',
};
