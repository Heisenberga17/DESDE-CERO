import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Dynamic sky system with sun, ambient light, and fog.
 * Supports time-of-day in hours: 0=midnight, 6=sunrise, 12=noon, 18=sunset.
 */
class SkySystem {
  constructor(scene) {
    this._scene = scene;
    this._sunPosition = new THREE.Vector3();

    // Sky shader
    this._sky = new Sky();
    this._sky.scale.setScalar(450000);
    scene.add(this._sky);

    const skyUniforms = this._sky.material.uniforms;
    skyUniforms['turbidity'].value = 4;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // Directional light (sun)
    this._sunLight = new THREE.DirectionalLight(0xfff4e0, 3.0);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.width = 4096;
    this._sunLight.shadow.mapSize.height = 4096;
    this._sunLight.shadow.camera.near = 0.5;
    this._sunLight.shadow.camera.far = 500;
    this._sunLight.shadow.camera.left = -200;
    this._sunLight.shadow.camera.right = 200;
    this._sunLight.shadow.camera.top = 200;
    this._sunLight.shadow.camera.bottom = -200;
    this._sunLight.shadow.bias = -0.0005;
    this._sunLight.shadow.normalBias = 0.02;
    scene.add(this._sunLight);
    scene.add(this._sunLight.target);

    // Hemisphere light (ambient fill)
    this._hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4);
    scene.add(this._hemiLight);

    // Fog
    this._fogColor = new THREE.Color(0xffd89b);
    scene.fog = new THREE.Fog(this._fogColor, 100, 800);

    // Default to golden hour (~17:30)
    this.setTimeOfDay(17.5);
  }

  /**
   * Set time of day.
   * @param {number} hours - Value in [0, 24]: 0=midnight, 6=sunrise, 12=noon, 18=sunset
   */
  setTimeOfDay(hours) {
    const t = (hours % 24) / 24; // normalize to 0-1
    this._time = hours;

    // Sun elevation: sinusoidal arc, sunrise at 6h (t=0.25), peak at 12h (t=0.5), sunset at 18h (t=0.75)
    const elevation = Math.sin((t - 0.25) * Math.PI * 2) * 90;
    // Sun azimuth: sweeps 180 degrees during the day
    const azimuth = THREE.MathUtils.lerp(-180, 180, t);

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    this._sunPosition.setFromSphericalCoords(1, phi, theta);

    // Update sky shader
    this._sky.material.uniforms['sunPosition'].value.copy(this._sunPosition);

    // Update directional light position
    this._sunLight.position.copy(this._sunPosition).multiplyScalar(200);

    // Adjust light intensity and color based on elevation
    const normalizedElevation = Math.max(0, elevation / 90); // 0 at horizon, 1 at zenith
    const sunIntensity = THREE.MathUtils.lerp(0.5, 3.0, normalizedElevation);
    this._sunLight.intensity = sunIntensity;

    // Warm colors at low sun, neutral at high sun
    const warmth = 1 - normalizedElevation;
    this._sunLight.color.setHSL(
      THREE.MathUtils.lerp(0.1, 0.15, warmth), // hue: warm orange to neutral
      THREE.MathUtils.lerp(0.2, 0.6, warmth),  // saturation: more saturated at horizon
      THREE.MathUtils.lerp(1.0, 0.95, warmth)  // lightness
    );

    // Update fog color to match atmosphere
    const fogHue = THREE.MathUtils.lerp(0.15, 0.55, normalizedElevation);
    const fogSat = THREE.MathUtils.lerp(0.5, 0.15, normalizedElevation);
    const fogLight = THREE.MathUtils.lerp(0.65, 0.8, normalizedElevation);
    this._fogColor.setHSL(fogHue, fogSat, fogLight);
    this._scene.fog.color.copy(this._fogColor);

    // Hemisphere light adjustments
    this._hemiLight.intensity = THREE.MathUtils.lerp(0.2, 0.5, normalizedElevation);
  }

  getSunDirection() {
    return this._sunPosition.clone().normalize();
  }

  update(delta) {
    // Could animate time-of-day here if desired
  }

  dispose() {
    this._scene.remove(this._sky);
    this._scene.remove(this._sunLight);
    this._scene.remove(this._sunLight.target);
    this._scene.remove(this._hemiLight);
    this._sky.material.dispose();
    this._sky.geometry.dispose();
  }
}

export default SkySystem;
