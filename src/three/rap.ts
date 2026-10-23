/**
 * ============================================================================
 *  rap.ts — procedural generator for an IATA RAP (LD-9 class) large
 *           refrigerated air-cargo container, built entirely from Three.js
 *           primitives. No external model files, no image assets.
 *
 *  Certified envelope (metres, nominal):
 *      width ................. 3.18 (X)  — uniform, NO contour
 *      depth ................. 2.44 (Z)
 *      height ................. 1.62 (Y)
 *
 *  Like the RKN the RAP is a true cuboid, but roughly twice the volume, so the
 *  build is heavier everywhere: 60 mm insulated sandwich panels, deep
 *  reinforced corner posts, doubled edge extrusions, heavy base castings and a
 *  large integrated climate-control unit on the front (door) panel with a
 *  condenser grille, twin evaporator fans and a flat composite control panel.
 *
 *  The aluminium frame and skin reuse the shared brushed-metal palette from
 *  TEXTURES.ts; the climate unit reuses the RKN's controller artwork so both
 *  reefers share one fascia.
 *
 *  Implements the same ContainerBase contract as the AKE and RKN generators,
 *  so AKEViewer.ts drives it unchanged.
 * ============================================================================
 */
import * as THREE from "three";
import {
  makeCondenserGrille,
  makeIdPlate,
  makeLivery,
  makeReeferPanel,
  makeStencil,
} from "./textures";
import {
  ContainerBase,
  FINISHES,
  assemblyFactory,
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
  type Assembly,
  type BaseMaterials,
  type ContainerStats,
  type FinishId,
  type V2,
} from "./primitives";

export { FINISHES };
export type { FinishId, Assembly };

/**
 * The RAP is a heavy build, so several frame constants are scaled up from the
 * shared ULD values (documented inline). Everything else comes from
 * ULD_CONSTANTS so the two reefers stay consistent.
 */
const WALL = 0.06; // insulated sandwich panel thickness
const RAIL_T = 0.022; // edge extrusion: skin inset this far, rails restore it
const RAIL_W = 0.17; // edge extrusion leg width
const POST_W = 0.15; // reinforced vertical corner post
const END_FRAME = 0.085; // axial depth of the door / blind end frames
const FRAME_W = 0.1; // radial width of the end frame ring
const CHASSIS = 0.115; // base skid-frame height
const CORNER_R = 0.1; // panel corner radius
const LEAF_T = 0.06; // door leaf thickness
const LEAF_BEVEL = 0.008;
const LEAF_CLEAR = 0.006; // radial gap between leaf and frame opening
const LEAF_RECESS = 0.05; // door face sits this far behind the envelope
const MAX_DOOR = THREE.MathUtils.degToRad(112);

/* ========================================================================== */
/* 1. Dimensions                                                              */
/* ========================================================================== */

export const RAP_DIMENSIONS = {
  /** uniform width along X — no fuselage contour */
  width: 3.18,
  /** depth along Z */
  depth: 2.44,
  /** overall height along Y */
  height: 1.62,
  /** certified internal volume (insulated box) */
  interiorVolume: 6.6,
} as const;

/* ========================================================================== */
/* 2. Materials                                                               */
/* ========================================================================== */

export interface RAPMaterials extends BaseMaterials {
  /** insulated sandwich skin — pale, so the finish colour tints through */
  insulated: THREE.MeshPhysicalMaterial;
  /** flat front climate-control fascia — moulded composite, NOT aluminium */
  panel: THREE.MeshPhysicalMaterial;
  /** backlit LCD readout */
  lcd: THREE.MeshStandardMaterial;
  /** ducting, shroud and coil housing */
  shroud: THREE.MeshStandardMaterial;
  /** stainless bezel framing the control panel */
  bezel: THREE.MeshStandardMaterial;
}

function createMaterials(finish: FinishId) {
  const base = createBaseMaterials(finish);
  const insulatedTex = makeInsulatedPanelTexture();
  const m: RAPMaterials = {
    ...base,
    // the skin keeps the brushed-metal response of the base shell but gains the
    // insulated-panel artwork: pressed seams, foam core, panel bow
    insulated: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(FINISHES[finish].color),
      metalness: FINISHES[finish].metalness * 0.85,
      roughness: FINISHES[finish].roughness + 0.12,
      map: insulatedTex,
      roughnessMap: base.shell.roughnessMap,
      normalMap: base.shell.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
      envMapIntensity: 1.0,
    }),
    panel: new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.25,
      roughness: 0.6,
      clearcoat: 0.4,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.75,
    }),
    lcd: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      metalness: 0.1,
      roughness: 0.28,
      transparent: true,
      emissive: new THREE.Color("#8ff5dc"),
      emissiveIntensity: 0.75,
      depthWrite: false,
      envMapIntensity: 0.3,
    }),
    shroud: new THREE.MeshStandardMaterial({
      color: "#39424a",
      metalness: 0.55,
      roughness: 0.68,
      envMapIntensity: 0.7,
    }),
    bezel: new THREE.MeshStandardMaterial({
      color: "#c9d0d6",
      metalness: 1.0,
      roughness: 0.22,
      envMapIntensity: 1.35,
    }),
  };
  return { mats: m, insulatedTex };
}

/* Local import shims keep the generator readable ---------------------------- */
import { makeInsulatedPanel } from "./textures";
const makeInsulatedPanelTexture = makeInsulatedPanel;

/* ========================================================================== */
/* 3. Section — a uniform cuboid, no slope                                    */
/* ========================================================================== */

/** The RAP cross-section: a plain rectangle, vertical walls on ±X. */
export function rapProfile(): V2[] {
  const { width: W, height: H } = RAP_DIMENSIONS;
  const x0 = -W / 2;
  return [
    { x: x0, y: CHASSIS },
    { x: x0 + W, y: CHASSIS },
    { x: x0 + W, y: H },
    { x: x0, y: H },
  ];
}

/* ========================================================================== */
/* 4. Build options and result                                                */
/* ========================================================================== */

export interface BuildOptions {
  finish: FinishId;
  /** corner posts, coil fins, tie-downs, drain, tie-down rails */
  detail: boolean;
  /** instanced rivet runs along every frame member */
  rivets: boolean;
  /** 0..1 door swing */
  doorOpen: number;
  /** climate-control unit powered (fans turn, LCD lit) */
  reefer: boolean;
  /** controller set point, °C */
  setpoint: number;
}

export const DEFAULT_OPTIONS: BuildOptions = {
  finish: "mill",
  detail: true,
  rivets: true,
  doorOpen: 0,
  reefer: true,
  setpoint: 4,
};

export interface RAPContainer extends ContainerBase {
  materials: RAPMaterials;
  stats: ContainerStats & {
    interiorM3: number;
    tempRange: string;
    tareKg: number;
  };
  setReefer(on: boolean): void;
  setSetpoint(celsius: number): void;
}

/* ========================================================================== */
/* 5. The generator                                                           */
/* ========================================================================== */

export function createRAPContainer(
  options: Partial<BuildOptions> = {},
): RAPContainer {
  const o: BuildOptions = { ...DEFAULT_OPTIONS, ...options };
  const { width: W, depth: D, height: H } = RAP_DIMENSIONS;

  const { mats: mat, insulatedTex } = createMaterials(o.finish);
  const root = tag(new THREE.Group(), "RAP_LD9");
  const rivets = new RivetRun();

  /* --- 5.1 the section stack: one rectangle, four offsets ---------------- */
  const nominal = rapProfile(); // certified outer envelope (cuboid)
  const hullOut = offsetPolygon(nominal, RAIL_T); // skin (rails restore envelope)
  const cavity = offsetPolygon(nominal, RAIL_T + WALL); // interior
  const leaf = offsetPolygon(nominal, FRAME_W + LEAF_CLEAR + LEAF_BEVEL);
  const X0 = nominal[0].x; // -W/2
  const rHull = CORNER_R - RAIL_T;
  const rOpen = 0.016; // offsets deeper than the radius come out near-square
  const rLeaf = 0.014;

  const nPosX = new THREE.Vector3(1, 0, 0);
  const nNegX = new THREE.Vector3(-1, 0, 0);
  const nTop = new THREE.Vector3(0, 1, 0);
  const nDoor = new THREE.Vector3(0, 0, 1);
  const nBlind = new THREE.Vector3(0, 0, -1);
  const upY = new THREE.Vector3(0, 1, 0);
  const upX = new THREE.Vector3(1, 0, 0);

  /* --- 5.2 assemblies ---------------------------------------------------- */
  const assemblies: Assembly[] = [];
  const assembly = assemblyFactory(root, assemblies);
  const A_HULL = assembly(
    "hull",
    "Hull shell",
    "Insulated panels, 60 mm wall",
    [0, 0.3, 0],
  );
  const A_FRAME = assembly(
    "frame",
    "Edge frame",
    "Extrusions + reinforced posts",
    [0, 0.7, 0],
  );
  const A_BASE = assembly(
    "base",
    "Base chassis",
    "Skid frame, castings, fork pockets",
    [0, -0.7, 0],
  );
  const A_DOOR = assembly(
    "door",
    "Door assembly",
    "Hinged leaf, 4 cam latch rods",
    [0, 0, 1.1],
  );
  const A_CLIMATE = assembly(
    "climate",
    "Climate unit",
    "Condenser, twin fans, controller",
    [0, 0.4, 1.8],
  );
  const A_END = assembly(
    "blind",
    "Blind end",
    "Closed end panel + livery",
    [0, 0, -1.1],
  );

  /* --- 5.3 hull: hollow rectangular tube of insulated panels ------------- */
  const hullLen = D - END_FRAME * 2;
  const hullGeo = new THREE.ExtrudeGeometry(
    ringSection(hullOut, cavity, rHull, CORNER_R - RAIL_T - WALL),
    { depth: hullLen, bevelEnabled: false, curveSegments: 10, steps: 1 },
  );
  hullGeo.translate(0, 0, -hullLen / 2);
  A_HULL.group.add(mesh(hullGeo, mat.insulated, "Hull — insulated panel tube"));

  // roof panel closes the envelope flush with the frame extrusions
  const roof = box(mat.alloy, W - 0.14, RAIL_T, D - 0.14, "Roof panel", 0.008);
  roof.position.set(0, H - RAIL_T / 2, 0);
  A_HULL.group.add(roof);

  const belly = box(mat.chassis, W - 0.18, 0.014, D - 0.24, "Belly pan", 0.005);
  belly.position.set(0, 0.007, 0);
  A_HULL.group.add(belly);

  // interior fit-out, visible with the door open
  const floorY = CHASSIS + RAIL_T + WALL;
  for (const dz of [-0.8, -0.4, 0, 0.4, 0.8]) {
    const strip = box(
      mat.hullInner,
      W - 0.3,
      0.01,
      0.12,
      "Floor wear strip",
      0.004,
    );
    strip.position.set(0, floorY + 0.006, dz);
    A_HULL.group.add(strip);
  }
  for (const yy of [0.46, 1.02]) {
    for (const n of [nPosX, nNegX]) {
      A_HULL.group.add(
        wallBox(
          mat.hullInner,
          hullLen - 0.24,
          0.05,
          0.024,
          n,
          upY,
          new THREE.Vector3(X0 + RAIL_T + WALL + 0.014, yy, 0),
          "Interior tie-down rail",
        ),
      );
    }
  }
  // cold-air duct along the ceiling + return-air probes
  const duct = box(mat.hullInner, W - 0.5, 0.1, 0.14, "Cold-air duct", 0.01);
  duct.position.set(0, H - RAIL_T - WALL - 0.07, -hullLen / 2 + 0.35);
  A_HULL.group.add(duct);
  for (const pz of [-0.5, 0, 0.5]) {
    const probe = mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.07, 12),
      mat.steel,
      "Temp probe",
    );
    probe.position.set(X0 + W * 0.5, floorY + 0.05, pz);
    A_HULL.group.add(probe);
  }

  /* --- 5.4 reinforced corners, stiffeners, tie-downs, drain -------------- */
  if (o.detail) {
    // heavy vertical corner posts, inset so their outer faces sit on the
    // certified envelope
    for (const cx of [X0 + POST_W / 2, X0 + W - POST_W / 2]) {
      const post = box(
        mat.alloy,
        POST_W,
        H - CHASSIS - RAIL_T,
        POST_W,
        "Corner post",
        0.02,
      );
      post.position.set(cx, (H + CHASSIS - RAIL_T) / 2, 0);
      A_FRAME.group.add(post);
      if (o.rivets) {
        rivets.line(
          new THREE.Vector3(cx, CHASSIS + 0.1, -D / 2 + 0.14),
          new THREE.Vector3(cx, H - 0.1, -D / 2 + 0.14),
          nBlind,
          0.2,
        );
        rivets.line(
          new THREE.Vector3(cx, CHASSIS + 0.1, D / 2 - 0.14),
          new THREE.Vector3(cx, H - 0.1, D / 2 - 0.14),
          nDoor,
          0.2,
        );
      }
    }

    // gusset plates tying each post into the roof and the base frame
    const gussetW = POST_W + 0.1;
    for (const cx of [X0 + gussetW / 2, X0 + W - gussetW / 2]) {
      for (const cz of [-D / 2 + END_FRAME + 0.1, 0, D / 2 - END_FRAME - 0.1]) {
        const g = box(
          mat.alloy,
          gussetW,
          0.022,
          gussetW,
          "Corner gusset",
          0.008,
        );
        g.position.set(cx, H - RAIL_T - 0.008, cz);
        A_FRAME.group.add(g);
      }
    }

    // panel stiffeners on the long walls
    for (const z of [-0.85, -0.28, 0.28, 0.85]) {
      for (const n of [nPosX, nNegX]) {
        A_HULL.group.add(
          wallBox(
            mat.insulated,
            0.1,
            H - CHASSIS - 0.2,
            RAIL_T,
            n,
            upY,
            new THREE.Vector3(X0 + W / 2 - RAIL_T * 0.5, (CHASSIS + H) / 2, z),
            "Wall stiffener",
          ),
        );
      }
    }
    // end-wall stiffeners
    for (const x of [X0 + 0.35, X0 + W - 0.35]) {
      for (const [n, z] of [
        [nDoor, hullLen / 2 - RAIL_T * 0.5],
        [nBlind, -hullLen / 2 + RAIL_T * 0.5],
      ] as [THREE.Vector3, number][]) {
        A_HULL.group.add(
          wallBox(
            mat.insulated,
            0.1,
            H - CHASSIS - 0.2,
            RAIL_T,
            n,
            upY,
            new THREE.Vector3(x, (CHASSIS + H) / 2, z),
            "End wall stiffener",
          ),
        );
      }
    }

    // deck-roller pads on the roof
    for (const x of [X0 + 0.6, X0 + W - 0.6]) {
      A_HULL.group.add(
        wallBox(
          mat.dark,
          0.16,
          0.12,
          RAIL_T * 0.6,
          nTop,
          upX,
          new THREE.Vector3(x, H - RAIL_T * 0.3, 0),
          "Roller pad",
          0.008,
        ),
      );
    }

    // condensate drain under the climate unit
    const drain = box(mat.steel, 0.06, 0.036, 0.06, "Condensate drain", 0.008);
    drain.position.set(W * 0.28, 0.018, D / 2 - END_FRAME - 0.2);
    A_HULL.group.add(drain);
    const drainPipe = mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12),
      mat.steel,
      "Drain pipe",
    );
    drainPipe.rotation.x = Math.PI / 2;
    drainPipe.position.copy(drain.position).setY(0.024);
    A_HULL.group.add(drainPipe);
  }

  /* --- 5.5 edge frame: extrusions that wrap every panel fillet ----------- */
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
      depth: D,
      bevelEnabled: false,
      curveSegments: 8,
      steps: 1,
    });
    geo.translate(0, 0, -D / 2);
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
        D,
        span,
        RAIL_T,
        n,
        new THREE.Vector3(d.x, d.y, 0),
        mid,
        `Edge extrusion ${i + 1}`,
        0.004,
      ),
    );
    if (o.rivets) {
      rivets.line(
        new THREE.Vector3(mid.x, mid.y, -D / 2 + 0.14),
        new THREE.Vector3(mid.x, mid.y, D / 2 - 0.14),
        n,
        0.16,
      );
    }
  });

  /* --- 5.6 base chassis, heavy castings, fork pockets -------------------- */
  const chassis = box(
    mat.chassis,
    W - 0.05,
    CHASSIS,
    D - 0.05,
    "Skid frame",
    0.014,
  );
  chassis.position.set(0, CHASSIS / 2, 0);
  A_BASE.group.add(chassis);

  for (const sx of [-1.15, -0.4, 0.4, 1.15]) {
    const bh = CHASSIS + 0.006;
    const beam = box(
      mat.chassis,
      0.17,
      bh,
      D - 0.03,
      "Longitudinal beam",
      0.01,
    );
    beam.position.set(sx, bh / 2, 0);
    A_BASE.group.add(beam);
  }
  for (const cz of [-0.9, 0, 0.9]) {
    const cross = box(mat.chassis, W - 0.1, 0.06, 0.12, "Cross member", 0.01);
    cross.position.set(0, CHASSIS - 0.04, cz);
    A_BASE.group.add(cross);
  }

  // lower corner castings with the cargo-system locating bore
  for (const cx of [X0 + 0.13, X0 + W - 0.13]) {
    for (const cz of [-D / 2 + 0.13, D / 2 - 0.13]) {
      const c = box(
        mat.alloy,
        0.24,
        CHASSIS + 0.008,
        0.24,
        "Corner casting",
        0.03,
      );
      c.position.set(cx, (CHASSIS + 0.008) / 2, cz);
      A_BASE.group.add(c);
      const bore = mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.024, 20),
        mat.dark,
        "Casting bore",
      );
      bore.position.set(cx, 0.016, cz);
      A_BASE.group.add(bore);
    }
  }

  // fork pockets across the 3.18 m width, entered from both long walls
  for (const z of [-0.55, 0.55]) {
    const y = CHASSIS * 0.55;
    for (const n of [nNegX, nPosX]) {
      const faceX =
        (n === nNegX ? X0 : X0 + W) + (n === nNegX ? 0.024 : -0.024);
      A_BASE.group.add(
        wallBox(
          mat.dark,
          0.34,
          0.075,
          0.024,
          n,
          upY,
          new THREE.Vector3(faceX + n.x * 0.012, y + n.y * 0.012, z),
          "Fork pocket",
          0.008,
        ),
      );
      A_BASE.group.add(
        wallBox(
          mat.steel,
          0.38,
          0.01,
          0.024,
          n,
          upY,
          new THREE.Vector3(faceX + n.x * 0.012, y - 0.043 + n.y * 0.012, z),
          "Pocket wear lip",
          0.004,
        ),
      );
    }
  }

  /* --- 5.7 end frames ---------------------------------------------------- */
  const ringGeo = new THREE.ExtrudeGeometry(
    ringSection(
      offsetPolygon(nominal, LEAF_BEVEL),
      offsetPolygon(nominal, FRAME_W - LEAF_BEVEL),
      Math.max(CORNER_R - LEAF_BEVEL, 0.012),
      rOpen,
    ),
    {
      depth: END_FRAME - LEAF_BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: LEAF_BEVEL,
      bevelSize: LEAF_BEVEL,
      bevelSegments: 2,
      curveSegments: 10,
      steps: 1,
    },
  );
  const ringShiftDoor = D / 2 - (END_FRAME - LEAF_BEVEL);
  const ringShiftBlind = -D / 2 + LEAF_BEVEL;
  A_DOOR.group.add(
    mesh(
      ringGeo.clone().translate(0, 0, ringShiftDoor),
      mat.alloy,
      "Door end frame",
    ),
  );
  A_END.group.add(
    mesh(
      ringGeo.clone().translate(0, 0, ringShiftBlind),
      mat.alloy,
      "Blind end frame",
    ),
  );

  if (o.rivets) {
    const circle = offsetPolygon(nominal, 0.04);
    circle.forEach((p, i) => {
      const q = circle[(i + 1) % circle.length];
      const d = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
      const a = new THREE.Vector3(
        p.x + d.x * 0.09,
        p.y + d.y * 0.09,
        D / 2 - 0.014,
      );
      const b = new THREE.Vector3(
        q.x - d.x * 0.09,
        q.y - d.y * 0.09,
        D / 2 - 0.014,
      );
      rivets.line(a, b, nDoor, 0.18);
      rivets.line(
        a.clone().setZ(-D / 2 + 0.014),
        b.clone().setZ(-D / 2 + 0.014),
        nBlind,
        0.18,
      );
    });
  }

  /* --- 5.8 blind end: panel, livery, identification plate --------------- */
  const blindGeo = new THREE.ExtrudeGeometry(
    roundedShape(offsetPolygon(nominal, FRAME_W + LEAF_BEVEL), rOpen),
    {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: LEAF_BEVEL,
      bevelSize: LEAF_BEVEL,
      bevelSegments: 2,
      curveSegments: 10,
    },
  );
  const blindFaceZ = -D / 2 + 0.012;
  blindGeo.translate(0, 0, blindFaceZ + LEAF_BEVEL);
  A_END.group.add(mesh(blindGeo, mat.insulated, "Blind end panel"));

  const liveryEnd = makeLivery({
    code: "RAP",
    type: "LD-9 REEFER",
    tag: `${W.toFixed(2)} \u00D7 ${D.toFixed(2)} \u00D7 ${H.toFixed(2)} M`,
    profileLabel: `${W.toFixed(2)} \u00D7 ${H.toFixed(2)} M`,
    section: "cuboid",
  });
  const idTex = makeIdPlate({
    width: 0.44,
    height: 0.23,
    id: "RAP 4127",
    carrier: "LH",
    serial: "RAP4127LH-0713",
    tareKg: 450,
    maxGrossKg: 6033,
    volumeM3: RAP_DIMENSIONS.interiorVolume,
  });
  const liveryEndMat = mat.decal.clone();
  liveryEndMat.map = liveryEnd;
  const idMat = mat.plate.clone();
  idMat.map = idTex;

  A_END.group.add(
    decal(
      1.3,
      1.04,
      nBlind,
      new THREE.Vector3(0, CHASSIS + (H - CHASSIS) * 0.62, blindFaceZ - 0.002),
      liveryEndMat,
      "End livery decal",
    ),
  );
  A_END.group.add(
    decal(
      0.44,
      0.23,
      nBlind,
      new THREE.Vector3(0, CHASSIS + 0.2, blindFaceZ - 0.002),
      idMat,
      "ULD identification plate",
    ),
  );

  /* --- 5.9 door assembly: pivot, leaf, gasket, four cam latches --------- */
  const doorPivot = tag(new THREE.Group(), "Door pivot");
  const HINGE_X = X0 + FRAME_W - 0.01; // pin axis, just inside the frame lip
  const HINGE_Z = D / 2 - END_FRAME * 0.5;
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
  const leafZ = D / 2 - LEAF_RECESS - (LEAF_T + LEAF_BEVEL) - HINGE_Z;
  const FACE = leafZ + LEAF_T + LEAF_BEVEL; // pivot-local z of the leaf's outer face
  leafGeo.translate(-HINGE_X, 0, leafZ);
  doorPivot.add(mesh(leafGeo, mat.insulated, "Door leaf"));

  // leaf stiffeners
  const leafH = H - CHASSIS - 0.24;
  for (const dx of [
    X0 + FRAME_W + 0.11,
    X0 + W * 0.32,
    X0 + W * 0.68,
    X0 + W - 0.13,
  ]) {
    doorPivot.add(
      wallBox(
        mat.insulated,
        0.12,
        leafH,
        0.018,
        nDoor,
        upY,
        new THREE.Vector3(px(dx), CHASSIS + leafH / 2 + 0.12, FACE + 0.01),
        "Door stiffener",
      ),
    );
  }

  // rubber gasket on the leaf's inner face
  const sealGeo = new THREE.ExtrudeGeometry(
    ringSection(
      offsetPolygon(leaf, 0.014),
      offsetPolygon(leaf, 0.06),
      rLeaf,
      Math.max(rLeaf - 0.046, 0.01),
    ),
    { depth: 0.02, bevelEnabled: false, curveSegments: 10 },
  );
  sealGeo.translate(-HINGE_X, 0, leafZ - 0.022);
  doorPivot.add(mesh(sealGeo, mat.dark, "Door gasket", false));

  // four cam latch rods with fold-flat handles, clear of the climate unit
  for (const rx of [
    X0 + FRAME_W + 0.08,
    X0 + W * 0.28,
    X0 + W * 0.72,
    X0 + W - 0.12,
  ]) {
    const rodLen = H - CHASSIS - 0.24;
    const rod = mesh(
      new THREE.CylinderGeometry(0.014, 0.014, rodLen, 14),
      mat.steel,
      "Cam latch rod",
    );
    rod.position.set(px(rx), CHASSIS + rodLen / 2 + 0.12, FACE + 0.015);
    doorPivot.add(rod);

    for (const hy of [
      CHASSIS + 0.24,
      CHASSIS + (H - CHASSIS) * 0.5,
      H - 0.24,
    ]) {
      const hub = box(mat.steel, 0.055, 0.058, 0.046, "Latch hub", 0.012);
      hub.position.set(px(rx), hy, FACE + 0.015);
      doorPivot.add(hub);
      const handle = box(mat.accent, 0.034, 0.16, 0.02, "Latch handle", 0.009);
      handle.position.set(px(rx) + 0.01, hy - 0.052, FACE + 0.019);
      handle.rotation.x = -0.1;
      doorPivot.add(handle);
    }
  }

  // keepers belong to the frame, not the leaf
  for (const rx of [
    X0 + FRAME_W + 0.08,
    X0 + W * 0.28,
    X0 + W * 0.72,
    X0 + W - 0.12,
  ]) {
    for (const ky of [CHASSIS + 0.16, H - 0.16]) {
      const k = box(mat.alloy, 0.07, 0.062, 0.05, "Latch keeper", 0.01);
      k.position.set(rx, ky, D / 2 - 0.034);
      A_DOOR.group.add(k);
    }
  }

  // hinges on the -X side
  for (const hy of [CHASSIS + 0.28, CHASSIS + (H - CHASSIS) / 2, H - 0.3]) {
    const pin = mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.15, 14),
      mat.steel,
      "Hinge pin",
    );
    pin.position.set(HINGE_X, hy, HINGE_Z);
    A_DOOR.group.add(pin);
    const leafArm = box(mat.steel, 0.1, 0.11, 0.016, "Hinge strap", 0.006);
    leafArm.position.set(px(HINGE_X + 0.055), hy, FACE + 0.01);
    doorPivot.add(leafArm);
    const frameArm = box(mat.steel, 0.1, 0.11, 0.016, "Hinge strap", 0.006);
    frameArm.position.set(HINGE_X + 0.055, hy, D / 2 - 0.016);
    A_DOOR.group.add(frameArm);
  }

  // handle bar + cold-chain stencil, clear of the climate unit
  const barX = X0 + 0.55;
  const bar = box(mat.accent, 0.4, 0.034, 0.03, "Door handle bar", 0.012);
  bar.position.set(px(barX), CHASSIS + 0.5, FACE + 0.026);
  doorPivot.add(bar);

  const coldTex = makeStencil("FROZEN \u25B2 -25\u00B0C", "#79b8c9", 640, 150);
  const coldMat = mat.stencil.clone();
  coldMat.map = coldTex;
  doorPivot.add(
    decal(
      0.34,
      0.08,
      nDoor,
      new THREE.Vector3(px(barX), CHASSIS + 0.3, FACE + 0.004),
      coldMat,
      "Cold-chain stencil",
    ),
  );

  /* --- 5.10 climate-control unit on the front (door) panel --------------- */
  // Hangs off the pivot so it swings with the door, but keeps its own assembly
  // so the exploded view can pull it clear.
  doorPivot.add(A_CLIMATE.group);

  // Depth budget (pivot-local z): the leaf face sits LEAF_RECESS behind the
  // certified 2.44 m envelope, so the whole unit is built inside that rebate
  // and never crosses the envelope.
  const UNIT_FACE = FACE + 0.032;

  const unitW = 1.95;
  const unitH = 1.2;
  const unitCx = 0; // centred on the front panel
  const unitCy = CHASSIS + (H - CHASSIS) * 0.53;
  const at = (ux: number, uy: number, z: number) =>
    new THREE.Vector3(px(unitCx + ux), unitCy + uy, z);

  // brushed stainless bezel plate, bolted to the leaf
  const bezel = box(
    mat.bezel,
    unitW + 0.08,
    unitH + 0.08,
    0.02,
    "Climate unit bezel",
    0.025,
  );
  bezel.position.set(px(unitCx), unitCy, FACE + 0.008);
  A_CLIMATE.group.add(bezel);

  // ducted housing behind the face
  const housing = box(
    mat.shroud,
    unitW,
    unitH,
    0.03,
    "Climate unit housing",
    0.015,
  );
  housing.position.set(px(unitCx), unitCy, FACE + 0.023);
  A_CLIMATE.group.add(housing);

  // ---- condenser intake grille spanning the upper face -------------------
  const grilleTex = makeCondenserGrille();
  const grilleMat = mat.plate.clone();
  grilleMat.map = grilleTex;
  grilleMat.roughness = 0.75;
  grilleMat.metalness = 0.2;
  A_CLIMATE.group.add(
    decal(
      unitW - 0.16,
      unitH * 0.46,
      nDoor,
      at(0, unitH * 0.26, UNIT_FACE - 0.016),
      grilleMat,
      "Condenser grille",
    ),
  );

  // ---- twin evaporator fans on spinning hubs ----------------------------
  const fans: THREE.Group[] = [];
  for (const fx of [-0.42, 0.42]) {
    const fanY = unitH * 0.26;
    const shroud = mesh(
      new THREE.CylinderGeometry(0.23, 0.26, 0.034, 30, 1, true),
      mat.shroud,
      "Fan shroud",
    );
    shroud.rotation.x = Math.PI / 2;
    shroud.position.copy(at(fx, fanY, UNIT_FACE - 0.018));
    A_CLIMATE.group.add(shroud);

    const hub = mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.03, 18),
      mat.steel,
      "Fan hub",
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(at(fx, fanY, UNIT_FACE - 0.018));
    A_CLIMATE.group.add(hub);

    const fan = tag(new THREE.Group(), "Evaporator fan");
    fan.position.copy(at(fx, fanY, UNIT_FACE - 0.014));
    A_CLIMATE.group.add(fan);
    for (let i = 0; i < 6; i++) {
      const blade = box(mat.steel, 0.17, 0.1, 0.009, "Fan blade", 0.005);
      blade.position.set(
        Math.cos((i / 6) * Math.PI * 2) * 0.14,
        Math.sin((i / 6) * Math.PI * 2) * 0.14,
        0,
      );
      blade.rotation.z = (i / 6) * Math.PI * 2 + 0.4;
      fan.add(blade);
    }
    fans.push(fan);
  }

  // ---- flat front control panel: the non-metallic fascia -----------------
  const panelTex = makeReeferPanel({
    code: "RAP",
    designation: "LD-9 · REEFER",
    tempRange: "-20 °C … +30 °C",
    minC: -20,
    maxC: 30,
    defaultC: o.setpoint,
    serial: "RAP-4127-07",
  });
  const panelMat = mat.panel.clone();
  panelMat.map = panelTex.texture;
  const panelW = 0.66;
  const panelH = panelW * 0.5;
  const panelUx = unitW / 2 - panelW / 2 - 0.09;
  const panelUy = -unitH * 0.28;

  const subFrame = box(
    mat.bezel,
    panelW + 0.06,
    panelH + 0.06,
    0.02,
    "Panel sub-frame",
    0.008,
  );
  subFrame.position.copy(at(panelUx, panelUy, FACE + 0.014));
  A_CLIMATE.group.add(subFrame);

  A_CLIMATE.group.add(
    wallBox(
      panelMat,
      panelW,
      panelH,
      0.014,
      nDoor,
      upY,
      at(panelUx, panelUy, UNIT_FACE - 0.007),
      "Climate control panel",
      0.006,
    ),
  );

  // backlit LCD readout, matched to the LCD well in the panel texture
  const lcdMat = mat.lcd.clone();
  lcdMat.map = panelTex.lcd;
  lcdMat.emissiveMap = panelTex.lcd;
  A_CLIMATE.group.add(
    wallBox(
      lcdMat,
      panelW * 0.41,
      panelH * 0.293,
      0.004,
      nDoor,
      upY,
      at(panelUx - panelW * 0.252, panelUy + panelH * 0.267, UNIT_FACE - 0.002),
      "LCD readout",
      0.002,
    ),
  );

  // membrane keycaps
  for (const [dx, dy, label] of [
    [-0.2, -0.09, "SET"],
    [-0.09, -0.09, "\u25BC"],
    [0.02, -0.09, "\u25B2"],
    [0.13, -0.09, "MODE"],
  ] as [number, number, string][]) {
    const key = box(mat.shroud, 0.042, 0.034, 0.006, `Key ${label}`, 0.004);
    key.position.copy(at(panelUx + dx, panelUy + dy, UNIT_FACE - 0.002));
    A_CLIMATE.group.add(key);
  }

  // power inlet + cable hook on the unit's lower-left flank
  const inletUx = -unitW / 2 + 0.11;
  const inletUy = -unitH * 0.3;
  const inlet = box(mat.dark, 0.09, 0.07, 0.026, "Power inlet", 0.01);
  inlet.position.copy(at(inletUx, inletUy, FACE + 0.019));
  A_CLIMATE.group.add(inlet);
  const inletPins = mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8),
    mat.steel,
    "Inlet pins",
  );
  inletPins.rotation.x = Math.PI / 2;
  inletPins.position.copy(at(inletUx, inletUy, UNIT_FACE - 0.005));
  A_CLIMATE.group.add(inletPins);

  const hook = mesh(
    new THREE.TorusGeometry(0.034, 0.006, 8, 16),
    mat.steel,
    "Cable hook",
  );
  hook.position.copy(at(inletUx - 0.09, inletUy + 0.19, UNIT_FACE - 0.017));
  A_CLIMATE.group.add(hook);

  // condenser coil fins along the top of the unit
  for (let i = 0; i < 12; i++) {
    const fin = box(mat.steel, unitW * 0.8, 0.05, 0.02, "Coil fin", 0.002);
    fin.position.copy(
      at(-unitW * 0.4 + (i * unitW * 0.8) / 11, unitH / 2 - 0.01, FACE + 0.03),
    );
    A_CLIMATE.group.add(fin);
  }

  // service stripe + unit stencils on the bezel
  const stripe = box(
    mat.accent,
    unitW + 0.1,
    0.014,
    0.024,
    "Unit service stripe",
    0.005,
  );
  stripe.position.copy(at(0, -unitH / 2 - 0.04, FACE + 0.01));
  A_CLIMATE.group.add(stripe);

  const reeferTagTex = makeStencil("RAP CLIMATE UNIT", "#79b8c9", 512, 130);
  const reeferTagMat = mat.stencil.clone();
  reeferTagMat.map = reeferTagTex;
  A_CLIMATE.group.add(
    decal(
      0.3,
      0.076,
      nDoor,
      at(-unitW / 2 + 0.18, unitH / 2 - 0.06, UNIT_FACE - 0.0145),
      reeferTagMat,
      "Unit stencil",
    ),
  );

  /* --- 5.11 side livery on the +X wall --------------------------------- */
  const liverySide = makeLivery({
    code: "RAP",
    type: "LD-9 COLD CHAIN",
    tag: "-20\u00B0C \u2026 +30\u00B0C \u00B7 6.6 M\u00B3",
    profileLabel: "0\u00B0 \u00B7 UNIFORM",
    section: "cuboid",
  });
  const sideMat = mat.decal.clone();
  sideMat.map = liverySide;
  A_HULL.group.add(
    decal(
      1.16,
      0.7,
      nPosX,
      new THREE.Vector3(
        X0 + W - RAIL_T + 0.002,
        CHASSIS + (H - CHASSIS) * 0.58,
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
      0.34,
      0.093,
      nNegX,
      new THREE.Vector3(X0 + RAIL_T - 0.002, CHASSIS + 0.34, -0.3),
      warnMat,
      "Warning stencil",
    ),
  );

  const rivetMesh = o.rivets ? rivets.build(mat.rivet) : null;
  if (rivetMesh) A_FRAME.group.add(rivetMesh);

  /* --- 5.12 runtime handles -------------------------------------------- */
  let reeferOn = o.reefer;
  const setReefer = (on: boolean) => {
    reeferOn = on;
    // hardware stays modelled either way; power only affects the backlight and
    // whether the condenser blowers turn (see animate() below)
    lcdMat.emissiveIntensity = on ? 0.75 : 0.1;
    mat.lcd.emissiveIntensity = on ? 0.75 : 0.1;
    panelTex.setActive(on);
  };
  setReefer(reeferOn);
  panelTex.setSetpoint(o.setpoint);
  doorPivot.rotation.y = -o.doorOpen * MAX_DOOR;

  /* --- 5.13 stats ------------------------------------------------------- */
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
      volumeM3: sectionArea * D,
      iataVolumeM3: RAP_DIMENSIONS.interiorVolume,
      footprintM2: W * D,
      tareKg: 450,
      maxGrossKg: 6033,
      payloadKg: 6033 - 450,
      interiorM3: RAP_DIMENSIONS.interiorVolume,
      tempRange: "-20 \u00B0C \u2026 +30 \u00B0C",
    },
    setFinish(id: FinishId) {
      const f = FINISHES[id];
      for (const m of [mat.shell, mat.insulated]) {
        m.color.set(f.color);
        m.metalness = m === mat.insulated ? f.metalness * 0.85 : f.metalness;
        m.roughness = m === mat.insulated ? f.roughness + 0.12 : f.roughness;
        m.clearcoat = f.clearcoat;
        m.clearcoatRoughness = f.clearcoatRoughness;
        m.needsUpdate = true;
      }
    },
    setDoorOpen(t: number) {
      doorPivot.rotation.y = -THREE.MathUtils.clamp(t, 0, 1) * MAX_DOOR;
    },
    setReefer,
    setSetpoint(celsius: number) {
      panelTex.setSetpoint(celsius);
    },
    animate(elapsed: number, delta: number) {
      if (reeferOn) {
        // twin condenser blowers, counter-rotating
        fans[0].rotation.z += delta * 13;
        fans[1].rotation.z -= delta * 13;
        lcdMat.emissiveIntensity = 0.68 + Math.sin(elapsed * 2.2) * 0.08;
      }
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
          "emissiveMap",
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
      panelTex.dispose();
      grilleTex.dispose();
      insulatedTex.dispose();
    },
  };
}
