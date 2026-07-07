import * as THREE from 'three';

/**
 * Click-to-select: raycasts registry component groups, applies an emissive
 * highlight, fills the info panel, and syncs the sidebar tree.
 */
export function createInteractions({ renderer, camera, components, onSelect }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downXY = null;

  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!downXY) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null;
    if (dx * dx + dy * dy > 25) return; // was a drag, not a click
    const rect = el.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const groups = components.map(c => c.group);
    const hits = raycaster.intersectObjects(groups, true);
    for (const hit of hits) {
      if (hit.object.name === 'acrylic') continue; // click through the clear cover
      let o = hit.object;
      while (o) {
        if (o.name?.startsWith('comp:')) {
          const id = o.name.slice(5);
          const comp = components.find(c => c.id === id);
          if (comp) { onSelect(comp); return; }
        }
        o = o.parent;
      }
    }
    onSelect(null);
  });
}

// ---------------------------------------------------------------- highlight
const saved = new Map();

export function highlight(comp) {
  clearHighlight();
  if (!comp) return;
  comp.group.traverse((o) => {
    if (o.isMesh && o.material && o.name !== 'acrylic') {
      if (!saved.has(o)) saved.set(o, o.material);
      const m = o.material.clone();
      if ('emissive' in m) {
        m.emissive = new THREE.Color(0x1668dc);
        m.emissiveIntensity = 0.35;
      }
      o.material = m;
    }
  });
}

export function clearHighlight() {
  for (const [mesh, mat] of saved) mesh.material = mat;
  saved.clear();
}

// ---------------------------------------------------------------- info panel
const panelEl = () => document.getElementById('infopanel');

export function showInfo(comp) {
  const p = panelEl();
  if (!comp) { p.classList.add('hidden'); return; }
  document.getElementById('info-title').textContent = comp.en;
  document.getElementById('info-subtitle').textContent = comp.cn;
  const table = document.getElementById('info-table');
  table.innerHTML = comp.params.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  p.classList.remove('hidden');
}
