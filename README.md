# Robotic Ultrasonic Cake Cutting Machine — Interactive 3D Design

Browser-based interactive 3D engineering visualization (Vite + three.js) of a
robotic ultrasonic cake cutter, modeled after the TECHSPEED proposal PDF with
three design changes: 1000 mm belt, touchscreen relocated onto the stainless
operator panel, and a fully transparent acrylic upper cover.

This "Safe Sink Motion" copy uses a front-mounted cantilever drop-down locating
plate. It parks above the cake path during infeed, cutting, discharge, and knife
washing, then lowers from the upper guide/cylinder assembly only while
positioning the cake. The rear/wash side stays open for the robot's rinse path.

## Run

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Features

- **Real ABB IRB 1200-5/90** loaded from the ros-industrial URDF/xacro
  (`public/models/abb_irb1200_support`, converted at runtime with
  xacro-parser, meshes via ColladaLoader). Joint motion respects URDF limits.
- **Full machine model** (1 unit = 100 mm): one continuous 2800 mm blue belt
  (1000 mm wide, top at 850 mm — no seam under the cutting station, mid-span
  carried by the cabinet table), electrical cabinet, aluminium-framed acrylic upper cover
  (1530 × 1625 mm footprint so the robot envelope stays fully inside),
  stainless operator panel (HMI + e-stop + reset + 4 manual valves + warning
  stickers) embedded in the front cover lower-right, a single 20 kHz ultrasonic
  cutter (600 mm titanium comb knife — a full line in one plunge),
  wash-side-clear cantilever locating plate + upstream positioning pusher,
  safety light curtain,
  knife washing sink (long enough for the
  blade to dip in parallel), tri-color alarm light.
- **Interaction**: orbit/zoom/pan, bilingual leader labels (toggle), click to
  highlight + parameter info panel, exploded view, dimension lines, five
  single-Action buttons (Feed & Position / Cross Cuts / Lengthwise Cuts /
  Wash Knife / Discharge) and a **repeating Run Demo cycle**: infeed →
  cantilever locating plate lowers from above → pusher drops behind the cake for a
  short locating nudge → both retract/lift so the knife path is clear → 3 cross
  cuts → wrist rotates the blade 90° only for the lengthwise cuts → knife rinse parallel to the
  sink → outfeed → next cake. Robot poses are precomputed with a small
  numeric IK (CCD + hill climb) and respect the URDF joint limits.

## Layout / axes

- X = machine length (2800 mm), +X = outfeed side
- Y = up (2100 mm), belt top at y=8.5
- Z = depth (1700 mm), +Z = front (doors + operator panel), robot at the rear
