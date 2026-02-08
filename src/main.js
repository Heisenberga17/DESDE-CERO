import * as THREE from 'three';
import Engine from './core/Engine.js';
import EventBus from './core/EventBus.js';
import GameState from './core/GameState.js';
import ModeController from './core/ModeController.js';
import SkySystem from './world/SkySystem.js';
import TerrainGenerator from './world/TerrainGenerator.js';

// Camera
import CameraSystem from './camera/CameraSystem.js';
import CameraDrone from './camera/CameraDrone.js';
import ThirdPersonCam from './camera/ThirdPersonCam.js';
import DrivingCam from './camera/DrivingCam.js';
import OrbitCam from './camera/OrbitCam.js';
import CinematicCam from './camera/CinematicCam.js';
import PathCam from './camera/PathCam.js';
import PostProcessing from './camera/PostProcessing.js';

// Player
import CharacterBody from './player/CharacterBody.js';
import PlayerController from './player/PlayerController.js';

// Entities
import Vehicle from './entities/Vehicle.js';
import EntityManager from './entities/EntityManager.js';

// Gameplay
import VehicleInteraction from './gameplay/VehicleInteraction.js';

// Director
import DirectorMode from './director/DirectorMode.js';
import VideoExport from './director/VideoExport.js';

// Animation
import AnimationManager from './animation/AnimationManager.js';

// Loaders
import AvaturnLoader from './loaders/AvaturnLoader.js';
import ModelLoader from './loaders/ModelLoader.js';

// UI
import ModelBrowser from './ui/ModelBrowser.js';
import HUD from './ui/HUD.js';

// Physics
import CollisionWorld from './physics/CollisionWorld.js';

// Utils
import { createStats } from './utils/debug.js';

// ── Canvas + Engine ──────────────────────────────────────────────────

const canvas = document.getElementById('scene-canvas');
const engine = new Engine(canvas);

// ── World ────────────────────────────────────────────────────────────

const sky = new SkySystem(engine.scene);
const terrain = new TerrainGenerator(engine.scene); // fallback ground

// ── Camera System ────────────────────────────────────────────────────

const cameraSystem = new CameraSystem(engine.camera, engine.input);

// Register camera modes
cameraSystem.registerMode(new CameraDrone());
cameraSystem.registerMode(new DrivingCam());
const orbitCam = new OrbitCam();
cameraSystem.registerMode(orbitCam);
cameraSystem.registerMode(new CinematicCam());
cameraSystem.registerMode(new PathCam());
cameraSystem.setMode('drone');
engine.addUpdatable(cameraSystem);

// ── Post-processing ──────────────────────────────────────────────────

const postProcessing = new PostProcessing(engine.renderer, engine.scene, engine.camera);
engine.setPostProcessing(postProcessing);

// ── Director Mode ────────────────────────────────────────────────────

const director = new DirectorMode(cameraSystem, engine.input);

// ── Mode Controller (replaces scattered event listeners) ─────────────

const modeController = new ModeController({
  cameraSystem,
  playerController: null,
  vehicleInteraction: null,
  director,
});
engine.addUpdatable(modeController);

// Director is updated by ModeController now, so don't add it separately

// ── Video Export ─────────────────────────────────────────────────────

const videoExport = new VideoExport(canvas);

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && GameState.mode === 'director') {
    videoExport.toggle();
  }
});

// ── UI ───────────────────────────────────────────────────────────────

const modelBrowser = new ModelBrowser(engine.scene, engine.camera);
engine.addUpdatable(modelBrowser);

const hud = new HUD();
engine.addUpdatable(hud);

// Make drop zone clickable
const dropZone = document.getElementById('model-drop-zone');
const fileInput = document.getElementById('model-file-input');
if (dropZone && fileInput) {
  dropZone.addEventListener('click', () => fileInput.click());
}

// ── Debug ────────────────────────────────────────────────────────────

const stats = createStats();
engine.setStats(stats);

// ── Crosshair + click prompt ─────────────────────────────────────────

const crosshair = document.getElementById('crosshair');
const clickPrompt = document.getElementById('click-to-start');

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (crosshair) crosshair.classList.toggle('active', locked);
  if (clickPrompt) clickPrompt.classList.toggle('hidden', locked);
});

// ── Asset Loading + Full Game Setup ──────────────────────────────────

async function loadAssets() {
  const setStatus = (msg) => {
    console.log(`[Assets] ${msg}`);
    const el = document.getElementById('model-status');
    if (el) el.textContent = msg;
  };

  try {
    // Load city environment
    setStatus('Loading city...');
    const city = await ModelLoader.load('assets/models/city/low_poly_city_game-ready.glb');
    city.scene.name = 'city-environment';
    engine.scene.add(city.scene);

    // Build collision octree from city geometry
    CollisionWorld.build(city.scene);

    setStatus('City loaded');

    // Load vehicles in parallel
    setStatus('Loading vehicles...');
    const [mcqueenData, calData, guidoData] = await Promise.all([
      ModelLoader.load('assets/models/vehicles/rookie_lightning_mcqueen.glb'),
      ModelLoader.load('assets/models/vehicles/cal_weathers.glb'),
      ModelLoader.load('assets/models/vehicles/guido/guido.glb'),
    ]);

    // Create Vehicle entities
    const mcqueen = new Vehicle(mcqueenData.scene, mcqueenData.animations, 'Lightning McQueen');
    mcqueen.position.set(10, 0, 10);
    engine.scene.add(mcqueen.mesh);
    EntityManager.add(mcqueen);

    const cal = new Vehicle(calData.scene, calData.animations, 'Cal Weathers');
    cal.position.set(20, 0, 10);
    engine.scene.add(cal.mesh);
    EntityManager.add(cal);

    const guido = new Vehicle(guidoData.scene, guidoData.animations, 'Guido');
    guido.position.set(30, 0, 10);
    engine.scene.add(guido.mesh);
    EntityManager.add(guido);

    const vehicles = [mcqueen, cal, guido];

    // Load avatar via AvaturnLoader
    setStatus('Loading avatar...');
    const avatarResult = await AvaturnLoader.load('assets/models/characters/model.glb');
    AvaturnLoader.configureShadows(avatarResult.mesh);

    console.log('[Assets] Avatar bones:', avatarResult.bones.length);
    console.log('[Assets] Avatar morph targets:', AvaturnLoader.getMorphTargetNames(avatarResult.mesh));

    // Set up player character
    const body = new CharacterBody(avatarResult.mesh, avatarResult.animations);
    body.container.position.set(0, 0, 15);
    engine.scene.add(body.container);

    // Preload Mixamo animations (auto-retargets to Avaturn skeleton)
    setStatus('Loading animations...');
    const animResults = await AnimationManager.preloadDefaultClips();
    const loadedAnims = animResults.filter(r => r.ok).map(r => r.name);
    console.log('[Assets] Animations loaded:', loadedAnims.join(', ') || 'none');

    // Register animations into state machine
    body.registerAnimations();

    // Player controller (updated by ModeController, not engine directly)
    const playerController = new PlayerController(body, engine.input);
    GameState.player = playerController;

    // Register third-person camera (needs player reference)
    const tpCam = new ThirdPersonCam(playerController);
    cameraSystem.registerMode(tpCam);

    // Vehicle interaction system (updated by ModeController, not engine directly)
    const vehicleInteraction = new VehicleInteraction(playerController, vehicles, engine.input);

    // Wire into ModeController
    modeController.setPlayerController(playerController);
    modeController.setVehicleInteraction(vehicleInteraction);

    // Wire OrbitCam to follow the player/vehicle based on mode
    EventBus.on('gamestate:modeChanged', ({ mode }) => {
      if (mode === 'play') {
        orbitCam.setFollowTarget(body.container, 1.5);
      } else if (mode === 'drive' && GameState.vehicle) {
        orbitCam.setFollowTarget(GameState.vehicle.mesh, 1.0);
      } else {
        orbitCam.setFollowTarget(null);
      }
    });
    // Also update follow target when entering/exiting vehicles
    EventBus.on('vehicle:entered', ({ vehicle }) => {
      orbitCam.setFollowTarget(vehicle.mesh, 1.0);
    });
    EventBus.on('vehicle:exited', () => {
      orbitCam.setFollowTarget(body.container, 1.5);
    });

    setStatus('All assets loaded! Press P to play');
    console.log('[Assets] All loaded — city, 3 vehicles, avatar, animations');

    // Start in free camera mode
    GameState.setMode('free');

  } catch (err) {
    console.error('[Assets] Load error:', err);
    setStatus('Asset load failed — check console');
  }
}

// P key to toggle between free camera and play mode
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && GameState.mode !== 'director') {
    if (GameState.mode === 'free') {
      if (GameState.player) {
        GameState.setMode('play');
      }
    } else if (GameState.mode === 'play') {
      GameState.setMode('free');
    }
  }
});

// ── Start ────────────────────────────────────────────────────────────

engine.start();
loadAssets();
console.log('[DESDE-CERO] Engine started — Open World Sandbox');
