import * as THREE from 'three';
import { ROBOT_X } from './machine.js';
import { setPose } from './robot.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const span = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _axis = new THREE.Vector3(), _org = new THREE.Vector3(), _q = new THREE.Quaternion();

function jointValue(j) { return Array.isArray(j.jointValue) ? j.jointValue[0] : j.angle; }

function clampToLimit(j, v) {
  const lo = j.limit?.lower ?? -Math.PI, hi = j.limit?.upper ?? Math.PI;
  return THREE.MathUtils.clamp(v, lo, hi);
}

function shortestAngleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function nearestJointValue(j, v, ref) {
  const lo = j.limit?.lower ?? -Infinity, hi = j.limit?.upper ?? Infinity;
  let best = clampToLimit(j, v);
  let bestDist = Math.abs(best - ref);
  for (let k = -2; k <= 2; k++) {
    const candidate = v + k * TAU;
    if (candidate < lo || candidate > hi) continue;
    const dist = Math.abs(candidate - ref);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/** blade-down error angle (rad) of the end effector */
function downError(eff) {
  eff.getWorldQuaternion(_q);
  _v1.set(0, -1, 0).applyQuaternion(_q);
  return _v1.angleTo(DOWN);
}

/** hill-climb a single joint to minimize an error function */
function tuneJoint(robot, name, errFn, steps = [0.5, 0.25, 0.12, 0.06, 0.03]) {
  const j = robot.joints[name];
  if (!j) return;
  for (const s of steps) {
    for (let k = 0; k < 4; k++) {
      const cur = jointValue(j);
      const e0 = errFn();
      robot.setJointValue(name, clampToLimit(j, cur + s));
      robot.updateMatrixWorld(true);
      const ePlus = errFn();
      robot.setJointValue(name, clampToLimit(j, cur - s));
      robot.updateMatrixWorld(true);
      const eMinus = errFn();
      const best = Math.min(e0, ePlus, eMinus);
      const v = best === e0 ? cur : best === ePlus ? cur + s : cur - s;
      robot.setJointValue(name, clampToLimit(j, v));
      robot.updateMatrixWorld(true);
      if (best === e0) break;
    }
  }
}

/**
 * Numeric IK (CCD + hill climb), used once at startup to precompute poses.
 * Places the blade tip at `target` (world) with the blade pointing down and
 * the blade's long axis aligned to `bladeAxis` ('z' = across the belt,
 * 'x' = along the belt / parallel to the sink).
 */
export function solveIK(robot, eff, tip, target, seed, bladeAxis = 'z') {
  setPose(robot, seed);
  robot.updateMatrixWorld(true);
  const ref = bladeAxis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  eff.getWorldQuaternion(_q);
  _v1.set(0, 0, 1).applyQuaternion(_q);
  _v1.y = 0;
  if (_v1.lengthSq() > 1e-8 && _v1.normalize().dot(ref) < 0) ref.negate();
  const posErr = () => tip.getWorldPosition(_v3).distanceTo(target);

  for (let iter = 0; iter < 40; iter++) {
    for (const name of ['joint_1', 'joint_2', 'joint_3']) {
      const j = robot.joints[name];
      j.getWorldPosition(_org);
      _axis.copy(j.axis).transformDirection(j.matrixWorld).normalize();
      tip.getWorldPosition(_v1).sub(_org);
      _v2.copy(target).sub(_org);
      _v1.addScaledVector(_axis, -_v1.dot(_axis));
      _v2.addScaledVector(_axis, -_v2.dot(_axis));
      if (_v1.lengthSq() < 1e-8 || _v2.lengthSq() < 1e-8) continue;
      let ang = _v1.angleTo(_v2);
      _v3.crossVectors(_v1, _v2);
      if (_v3.dot(_axis) < 0) ang = -ang;
      robot.setJointValue(name, clampToLimit(j, jointValue(j) + ang * 0.6));
      robot.updateMatrixWorld(true);
    }
    tuneJoint(robot, 'joint_5', () => downError(eff), [0.4, 0.15, 0.05]);
    if (posErr() < 0.02 && downError(eff) < 0.05) break;
  }
  tuneJoint(robot, 'joint_6', () => {
    eff.getWorldQuaternion(_q);
    _v1.set(0, 0, 1).applyQuaternion(_q); // blade long axis (local Z)
    _v1.y = 0;
    if (_v1.lengthSq() < 1e-8) return 1;
    return 1 - THREE.MathUtils.clamp(_v1.normalize().dot(ref), -1, 1);
  });
  if (seed?.length >= 6 && robot.joints.joint_6) {
    robot.setJointValue('joint_6', nearestJointValue(robot.joints.joint_6, jointValue(robot.joints.joint_6), seed[5]));
    robot.updateMatrixWorld(true);
  }
  const pose = [];
  for (let i = 1; i <= 6; i++) pose.push(jointValue(robot.joints[`joint_${i}`]));
  return pose;
}

const lerpPose = (a, b, t, out) => {
  for (let i = 0; i < 6; i++) {
    out[i] = i === 5 ? a[i] + shortestAngleDelta(a[i], b[i]) * t : a[i] + (b[i] - a[i]) * t;
  }
  return out;
};

/**
 * Segment-based work cycle. Each segment is independently playable from the
 * Action buttons; "Run Demo" chains all of them in an endless loop:
 *   feed → cross cuts → lengthwise cuts → wash → discharge
 */
export function createDemo({ robot, endEffector, dynamics }) {
  const tip = endEffector.getObjectByName('tip');
  const cake = dynamics.cakes[dynamics.cakes.length - 1];
  const others = dynamics.cakes.slice(0, -1);
  const gate = dynamics.limitMoving;
  const pusher = dynamics.pusherMoving;

  const CAKE_START = -11, CAKE_SHORT = -0.95, CAKE_STATION = -0.7, CAKE_EXIT = 10.8;
  const CUT_Y = 8.62, HOVER_Y = 10.6;

  // ---------- precompute poses (numeric IK) ----------
  const HOME = solveIK(robot, endEffector, tip, new THREE.Vector3(ROBOT_X, 12.2, -2.0), [0, 0.3, -0.3, 0, 1.2, 0]);
  // 3 cross lines: one plunge each (blade spans the full 500 mm width)
  const cross = [];
  for (const x of [-2.2, -0.7, 0.8]) {
    const seed = cross.length ? cross[cross.length - 1].cut : HOME;
    const hover = solveIK(robot, endEffector, tip, new THREE.Vector3(x, HOVER_Y, 0), seed, 'z');
    const cut = solveIK(robot, endEffector, tip, new THREE.Vector3(x, CUT_Y, 0), hover, 'z');
    cross.push({ hover, cut });
  }
  // 2 lengthwise lines: one plunge each (blade spans the full 600 mm length)
  const lengthw = [];
  for (const z of [-0.85, 0.85]) {
    const seed = lengthw.length ? lengthw[lengthw.length - 1].cut : HOME;
    const hover = solveIK(robot, endEffector, tip, new THREE.Vector3(-0.7, HOVER_Y, z), seed, 'x');
    const cut = solveIK(robot, endEffector, tip, new THREE.Vector3(-0.7, CUT_Y, z), hover, 'x');
    lengthw.push({ hover, cut });
  }
  // wash: rotate and travel at a higher clearance, then descend only over the sink.
  const washLift = solveIK(robot, endEffector, tip, new THREE.Vector3(0.0, 12.75, -3.6), HOME, 'x');
  const sinkEntry = solveIK(robot, endEffector, tip, new THREE.Vector3(2.1, 12.65, -6.75), washLift, 'x');
  const sinkHover = solveIK(robot, endEffector, tip, new THREE.Vector3(3.85, 11.85, -7.9), sinkEntry, 'x');
  const sinkDip = solveIK(robot, endEffector, tip, new THREE.Vector3(3.85, 9.02, -7.9), sinkHover, 'x');
  setPose(robot, HOME);
  robot.updateMatrixWorld(true);

  // ---------- helpers ----------
  const curPose = [...HOME];
  function playKf(kf, tNow) {
    if (tNow <= kf[0].t) { setPose(robot, kf[0].pose); return; }
    for (let i = 0; i < kf.length - 1; i++) {
      if (tNow >= kf[i].t && tNow <= kf[i + 1].t) {
        const sp = kf[i + 1].t - kf[i].t;
        const k = sp > 0 ? smooth((tNow - kf[i].t) / sp) : 1;
        setPose(robot, lerpPose(kf[i].pose, kf[i + 1].pose, k, curPose));
        return;
      }
    }
    setPose(robot, kf[kf.length - 1].pose);
  }
  function beltRun(dt) {
    dynamics.beltTex.offset.x += dt * 1.1;
    for (const r of dynamics.rollers) r.rotateY(dt * 5);
  }
  const gateY = (k) => gate.userData.downY + (gate.userData.upY - gate.userData.downY) * k;
  function setGate(k) {
    const v = THREE.MathUtils.clamp(k, 0, 1);
    if (gate.userData.setEngaged) gate.userData.setEngaged(v);
    else gate.position.y = gateY(v);
  }
  const snapStation = () => { cake.visible = true; cake.position.x = CAKE_STATION; cake.position.z = 0; };

  /** build a plunge keyframe list starting and ending at HOME */
  function plungeKf(list, approach) {
    const kf = [{ t: 0, pose: HOME }];
    let t = approach;
    const reveals = [];
    for (const p of list) {
      kf.push({ t, pose: p.hover });
      kf.push({ t: t + 0.5, pose: p.cut });
      reveals.push(t + 0.5);
      kf.push({ t: t + 0.7, pose: p.cut });
      kf.push({ t: t + 1.2, pose: p.hover });
      t += 1.7;
    }
    kf.push({ t: t + 0.7, pose: HOME });
    return { kf, reveals, dur: t + 0.9 };
  }
  const crossK = plungeKf(cross, 1.1);
  const lengthK = plungeKf(lengthw, 1.4);   // extra time: wrist rotates the blade 90°

  // wash keyframes
  const washKf = [
    { t: 0, pose: HOME },
    { t: 0.8, pose: washLift },
    { t: 1.6, pose: sinkEntry },
    { t: 2.4, pose: sinkHover },
    { t: 3.1, pose: sinkDip },
  ];
  for (let i = 0; i < 3; i++) {
    const w = [...sinkDip];
    w[5] = sinkDip[5] + (i % 2 ? -0.09 : 0.09);   // gentle rinse wiggle (long blade)
    washKf.push({ t: 3.5 + i * 0.4, pose: w });
  }
  washKf.push(
    { t: 4.9, pose: sinkDip },
    { t: 5.5, pose: sinkHover },
    { t: 6.2, pose: sinkEntry },
    { t: 6.9, pose: washLift },
    { t: 7.6, pose: HOME },
  );

  // ---------- segments ----------
  const segments = {
    feed: {
      label: 'Feed & Position',
      dur: 7.4,
      init() {
        cake.visible = true;
        cake.position.set(CAKE_START, cake.position.y, 0);
        dynamics.cutSegs.forEach(s => (s.visible = false));
        setGate(0);
        pusher.position.y = pusher.userData.upY;
        pusher.position.x = 0;
        setPose(robot, HOME);
      },
      tick(t, dt) {
        // belt in, cake stops slightly short of the gate
        if (t < 4.0) {
          cake.position.x = CAKE_START + (CAKE_SHORT - CAKE_START) * easeOutCubic(span(t, 0.2, 4.0));
          beltRun(dt);
        }
        // pusher: drop → nudge (presses cake against the gate) → retract → lift
        pusher.position.y = pusher.userData.upY * (1 - smooth(span(t, 4.2, 5.0)) + smooth(span(t, 6.4, 7.2)));
        const nudge = pusher.userData.nudge * (smooth(span(t, 5.2, 5.6)) - smooth(span(t, 5.9, 6.3)));
        pusher.position.x = nudge;
        if (t >= 5.2) {
          const face = pusher.userData.restFace + nudge;
          cake.position.x = Math.max(cake.position.x, Math.min(face + 3.0, CAKE_STATION));
        }
        const gateEngaged = smooth(span(t, 2.65, 3.15)) - smooth(span(t, 6.45, 7.15));
        setGate(gateEngaged);
      },
    },
    cross: {
      label: 'Cross Cuts',
      dur: crossK.dur,
      init() {
        snapStation();
        setGate(0);
        pusher.position.y = pusher.userData.upY;
        pusher.position.x = 0;
        dynamics.cutSegs.slice(0, 3).forEach(s => (s.visible = false));
      },
      tick(t) {
        crossK.reveals.forEach((rt, i) => { dynamics.cutSegs[i].visible = t >= rt; });
        playKf(crossK.kf, t);
      },
    },
    lengthwise: {
      label: 'Lengthwise Cuts',
      dur: lengthK.dur,
      init() {
        snapStation();
        setGate(0);
        pusher.position.y = pusher.userData.upY;
        pusher.position.x = 0;
        dynamics.cutSegs.slice(3, 5).forEach(s => (s.visible = false));
      },
      tick(t) {
        lengthK.reveals.forEach((rt, i) => { dynamics.cutSegs[3 + i].visible = t >= rt; });
        playKf(lengthK.kf, t);
      },
    },
    wash: {
      label: 'Wash Knife',
      dur: 7.8,
      init() {
        setGate(0);
        pusher.position.y = pusher.userData.upY;
        pusher.position.x = 0;
        setPose(robot, HOME);
      },
      tick(t) {
        setGate(0);
        playKf(washKf, t);
      },
    },
    discharge: {
      label: 'Discharge',
      dur: 6.4,
      init() {
        snapStation();
        setGate(0);
        pusher.position.y = pusher.userData.upY;
        pusher.position.x = 0;
        setPose(robot, HOME);
      },
      tick(t, dt) {
        if (t >= 0.4 && t <= 4.6) {
          cake.position.x = CAKE_STATION + (CAKE_EXIT - CAKE_STATION) * smooth(span(t, 0.4, 4.6));
          beltRun(dt);
        }
        setGate(0);
      },
    },
  };
  const cycleOrder = ['feed', 'cross', 'lengthwise', 'wash', 'discharge'];

  // ---------- sequencer ----------
  let playlist = [];
  let looping = false;
  let idx = 0, tSeg = 0;
  let running = false;
  const staticPos = dynamics.cakes.map(c => c.position.x);

  function begin(names, loop) {
    playlist = names.map(n => segments[n]);
    looping = loop;
    idx = 0; tSeg = 0;
    running = true;
    others.forEach(c => (c.visible = false));
    dynamics.lamps.green.material = dynamics.lamps.green.material.clone();
    dynamics.lamps.green.material.emissiveIntensity = 1.4;
    playlist[0].init();
  }

  return {
    get running() { return running; },
    get poses() { return { HOME, cross, lengthw, washLift, sinkEntry, sinkHover, sinkDip, segments }; },
    actions: cycleOrder.map(n => ({ id: n, label: segments[n].label })),
    start() { begin(cycleOrder, true); },
    playAction(name) { begin([name], false); },
    stop() {
      running = false;
      dynamics.cakes.forEach((c, i) => { c.visible = true; c.position.x = staticPos[i]; c.position.z = 0; });
      dynamics.cutSegs.forEach(s => (s.visible = false));
      setGate(0);
      pusher.position.y = pusher.userData.upY;
      pusher.position.x = 0;
      setPose(robot, HOME);
      dynamics.lamps.green.material.emissiveIntensity = 0.5;
    },
    update(dt) {
      if (!running) return;
      tSeg += dt;
      const seg = playlist[idx];
      seg.tick(Math.min(tSeg, seg.dur), dt);
      dynamics.lamps.green.material.emissiveIntensity = 1.0 + 0.5 * Math.sin(performance.now() / 160);
      if (tSeg >= seg.dur) {
        idx++;
        tSeg = 0;
        if (idx >= playlist.length) {
          if (looping) idx = 0;
          else { running = false; dynamics.lamps.green.material.emissiveIntensity = 0.5; return; }
        }
        playlist[idx].init();
      }
    },
  };
}
