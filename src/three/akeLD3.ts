/**
 * ============================================================================
 *  akeLD3.ts — procedural generator for an IATA AKE / LD-3 lower-deck
 *              air-cargo container (ULD), built entirely from Three.js
 *              primitives. No external model files, no image assets.
 *
 *  Certified envelope (metres, nominal):
 *      base footprint ......... 1.53 (X, width)  x  1.56 (Z, length)
 *      height ................. 1.62 (Y)
 *      upper contour .......... 2.01 (X at Y = 1.62, fuselage-side taper)
 *
 *  Coordinate frame: Y up, base resting on the Y = 0 plane, the vertical
 *  "centreline" wall on -X, the contoured "fuselage" wall leaning out on +X,
 *  hinged door on +Z, blind end on -Z.
 *
 *  Everything is derived from ONE nominal 2-D cross-section (a right
 *  trapezoid). The hull, its cavity, the end frames, the door opening and the
 *  door leaf are successive inward polygon offsets of that section, so the
 *  model stays dimensionally exact when the taper is switched off.
 *
 *  createAKEContainer() returns the Group plus handles for materials, the five
 *  exploded-view assemblies and the door pivot, ready to be dropped into any
 *  scene or handed to a GLTF / OBJ / STL exporter.
 * ============================================================================
 *
 *  Model-agnostic machinery (section offsets, filleted shapes, corner rail
 *  sections, mesh factories, the instanced rivet run, the metallic material
 *  palette and the shared container contract) lives in primitives.ts and is
 *  imported below — this file only describes the LD-3 shape itself.
 * ============================================================================
 */
import * as THREE from "three";
import { makeIdPlate, makeLivery, makeStencil } from "./textures";
import {
  Assembly,
  ContainerBase,
  FINISHES,
  cornerRailSection,
  createBaseMaterials,
  decal,
  mesh,
  box,
  offsetPolygon,
  ringSection,
  RivetRun,
  roundedShape,
  tag,
  wallBox,
  type BaseMaterials,
  type FinishId,
  type V2,
} from "./primitives";

export { FINISHES };
export type { FinishId };
export type { Assembly };
export type AKEMaterials = BaseMaterials;

/* ========================================================================== */
/* 1. Dimensions                                                              */
/* ========================================================================== */

export const AKE_DIMENSIONS = {
  /** base width along X — narrow bottom of the contour */
  baseWidth: 1.53,
  /** base length along Z */
  baseLength: 1.56,
  /** overall height along Y */
  height: 1.62,
  /** upper width along X — LD-3 fuselage contour */
  topWidth: 2.01,
} as const;

/* Manufacturing constants. All in metres. */
const WALL = 0.032; // hull wall thickness
const RAIL_T = 0.015; // edge extrusion: hull is inset this far, rails restore it
const RAIL_W = 0.13; // edge extrusion leg width, measured along the section
const END_FRAME = 0.06; // axial depth of the door / blind end frames
const RING_BEV = 0.008; // chamfer on the end frames (compensated below)
const FRAME_W = 0.075; // radial width of the end frame ring
const CHASSIS = 0.09; // base skid-frame height
const CORNER_R = 0.07; // hull corner radius (the four long corners)
const LEAF_T = 0.042; // door leaf thickness
const LEAF_BEVEL = 0.007;
const LEAF_CLEAR = 0.005; // radial gap between leaf and frame opening
const LEAF_RECESS = 0.036; // door face sits this far behind the envelope
const MAX_DOOR = THREE.MathUtils.degToRad(112);

/** The LD-3 cross-section: right trapezoid, vertical on the -X side. */
export function contourProfile(contour: boolean): V2[] {
  const { baseWidth: BW, height: H, topWidth: TW } = AKE_DIMENSIONS;
  const top = contour ? TW : BW;
  const x0 = -top / 2; // centre the envelope on X
  return [
    { x: x0, y: CHASSIS },
    { x: x0 + BW, y: CHASSIS },
    { x: x0 + top, y: H },
    { x: x0, y: H },
  ];
}

/** X of the contoured outer wall at height y. */
function wallX(p: V2[], y: number) {
  const t = THREE.MathUtils.clamp((y - p[1].y) / (p[2].y - p[1].y), 0, 1);
  return THREE.MathUtils.lerp(p[1].x, p[2].x, t);
}

/** Outward unit normal of the contoured (+X) wall. */
function slantNormal(p: V2[]) {
  const d = new THREE.Vector2(p[2].x - p[1].x, p[2].y - p[1].y);
  return new THREE.Vector3(d.y, -d.x, 0).normalize();
}

/* ========================================================================== */
/* 6. Build result                                                            */
/* ========================================================================== */

export interface AKEContainer extends ContainerBase {
  materials: AKEMaterials;
  stats: {
    meshes: number;
    triangles: number;
    volumeM3: number;
    iataVolumeM3: number;
    footprintM2: number;
    tareKg: number;
    maxGrossKg: number;
    payloadKg: number;
  };
  setFinish(id: FinishId): void;
  setDoorOpen(t: number): void;
  dispose(): void;
}

/* ========================================================================== */
/* 6. Build options                                                           */
/* ========================================================================== */

export interface BuildOptions {
  /** true = trapezoidal LD-3 taper, false = prismatic box of the same base */
  contour: boolean;
  finish: FinishId;
  /** stiffeners, belt course, roller pads, tie-downs */
  detail: boolean;
  /** instanced rivet runs along every frame member */
  rivets: boolean;
  /** 0..1 door swing */
  doorOpen: number;
}

export const DEFAULT_OPTIONS: BuildOptions = {
  contour: true,
  finish: "mill",
  detail: true,
  rivets: true,
  doorOpen: 0,
};

/* ========================================================================== */
/* 7. The generator                                                           */
/* ========================================================================== */

export function createAKEContainer(
  options: Partial<BuildOptions> = {},
): AKEContainer {
  const o: BuildOptions = { ...DEFAULT_OPTIONS, ...options };
  const { baseWidth: BW, baseLength: BL, height: H } = AKE_DIMENSIONS;

  const mat = createBaseMaterials(o.finish);
  const root = tag(new THREE.Group(), "AKE_LD3");
  const rivets = new RivetRun();

  /* --- 7.1 the section stack: one trapezoid, four offsets --------------- */
  const nominal = contourProfile(o.contour); // certified outer envelope
  const hullOut = offsetPolygon(nominal, RAIL_T); // hull skin (rails restore envelope)
  const cavity = offsetPolygon(nominal, RAIL_T + WALL); // interior
  // clear aperture = offset(nominal, FRAME_W); the leaf body is drawn one bevel
  // deeper so its dilated caps still clear the aperture by LEAF_CLEAR
  const leaf = offsetPolygon(nominal, FRAME_W + LEAF_CLEAR + LEAF_BEVEL);
  const X0 = nominal[0].x; // inner (vertical) wall plane
  const rHull = CORNER_R - RAIL_T; // 0.055 — skin follows the outer fillet
  const rOpen = 0.014; // offsets deeper than the radius come out near-square
  const rLeaf = 0.012;

  const nSlant = slantNormal(nominal); // contoured wall normal
  const nInner = new THREE.Vector3(-1, 0, 0); // centreline wall normal
  const nDoor = new THREE.Vector3(0, 0, 1);
  const nBlind = new THREE.Vector3(0, 0, -1);
  const slantUp = new THREE.Vector3(
    nominal[2].x - nominal[1].x,
    AKE_DIMENSIONS.height - CHASSIS,
    0,
  ).normalize();

  /* --- 7.2 assemblies ---------------------------------------------------- */
  const assemblies: Assembly[] = [];
  const assembly = (
    id: string,
    label: string,
    note: string,
    dir: [number, number, number],
  ) => {
    const g = new THREE.Group();
    g.name = label;
    root.add(g);
    const a: Assembly = {
      id,
      label,
      note,
      group: g,
      home: new THREE.Vector3(),
      explode: new THREE.Vector3(...dir),
      meshes: 0,
      triangles: 0,
    };
    assemblies.push(a);
    return a;
  };
  const A_HULL = assembly(
    "hull",
    "Hull shell",
    "Contour tube, 32 mm wall",
    [0, 0.3, 0],
  );
  const A_FRAME = assembly(
    "frame",
    "Edge frame",
    "Aluminium extrusions + rivets",
    [0, 0.66, 0],
  );
  const A_BASE = assembly(
    "base",
    "Base chassis",
    "Skid frame, castings, fork pockets",
    [0, -0.62, 0],
  );
  const A_DOOR = assembly(
    "door",
    "Door assembly",
    "Hinged leaf, cam latch rods",
    [0, 0, 0.9],
  );
  const A_END = assembly(
    "blind",
    "Blind end",
    "Closed end panel + livery",
    [0, 0, -0.9],
  );

  /* --- 7.3 hull: hollow contour tube, open at both ends ----------------- */
  const hullLen = BL - END_FRAME * 2;
  const hullGeo = new THREE.ExtrudeGeometry(
    ringSection(hullOut, cavity, rHull, CORNER_R - RAIL_T - WALL),
    { depth: hullLen, bevelEnabled: false, curveSegments: 10, steps: 1 },
  );
  hullGeo.translate(0, 0, -hullLen / 2);
  A_HULL.group.add(mesh(hullGeo, mat.shell, "Hull — contour tube"));

  // top and belly panels close the envelope flush with the frame extrusions
  const topPanel = box(
    mat.alloy,
    nominal[2].x - nominal[3].x - 0.13,
    RAIL_T,
    BL - 0.13,
    "Top panel",
    0.006,
  );
  topPanel.position.set((nominal[2].x + nominal[3].x) / 2, H - RAIL_T / 2, 0);
  A_HULL.group.add(topPanel);

  const belly = box(
    mat.chassis,
    BW - 0.16,
    0.012,
    BL - 0.2,
    "Belly pan",
    0.004,
  );
  belly.position.set(X0 + BW / 2, 0.006, 0);
  A_HULL.group.add(belly);

  // interior fit-out, visible with the door open
  const floorY = CHASSIS + RAIL_T + WALL;
  for (const dz of [-0.36, 0, 0.36]) {
    const strip = box(
      mat.hullInner,
      BW - 0.26,
      0.008,
      0.1,
      "Floor wear strip",
      0.003,
    );
    strip.position.set(X0 + BW / 2, floorY + 0.005, dz);
    A_HULL.group.add(strip);
  }
  for (const yy of [0.42, 0.94]) {
    const rail = wallBox(
      mat.hullInner,
      hullLen - 0.2,
      0.045,
      0.02,
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(X0 + RAIL_T + WALL + 0.012, yy, 0),
      "Interior tie-down rail",
    );
    A_HULL.group.add(rail);
  }

  /* --- 7.4 stiffeners, belt course, roller pads, tie-downs -------------- */
  if (o.detail) {
    // stiffeners are proud of the skin by exactly RAIL_T, so their outer faces
    // land on the certified envelope instead of outside it
    const slantLen = Math.hypot(nominal[2].x - nominal[1].x, H - CHASSIS);
    const midY = CHASSIS + (H - CHASSIS) / 2;

    for (const z of [-0.6, 0.6]) {
      A_HULL.group.add(
        wallBox(
          mat.shell,
          0.085,
          slantLen - 0.16,
          RAIL_T,
          nSlant,
          slantUp,
          new THREE.Vector3(
            wallX(nominal, midY) - nSlant.x * (RAIL_T * 0.5),
            midY - nSlant.y * (RAIL_T * 0.5),
            z,
          ),
          "Contour stiffener",
        ),
      );
    }
    for (const z of [-0.55, 0, 0.55]) {
      A_HULL.group.add(
        wallBox(
          mat.shell,
          0.085,
          H - CHASSIS - 0.16,
          RAIL_T,
          nInner,
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(X0 + RAIL_T * 0.5, midY, z),
          "Wall stiffener",
        ),
      );
    }

    // horizontal belt course on the centreline wall (the contoured wall is
    // reserved for the airline livery decal)
    const beltY = CHASSIS + (H - CHASSIS) * 0.6;
    A_HULL.group.add(
      wallBox(
        mat.shell,
        BL - 0.26,
        0.055,
        RAIL_T,
        nInner,
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(X0 + RAIL_T * 0.5, beltY, 0),
        "Belt course",
      ),
    );

    // fuselage roller-guide wear pads, bonded to the upper contoured wall
    for (const z of [-0.5, 0.5]) {
      const padY = CHASSIS + (H - CHASSIS) * 0.82;
      A_HULL.group.add(
        wallBox(
          mat.dark,
          0.13,
          0.19,
          RAIL_T * 0.6,
          nSlant,
          slantUp,
          new THREE.Vector3(
            wallX(nominal, padY) - nSlant.x * (RAIL_T * 0.3),
            padY - nSlant.y * (RAIL_T * 0.3),
            z,
          ),
          "Roller guide pad",
          0.01,
        ),
      );
    }

    // cargo tie-down D-rings standing off the interior rails
    const cavityWall = X0 + RAIL_T + WALL;
    for (const ty of [0.42, 0.94]) {
      for (const tz of [-0.44, 0.44]) {
        const pocket = box(
          mat.dark,
          0.014,
          0.06,
          0.07,
          "Tie-down pocket",
          0.004,
        );
        pocket.position.set(cavityWall + 0.007, ty, tz);
        A_HULL.group.add(pocket);
        const ring = mesh(
          new THREE.TorusGeometry(0.019, 0.005, 8, 18),
          mat.steel,
          "Tie-down ring",
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(cavityWall + 0.02, ty, tz);
        A_HULL.group.add(ring);
      }
    }
  }

  /* --- 7.5 edge frame: extrusions that wrap every hull fillet ---------- */
  // The skin is inset by RAIL_T so these members land exactly on the
  // certified envelope instead of outside it.
  const N = nominal.length;
  const legs: number[] = [];
  nominal.forEach((p, i) => {
    const prev = nominal[(i - 1 + N) % N];
    const next = nominal[(i + 1) % N];
    const { shape, leg } = cornerRailSection(
      p,
      prev,
      next,
      CORNER_R,
      RAIL_T,
      RAIL_W,
    );
    legs.push(leg);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: BL,
      bevelEnabled: false,
      curveSegments: 8,
      steps: 1,
    });
    geo.translate(0, 0, -BL / 2);
    A_FRAME.group.add(mesh(geo, mat.alloy, `Corner extrusion ${i + 1}`));
  });

  // straight bands spanning between adjacent corner extrusions
  nominal.forEach((p, i) => {
    const q = nominal[(i + 1) % N];
    const d = new THREE.Vector2(q.x - p.x, q.y - p.y);
    const edgeLen = d.length();
    d.normalize();
    const n = new THREE.Vector3(d.y, -d.x, 0); // outward (CCW section)
    const span = edgeLen - legs[i] - legs[(i + 1) % N];
    if (span < 0.06) return;
    const mid = new THREE.Vector3(
      (p.x + q.x) / 2,
      (p.y + q.y) / 2,
      0,
    ).addScaledVector(n, -RAIL_T / 2);
    A_FRAME.group.add(
      wallBox(
        mat.alloy,
        BL,
        span,
        RAIL_T,
        n,
        new THREE.Vector3(d.x, d.y, 0),
        mid,
        `Edge extrusion ${i + 1}`,
        0.003,
      ),
    );
    if (o.rivets) {
      rivets.line(
        new THREE.Vector3(mid.x, mid.y, -BL / 2 + 0.11),
        new THREE.Vector3(mid.x, mid.y, BL / 2 - 0.11),
        n,
        0.15,
      );
    }
  });

  /* --- 7.6 base chassis, corner castings, fork pockets ----------------- */
  const chassis = box(
    mat.chassis,
    BW - 0.04,
    CHASSIS,
    BL - 0.04,
    "Skid frame",
    0.012,
  );
  chassis.position.set(X0 + BW / 2, CHASSIS / 2, 0);
  A_BASE.group.add(chassis);

  for (const sx of [-0.44, 0.44]) {
    const bh = CHASSIS + 0.004;
    const beam = box(
      mat.chassis,
      0.14,
      bh,
      BL - 0.02,
      "Longitudinal beam",
      0.008,
    );
    beam.position.set(X0 + BW / 2 + sx, bh / 2, 0);
    A_BASE.group.add(beam);
  }

  // lower corner castings with the cargo-system locating bore
  for (const cx of [X0 + 0.1, X0 + BW - 0.1]) {
    for (const cz of [-BL / 2 + 0.1, BL / 2 - 0.1]) {
      const c = box(
        mat.alloy,
        0.18,
        CHASSIS + 0.006,
        0.18,
        "Corner casting",
        0.022,
      );
      c.position.set(cx, (CHASSIS + 0.006) / 2, cz);
      A_BASE.group.add(c);
      const bore = mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.02, 20),
        mat.dark,
        "Casting bore",
      );
      bore.position.set(cx, 0.013, cz);
      A_BASE.group.add(bore);
    }
  }

  // fork pockets: tunnels across the 1.53 m width, entered from both long walls.
  // The dark mouth fills the 20 mm gap between the skid frame and the envelope.
  for (const z of [-0.4, 0.4]) {
    const y = CHASSIS * 0.55;
    for (const n of [nInner, nSlant]) {
      const faceX = (n === nInner ? X0 : wallX(nominal, y)) + 0.02;
      A_BASE.group.add(
        wallBox(
          mat.dark,
          0.3,
          0.064,
          0.019,
          n,
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(faceX + n.x * 0.0095, y + n.y * 0.0095, z),
          "Fork pocket",
          0.006,
        ),
      );
      A_BASE.group.add(
        wallBox(
          mat.steel,
          0.34,
          0.009,
          0.019,
          n,
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(faceX + n.x * 0.0095, y - 0.0365 + n.y * 0.0095, z),
          "Pocket wear lip",
          0.003,
        ),
      );
    }
  }

  /* --- 7.7 end frames --------------------------------------------------- */
  // ExtrudeGeometry *dilates* the section by bevelSize at both caps, so the
  // frame is drawn one bevel inside the envelope: its outer faces then land
  // exactly on the certified 1.53 x 1.62 / 2.01 m boundary.
  const ringGeo = new THREE.ExtrudeGeometry(
    ringSection(
      offsetPolygon(nominal, RING_BEV),
      offsetPolygon(nominal, FRAME_W - RING_BEV),
      Math.max(CORNER_R - RING_BEV, 0.01),
      rOpen,
    ),
    {
      depth: END_FRAME - RING_BEV * 2,
      bevelEnabled: true,
      bevelThickness: RING_BEV,
      bevelSize: RING_BEV,
      bevelSegments: 2,
      curveSegments: 10,
      steps: 1,
    },
  );
  // extrusion spans local z ∈ [-bevel, depth + bevel]; seat each end flush
  const ringShiftDoor = BL / 2 - (END_FRAME - 0.008);
  const ringShiftBlind = -BL / 2 + 0.008;

  const ringDoor = mesh(
    ringGeo.clone().translate(0, 0, ringShiftDoor),
    mat.alloy,
    "Door end frame",
  );
  A_DOOR.group.add(ringDoor);
  const ringBlind = mesh(
    ringGeo.clone().translate(0, 0, ringShiftBlind),
    mat.alloy,
    "Blind end frame",
  );
  A_END.group.add(ringBlind);

  if (o.rivets) {
    // rivet circle on the flat face of each end frame, clear of the fillets
    const circle = offsetPolygon(nominal, 0.03);
    circle.forEach((p, i) => {
      const q = circle[(i + 1) % circle.length];
      const d = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
      const a = new THREE.Vector3(
        p.x + d.x * 0.07,
        p.y + d.y * 0.07,
        BL / 2 - 0.012,
      );
      const b = new THREE.Vector3(
        q.x - d.x * 0.07,
        q.y - d.y * 0.07,
        BL / 2 - 0.012,
      );
      rivets.line(a, b, nDoor, 0.16);
      rivets.line(
        a.clone().setZ(-BL / 2 + 0.012),
        b.clone().setZ(-BL / 2 + 0.012),
        nBlind,
        0.16,
      );
    });
  }

  /* --- 7.8 blind end: panel, livery, identification plate -------------- */
  const blindGeo = new THREE.ExtrudeGeometry(
    roundedShape(offsetPolygon(nominal, FRAME_W + LEAF_BEVEL), rOpen),
    {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: LEAF_BEVEL,
      bevelSize: LEAF_BEVEL,
      bevelSegments: 2,
      curveSegments: 10,
    },
  );
  const blindFaceZ = -BL / 2 + 0.01; // outer face, set back inside the frame
  blindGeo.translate(0, 0, blindFaceZ + LEAF_BEVEL);
  A_END.group.add(mesh(blindGeo, mat.shell, "Blind end panel"));

  const liveryEnd = makeLivery({
    code: "AKE",
    type: "LD-3 LOWER DECK",
    tag: `${BW.toFixed(2)} \u00D7 ${BL.toFixed(2)} \u00D7 ${H.toFixed(2)} M`,
    profileLabel: `${BW.toFixed(2)} / ${AKE_DIMENSIONS.topWidth.toFixed(2)} M`,
    section: "contour",
  });
  const idTex = makeIdPlate({
    width: 0.36,
    height: 0.19,
    id: "AKE 4127",
    carrier: "BA",
    serial: "AKE4127BA-0713",
    tareKg: 92,
    maxGrossKg: 1588,
    volumeM3: 4.3,
  });
  const liveryEndMat = mat.decal.clone();
  liveryEndMat.map = liveryEnd;
  const idMat = mat.plate.clone();
  idMat.map = idTex;

  const blindCx = X0 + BW / 2 + 0.04;
  A_END.group.add(
    decal(
      1.14,
      0.92,
      nBlind,
      new THREE.Vector3(
        blindCx,
        CHASSIS + (H - CHASSIS) * 0.6,
        blindFaceZ - 0.002,
      ),
      liveryEndMat,
      "End livery decal",
    ),
  );
  A_END.group.add(
    decal(
      0.36,
      0.19,
      nBlind,
      new THREE.Vector3(blindCx, CHASSIS + 0.17, blindFaceZ - 0.002),
      idMat,
      "ULD identification plate",
    ),
  );

  /* --- 7.9 door assembly: pivot, leaf, gasket, cam latches, hinges ----- */
  const doorPivot = tag(new THREE.Group(), "Door pivot");
  const HINGE_X = X0 + FRAME_W - 0.008; // pin axis, just inside the frame lip
  const HINGE_Z = BL / 2 - END_FRAME * 0.5;
  doorPivot.position.set(HINGE_X, 0, HINGE_Z);
  A_DOOR.group.add(doorPivot);
  const px = (x: number) => x - HINGE_X; // world X → pivot-local X

  const leafGeo = new THREE.ExtrudeGeometry(roundedShape(leaf, rLeaf), {
    depth: LEAF_T,
    bevelEnabled: true,
    bevelThickness: LEAF_BEVEL,
    bevelSize: LEAF_BEVEL,
    bevelSegments: 2,
    curveSegments: 10,
  });
  const leafZ = BL / 2 - LEAF_RECESS - (LEAF_T + LEAF_BEVEL) - HINGE_Z;
  const FACE = leafZ + LEAF_T + LEAF_BEVEL; // pivot-local z of the leaf's outer face
  // bake the pivot offset into the section geometry so the leaf swings about it
  leafGeo.translate(-HINGE_X, 0, leafZ);
  doorPivot.add(mesh(leafGeo, mat.shell, "Door leaf"));

  // leaf stiffeners: two vertical, one following the contoured edge
  const leafH = H - CHASSIS - 0.2;
  for (const dx of [X0 + FRAME_W + 0.09, X0 + BW * 0.55]) {
    const rib = wallBox(
      mat.shell,
      0.1,
      leafH,
      0.014,
      nDoor,
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(px(dx), CHASSIS + leafH / 2 + 0.1, FACE + 0.008),
      "Door stiffener",
    );
    doorPivot.add(rib);
  }
  const leafSlant = wallBox(
    mat.shell,
    0.1,
    Math.hypot(leaf[2].x - leaf[1].x, H - CHASSIS) - 0.22,
    0.014,
    nDoor,
    new THREE.Vector3(leaf[2].x - leaf[1].x, H - CHASSIS, 0),
    new THREE.Vector3(
      px((leaf[1].x + leaf[2].x) / 2),
      CHASSIS + (H - CHASSIS) / 2,
      FACE + 0.008,
    ),
    "Door stiffener",
  );
  doorPivot.add(leafSlant);

  // rubber gasket on the leaf's inner face
  const sealGeo = new THREE.ExtrudeGeometry(
    ringSection(
      offsetPolygon(leaf, 0.012),
      offsetPolygon(leaf, 0.05),
      rLeaf,
      Math.max(rLeaf - 0.04, 0.01),
    ),
    { depth: 0.016, bevelEnabled: false, curveSegments: 10 },
  );
  sealGeo.translate(-HINGE_X, 0, leafZ - 0.017);
  doorPivot.add(mesh(sealGeo, mat.dark, "Door gasket", false));

  // cam latch rods with fold-flat handles
  for (const rx of [X0 + FRAME_W + 0.06, X0 + BW - 0.1]) {
    const rodLen = H - CHASSIS - 0.2;
    const rod = mesh(
      new THREE.CylinderGeometry(0.012, 0.012, rodLen, 14),
      mat.steel,
      "Cam latch rod",
    );
    rod.position.set(px(rx), CHASSIS + rodLen / 2 + 0.1, FACE + 0.013);
    doorPivot.add(rod);

    for (const hy of [CHASSIS + 0.2, CHASSIS + (H - CHASSIS) * 0.55, H - 0.2]) {
      const hub = box(mat.steel, 0.048, 0.05, 0.04, "Latch hub", 0.01);
      hub.position.set(px(rx), hy, FACE + 0.013);
      doorPivot.add(hub);
      // fold-flat lever: kept inside the frame rebate so the closed door
      // never breaks the certified envelope
      const handle = box(mat.accent, 0.03, 0.14, 0.018, "Latch handle", 0.008);
      handle.position.set(px(rx) + 0.009, hy - 0.045, FACE + 0.017);
      handle.rotation.x = -0.1;
      doorPivot.add(handle);
    }
  }

  // keepers belong to the frame, not the leaf
  for (const rx of [X0 + FRAME_W + 0.06, X0 + BW - 0.1]) {
    for (const ky of [CHASSIS + 0.13, H - 0.13]) {
      const k = box(mat.alloy, 0.06, 0.055, 0.045, "Latch keeper", 0.008);
      k.position.set(rx, ky, BL / 2 - 0.028);
      A_DOOR.group.add(k);
    }
  }

  // hinges on the centreline side: pin on the axis, one strap each side
  for (const hy of [CHASSIS + 0.22, CHASSIS + (H - CHASSIS) / 2, H - 0.24]) {
    const pin = mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.13, 14),
      mat.steel,
      "Hinge pin",
    );
    pin.position.set(HINGE_X, hy, HINGE_Z);
    A_DOOR.group.add(pin);
    const leafArm = box(mat.steel, 0.09, 0.1, 0.014, "Hinge strap", 0.005);
    leafArm.position.set(px(HINGE_X + 0.048), hy, FACE + 0.008);
    doorPivot.add(leafArm);
    const frameArm = box(mat.steel, 0.09, 0.1, 0.014, "Hinge strap", 0.005);
    frameArm.position.set(HINGE_X + 0.048, hy, BL / 2 - 0.014);
    A_DOOR.group.add(frameArm);
  }

  // handle bar + stencils on the leaf
  const bar = box(mat.accent, 0.34, 0.03, 0.026, "Door handle bar", 0.01);
  bar.position.set(px(X0 + BW / 2), CHASSIS + 0.46, FACE + 0.022);
  doorPivot.add(bar);

  const pullTex = makeStencil("PULL \u25BC", "#ffb020", 512, 160);
  const pullMat = mat.stencil.clone();
  pullMat.map = pullTex;
  doorPivot.add(
    decal(
      0.26,
      0.082,
      nDoor,
      new THREE.Vector3(px(X0 + BW / 2), CHASSIS + 0.32, FACE + 0.003),
      pullMat,
      "Handling stencil",
    ),
  );
  const leafIdMat = mat.plate.clone();
  leafIdMat.map = idTex;
  doorPivot.add(
    decal(
      0.34,
      0.18,
      nDoor,
      new THREE.Vector3(px(X0 + BW / 2 - 0.02), H - 0.34, FACE + 0.003),
      leafIdMat,
      "Door data plate",
    ),
  );

  doorPivot.rotation.y = -o.doorOpen * MAX_DOOR;

  /* --- 7.10 side livery on the contoured wall ------------------------- */
  const liverySide = makeLivery({
    code: "AKE",
    type: "LD-3 CONTOURED ULD",
    tag: "MAX GROSS 1588 KG \u00B7 4.3 M\u00B3",
    profileLabel: "16.5\u00B0 TAPER",
    section: "contour",
  });
  const sideMat = mat.decal.clone();
  sideMat.map = liverySide;
  const decalY = CHASSIS + (H - CHASSIS) * 0.58;
  A_HULL.group.add(
    decal(
      1.06,
      0.64,
      nSlant,
      new THREE.Vector3(
        wallX(nominal, decalY) - nSlant.x * (RAIL_T - 0.002),
        decalY - nSlant.y * (RAIL_T - 0.002),
        0,
      ),
      sideMat,
      "Side livery decal",
    ),
  );

  const warnTex = makeStencil("NO STEP", "#e2513c", 512, 140);
  const warnMat = mat.stencil.clone();
  warnMat.map = warnTex;
  A_HULL.group.add(
    decal(
      0.3,
      0.082,
      nInner,
      new THREE.Vector3(X0 + RAIL_T - 0.002, CHASSIS + 0.3, -0.25),
      warnMat,
      "Warning stencil",
    ),
  );

  const rivetMesh = o.rivets ? rivets.build(mat.rivet) : null;
  if (rivetMesh) A_FRAME.group.add(rivetMesh);

  /* --- 7.11 stats ------------------------------------------------------ */
  let triangles = 0;
  let meshCount = 0;
  for (const a of assemblies) {
    a.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.geometry) return;
      meshCount++;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh
        ? (m as THREE.InstancedMesh).count
        : 1;
      const g = m.geometry;
      const t = g.index
        ? g.index.count / 3
        : (g.attributes.position?.count ?? 0) / 3;
      const tri = Math.round(t * inst);
      triangles += tri;
      a.meshes++;
      a.triangles += tri;
    });
  }

  const sectionArea = Math.abs(
    THREE.ShapeUtils.area(nominal.map((p) => new THREE.Vector2(p.x, p.y))),
  );

  return {
    group: root,
    materials: mat,
    assemblies,
    doorPivot,
    profile: nominal,
    stats: {
      meshes: meshCount,
      triangles,
      volumeM3: sectionArea * BL,
      iataVolumeM3: 4.3,
      footprintM2: BW * BL,
      tareKg: 92,
      maxGrossKg: 1588,
      payloadKg: 1588 - 92,
    },
    setFinish(id: FinishId) {
      const f = FINISHES[id];
      mat.shell.color.set(f.color);
      mat.shell.metalness = f.metalness;
      mat.shell.roughness = f.roughness;
      mat.shell.clearcoat = f.clearcoat;
      mat.shell.clearcoatRoughness = f.clearcoatRoughness;
      mat.shell.needsUpdate = true;
    },
    setDoorOpen(t: number) {
      doorPivot.rotation.y = -THREE.MathUtils.clamp(t, 0, 1) * MAX_DOOR;
    },
    dispose() {
      const geos = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      const texs = new Set<THREE.Texture>();
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) geos.add(m.geometry);
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => mats.add(x));
        else if (mm) mats.add(mm);
      });
      mats.forEach((m) => {
        const rec = m as unknown as Record<string, unknown>;
        for (const k of [
          "map",
          "normalMap",
          "roughnessMap",
          "aoMap",
          "metalnessMap",
        ]) {
          if (rec[k] instanceof THREE.Texture)
            texs.add(rec[k] as THREE.Texture);
        }
        m.dispose();
      });
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
