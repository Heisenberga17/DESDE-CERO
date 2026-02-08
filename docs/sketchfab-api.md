# Sketchfab API — Analysis

## What It Is

The Sketchfab Data API v3 is a REST API for searching Sketchfab's catalog of 1M+ 3D models and downloading them programmatically as GLB files.

- Docs: https://sketchfab.com/developers/data-api/v3
- Download API: https://sketchfab.com/developers/download-api

## What It Provides

- **Search** — Query models by keyword, category, license type
- **Download** — Get GLB/glTF files for models (requires auth)
- **Metadata** — Author, license, description, thumbnails
- **Upload** — Upload your own models to Sketchfab

## Is It Needed?

**No — purely added value.**

If you already have GLB files downloaded from Sketchfab (or anywhere), you load them with `GLTFLoader` directly. No API needed.

The API is only useful if you want an **in-app model browser** that searches Sketchfab's catalog.

## Authentication Requirements

- **OAuth 2.0** required for downloads (user must have a Sketchfab account)
- **API Token** option for server-side requests
- Some search endpoints may work without auth (limited)

## Licensing Obligations

If you use the Download API, you **must**:
- Display the model's license type
- Show author attribution with creator username
- Link back to the original Sketchfab model page
- Attribution must follow the asset everywhere it's used

## When to Add It

Consider adding in a later phase if you want:
- In-app model search/browsing with thumbnails
- Direct download without leaving the app
- Access to Sketchfab's full catalog of free CC-licensed models

## Loading Sketchfab GLBs Without the API

Just load the GLB file directly — no API needed:

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('path/to/sketchfab-model.glb', (gltf) => {
  scene.add(gltf.scene);
});
```

Note: Many Sketchfab models use Draco compression, so always attach a DRACOLoader.
