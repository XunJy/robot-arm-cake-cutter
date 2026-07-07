import * as THREE from 'three';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Explode view: slides each component group along its registered direction
 * with an eased animation. Groups animate their position offset, so labels
 * and child meshes follow.
 */
export function createExplode(components) {
  let progress = 0;      // 0 = assembled, 1 = exploded
  let target = 0;
  const DURATION = 0.9;  // seconds

  for (const c of components) {
    c._home = c.group.position.clone();
    c._offset = new THREE.Vector3(...(c.explode?.toArray?.() ?? [0, 0, 0]));
    if (c.explode && !c.explode.isVector3) c._offset = new THREE.Vector3(...c.explode);
  }

  return {
    get exploded() { return target === 1; },
    toggle() { target = target === 1 ? 0 : 1; return target === 1; },
    reset() { target = 0; },
    update(dt) {
      if (progress === target) return;
      const dir = Math.sign(target - progress);
      progress = THREE.MathUtils.clamp(progress + (dir * dt) / DURATION, 0, 1);
      const k = easeInOutCubic(progress);
      for (const c of components) {
        c.group.position.copy(c._home).addScaledVector(c._offset, k * 1.0);
      }
    },
  };
}
