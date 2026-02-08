# DESDE CERO — Open World Sandbox + Cinematic Engine

## Vision
**GTA meets Garry's Mod meets a machinima tool.**
Playable open-world sandbox in the browser. Control a custom avatar, explore procedural cities, drive vehicles, interact with NPCs. Plus a cinematic director mode for choreographing scenes and recording videos.

**Two core modes:**
- **PLAY MODE** — Third-person character control. Walk, run, sprint, jump. Enter/exit vehicles. Drive around.
- **DIRECTOR MODE** — Free camera. Place NPCs. Set up cinematic camera paths. Record video.

**Stack:** Three.js r160 + vanilla JS + ES modules (importmap from CDN, no bundler)

---

## Phase Status

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Core engine + Sketchfab city + drone camera | DONE |
| 2 | Player character + third-person movement | DONE |
| 3 | Model loading (Sketchfab GLBs + Avaturn avatars) | DONE (auto-loads from assets/) |
| 4 | Vehicles — driving gameplay | DONE |
| 5 | NPCs + animation system | DONE |
| 6 | Cinematic camera system + post-processing | DONE |
| 7 | Director mode + timeline + video export | DONE |

---

## Phase 1: Core Engine + World

**Goal:** Fly around a procedurally generated city with beautiful lighting.

**All complete:**
- `src/core/Engine.js` — renderer (ACES, exposure 1.1), scene, camera, loop
- `src/core/EventBus.js` — pub/sub singleton
- `src/core/InputManager.js` — keyboard, mouse, pointer lock
- `src/core/GameState.js` — global state (mode, player, vehicle, timeOfDay, pause)
- `src/camera/CameraSystem.js` — mode manager
- `src/camera/CameraDrone.js` — free-fly drone camera
- `src/world/SkySystem.js` — sky shader, sun, fog, setTimeOfDay(0-24 hours), shadow frustum -200..200
- `src/world/CityGenerator.js` — procedural city (800x800):
  - Grid-based roads (main every 160u, secondary every 80u)
  - Road markings: yellow dashed center lines, white lane lines, crosswalks
  - Sidewalks (raised 0.1u, 3u wide)
  - Buildings: random sizes (8-20 wide, 10-60 tall), 14 facade colors
  - Window emissives (warm yellow, ~60% lit, merged geometry)
  - Street props: lamp posts with PointLights (18 max), traffic lights
  - All geometry merged for performance, seeded PRNG for reproducibility
- `src/utils/constants.js` — physics, speeds, city layout, key bindings
- `src/utils/debug.js` — Stats.js
- `src/loaders/ModelLoader.js` — GLTFLoader + DRACOLoader + caching
- `src/entities/Entity.js` — base entity class
- `src/entities/Prop.js` — static/animated objects
- `src/ui/ModelBrowser.js` — UI panel (M key), file drag-and-drop, URL input

**Deliverable:** Fly around a procedural city with buildings, roads, streetlights, and golden hour lighting. Load GLB models via drag-and-drop or URL.

---

## Phase 2: Player Character + Movement

**Goal:** Third-person character walks/runs/jumps through the city with collision.

**Files:**
- `src/player/CharacterBody.js` — mesh, AnimationMixer, state machine
- `src/player/PlayerController.js` — input → movement, state transitions
- `src/player/PlayerPhysics.js` — gravity, ground check, building collision
- `src/animation/AnimationState.js` — idle→walk→run→sprint→jump→falling→drive
- `src/camera/ThirdPersonCam.js` — follow player, collision avoidance
- `src/ui/HUD.js` — mode indicator, minimap, interaction prompts

**States:** idle (0 speed), walk (3 u/s), run (7 u/s, Shift), sprint (12 u/s), jump (Space), falling, drive

**Deliverable:** Third-person character with smooth animation blending and camera collision.

---

## Phase 3: Model Loading

**Goal:** Load external GLBs into the world, swap player avatar.

**Existing (done):**
- `src/loaders/ModelLoader.js` — GLTFLoader + DRACOLoader + caching
- `src/entities/Entity.js` — base class
- `src/entities/Prop.js` — static/animated objects
- `src/ui/ModelBrowser.js` — UI panel (M key)

**New files:**
- `src/loaders/AvaturnLoader.js` — detect skeleton, bone name mapping
- `src/loaders/AnimationLoader.js` — load Mixamo animation GLBs
- `src/entities/EntityManager.js` — registry, spatial queries

**Types:** Vehicle → driveable, Character → player swap or NPC, Environment → world, Prop → static

**Deliverable:** Paste Sketchfab URL → model appears. Paste Avaturn URL → player avatar changes.

---

## Phase 4: Vehicles — Driving Gameplay

**Goal:** Enter vehicles, drive with arcade physics, exit.

**Files:**
- `src/entities/Vehicle.js` — arcade physics (accel, steering, friction, drift)
- `src/gameplay/VehicleInteraction.js` — proximity check, F to enter/exit
- `src/gameplay/CollisionSystem.js` — AABB collision for buildings/vehicles
- `src/camera/DrivingCam.js` — higher, wider FOV, speed shake

**Controls:** W/S accel/reverse, A/D steer, Space brake, Shift boost, F exit
**Features:** Wheel spin, auto-detect wheel meshes, speedometer HUD

**Deliverable:** Walk up to car → F → drive with arcade physics → drift corners → exit.

---

## Phase 5: NPCs + Animations

**Goal:** Populate world with characters, full animation system.

**Files:**
- `src/entities/NPC.js` — patrol, wander, idle, scripted behaviors
- `src/animation/AnimationManager.js` — clip registry, load/apply
- `src/animation/MixamoRetargeter.js` — remap Mixamo → Avaturn bones
- `src/gameplay/Minimap.js` — 2D canvas overlay

**Pre-load Mixamo clips:** idle, walk, run, sprint, jump, fall, drive, sit, dance, wave, talk, punch, kick

**Deliverable:** NPCs wandering streets. Full animation library on player + NPCs.

---

## Phase 6: Cinematic Camera System

**Goal:** Pro camera modes for cinematic shots.

**Files:**
- `src/camera/OrbitCam.js` — orbit around target
- `src/camera/CinematicCam.js` — dolly zoom, crane, tracking, fly-by (keys 1-6)
- `src/camera/PathCam.js` — CatmullRom spline keyframe paths

**Post-processing (EffectComposer):**
- Bloom (UnrealBloomPass), SSAO, Depth of Field (BokehPass), Vignette
- Toggle with G key

**Deliverable:** 6 camera modes. Cinematic presets. Custom path editor. Post-processing.

---

## Phase 7: Director Mode + Timeline + Export

**Goal:** Full scene choreography and video recording.

**Files:**
- `src/director/DirectorMode.js` — Tab to toggle, freeze player, show tools
- `src/director/NPCDirector.js` — click to select, assign actions
- `src/director/Timeline.js` — master sequencer
- `src/director/TimelineUI.js` — visual timeline bar
- `src/director/VideoExport.js` — MediaRecorder + frame-by-frame capture

**Deliverable:** Choreograph NPCs, set camera paths, scrub timeline, record video.

---

## Controls

### Play Mode (On Foot)
WASD move | Shift sprint | Space jump | F enter vehicle | C camera | M models | Tab director | Esc pause

### Play Mode (Driving)
W/S accel/reverse | A/D steer | Space brake | Shift boost | F exit | C camera

### Director Mode
WASD+QE fly | Mouse look | Click select | P path editor | 1-6 cinematic shots | G post-fx | Tab back

---

## Technical Notes
- Three.js r160: physically correct lights (no useLegacyLights), SRGBColorSpace
- ACES tone mapping, exposure 1.1, PCFSoftShadowMap 4096
- Camera Euler YXZ for FPS mouse look
- Frame-rate-independent damping: pow(factor, delta*60)
- 1 unit = 1 meter. Ground Y=0. Characters 1.8u tall.
- Must serve via HTTP (file:// blocks ES modules)
- Pixel ratio capped at min(dpr, 2)
