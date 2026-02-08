import * as THREE from 'three';
import EventBus from '../core/EventBus.js';
import ModelLoader from '../loaders/ModelLoader.js';
import Prop from '../entities/Prop.js';

/**
 * UI panel for loading GLB models via file upload, drag-and-drop, or URL.
 * Press M to toggle. Loaded models appear at camera focus point.
 */
class ModelBrowser {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(scene, camera) {
    this._scene = scene;
    this._camera = camera;
    this._entities = [];
    this._isOpen = false;

    // DOM elements
    this._panel = document.getElementById('model-browser');
    this._urlInput = document.getElementById('model-url-input');
    this._typeSelect = document.getElementById('model-type-select');
    this._scaleInput = document.getElementById('model-scale-input');
    this._scaleValue = document.getElementById('model-scale-value');
    this._loadBtn = document.getElementById('model-load-btn');
    this._fileInput = document.getElementById('model-file-input');
    this._dropZone = document.getElementById('model-drop-zone');
    this._status = document.getElementById('model-status');

    this._setupEvents();
  }

  _setupEvents() {
    // Toggle panel with M key
    this._onKeyDown = (e) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    // Load from URL
    this._loadBtn.addEventListener('click', () => {
      const url = this._urlInput.value.trim();
      if (url) this._loadFromUrl(url);
    });

    // URL input — Enter to load
    this._urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = this._urlInput.value.trim();
        if (url) this._loadFromUrl(url);
      }
    });

    // File input
    this._fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._loadFromFile(file);
    });

    // Scale slider
    this._scaleInput.addEventListener('input', () => {
      this._scaleValue.textContent = this._scaleInput.value;
    });

    // Drag and drop on the drop zone
    this._dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone.classList.add('drag-over');
    });
    this._dropZone.addEventListener('dragleave', () => {
      this._dropZone.classList.remove('drag-over');
    });
    this._dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        this._loadFromFile(file);
      } else {
        this._setStatus('Please drop a .glb or .gltf file', true);
      }
    });

    // Also allow drag-and-drop on the full canvas when panel is closed
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      // Only handle if panel is closed and drop is on canvas
      if (this._isOpen) return;
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        this._loadFromFile(file);
      }
    });

    // Loading progress
    EventBus.on('model:loading', ({ progress }) => {
      const pct = Math.round(progress * 100);
      this._setStatus(`Loading... ${pct}%`);
    });
  }

  toggle() {
    this._isOpen = !this._isOpen;
    this._panel.classList.toggle('open', this._isOpen);
    // Release pointer lock when panel opens so user can interact with UI
    if (this._isOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  open() {
    this._isOpen = true;
    this._panel.classList.add('open');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  close() {
    this._isOpen = false;
    this._panel.classList.remove('open');
  }

  async _loadFromUrl(url) {
    this._setStatus('Loading...');
    try {
      const result = await ModelLoader.load(url);
      this._addToScene(result, url);
      this._setStatus('Loaded successfully!');
    } catch (err) {
      console.error('[ModelBrowser] Load error:', err);
      this._setStatus('Failed to load model', true);
    }
  }

  async _loadFromFile(file) {
    this._setStatus(`Loading ${file.name}...`);
    try {
      const result = await ModelLoader.loadFile(file);
      this._addToScene(result, file.name);
      this._setStatus(`Loaded: ${file.name}`);
    } catch (err) {
      console.error('[ModelBrowser] File load error:', err);
      this._setStatus('Failed to load file', true);
    }
  }

  _addToScene(result, sourceName) {
    const type = this._typeSelect ? this._typeSelect.value : 'prop';
    const scale = parseFloat(this._scaleInput ? this._scaleInput.value : 1);

    const mesh = result.scene;
    mesh.scale.setScalar(scale);

    // Position 10 units in front of camera, on the ground
    const dir = new THREE.Vector3();
    this._camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    mesh.position.copy(this._camera.position).add(dir.multiplyScalar(10));
    mesh.position.y = 0;

    const entity = new Prop(mesh, result.animations, sourceName);
    this._scene.add(mesh);
    this._entities.push(entity);

    EventBus.emit('entity:added', { entity });
  }

  /** Get all loaded entities. */
  getEntities() {
    return this._entities;
  }

  _setStatus(msg, isError = false) {
    if (this._status) {
      this._status.textContent = msg;
      this._status.style.color = isError ? '#ff6b6b' : 'var(--hud-accent)';
      // Auto-clear after 3s
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        if (this._status) this._status.textContent = '';
      }, 3000);
    }
  }

  update(delta) {
    for (const entity of this._entities) {
      entity.update(delta);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    for (const entity of this._entities) {
      entity.dispose();
    }
    this._entities = [];
  }
}

export default ModelBrowser;
