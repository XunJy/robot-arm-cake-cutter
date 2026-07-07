import * as THREE from 'three';
import { makeHMITexture, makeTextPlateTexture, makeWarnStickerTexture, makeBeltTexture, makeEStopBaseTexture } from './hmi.js';

// Scale: 1 Three.js unit = 100 mm.
// Machine envelope: X ∈ [-14,14] (2800), Z ∈ [-10.5,6.5] (1700), Y up (2100 → y=21).
// +Z is the machine front (cabinet doors + operator panel), +X is the outfeed side.
// The belt (1000 wide, centred on z=0) runs near the front; the enclosure
// extends rearwards so the robot working envelope stays fully inside it.

export const BELT_TOP = 8.5;      // 850 mm
export const CAKE_H = 0.9;        // 90 mm
export const PLATE_X = 2.4;       // limit-stop plate position
export const BACK_Z = -10.15;     // rear wall of the enclosure
export const ENC_X = 7.65;        // enclosure frame half-length (extended for robot clearance)
export const ROBOT_X = -1.5;      // robot base centre
export const ROBOT_Z = -6.0;

// ---------------------------------------------------------------- materials
export const MAT = {
  alu:       new THREE.MeshStandardMaterial({ color: 0xd7dce1, metalness: 0.65, roughness: 0.42 }),
  aluDark:   new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.5 }),
  steel:     new THREE.MeshStandardMaterial({ color: 0xb9bfc6, metalness: 0.8, roughness: 0.35 }),
  chrome:    new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 0.95, roughness: 0.18 }),
  brushed:   new THREE.MeshStandardMaterial({ color: 0xcdd1d4, metalness: 0.8, roughness: 0.4 }),
  cabinet:   new THREE.MeshStandardMaterial({ color: 0xb5c8de, metalness: 0.25, roughness: 0.6 }),
  cabinetDk: new THREE.MeshStandardMaterial({ color: 0x9db1ca, metalness: 0.25, roughness: 0.6 }),
  beltBlue:  new THREE.MeshStandardMaterial({ color: 0x1d55c2, metalness: 0.1, roughness: 0.75 }),
  cake:      new THREE.MeshStandardMaterial({ color: 0xf2df6a, metalness: 0.0, roughness: 0.92 }),
  cakeDark:  new THREE.MeshStandardMaterial({ color: 0xc9a83f, metalness: 0.0, roughness: 0.95 }),
  acrylic:   new THREE.MeshPhysicalMaterial({
    color: 0xeaf4fb, transparent: true, opacity: 0.1, roughness: 0.05,
    metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  }),
  darkPlastic: new THREE.MeshStandardMaterial({ color: 0x33383d, metalness: 0.3, roughness: 0.6 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.4, roughness: 0.55 }),
  titanium:  new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.85, roughness: 0.3 }),
  sinkBrown: new THREE.MeshStandardMaterial({ color: 0x8a4638, metalness: 0.35, roughness: 0.5 }),
  water:     new THREE.MeshPhysicalMaterial({ color: 0x7fb8dc, transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0 }),
  estopYellow: new THREE.MeshStandardMaterial({ color: 0xf6c90e, metalness: 0.2, roughness: 0.5 }),
  estopRed:  new THREE.MeshStandardMaterial({ color: 0xc41414, metalness: 0.25, roughness: 0.45 }),
  btnBlue:   new THREE.MeshStandardMaterial({ color: 0x1f5fd0, metalness: 0.35, roughness: 0.4 }),
  lampRed:   new THREE.MeshStandardMaterial({ color: 0xd23a2e, emissive: 0x881410, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 }),
  lampYellow:new THREE.MeshStandardMaterial({ color: 0xe8c229, emissive: 0x8a6d0a, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 }),
  lampGreen: new THREE.MeshStandardMaterial({ color: 0x37b34a, emissive: 0x0e6b1e, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 }),
  lcBody:    new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.5, roughness: 0.5 }),
  lcGlow:    new THREE.MeshStandardMaterial({ color: 0xff8b2a, emissive: 0xff7300, emissiveIntensity: 1.1 }),
  screenBezel: new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.4, roughness: 0.5 }),
};

// ---------------------------------------------------------------- helpers
function box(g, w, h, d, mat, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  if (opts.name) m.name = opts.name;
  g.add(m);
  return m;
}

function cyl(g, r, h, mat, x, y, z, axis = 'y', seg = 24, opts = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// ---------------------------------------------------------------- registry
/** Component registry entry factory */
function reg(list, id, en, cn, group, anchor, labelPos, explode, params) {
  group.name = `comp:${id}`;
  const c = { id, en, cn, group, anchor, labelPos, explode, params };
  list.push(c);
  return c;
}

// ================================================================ conveyor
function buildConveyor(x0, x1, legXs, beltTexture) {
  const g = new THREE.Group();
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;

  // side rails (aluminium profile)
  for (const zs of [-5.25, 5.25]) {
    box(g, len, 0.85, 0.35, MAT.alu, cx, 7.85, zs);
    box(g, len, 0.12, 0.5, MAT.aluDark, cx, 8.34, zs); // top lip
  }
  // end rollers
  for (const rx of [x0 + 0.5, x1 - 0.5]) {
    const roller = cyl(g, 0.48, 10.15, MAT.steel, rx, 8.0, 0, 'z', 28);
    roller.userData.isRoller = true;
  }
  // belt: top run (textured), bottom run
  const beltTopGeo = new THREE.BoxGeometry(len - 0.55, 0.14, 10);
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTexture, metalness: 0.1, roughness: 0.8 });
  beltTexture.repeat.set(len / 2.2, 1);
  const beltTop = new THREE.Mesh(beltTopGeo, beltMat);
  beltTop.position.set(cx, BELT_TOP - 0.07, 0);
  beltTop.castShadow = true; beltTop.receiveShadow = true;
  g.add(beltTop);
  box(g, len - 1.0, 0.12, 10, MAT.beltBlue, cx, 7.55, 0);

  // legs (aluminium H-frames with casters + levelling feet)
  for (const lx of legXs) {
    for (const zs of [-4.6, 4.6]) {
      box(g, 0.42, 6.9, 0.42, MAT.alu, lx, 3.95, zs);
      // caster
      box(g, 0.34, 0.22, 0.34, MAT.black, lx, 0.62, zs);
      cyl(g, 0.26, 0.2, MAT.darkPlastic, lx, 0.3, zs, 'x', 18);
      // levelling foot
      cyl(g, 0.06, 0.5, MAT.steel, lx + 0.42, 0.35, zs, 'y', 10);
      cyl(g, 0.18, 0.08, MAT.black, lx + 0.42, 0.1, zs, 'y', 14);
    }
    box(g, 0.42, 0.42, 9.2, MAT.alu, lx, 1.4, 0);   // lower cross bar
    box(g, 0.42, 0.42, 9.2, MAT.alu, lx, 7.2, 0);   // upper cross bar
  }
  return { group: g, beltTexture };
}

// ================================================================ lower cover
function buildLowerCover() {
  const g = new THREE.Group();
  const W = 15.6; // cabinet length (follows the extended enclosure)
  // front slab beside the belt, deep rear cabinet (robot table), center block under belt
  box(g, W, 7.95, 1.0, MAT.cabinet, 0, 4.45, 5.9);        // front slab
  box(g, W, 7.95, 4.95, MAT.cabinet, 0, 4.45, -7.825);    // rear cabinet
  box(g, W, 6.85, 9.8, MAT.cabinet, 0, 3.9, 0);           // center block (under belt)
  // stainless deck strips on top (table surface)
  box(g, W + 0.1, 0.14, 1.15, MAT.brushed, 0, 8.47, 5.9);
  box(g, W + 0.1, 0.14, 5.05, MAT.brushed, 0, 8.47, -7.825);

  // double doors on the front face
  for (const s of [-1, 1]) {
    const door = box(g, 6.8, 6.1, 0.1, MAT.cabinetDk, s * 3.55, 3.95, 6.44);
    door.name = 'door';
    // handle
    cyl(g, 0.06, 1.1, MAT.chrome, s * 0.5, 4.0, 6.55, 'y', 10);
    box(g, 0.06, 0.1, 0.14, MAT.chrome, s * 0.5, 4.5, 6.5);
    box(g, 0.06, 0.1, 0.14, MAT.chrome, s * 0.5, 3.5, 6.5);
    // vent grille (dark slats)
    for (let i = 0; i < 5; i++) {
      box(g, 3.4, 0.14, 0.05, MAT.darkPlastic, s * 3.55, 1.7 + i * 0.32, 6.5, { shadow: false });
    }
  }
  // vent grilles on the rear face
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(g, 2.6, 0.14, 0.05, MAT.darkPlastic, s * 2.72, 2.4 + i * 0.32, -10.33, { shadow: false });
    }
  }
  // corner + mid casters and feet
  for (const sx of [-1, 1]) for (const zz of [5.85, -2, -9.7]) {
    box(g, 0.4, 0.24, 0.4, MAT.black, sx * 7.1, 0.6, zz);
    cyl(g, 0.3, 0.24, MAT.darkPlastic, sx * 7.1, 0.3, zz, 'x', 18);
    cyl(g, 0.2, 0.1, MAT.black, sx * 6.0, 0.1, zz, 'y', 14);
  }
  return g;
}

// ================================================================ upper cover
function buildUpperCover() {
  const g = new THREE.Group();
  const P = 0.55;                  // profile size
  const X = ENC_X;                 // frame half-extent in X
  const ZF = 6.1, ZB = BACK_Z;     // front / back frame planes
  const ZC = (ZF + ZB) / 2, ZL = ZF - ZB;
  const Y0 = 8.5, Y1 = 21 - P / 2; // top beam center

  // corner posts
  for (const sx of [-1, 1]) for (const zz of [ZF, ZB]) {
    box(g, P, 21 - Y0, P, MAT.alu, sx * X, (Y0 + 21) / 2, zz);
  }
  // top perimeter beams
  box(g, 2 * X - P, P, P, MAT.alu, 0, Y1, ZF);
  box(g, 2 * X - P, P, P, MAT.alu, 0, Y1, ZB);
  box(g, P, P, ZL + P, MAT.alu, X, Y1, ZC);
  box(g, P, P, ZL + P, MAT.alu, -X, Y1, ZC);
  // bottom beams front/back
  box(g, 2 * X - P, P, P, MAT.alu, 0, Y0 + P / 2, ZF);
  box(g, 2 * X - P, P, P, MAT.alu, 0, Y0 + P / 2, ZB);
  // side beams above the belt tunnel (tunnel: z ∈ [-5,5], y ∈ [8.5, 9.8])
  box(g, P, P, ZL - P, MAT.alu, X, 10.1, ZC);
  box(g, P, P, ZL - P, MAT.alu, -X, 10.1, ZC);
  // mid rails (all faces)
  box(g, 2 * X - P, P * 0.7, P * 0.7, MAT.alu, 0, 15.2, ZF);
  box(g, 2 * X - P, P * 0.7, P * 0.7, MAT.alu, 0, 15.2, ZB);
  box(g, P * 0.7, P * 0.7, ZL - P, MAT.alu, X, 15.2, ZC);
  box(g, P * 0.7, P * 0.7, ZL - P, MAT.alu, -X, 15.2, ZC);

  // ---- transparent acrylic panes ----
  const pane = (w, h, d, x, y, z) => {
    const m = box(g, w, h, d, MAT.acrylic, x, y, z, { shadow: false });
    m.name = 'acrylic';
    return m;
  };
  pane(2 * X - P, 21 - Y0 - P, 0.08, 0, (Y0 + 21) / 2, ZF);     // front
  pane(2 * X - P, 21 - Y0 - P, 0.08, 0, (Y0 + 21) / 2, ZB);     // back
  pane(2 * X - P, 0.08, ZL - P, 0, 20.96, ZC);                  // top
  // left & right walls: full pane above the tunnel lintel + slivers beside tunnel
  for (const sx of [-1, 1]) {
    pane(0.08, 21 - 10.4 - P / 2, ZL - P, sx * X, (10.4 + 21 - P / 2) / 2, ZC);
    pane(0.08, 1.35, 0.85, sx * X, 9.18, 5.5);                        // front sliver
    pane(0.08, 1.35, -5 - ZB - 0.2, sx * X, 9.18, (-5 + ZB) / 2);     // rear section
  }
  return g;
}

// ================================================================ operator panel
// Mounted on the FRONT acrylic wall (the face the robot looks at, on the
// right side w.r.t. belt travel), lower-right corner of that pane.
// Viewer stands at +Z looking at the machine: viewer's RIGHT = +X.
// Layout: HMI screen upper-left, e-stop lower-right of the screen, reset
// directly below the e-stop, 4 manual valve knobs along the bottom,
// warning stickers on the left edge.
function buildOperatorPanel() {
  const g = new THREE.Group();
  const PZ = 6.3;                // plate center z (proud of front acrylic wall)
  const CX = 4.85;               // plate center x → plate spans x ∈ [2.4, 7.3]:
                                 // clear of the cutting station (cake ends at x=2.3),
                                 // so the front view into the enclosure stays open

  // brushed stainless plate, 490 × 360 mm (compact)
  const plate = box(g, 4.9, 3.6, 0.14, MAT.brushed, CX, 11.4, PZ);
  plate.name = 'panelPlate';
  // corner bolts
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    cyl(g, 0.08, 0.06, MAT.chrome, CX + sx * 2.18, 11.4 + sy * 1.53, PZ + 0.08, 'z', 12);
    cyl(g, 0.035, 0.08, MAT.darkPlastic, CX + sx * 2.18, 11.4 + sy * 1.53, PZ + 0.1, 'z', 8);
  }

  // ---- HMI touchscreen (GOT2000 style), screen center ≈1190 mm above floor ----
  const SX = CX - 1.1, SY = 11.95;
  box(g, 2.6, 2.0, 0.16, MAT.screenBezel, SX, SY, PZ + 0.1);
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(2.32, 1.7),
    new THREE.MeshBasicMaterial({ map: makeHMITexture(), toneMapped: false })
  );
  scr.position.set(SX, SY + 0.03, PZ + 0.19);
  scr.name = 'hmiScreen';
  g.add(scr);
  // bezel brand strip
  box(g, 0.95, 0.1, 0.02, MAT.darkPlastic, SX, SY - 0.9, PZ + 0.185, { shadow: false });

  // ---- emergency stop: printed yellow base disc + red mushroom head ----
  const EX = CX + 1.5, EY = 12.25;
  const baseFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 28),
    new THREE.MeshBasicMaterial({ map: makeEStopBaseTexture(), toneMapped: false })
  );
  baseFace.position.set(EX, EY, PZ + 0.155);
  g.add(baseFace);
  cyl(g, 0.46, 0.08, MAT.estopYellow, EX, EY, PZ + 0.11, 'z', 28);
  cyl(g, 0.15, 0.2, MAT.darkPlastic, EX, EY, PZ + 0.24, 'z', 16);
  cyl(g, 0.27, 0.14, MAT.estopRed, EX, EY, PZ + 0.4, 'z', 24);
  cyl(g, 0.23, 0.05, MAT.estopRed, EX, EY, PZ + 0.49, 'z', 24);

  // ---- reset button below the e-stop: blue knob + red tag above ----
  const RY = 10.55;
  const rTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.28),
    new THREE.MeshBasicMaterial({ map: makeTextPlateTexture(['RESET'], { bg: '#c11212', fg: '#ffffff', border: '#8c0d0d', fontPx: 40 }), toneMapped: false })
  );
  rTag.position.set(EX, RY + 0.42, PZ + 0.09);
  g.add(rTag);
  cyl(g, 0.2, 0.05, MAT.steel, EX, RY, PZ + 0.1, 'z', 20);
  cyl(g, 0.14, 0.18, MAT.btnBlue, EX, RY, PZ + 0.18, 'z', 20);

  // ---- bottom row: 4 blue manual valve knobs ----
  for (let i = 0; i < 4; i++) {
    const x = CX - 1.55 + i * 0.88;
    cyl(g, 0.12, 0.1, MAT.steel, x, 10.05, PZ + 0.1, 'z', 14);
    cyl(g, 0.27, 0.14, MAT.btnBlue, x, 10.05, PZ + 0.2, 'z', 20);
    box(g, 0.09, 0.44, 0.06, MAT.btnBlue, x, 10.05, PZ + 0.29); // knob ridge
  }

  // ---- yellow warning stickers (bottom-left corner) ----
  const wtex = [makeWarnStickerTexture('⚡'), makeWarnStickerTexture('!')];
  [10.5, 9.98].forEach((y, i) => {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45),
      new THREE.MeshBasicMaterial({ map: wtex[i], toneMapped: false }));
    st.position.set(CX - 2.19, y, PZ + 0.075);
    g.add(st);
  });
  return g;
}

// ================================================================ limit stop
function buildLimitStop() {
  const g = new THREE.Group();
  const X = PLATE_X + 0.01; // inner face sits just ahead of the cake front edge
  const FRONT_Z = 5.45;
  const GUIDE_ZS = [3.2, 4.75];
  const BEAM_CENTER_Z = 1.25;
  const BEAM_DEPTH = 8.4; // rear edge stops at z=-2.95, leaving the wash side clear

  // Front-mounted cantilever locating plate. The rear/wash side is deliberately
  // open so the robot can swing the blade to the sink without hitting this unit.
  box(g, 0.86, 0.32, 0.36, MAT.brushed, X, BELT_TOP + 0.1, FRONT_Z);
  box(g, 0.48, 4.25, 0.42, MAT.alu, X - 0.22, 10.55, FRONT_Z);
  box(g, 0.48, 4.25, 0.42, MAT.alu, X + 0.22, 10.55, FRONT_Z);
  box(g, 0.95, 0.28, BEAM_DEPTH, MAT.brushed, X, 12.7, BEAM_CENTER_Z);
  box(g, 0.55, 0.18, BEAM_DEPTH - 0.45, MAT.aluDark, X, 12.28, BEAM_CENTER_Z + 0.18);
  box(g, 0.55, 0.7, 0.24, MAT.steel, X, 12.28, BEAM_CENTER_Z - BEAM_DEPTH / 2 + 0.15);
  cyl(g, 0.34, 1.45, MAT.alu, X, 13.55, 4.1, 'y', 20);
  box(g, 0.8, 0.12, 0.8, MAT.black, X, 14.28, 4.1);
  box(g, 0.8, 0.12, 0.8, MAT.black, X, 12.9, 4.1);
  cyl(g, 0.06, 0.28, MAT.btnBlue, X + 0.4, 14.08, 4.3, 'x', 8);
  for (const sz of GUIDE_ZS) {
    cyl(g, 0.22, 0.55, MAT.steel, X, 12.95, sz, 'y', 16);
  }

  const moving = new THREE.Group();
  box(moving, 0.46, 0.16, 5.95, MAT.steel, X, 9.88, 0.05);
  for (const sz of GUIDE_ZS) cyl(moving, 0.09, 4.0, MAT.chrome, X, 11.45, sz, 'y', 12);
  cyl(moving, 0.08, 3.25, MAT.chrome, X, 11.22, 4.1, 'y', 12);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xd8cfa4, metalness: 0.3, roughness: 0.55 });
  box(moving, 0.18, 1.0, 5.75, plateMat, X, BELT_TOP + 0.58, 0);
  box(moving, 0.22, 0.08, 5.85, MAT.steel, X, BELT_TOP + 0.08, 0);
  moving.userData.downY = 0;
  moving.userData.upY = 1.65;
  moving.userData.setEngaged = (k) => {
    const t = THREE.MathUtils.clamp(k, 0, 1);
    moving.position.y = moving.userData.upY * (1 - t);
  };
  moving.userData.setEngaged(0);
  g.add(moving);
  return { group: g, moving };
}

// ================================================================ positioning pusher
// Upstream counterpart of the locating plate: its plate is perpendicular to the
// belt travel, so the pusher sets the cake against the outfeed-side stop.
// Sequence: plate drops behind the cake → short horizontal nudge presses the
// cake against the stop → retracts and lifts immediately so the knife has a
// clear path. Built at the DOWN position; position.y = upY parks it.
function buildPusher() {
  const g = new THREE.Group();
  const X = -4.2;

  // support shafts on the conveyor rails + fixed cross beam (gate-style)
  for (const sz of [-5.4, 5.4]) {
    cyl(g, 0.14, 4.4, MAT.chrome, X, 10.6, sz, 'y', 16);
    cyl(g, 0.26, 0.12, MAT.steel, X, 8.45, sz, 'y', 16);
  }
  box(g, 0.95, 0.28, 11.2, MAT.brushed, X, 12.7, 0);
  // vertical cylinder on top
  cyl(g, 0.36, 1.5, MAT.alu, X, 13.6, 0, 'y', 20);
  box(g, 0.85, 0.12, 0.85, MAT.black, X, 14.4, 0);
  box(g, 0.85, 0.12, 0.85, MAT.black, X, 12.9, 0);
  cyl(g, 0.07, 0.3, MAT.btnBlue, X + 0.42, 14.2, 0.2, 'x', 8);
  // linear bearing housings
  for (const sz of [-3.0, 3.0]) {
    cyl(g, 0.22, 0.6, MAT.steel, X, 12.95, sz, 'y', 16);
  }

  // ---- moving assembly (down position): carriage + horizontal nudge + plate ----
  const moving = new THREE.Group();
  box(moving, 0.5, 0.16, 7.0, MAT.steel, X, 9.9, 0);                          // carrier bar
  for (const sz of [-3.0, 3.0]) cyl(moving, 0.09, 4.1, MAT.chrome, X, 11.5, sz, 'y', 12); // guide rods
  cyl(moving, 0.09, 3.4, MAT.chrome, X, 11.3, 0, 'y', 12);                    // piston rod
  // pusher plate (thickness 0.18 → inner face at X + 0.15)
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xd8cfa4, metalness: 0.3, roughness: 0.55 });
  box(moving, 0.18, 1.1, 7.0, plateMat, X + 0.06, 9.17, 0);
  moving.userData.downY = 0;
  moving.userData.upY = 1.35;
  moving.userData.nudge = 0.35;   // horizontal press stroke (+X)
  moving.userData.restFace = X + 0.15;
  g.add(moving);
  return { group: g, moving };
}

// ================================================================ light curtain
function buildLightCurtain() {
  const g = new THREE.Group();
  const LX = 9.4;               // just outside the extended enclosure, on the outfeed
  for (const sz of [-5.55, 5.55]) {
    box(g, 0.3, 0.2, 0.6, MAT.steel, LX, 8.45, sz);   // mount
    box(g, 0.34, 4.2, 0.34, MAT.lcBody, LX, 10.65, sz);
    // emitting strip faces inward
    const strip = box(g, 0.12, 3.7, 0.1, MAT.lcGlow, LX, 10.6, sz - Math.sign(sz) * 0.19, { shadow: false });
    strip.name = 'lcStrip';
    cyl(g, 0.07, 0.06, MAT.lampRed, LX, 12.62, sz - Math.sign(sz) * 0.19, 'z', 10);
  }
  return g;
}

// ================================================================ sink
function buildSink() {
  const g = new THREE.Group();
  // long enough for the 600 mm blade to dip in parallel to the basin
  const x0 = 0.5, x1 = 7.2, z0 = -8.9, z1 = -6.9;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const h = 0.8, yb = 8.54, t = 0.12;
  // walls (brown-red rim)
  box(g, x1 - x0, h, t, MAT.sinkBrown, cx, yb + h / 2, z0 + t / 2);
  box(g, x1 - x0, h, t, MAT.sinkBrown, cx, yb + h / 2, z1 - t / 2);
  box(g, t, h, z1 - z0 - 2 * t, MAT.sinkBrown, x0 + t / 2, yb + h / 2, cz);
  box(g, t, h, z1 - z0 - 2 * t, MAT.sinkBrown, x1 - t / 2, yb + h / 2, cz);
  // rim lip
  box(g, x1 - x0 + 0.1, 0.06, 0.24, MAT.sinkBrown, cx, yb + h, z0 + t / 2);
  box(g, x1 - x0 + 0.1, 0.06, 0.24, MAT.sinkBrown, cx, yb + h, z1 - t / 2);
  box(g, 0.24, 0.06, z1 - z0 + 0.1, MAT.sinkBrown, x0 + t / 2, yb + h, cz);
  box(g, 0.24, 0.06, z1 - z0 + 0.1, MAT.sinkBrown, x1 - t / 2, yb + h, cz);
  // basin floor + water
  box(g, x1 - x0 - 2 * t, 0.06, z1 - z0 - 2 * t, MAT.darkPlastic, cx, yb + 0.04, cz);
  const water = box(g, x1 - x0 - 2 * t, 0.04, z1 - z0 - 2 * t, MAT.water, cx, yb + 0.52, cz, { shadow: false });
  water.name = 'water';
  // inlet valve (right end): chrome pipe + blue handle
  cyl(g, 0.08, 0.7, MAT.chrome, x1 + 0.2, yb + 0.9, cz + 0.4, 'y', 10);
  cyl(g, 0.08, 0.5, MAT.chrome, x1 + 0.2, yb + 1.25, cz + 0.22, 'z', 10);
  cyl(g, 0.16, 0.06, MAT.btnBlue, x1 + 0.2, yb + 1.32, cz + 0.4, 'y', 12);
  // drain valve (left end): red handwheel on pipe
  cyl(g, 0.09, 0.6, MAT.chrome, x0 - 0.18, yb + 0.25, cz, 'x', 10);
  cyl(g, 0.18, 0.07, MAT.estopRed, x0 - 0.42, yb + 0.25, cz, 'x', 14);
  return g;
}

// ================================================================ alarm light
function buildAlarmLight() {
  const g = new THREE.Group();
  const x = -ENC_X, z = 6.1;
  box(g, 0.5, 0.12, 0.5, MAT.black, x, 21.05, z);
  cyl(g, 0.07, 0.95, MAT.steel, x, 21.6, z, 'y', 10);
  cyl(g, 0.24, 0.1, MAT.black, x, 22.1, z, 'y', 16);
  const lamps = {
    green: cyl(g, 0.22, 0.5, MAT.lampGreen, x, 22.42, z, 'y', 18),
    yellow: cyl(g, 0.22, 0.5, MAT.lampYellow, x, 22.94, z, 'y', 18),
    red: cyl(g, 0.22, 0.5, MAT.lampRed, x, 23.46, z, 'y', 18),
  };
  cyl(g, 0.23, 0.08, MAT.black, x, 23.76, z, 'y', 16);
  return { group: g, lamps };
}

// ================================================================ cakes
function buildCakes() {
  const g = new THREE.Group();
  const mk = (x) => {
    const cake = new THREE.Mesh(new THREE.BoxGeometry(6, CAKE_H, 5), MAT.cake);
    cake.position.set(x, BELT_TOP + CAKE_H / 2, 0);
    cake.castShadow = cake.receiveShadow = true;
    g.add(cake);
    return cake;
  };
  // one queued on the infeed, one at the cutting station (600 long each —
  // centres must stay ≥620 apart to avoid overlap)
  const cakes = [mk(-7.5), mk(-0.7)];

  // Cut lines revealed during the demo, in exact plunge order.
  // The 600 mm blade covers a full line in ONE plunge:
  // 3 cross lines (along Z) + 2 lengthwise lines (along X) = 5 plunges.
  const station = cakes[cakes.length - 1];
  const cutSegs = [];
  const seg = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), MAT.cakeDark);
    m.position.set(x, CAKE_H / 2, z);
    m.visible = false;
    station.add(m);
    cutSegs.push(m);
  };
  for (const lx of [-1.5, 0, 1.5]) seg(0.06, 5.04, lx, 0);   // cross lines (150 mm strips)
  for (const lz of [-0.85, 0.85]) seg(6.04, 0.06, 0, lz);    // lengthwise lines (~170 mm strips)
  return { group: g, cakes, cutSegs };
}

// ================================================================ robot pedestal
export function buildPedestal(g) {
  box(g, 2.5, 0.75, 1.95, MAT.cabinetDk, ROBOT_X, 8.92, ROBOT_Z);
  box(g, 2.7, 0.14, 2.15, MAT.brushed, ROBOT_X, 9.37, ROBOT_Z);
  // anchor bolts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(g, 0.07, 0.1, MAT.darkPlastic, ROBOT_X + sx * 1.15, 9.48, ROBOT_Z + sz * 0.85, 'y', 10);
  }
  return { baseY: 9.44, x: ROBOT_X, z: ROBOT_Z };
}

// ================================================================ build all
export function buildMachine(scene) {
  const components = [];
  const machine = new THREE.Group();
  machine.name = 'machine';
  scene.add(machine);

  // ONE continuous belt through the whole machine — no seam under the
  // cutting station; the cabinet's center block supports the mid-span.
  const beltTex = makeBeltTexture();
  const conv = buildConveyor(-14, 14, [-13.1, -9.2, 9.2, 13.1], beltTex);
  const lower = buildLowerCover();
  const upper = buildUpperCover();
  const panel = buildOperatorPanel();
  const limit = buildLimitStop();
  const pusher = buildPusher();
  pusher.moving.position.y = pusher.moving.userData.upY; // parked up in the static scene
  const curtain = buildLightCurtain();
  const sink = buildSink();
  const alarm = buildAlarmLight();
  const cakes = buildCakes();

  machine.add(conv.group, lower, upper, panel, limit.group, pusher.group, curtain, sink, alarm.group, cakes.group);

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  reg(components, 'conveyor', 'Conveyor Line (Single Belt)', '整体输送线', conv.group,
    V(-10, 8.5, 0), V(-11.5, 12.5, 3.5), V(0, 3.5, 0), [
      ['Belt width', '1000 mm'], ['Belt length', '2800 mm, one continuous belt'],
      ['Belt height', '≈850 mm'], ['Belt', 'Blue food-grade PU'],
      ['Mid-span support', 'Cabinet table (no seam at the station)'],
      ['Base', 'Aluminium frame + casters'],
    ]);
  reg(components, 'lowerCover', 'Electrical Cabinet (Lower Cover)', '下罩 / 电控柜', lower,
    V(-3, 4.5, 6.45), V(-8, 3.2, 8.5), V(0, 0, 0), [
      ['Type', 'Sheet-metal cabinet, double doors'], ['Power supply', '380 V / 50 Hz'],
      ['PLC', 'Mitsubishi / Inovance'], ['Electronics', 'Omron / Schneider'],
      ['Features', 'Handles + vent grilles + casters'],
    ]);
  reg(components, 'upperCover', 'Upper Cover (Clear Acrylic)', '上罩 · 透明亚克力', upper,
    V(0, 19.5, 6.1), V(-4, 23.5, 8), V(0, 8, 0), [
      ['Frame', 'Aluminium extrusion'], ['Panels', 'Transparent acrylic, all sides + top'],
      ['Height to top', '2100 mm'], ['Depth (robot envelope)', '1700 mm'],
      ['Access', 'Belt tunnels both sides'],
    ]);
  reg(components, 'panel', 'Operator Panel (Stainless)', '不锈钢操作面板', panel,
    V(4.85, 11.4, 6.4), V(9.8, 15.5, 9), V(0, 0.5, 5.5), [
      ['Material', 'Brushed stainless steel'], ['Size', '490 × 360 mm (compact)'],
      ['HMI', 'Touchscreen (GOT2000 style)'],
      ['Position', 'Front cover lower-right, clear of the station view'],
      ['Screen center height', '≈1190 mm'],
      ['Controls', 'E-stop · Reset · 4 manual valves'],
      ['Touchscreen brand', 'MCGS / INOVANCE'],
    ]);
  reg(components, 'limitStop', 'Limit Stop Unit', '限位机构', limit.group,
    V(PLATE_X, 9.55, 3.1), V(6.2, 12.4, -4.2), V(0.5, 1.4, 2), [
      ['Type', 'Front cantilever drop-down plate'], ['Stroke', 'Vertical lift, wash side open'],
      ['Park position', 'Raised above cake path'], ['Air source', '0.6 – 1 MPa'],
      ['Function', 'Outfeed-side stop during positioning only'],
    ]);
  reg(components, 'pusher', 'Positioning Pusher Unit', '定位推板机构', pusher.group,
    V(-4.2, 13.8, 0), V(-8.5, 17.5, 4.5), V(-1, 4, -1.5), [
      ['Actuator', 'Vertical + horizontal air cylinders'], ['Air source', '0.6 – 1 MPa'],
      ['Plate', 'Perpendicular to belt travel'],
      ['Sequence', 'Drop behind cake → press it against the gate → retract & lift'],
      ['Function', 'Presses cake against the drop-down locating plate'],
    ]);
  reg(components, 'lightCurtain', 'Safety Light Curtain', '安全光栅', curtain,
    V(9.4, 11.5, 5.5), V(11.5, 15.5, 7.5), V(3, 1, 2.5), [
      ['Position', 'Outfeed side'], ['Type', 'Opposed emitter / receiver columns'],
      ['Function', 'Stops machine on intrusion'],
    ]);
  reg(components, 'sink', 'Knife Washing Sink', '洗刀水槽', sink,
    V(3.85, 9.4, -7.9), V(7.5, 13, -11), V(0, 3, -3.5), [
      ['Location', 'Table corner'], ['Rim', 'Brown-red frame'],
      ['Valves', 'Inlet valve + drain valve'], ['Function', 'Ultrasonic knife rinsing'],
    ]);
  reg(components, 'alarmLight', 'Tri-color Alarm Light', '三色报警灯', alarm.group,
    V(-7.65, 23, 6.1), V(-10.5, 25, 8), V(0, 5, 3), [
      ['Colors', 'Red / Yellow / Green'], ['Mount', 'Top of upper cover'],
      ['Function', 'Machine status indication'],
    ]);
  reg(components, 'cakes', 'Cake Products', '蛋糕', cakes.group,
    V(-7.5, 9.4, 0), V(-9.5, 12.5, 5), V(0, 1.5, 4), [
      ['Max product width', '500 mm'], ['Shown', '600 × 500 × 90 mm'],
      ['Placement', 'On infeed belt'],
    ]);

  return {
    machine,
    components,
    dynamics: {
      beltTex,
      limitMoving: limit.moving,
      pusherMoving: pusher.moving,
      cakes: cakes.cakes,
      cutSegs: cakes.cutSegs,
      lamps: alarm.lamps,
      rollers: conv.group.children.filter(m => m.userData.isRoller),
    },
  };
}
