import * as THREE from 'three';
import Engine from './core/Engine.js';
import EventBus from './core/EventBus.js';
import GameState from './core/GameState.js';
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

// UI
import ModelBrowser from './ui/ModelBrowser.js';
import HUD from './ui/HUD.js';

// Loaders
import ModelLoader from './loaders/ModelLoader.js';

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

// Register drone camera (default)
const drone = new CameraDrone();
cameraSystem.registerMode(drone);

// Register driving camera
const drivingCam = new DrivingCam();
cameraSystem.registerMode(drivingCam);

// Register orbit camera
const orbitCam = new OrbitCam();
cameraSystem.registerMode(orbitCam);

// Register cinematic camera
const cinematicCam = new CinematicCam();
cameraSystem.registerMode(cinematicCam);

// Register path camera
const pathCam = new PathCam();
cameraSystem.registerMode(pathCam);

// Start with drone
cameraSystem.setMode('drone');
engine.addUpdatable(cameraSystem);

// ── Post-processing ──────────────────────────────────────────────────

const postProcessing = new PostProcessing(engine.renderer, engine.scene, engine.camera);
engine.setPostProcessing(postProcessing);

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

// ── Director Mode ────────────────────────────────────────────────────

const director = new DirectorMode(cameraSystem, engine.input);
engine.addUpdatable(director);

// ── Video Export ─────────────────────────────────────────────────────

const videoExport = new VideoExport(canvas);

// R key to toggle recording
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && GameState.mode === 'director') {
    videoExport.toggle();
  }
});

// ── Camera mode switching based on game state ────────────────────────

EventBus.on('gamestate:modeChanged', ({ mode }) => {
  if (mode === 'drive') {
    cameraSystem.setMode('driving');
  } else if (mode === 'play') {
    cameraSystem.setMode('thirdperson');
  } else if (mode === 'free' || mode === 'director') {
    cameraSystem.setMode('drone');
  }
});

// ── Asset Loading + Full Game Setup ──────────────────────────────────

let playerController = null;
let vehicleInteraction = null;

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

    // Load avatar
    setStatus('Loading avatar...');
    const avatarData = await ModelLoader.load('assets/models/characters/model.glb');

    // Set up player character
    const body = new CharacterBody(avatarData.scene, avatarData.animations);
    body.container.position.set(0, 0, 15);
    engine.scene.add(body.container);

    playerController = new PlayerController(body, engine.input);
    engine.addUpdatable(playerController);
    GameState.player = playerController;

    // Register third-person camera (needs player reference)
    const tpCam = new ThirdPersonCam(playerController);
    cameraSystem.registerMode(tpCam);

    // Vehicle interaction system
    vehicleInteraction = new VehicleInteraction(playerController, vehicles, engine.input);
    engine.addUpdatable(vehicleInteraction);

    // Load walking animation if available
    try {
      await AnimationManager.loadClip('walk', 'assets/animations/Walking.fbx');
      console.log('[Assets] Walking animation loaded');
    } catch (e) {
      console.warn('[Assets] Could not load Walking.fbx:', e.message);
    }

    setStatus('All assets loaded! Press P to play');
    console.log('[Assets] All loaded — city, 3 vehicles, avatar');

    // Start in free camera mode (drone) — press P to switch to play
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
      if (playerController) {
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
