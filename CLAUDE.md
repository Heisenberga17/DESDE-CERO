# DESDE CERO — Open World Sandbox + Cinematic Engine

## Project Overview
Browser-based 3D open world sandbox ("GTA meets Garry's Mod meets machinima tool") using Three.js r160, vanilla JS, ES modules via importmap (no bundler).

## Stack
- Three.js r160 from unpkg CDN
- Vanilla JS with ES modules (importmap in index.html)
- No build step — edit files, refresh browser
- Serve via `python3 -m http.server 8080`

## Architecture

```
src/
├── core/           Engine, EventBus, GameState, InputManager
├── camera/         CameraSystem + 6 modes (Drone, ThirdPerson, Driving, Orbit, Cinematic, Path) + PostProcessing
├── player/         CharacterBody, PlayerController
├── entities/       Entity (base), Vehicle, NPC, Prop, EntityManager
├── animation/      AnimationManager (FBX/GLB clip registry)
├── gameplay/       VehicleInteraction, (future: CollisionSystem)
├── director/       DirectorMode, VideoExport
├── loaders/        ModelLoader (GLTFLoader + Draco)
├── world/          SkySystem, TerrainGenerator, CityGenerator
├── ui/             ModelBrowser, HUD
├── utils/          constants.js, debug.js
└── main.js         Bootstrap wiring
```

## Key Patterns
- **EventBus** (`src/core/EventBus.js`): Pub/sub singleton for decoupled communication
- **GameState** (`src/core/GameState.js`): Singleton tracking mode (free/play/drive/director), player, vehicle refs
- **Camera modes**: Each implements `{ name, activate(camera), deactivate(camera), update(camera, input, delta) }`
- **Entity system**: Base class Entity → Vehicle, NPC, Prop. EntityManager is a singleton registry with spatial queries
- **Updatables**: Any system with `update(delta)` can be registered via `engine.addUpdatable(system)`

## Key Technical Notes
- Three.js r160: `useLegacyLights` is deprecated; physically correct lights are default
- Use `SRGBColorSpace`, not `sRGBEncoding`
- Camera Euler order must be `YXZ` for FPS-style mouse look
- Frame-rate-independent damping: `pow(factor, delta * 60)`
- PlaneGeometry creates XY plane — rotate `-PI/2` on X for ground
- Roads/overlays at Y=0.01+ to avoid z-fighting
- Pointer lock requires user click gesture
- Light intensities are physically-based (directional light ~3.0 with ACES exposure 1.1)
- 1 unit = 1 meter

## Assets (local, not tracked in git)
Assets live in `assets/` and are loaded at startup via ModelLoader:
- `assets/models/city/low_poly_city_game-ready.glb` — Sketchfab city
- `assets/models/characters/model.glb` — Avaturn avatar
- `assets/models/vehicles/*.glb` — Vehicle models
- `assets/animations/Walking.fbx` — Mixamo walking clip

## Common Tasks

### Adding a new model
1. Place GLB in appropriate `assets/models/` subfolder
2. Add a `ModelLoader.load()` call in `main.js` `loadAssets()`
3. Wrap in appropriate entity class (Vehicle, NPC, Prop)
4. Add to scene and EntityManager

### Adding a new animation
1. Download Mixamo FBX → place in `assets/animations/`
2. Load via `AnimationManager.loadClip('name', 'assets/animations/file.fbx')`
3. Play on any character via `character.playAction('name')`

### Adding a new camera mode
1. Create file in `src/camera/` implementing `{ name, activate, deactivate, update }`
2. Register in `main.js`: `cameraSystem.registerMode(new MyCam())`

### Adding a new entity type
1. Extend `Entity` in `src/entities/`
2. Implement `update(delta)` and `dispose()`
3. Register with `EntityManager.add(entity)`

### Changing time of day
- `sky.setTimeOfDay(hours)` — 0=midnight, 6=sunrise, 12=noon, 17.5=golden hour, 18=sunset

## Running
```bash
cd "/Users/fer/Documents/VS Studio/DESDE-CERO"
python3 -m http.server 8080
# Open http://localhost:8080
```
