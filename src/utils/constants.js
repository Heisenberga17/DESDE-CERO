// Physics
export const GRAVITY = -9.81;
export const GROUND_Y = 0;

// Player movement speeds (units/second)
export const WALK_SPEED = 3;
export const RUN_SPEED = 7;
export const SPRINT_SPEED = 12;
export const JUMP_FORCE = 8;

// Vehicle — basic
export const VEHICLE_ENTER_DISTANCE = 4;

// Vehicle — physics
export const VEHICLE_ACCEL_SMOOTHING = 6;
export const VEHICLE_STEER_SMOOTHING = 5;
export const VEHICLE_GRIP_THRESHOLD = 0.7;
export const VEHICLE_BODY_TILT_MAX = 0.08; // ~4.5 degrees

// Player — movement feel
export const PLAYER_ACCEL_RATE = 50;
export const PLAYER_DECEL_RATE = 40;
export const PLAYER_AIR_CONTROL = 0.4;
export const COYOTE_TIME = 0.12;
export const JUMP_BUFFER_TIME = 0.1;

// Gamepad standard button indices
export const GP_A = 0, GP_B = 1, GP_X = 2, GP_Y = 3;
export const GP_LB = 4, GP_RB = 5, GP_LT = 6, GP_RT = 7;

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
