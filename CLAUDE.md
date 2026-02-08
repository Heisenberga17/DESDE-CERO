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
├── core/           Engine, EventBus, GameState, InputManager, ModeController
├── camera/         CameraSystem + 6 modes (Drone, ThirdPerson, Driving, Orbit, Cinematic, Path) + PostProcessing
├── player/         CharacterBody (with AnimationState), PlayerController
├── entities/       Entity (base), Vehicle, NPC, Prop, EntityManager
├── animation/      AnimationManager, AnimationState, MixamoRetargeter
├── gameplay/       VehicleInteraction
├── director/       DirectorMode, VideoExport
├── loaders/        ModelLoader (GLTFLoader + Draco), AvaturnLoader
├── world/          SkySystem, TerrainGenerator, CityGenerator
├── ui/             ModelBrowser, HUD
├── utils/          constants.js, debug.js
└── main.js         Bootstrap wiring
```

## Key Patterns
- **EventBus** (`src/core/EventBus.js`): Pub/sub singleton for decoupled communication
- **GameState** (`src/core/GameState.js`): Singleton tracking mode (free/play/drive/director), player, vehicle refs
- **ModeController** (`src/core/ModeController.js`): Central coordinator managing which systems are active per mode
- **Camera modes**: Each implements `{ name, activate(camera), deactivate(camera), update(camera, input, delta) }`
- **Entity system**: Base class Entity → Vehicle, NPC, Prop. EntityManager is a singleton registry with spatial queries
- **AnimationState**: State machine with speed-based auto-transitions and crossfade blending
- **MixamoRetargeter**: Automatic bone name mapping from Mixamo → standard humanoid skeleton
- **Updatables**: Any system with `update(delta)` can be registered via `engine.addUpdatable(system)`

## Mode System
| Mode | Camera | Player | Vehicles | Director |
|------|--------|--------|----------|----------|
| free | drone | off | off | Tab only |
| play | thirdperson | active | proximity | Tab |
| drive | driving | off | driving | Tab |
| director | drone | off | off | full |

## Key Technical Notes
- Three.js r160: physically correct lights are default
- Use `SRGBColorSpace`, not `sRGBEncoding`
- Camera Euler order must be `YXZ` for FPS-style mouse look
- Frame-rate-independent damping: `pow(factor, delta * 60)`
- PlaneGeometry creates XY plane — rotate `-PI/2` on X for ground
- Pointer lock requires user click gesture
- Light intensities are physically-based (directional ~3.0 with ACES exposure 1.3)
- 1 unit = 1 meter
- Mixamo animations auto-retargeted via MixamoRetargeter

## Post-Processing Pipeline
RenderPass → SAOPass (AO) → UnrealBloomPass → Vignette → SMAAPass → OutputPass

## Assets (local, not tracked in git)
- `assets/models/city/low_poly_city_game-ready.glb` — Sketchfab city
- `assets/models/characters/model.glb` — Avaturn avatar
- `assets/models/vehicles/*.glb` — Vehicle models
- `assets/animations/*.fbx` — Mixamo animation clips

## Controls
- WASD: Move, Shift: Sprint, Ctrl: Walk, Space: Jump
- P: Toggle play/free mode
- F: Enter/exit vehicle
- Tab: Toggle director mode
- 1-6: Cinematic presets (director mode)
- G: Toggle post-processing
- M: Model browser
- R: Record video (director mode)
- C: Cycle camera modes

## Common Tasks

### Adding a Mixamo animation
1. Download FBX from mixamo.com (any character, "Without Skin" format works too)
2. Place in `assets/animations/` with descriptive name
3. Auto-loaded by `AnimationManager.preloadDefaultClips()` if name matches convention
4. Or manual: `await AnimationManager.loadMixamoClip('name', 'path.fbx')`

### Swapping the player avatar
```js
const result = await AvaturnLoader.load('path/to/avatar.glb');
AvaturnLoader.configureShadows(result.mesh);
await characterBody.swapMesh(result.mesh, result.animations);
```

### Adding a new vehicle
1. Place GLB in `assets/models/vehicles/`
2. Load in `main.js`: `const data = await ModelLoader.load('path.glb')`
3. Create: `const v = new Vehicle(data.scene, data.animations, 'Name')`
4. Add to scene + EntityManager + vehicles array

### Adding a new camera mode
1. Create file in `src/camera/` implementing `{ name, activate, deactivate, update }`
2. Register: `cameraSystem.registerMode(new MyCam())`

### Changing time of day
`sky.setTimeOfDay(hours)` — 0=midnight, 6=sunrise, 12=noon, 17.5=golden hour

### Recording video
Director mode (Tab) → R to start/stop → .webm auto-downloads

## Running
```bash
cd "/Users/fer/Documents/VS Studio/DESDE-CERO"
python3 -m http.server 8080
# Open http://localhost:8080
```
