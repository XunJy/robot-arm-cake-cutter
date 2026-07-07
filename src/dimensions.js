import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const dimMat = new THREE.LineBasicMaterial({ color: 0x16324a });

function arrowCone(dir, pos) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 10), new THREE.MeshBasicMaterial({ color: 0x16324a }));
  cone.position.copy(pos);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return cone;
}

/**
 * One dimension line: main line with arrowheads at both ends, extension
 * ticks, and a CSS2D value label at the midpoint.
 */
function dimLine(group, a, b, text, tickDir) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A).normalize();
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), dimMat));
  group.add(arrowCone(dir.clone().negate(), A.clone().addScaledVector(dir, 0.25)));
  group.add(arrowCone(dir, B.clone().addScaledVector(dir, -0.25)));
  // extension ticks
  if (tickDir) {
    const t = new THREE.Vector3(...tickDir);
    for (const P of [A, B]) {
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        P.clone().addScaledVector(t, -0.35), P.clone().addScaledVector(t, 0.35),
      ]), dimMat));
    }
  }
  const el = document.createElement('div');
  el.className = 'dim-label';
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.copy(A.clone().add(B).multiplyScalar(0.5));
  group.add(label);
}

export function createDimensions(scene) {
  const g = new THREE.Group();
  g.name = 'dimensions';
  // overall length 2800 (front, near floor)
  dimLine(g, [-14, 0.3, 8.2], [14, 0.3, 8.2], '2800 mm', [0, 0, 1]);
  // overall width 1700 (right end; enclosure deepened for the robot envelope)
  dimLine(g, [16, 0.3, -10.5], [16, 0.3, 6.5], '1700 mm', [1, 0, 0]);
  // overall height 2100 (left-front corner)
  dimLine(g, [-7.6, 0, 7.4], [-7.6, 21, 7.4], '2100 mm', [-1, 0, 1]);
  // belt width 1000 (above infeed end)
  dimLine(g, [-13.3, 9.6, -5], [-13.3, 9.6, 5], 'Belt 1000 mm', [0, 1, 0]);
  g.visible = false;
  scene.add(g);
  return {
    setVisible(v) { g.visible = v; g.traverse(o => { if (o.isCSS2DObject) o.visible = v; }); },
  };
}
