# Avaturn SDK — Analysis

## What It Is

The Avaturn SDK is an **iframe-based avatar creator/customizer** that you embed in your web app. Users design avatars in-browser (choose body type, clothing, accessories) and export them as GLB files.

- Official docs: https://docs.avaturn.me/integration/web
- npm: `@avaturn/sdk`

## What It Provides

- **Iframe embed** — Full avatar editor UI runs inside an iframe in your app
- **Event callbacks** — Listen for garment changes, body modifications, avatar export
- **Asset customization** — Control which clothing/accessory options are available
- **GLB export** — When user finishes, SDK emits a postMessage with the GLB download URL

## Is It Needed?

**No — purely added value.**

If you already have an Avaturn GLB file (exported from avaturn.me), you load it with Three.js `GLTFLoader` like any other GLB. No SDK required.

The SDK is only useful if you want to let users **create new avatars without leaving your app**.

## When to Add It

Consider adding the SDK in a later phase if you want:
- In-app avatar creation
- Real-time avatar customization (change clothes, hairstyle)
- Multiple avatar generation for scenes

## Loading Avaturn GLBs Without the SDK

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('path/to/avaturn-avatar.glb', (gltf) => {
  scene.add(gltf.scene);
  // Access skeleton for animation:
  // gltf.scene.traverse(child => { if (child.isBone) console.log(child.name); });
});
```

## Animation Caveat

Avaturn skeletons **may not match Mixamo bone naming** directly. Avaturn's own docs recommend:

1. Use a pre-tested Avaturn FBX base model (not GLB)
2. Upload to Mixamo, select animation
3. Export from Mixamo
4. Apply animation to your actual avatar in Blender

For this engine, `MixamoMapper.js` (Phase 3) will handle bone-name retargeting at runtime, so this manual workflow won't be needed.
