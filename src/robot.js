import * as THREE from 'three';
import { XacroLoader } from 'xacro-parser';
import URDFLoader from 'urdf-loader';
import { MAT, buildPedestal } from './machine.js';

// The URDF is authored in meters, Z-up. Project scale is 1 unit = 100 mm,
// so scale ×10 and rotate X by -90° to make Y point up.

const ABB_WHITE = new THREE.MeshStandardMaterial({ color: 0xECECE7, metalness: 0.15, roughness: 0.45 });
const ABB_GRAY = new THREE.MeshStandardMaterial({ color: 0x8f9499, metalness: 0.4, roughness: 0.5 });

/**
 * Builds one ultrasonic cutting unit in METER scale (it is attached under the
 * scaled URDF frame): converter cylinder → amplitude modulator → titanium
 * comb knife (600 mm wide, vertical slots).
 * Built pointing down local -Y, blade plane = local YZ (blade width along Z).
 */
function buildCutterUnit() {
  const g = new THREE.Group();
  const m = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  // converter (transducer) cylinder
  m(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 20), MAT.steel, 0, -0.065, 0);
  m(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 20), MAT.black, 0, -0.135, 0);
  // amplitude modulator (booster, tapered)
  m(new THREE.CylinderGeometry(0.034, 0.024, 0.09, 20), MAT.chrome, 0, -0.19, 0);
  // holder flange + horn bar spanning the blade
  m(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 20), MAT.titanium, 0, -0.24, 0);
  m(new THREE.BoxGeometry(0.03, 0.05, 0.56), MAT.chrome, 0, -0.265, 0);
  // knife: titanium comb blade, 600 mm wide (local Z) → one plunge per line
  m(new THREE.BoxGeometry(0.012, 0.115, 0.6), MAT.titanium, 0, -0.335, 0);
  // cutting edge (thin wedge look)
  m(new THREE.BoxGeometry(0.004, 0.02, 0.6), MAT.chrome, 0, -0.4, 0);
  // vertical relief slots
  for (let i = 0; i < 8; i++) {
    m(new THREE.BoxGeometry(0.014, 0.07, 0.012), MAT.black, 0, -0.32, -0.245 + i * 0.07);
  }
  return g;
}

/** Full end-effector: mounting flange + a single cutter unit. The wrist
 *  (joint_6) rotates the blade 90° between cross and lengthwise cuts. */
export function buildEndEffector() {
  const g = new THREE.Group();
  g.name = 'comp:cutter';
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.022, 20), MAT.brushed);
  mount.castShadow = mount.receiveShadow = true;
  g.add(mount);
  const unit = buildCutterUnit();
  unit.position.set(0, -0.012, 0);
  g.add(unit);
  // blade tip reference for IK / demo
  const tip = new THREE.Object3D();
  tip.name = 'tip';
  tip.position.set(0, -0.4, 0);
  g.add(tip);
  return g;
}

export function loadRobot() {
  return new Promise((resolve, reject) => {
    const modelBase = `${import.meta.env.BASE_URL}models`;
    const xacroUrl = `${modelBase}/abb_irb1200_support/urdf/irb1200_5_90.xacro`;
    const xacroLoader = new XacroLoader();
    xacroLoader.rospackCommands = { find: (pkg) => `${modelBase}/${pkg}` };
    xacroLoader.load(
      xacroUrl,
      (xml) => {
        const manager = new THREE.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.packages = {
          abb_irb1200_support: `${modelBase}/abb_irb1200_support`,
          abb_resources: `${modelBase}/abb_resources`,
        };
        const robot = loader.parse(xml);
        manager.onLoad = () => {
          // normalize materials (ABB white + graphite accents)
          robot.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
              c.material = ABB_WHITE;
            }
          });
          resolve(robot);
        };
        manager.onError = (url) => console.warn('Failed to load mesh:', url);
      },
      reject
    );
  });
}

/**
 * Places the robot on its pedestal inside the enclosure and attaches the
 * ultrasonic end effector to tool0.
 * Returns { group, robot, endEffector } — group is the registrable component.
 */
export function mountRobot(robot) {
  const group = new THREE.Group();
  const ped = buildPedestal(group);

  // orientation wrapper: URDF Z-up → Y-up, robot forward (+X URDF) → world +Z (toward belt)
  const orient = new THREE.Group();
  orient.rotation.y = -Math.PI / 2;
  orient.position.set(ped.x, ped.baseY, ped.z);
  robot.rotation.x = -Math.PI / 2;
  robot.scale.setScalar(10);
  orient.add(robot);
  group.add(orient);

  const endEffector = buildEndEffector();
  const tool0 = robot.frames?.tool0 || robot.links?.tool0;
  if (tool0) {
    // tool0: Z out of flange → hang cutter along +Z, blades pointing away from flange
    endEffector.rotation.x = -Math.PI / 2; // local -Y (blade dir) → +Z of flange
    tool0.add(endEffector);
  }
  return { group, robot, endEffector };
}

/** Clamped joint pose helper. */
export function setPose(robot, pose) {
  for (let i = 0; i < 6; i++) {
    const name = `joint_${i + 1}`;
    const j = robot.joints[name];
    if (!j) continue;
    const lo = j.limit?.lower ?? -Math.PI, hi = j.limit?.upper ?? Math.PI;
    robot.setJointValue(name, THREE.MathUtils.clamp(pose[i], lo, hi));
  }
}
