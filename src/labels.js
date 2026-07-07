import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const lineMat = new THREE.LineBasicMaterial({ color: 0x5a6b80, transparent: true, opacity: 0.75 });

/**
 * Creates bilingual leader-line labels for each registry component.
 * Label group is added inside each component group, so labels follow
 * explode offsets automatically.
 */
export function createLabels(components, onSelect) {
  const handles = [];
  for (const c of components) {
    const holder = new THREE.Group();
    holder.name = 'label';

    const geo = new THREE.BufferGeometry().setFromPoints([c.anchor, c.labelPos]);
    const line = new THREE.Line(geo, lineMat);
    holder.add(line);

    const el = document.createElement('div');
    el.className = 'comp-label';
    el.innerHTML = `<span class="en">${c.en}</span><span class="cn">${c.cn}</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(c); });
    const obj = new CSS2DObject(el);
    obj.position.copy(c.labelPos);
    holder.add(obj);

    c.group.add(holder);
    handles.push(holder);
  }
  return {
    setVisible(v) { handles.forEach(h => { h.visible = v; h.traverse(o => { if (o.isCSS2DObject) o.visible = v; }); }); },
  };
}
