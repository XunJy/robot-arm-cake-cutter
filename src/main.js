import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMachine } from './machine.js';
import { loadRobot, mountRobot, setPose as setPoseDebug } from './robot.js';
import { createLabels } from './labels.js';
import { createDimensions } from './dimensions.js';
import { createInteractions, highlight, showInfo } from './interactions.js';
import { createExplode } from './explode.js';
import { createDemo } from './demo.js';

const viewport = document.getElementById('viewport');

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.classList.add('label-layer');
viewport.appendChild(labelRenderer.domElement);

// ---------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f5);
scene.fog = new THREE.Fog(0xeef1f5, 90, 220);
// soft studio reflections so metallic materials read correctly
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
const HOME_CAM = new THREE.Vector3(27, 17, 30);
camera.position.copy(HOME_CAM);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 6;
controls.maxDistance = 120;

// ---------------------------------------------------------------- lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x9aa0a6, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(18, 32, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -20;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.4);
fill.position.set(-20, 14, -18);
scene.add(fill);

// ---------------------------------------------------------------- ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0xf1f3f6, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(120, 60, 0xc7cdd6, 0xdde2e9);
grid.position.y = 0.01;
scene.add(grid);

// ---------------------------------------------------------------- build
const { components, dynamics } = buildMachine(scene);

let selected = null;
function select(comp) {
  selected = comp;
  highlight(comp);
  showInfo(comp);
  document.querySelectorAll('#component-tree li').forEach(li => {
    li.classList.toggle('selected', comp && li.dataset.id === comp.id);
  });
}

const chkLabels = document.getElementById('chk-labels');
const btnLabels = document.getElementById('btn-labels');
const labelMgrs = [createLabels(components, select)];
const setLabelsVisible = (v) => {
  const visible = !!v;
  labelMgrs.forEach(m => m.setVisible(visible));
  chkLabels.checked = visible;
  btnLabels.textContent = visible ? 'Hide Labels' : 'Show Labels';
  btnLabels.classList.toggle('active', visible);
};
const dims = createDimensions(scene);
const explode = createExplode(components);
createInteractions({ renderer, camera, components, onSelect: select });

// ---------------------------------------------------------------- sidebar tree
const treeColors = {
  robot: '#e0483c', cutter: '#8e6fd8', conveyor: '#1d55c2',
  upperCover: '#7fb3d9', lowerCover: '#9db4cf', panel: '#8a949c', limitStop: '#d8a12c',
  pusher: '#2aa7a0', lightCurtain: '#ff8b2a', sink: '#8a4638', alarmLight: '#37b34a',
  cakes: '#e6cf3a',
};
function rebuildTree() {
  const ul = document.getElementById('component-tree');
  ul.innerHTML = '';
  for (const c of components) {
    const li = document.createElement('li');
    li.dataset.id = c.id;
    li.innerHTML = `<span class="dot" style="background:${treeColors[c.id] || '#888'}"></span>${c.en}<span class="cn">${c.cn}</span>`;
    li.addEventListener('click', () => select(selected?.id === c.id ? null : c));
    ul.appendChild(li);
  }
}
rebuildTree();

// ---------------------------------------------------------------- robot load
let demo = null;
loadRobot()
  .then((robot) => {
    const { group, endEffector } = mountRobot(robot);
    scene.add(group);

    components.push({
      id: 'robot', en: 'Six-axis Robot ABB IRB 1200', cn: '六轴机器人',
      group, anchor: new THREE.Vector3(-1.5, 14.2, -6.0), labelPos: new THREE.Vector3(-6.5, 19, -9.5),
      explode: new THREE.Vector3(-1, 3.5, -3.5),
      params: [
        ['Model', 'ABB IRB 1200-5/90'], ['Axes', '6'], ['Reach', '900 mm'],
        ['Payload', '5 kg'], ['Mounting', 'Pedestal on table'],
        ['Drive', 'robot.setJointValue(joint_1…6)'],
      ],
    });
    components.push({
      id: 'cutter', en: 'Ultrasonic Cutting Unit', cn: '超声波切割组件',
      group: endEffector, anchor: new THREE.Vector3(0, -0.28, 0), labelPos: new THREE.Vector3(0.55, 0.1, 0.55),
      explode: new THREE.Vector3(0, 0, 0),
      params: [
        ['Ultrasonic frequency', '20 kHz'], ['Ultrasonic power', '2500 W'],
        ['Knife width', '600 mm (full line in one plunge)'], ['Knife material', 'Titanium alloy'],
        ['Knives', '1 (cross cuts keep the across-belt blade; wrist rotates 90° for lengthwise cuts)'],
        ['Structure', 'Converter → Amplitude modulator → Knife'],
        ['Power supply', '380 V / 50 Hz'], ['Air source', '0.6 – 1 MPa'],
      ],
    });
    rebuildTree();

    // labels for the two new components
    labelMgrs.push(createLabels(components.slice(-2), select));
    setLabelsVisible(chkLabels.checked);

    // re-init explode with robot included (force-assemble first)
    explodeRef.reset();
    explodeRef.update(10);
    explodeRef = createExplode(components);

    demo = createDemo({ robot, endEffector, dynamics });

    // one button per work-cycle action
    const actWrap = document.getElementById('action-buttons');
    demo.actions.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `<span class="num">${i + 1}</span>${a.label}`;
      b.addEventListener('click', () => {
        explodeRef.reset();
        btnExplode.classList.remove('active');
        demo.playAction(a.id);
        btnDemo.textContent = 'Run Demo';
        btnDemo.classList.remove('active');
        actWrap.querySelectorAll('.btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
      actWrap.appendChild(b);
    });

    // debug hooks (used for pose tuning)
    window.__robot = robot;
    window.__demo = demo;
    window.__dyn = dynamics;
    window.__setPose = (p) => { setPoseDebug(robot, p); };

    document.getElementById('loading-overlay').classList.add('done');
  })
  .catch((err) => {
    console.error('Robot load failed:', err);
    document.querySelector('#loading-overlay p').textContent = 'Failed to load robot model — see console.';
  });

let explodeRef = explode;

// ---------------------------------------------------------------- UI wiring
chkLabels.addEventListener('change', (e) => setLabelsVisible(e.target.checked));
btnLabels.addEventListener('click', () => setLabelsVisible(!chkLabels.checked));
document.getElementById('chk-dims').addEventListener('change', (e) => dims.setVisible(e.target.checked));

const btnExplode = document.getElementById('btn-explode');
btnExplode.addEventListener('click', () => {
  if (demo?.running) return;
  const on = explodeRef.toggle();
  btnExplode.classList.toggle('active', on);
});

const btnDemo = document.getElementById('btn-demo');
const clearActionActive = () =>
  document.querySelectorAll('#action-buttons .btn').forEach(x => x.classList.remove('active'));
btnDemo.addEventListener('click', () => {
  if (!demo) return;
  clearActionActive();
  if (demo.running) {
    demo.stop();
    btnDemo.textContent = 'Run Demo';
    btnDemo.classList.remove('active');
  } else {
    explodeRef.reset();
    btnExplode.classList.remove('active');
    demo.start();
    btnDemo.textContent = 'Stop Demo';
    btnDemo.classList.add('active');
  }
});

document.getElementById('btn-reset-view').addEventListener('click', () => {
  camera.position.copy(HOME_CAM);
  controls.target.set(0, 8, 0);
});
document.getElementById('info-close').addEventListener('click', () => select(null));

// debug camera hook
window.__setCam = (px, py, pz, tx = 0, ty = 8, tz = 0) => {
  camera.position.set(px, py, pz);
  controls.target.set(tx, ty, tz);
};
// debug: deterministically advance the running demo to an absolute cycle time
window.__step = (toSeconds) => {
  if (!demo) return 'no-demo';
  if (!demo.running) demo.start();
  demo.stop(); demo.start();
  const dt = 1 / 60;
  for (let t = 0; t < toSeconds; t += dt) demo.update(dt);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  return 'at ' + toSeconds + 's';
};

// ---------------------------------------------------------------- resize/loop
function onResize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

const clockTHREE = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clockTHREE.getDelta(), 0.05);
  controls.update();
  explodeRef.update(dt);
  if (demo?.running) {
    demo.update(dt);
    if (!demo.running) { // playback just finished on its own
      btnDemo.textContent = 'Run Demo';
      btnDemo.classList.remove('active');
      clearActionActive();
    }
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
tick();
