import Stats from 'three/addons/libs/stats.module.js';
import { GridHelper, AxesHelper } from 'three';

export function createStats() {
  const stats = new Stats();
  stats.dom.style.position = 'fixed';
  stats.dom.style.top = '0px';
  stats.dom.style.left = '0px';
  stats.dom.style.zIndex = '100';
  document.body.appendChild(stats.dom);
  return stats;
}

export function createGridHelper(scene, size = 500, divisions = 100) {
  const grid = new GridHelper(size, divisions, 0x888888, 0x444444);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);
  return grid;
}

export function createAxesHelper(scene, size = 10) {
  const axes = new AxesHelper(size);
  scene.add(axes);
  return axes;
}
