/**
 * ============================================================================
 *  rkn.ts — procedural generator for an IATA RKN / LD-9 class refrigerated
 *           air-cargo container (active reefer ULD), built entirely from
 *           Three.js primitives. No external model files, no image assets.
 *
 *  Certified envelope (metres, nominal):
 *      width ................. 2.00 (X)  — uniform, NO contour
 *      depth ................. 1.53 (Z)
 *      height ................. 1.62 (Y)
 *
 *  Unlike the AKE / LD-3 (a right trapezoid with a 16.5° fuselage taper) the
 *  RKN is a true cuboid: the cross-section is a plain rectangle, so the same
 *  offset-polygon machinery from primitives.ts yields the hull, cavity, end
 *  frames and door leaf with no slant anywhere in the model.
 *
 *  Coordinate frame: Y up, base resting on the Y = 0 plane, centred on X, the
 *  hinged door on +Z (the "front" side) carrying the refrigeration unit.
 *
 *  The refrigeration unit is the RKN's defining feature: a flat front control
 *  panel in a non-metallic composite fascia (brushed-steel bezel, membrane
 *  keypad, backlit LCD readout) sits on the door side, fed by a condenser
 *  grille and a spinning evaporator fan. The aluminium frame and hull reuse
 *  the shared brushed-metal materials from TEXTURES.ts.
 *
 *  The returned object implements the same ContainerBase contract as the AKE
 *  generator, so AKEViewer.ts drives both models unchanged.
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
  ULD_CONSTANTS,
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

const {
  WALL,
  RAIL_T,
  RAIL_W,
  END_FRAME,
  RING_BEV,
  FRAME_W,
  CHASSIS,
  CORNER_R,
  LEAF_T,
  LEAF_BEVEL,
  LEAF_CLEAR,
  LEAF_RECESS,
  MAX_DOOR,
} = ULD_CONSTANTS;

/* ========================================================================== */
/* 1. Dimensions                                                              */
/* ========================================================================== */

export const RKN_DIMENSIONS = {
  /** uniform width along X — no fuselage contour */
  width: 2.0,
  /** depth along Z */
  depth: 1.53,
  /** overall height along Y */
  height: 1.62,
  /** certified internal volume (insulated box) */
  interiorVolume: 3.6,
} as const;

/* ========================================================================== */
/* 2. Materials                                                               */
/* ========================================================================== */

export interface RKNMaterials extends BaseMaterials {
  /** flat front control-panel fascia — moulded composite, NOT aluminium */
  panel: THREE.MeshPhysicalMaterial;
  /** backlit LCD readout, glowing through the fascia */
  lcd: THREE.MeshStandardMaterial;
  /** grille shroud / ducting around the condenser */
  shroud: THREE.MeshStandardMaterial;
  /** stainless bezel framing the panel */
  bezel: THREE.MeshStandardMaterial;
}

function createMaterials(finish: FinishId) {
  const base = createBaseMaterials(finish);
  const m: RKNMaterials = {
    ...base,
    // Deliberately non-metallic: a painted/moulded composite fascia so the
    // control panel reads as a different surface from the aluminium frame.
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
  return m;
}

/* ========================================================================== */
/* 3. Section — a uniform cuboid, no slope                                    */
/* ========================================================================== */

/**
 * The RKN cross-section: a plain rectangle. Vertical walls on ±X, so the
 * container is a cuboid from base to roof — the defining difference from the
 * trapezoidal AKE section.
 */
export function rknProfile(): V2[] {
  const { width: W, height: H } = RKN_DIMENSIONS;
  const x0 = -W / 2; // centre the envelope on X
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
  /** stiffeners, roller pads, tie-downs, drain */
  detail: boolean;
  /** instanced rivet runs along every frame member */
  rivets: boolean;
  /** 0..1 door swing */
  doorOpen: number;
  /** refrigeration unit powered (fan spins, LCD lit) */
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
  setpoint: -18,
};

export interface RKNContainer extends ContainerBase {
  materials: RKNMaterials;
  stats: ContainerStats & {
    interiorM3: number;
    tempRange: string;
    tareKg: number;
  };
  /** power the refrigeration unit on/off */
  setReefer(on: boolean): void;
  /** change the controller set point — repaints the LCD */
  setSetpoint(celsius: number): void;
}

/* ========================================================================== */
/* 5. The generator                                                           */
/* ========================================================================== */

export function createRKNContainer(options: Partial<BuildOptions> = {}): RKNContainer {
  const o: BuildOptions = { ...DEFAULT_OPTIONS, ...options };
  const { width: W, depth: D, height: H } = RKN_DIMENSIONS;

  const mat = createMaterials(o.finish);
  const root = tag(new THREE.Group(), "RKN_LD9");
  const rivets = new RivetRun();

  /* --- 5.1 the section stack: one rectangle, four offsets ---------------- */
  const nominal = rknProfile(); // certified outer envelope (cuboid)
  const hullOut = offsetPolygon(nominal, RAIL_T); // hull skin (rails restore envelope)
  const cavity = offsetPolygon(nominal, RAIL_T + WALL); // interior
  // clear aperture = offset(nominal, FRAME_W); the leaf body is drawn one bevel
  // deeper so its dilated caps still clear the aperture by LEAF_CLEAR
  const leaf = offsetPolygon(nominal, FRAME_W + LEAF_CLEAR + LEAF_BEVEL);
  const X0 = nominal[0].x; // -W/2, the -X wall plane
  const rHull = CORNER_R - RAIL_T; // skin follows the outer fillet
  const rOpen = 0.014; // offsets deeper than the radius come out near-square
  const rLeaf = 0.012;

  // axis-aligned wall normals — a cuboid has no slant at all
  const nPosX = new THREE.Vector3(1, 0, 0);
  const nNegX = new THREE.Vector3(-1, 0, 0);
  const nTop = new THREE.Vector3(0, 1, 0);
  const nDoor = new THREE.Vector3(0, 0, 1);
  const nBlind = new THREE.Vector3(0, 0, -1);
  const upY = new THREE.Vector3(0, 1, 0);
  const upZ = new THREE.Vector3(0, 0, 1);
  const upX = new THREE.Vector3(1, 0, 0);

  /* --- 5.2 assemblies ---------------------------------------------------- */
  const assemblies: Assembly[] = [];
  const assembly = assemblyFactory(root, assemblies);
  const A_HULL = assembly("hull", "Hull shell", "Insulated cuboid tube, 32 mm wall", [0, 0.3, 0]);
  const A_FRAME = assembly("frame", "Edge frame", "Aluminium extrusions + rivets", [0, 0.66, 0]);
  const A_BASE = assembly("base", "Base chassis", "Skid frame, castings, fork pockets", [0, -0.62, 0]);
  const A_DOOR = assembly("door", "Door assembly", "Hinged leaf, cam latch rods", [0, 0, 0.9]);
  const A_REEFER = assembly("reefer", "Refrigeration unit", "Condenser, fan, control panel", [0, 0.34, 1.5]);
  const A_END = assembly("blind", "Blind end", "Closed end panel + livery", [0, 0, -0.9]);

  /* --- 5.3 hull: hollow rectangular tube, open at both ends -------------- */
  const hullLen = D - END_FRAME * 2;
  const hullGeo = new THREE.ExtrudeGeometry(
    ringSection(hullOut, cavity, rHull, CORNER_R - RAIL_T - WALL),
    { depth: hullLen, bevelEnabled: false, curveSegments: 10, steps: 1 },
  );
  hullGeo.translate(0, 0, -hullLen / 2);
  A_HULL.group.add(mesh(hullGeo, mat.shell, "Hull — rectangular tube"));

  // roof panel closes the envelope flush with the frame extrusions
  const roof = box(mat.alloy, W - 0.13, RAIL_T, D - 0.13, "Roof panel", 0.006);
  roof.position.set(0, H - RAIL_T / 2, 0);
  A_HULL.group.add(roof);

  const belly = box(mat.chassis, W - 0.16, 0.012, D - 0.2, "Belly pan", 0.004);
  belly.position.set(0, 0.006, 0);
  A_HULL.group.add(belly);

  // interior fit-out, visible with the door open
  const floorY = CHASSIS + RAIL_T + WALL;
  for (const dz of [-0.34, 0, 0.34]) {
    const strip = box(mat.hullInner, W - 0.26, 0.008, 0.1, "Floor wear strip", 0.003);
    strip.position.set(0, floorY + 0.005, dz);
    A_HULL.group.add(strip);
  }
  for (const yy of [0.44, 0.96]) {
    for (const n of [nPosX, nNegX]) {
      A_HULL.group.add(
        wallBox(
          mat.hullInner,
          hullLen - 0.2,
          0.045,
          0.02,
          n,
          upY,
          new THREE.Vector3(X0 + RAIL_T + WALL + 0.012, yy, 0),
          "Interior tie-down rail",
        ),
      );
    }
  }

  /* --- 5.4 stiffeners, roller pads, tie-downs, drain -------------------- */
  if (o.detail) {
    // vertical stiffeners on both long walls and both end walls
    for (const z of [-0.55, 0, 0.55]) {
      for (const n of [nPosX, nNegX]) {
        A_HULL.group.add(
          wallBox(
            mat.shell,
            0.085,
            H - CHASSIS - 0.16,
            RAIL_T,
            n,
            upY,
            new THREE.Vector3(X0 + W / 2 - RAIL_T * 0.5, (CHASSIS + H) / 2, z),
            "Wall stiffener",
          ),
        );
      }
    }
    for (const x of [X0 + 0.22, X0 + W - 0.22]) {
      A_HULL.group.add(
        wallBox(
          mat.shell,
          0.085,
          H - CHASSIS - 0.16,
          RAIL_T,
          nDoor,
          upY,
          new THREE.Vector3(x, (CHASSIS + H) / 2, hullLen / 2 - RAIL_T * 0.5),
          "End wall stiffener",
        ),
      );
      A_HULL.group.add(
        wallBox(
          mat.shell,
          0.085,
          H - CHASSIS - 0.16,
          RAIL_T,
          nBlind,
          upY,
          new THREE.Vector3(x, (CHASSIS + H) / 2, -hullLen / 2 + RAIL_T * 0.5),
          "End wall stiffener",
        ),
      );
    }

    // horizontal belt course on all four walls
    const beltY = CHASSIS + (H - CHASSIS) * 0.58;
    for (const [n, at] of [
      [nPosX, new THREE.Vector3(X0 + W - RAIL_T * 0.5, beltY, 0)],
      [nNegX, new THREE.Vector3(X0 + RAIL_T * 0.5, beltY, 0)],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      A_HULL.group.add(
        wallBox(mat.shell, D - 0.26, 0.055, RAIL_T, n, upZ, at, "Belt course"),
      );
    }
    for (const [n, at] of [
      [nDoor, new THREE.Vector3(0, beltY, hullLen / 2 - RAIL_T * 0.5)],
      [nBlind, new THREE.Vector3(0, beltY, -hullLen / 2 + RAIL_T * 0.5)],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      A_HULL.group.add(
        wallBox(mat.shell, W - 0.26, 0.055, RAIL_T, n, upY, at, "Belt course"),
      );
    }

    // fuselage roller pads on the roof — reefer ULDs ride on deck rollers
    for (const x of [X0 + 0.36, X0 + W - 0.36]) {
      A_HULL.group.add(
        wallBox(
          mat.dark,
          0.14,
          0.1,
          RAIL_T * 0.7,
          nTop,
          upX,
          new THREE.Vector3(x, H - RAIL_T * 0.35, 0),
          "Roller pad",
          0.008,
        ),
      );
    }

    // cargo tie-down D-rings inside the rails
    const cavityWall = X0 + RAIL_T + WALL;
    for (const ty of [0.44, 0.96]) {
      for (const tz of [-0.4, 0.4]) {
        const pocket = box(mat.dark, 0.014, 0.06, 0.07, "Tie-down pocket", 0.004);
        pocket.position.set(cavityWall + 0.007, ty, tz);
        A_HULL.group.add(pocket);
        const ring = mesh(new THREE.TorusGeometry(0.019, 0.005, 8, 18), mat.steel, "Tie-down ring");
        ring.rotation.y = Math.PI / 2;
        ring.position.set(cavityWall + 0.02, ty, tz);
        A_HULL.group.add(ring);
      }
    }

    // condensate drain under the reefer unit (melt water out of the box)
    const drain = box(mat.steel, 0.05, 0.03, 0.05, "Condensate drain", 0.006);
    drain.position.set(X0 + W - 0.42, 0.016, D / 2 - END_FRAME - 0.12);
    A_HULL.group.add(drain);
    const drainPipe = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), mat.steel, "Drain pipe");
    drainPipe.rotation.x = Math.PI / 2;
    drainPipe.position.copy(drain.position).setY(0.021);
    A_HULL.group.add(drainPipe);
  }

  /* --- 5.5 edge frame: extrusions that wrap every hull fillet ----------- */
  // The skin is inset by RAIL_T so these members land exactly on the
  // certified 2.00 x 1.62 m envelope instead of outside it.
  const N = nominal.length;
  const legs: number[] = [];
  nominal.forEach((p, i) => {
    const prev = nominal[(i - 1 + N) % N];
    const next = nominal[(i + 1) % N];
    const { shape, leg } = cornerRailSection(p, prev, next, CORNER_R, RAIL_T, RAIL_W);
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
    const mid = new THREE.Vector3((p.x + q.x) / 2, (p.y + q.y) / 2, 0).addScaledVector(n, -RAIL_T / 2);
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
        0.003,
      ),
    );
    if (o.rivets) {
      rivets.line(
        new THREE.Vector3(mid.x, mid.y, -D / 2 + 0.11),
        new THREE.Vector3(mid.x, mid.y, D / 2 - 0.11),
        n,
        0.15,
      );
    }
  });

  /* --- 5.6 base chassis, corner castings, fork pockets ------------------ */
  const chassis = box(mat.chassis, W - 0.04, CHASSIS, D - 0.04, "Skid frame", 0.012);
  chassis.position.set(0, CHASSIS / 2, 0);
  A_BASE.group.add(chassis);

  for (const sx of [-0.68, 0.68]) {
    const bh = CHASSIS + 0.004;
    const beam = box(mat.chassis, 0.14, bh, D - 0.02, "Longitudinal beam", 0.008);
    beam.position.set(sx, bh / 2, 0);
    A_BASE.group.add(beam);
  }

  // lower corner castings with the cargo-system locating bore
  for (const cx of [X0 + 0.1, X0 + W - 0.1]) {
    for (const cz of [-D / 2 + 0.1, D / 2 - 0.1]) {
      const c = box(mat.alloy, 0.18, CHASSIS + 0.006, 0.18, "Corner casting", 0.022);
      c.position.set(cx, (CHASSIS + 0.006) / 2, cz);
      A_BASE.group.add(c);
      const bore = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 20), mat.dark, "Casting bore");
      bore.position.set(cx, 0.013, cz);
      A_BASE.group.add(bore);
    }
  }

  // fork pockets: tunnels across the 2.00 m width, entered from both long walls
  for (const z of [-0.34, 0.34]) {
    const y = CHASSIS * 0.55;
    for (const n of [nNegX, nPosX]) {
      const faceX = (n === nNegX ? X0 : X0 + W) + (n === nNegX ? 0.02 : -0.02);
      A_BASE.group.add(
        wallBox(
          mat.dark,
          0.3,
          0.064,
          0.019,
          n,
          upY,
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
          upY,
          new THREE.Vector3(faceX + n.x * 0.0095, y - 0.0365 + n.y * 0.0095, z),
          "Pocket wear lip",
          0.003,
        ),
      );
    }
  }

  /* --- 5.7 end frames (both ends share one ring profile) ---------------- */
  // ExtrudeGeometry *dilates* the section by bevelSize at both caps, so the
  // frame is drawn one bevel inside the envelope: its outer faces then land
  // exactly on the certified boundary.
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
  const ringShiftDoor = D / 2 - (END_FRAME - RING_BEV);
  const ringShiftBlind = -D / 2 + RING_BEV;
  A_DOOR.group.add(mesh(ringGeo.clone().translate(0, 0, ringShiftDoor), mat.alloy, "Door end frame"));
  A_END.group.add(mesh(ringGeo.clone().translate(0, 0, ringShiftBlind), mat.alloy, "Blind end frame"));

  if (o.rivets) {
    // rivet circle on the flat face of each end frame, clear of the fillets
    const circle = offsetPolygon(nominal, 0.03);
    circle.forEach((p, i) => {
      const q = circle[(i + 1) % circle.length];
      const d = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
      const a = new THREE.Vector3(p.x + d.x * 0.07, p.y + d.y * 0.07, D / 2 - 0.012);
      const b = new THREE.Vector3(q.x - d.x * 0.07, q.y - d.y * 0.07, D / 2 - 0.012);
      rivets.line(a, b, nDoor, 0.16);
      rivets.line(a.clone().setZ(-D / 2 + 0.012), b.clone().setZ(-D / 2 + 0.012), nBlind, 0.16);
    });
  }

  /* --- 5.8 blind end: panel, livery, identification plate --------------- */
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
  const blindFaceZ = -D / 2 + 0.01;
  blindGeo.translate(0, 0, blindFaceZ + LEAF_BEVEL);
  A_END.group.add(mesh(blindGeo, mat.shell, "Blind end panel"));

  const liveryEnd = makeLivery({
    code: "RKN",
    type: "LD-9 REEFER",
    tag: `${W.toFixed(2)} \u00D7 ${D.toFixed(2)} \u00D7 ${H.toFixed(2)} M`,
  });
  const idTex = makeIdPlate({
    width: 0.36,
    height: 0.19,
    id: "RKN 4127",
    carrier: "LH",
    serial: "RKN4127LH-0713",
  });
  const liveryEndMat = mat.decal.clone();
  liveryEndMat.map = liveryEnd;
  const idMat = mat.plate.clone();
  idMat.map = idTex;

  A_END.group.add(
    decal(
      1.14,
      0.92,
      nBlind,
      new THREE.Vector3(0, CHASSIS + (H - CHASSIS) * 0.6, blindFaceZ - 0.002),
      liveryEndMat,
      "End livery decal",
    ),
  );
  A_END.group.add(
    decal(
      0.36,
      0.19,
      nBlind,
      new THREE.Vector3(0, CHASSIS + 0.17, blindFaceZ - 0.002),
      idMat,
      "ULD identification plate",
    ),
  );

  /* --- 5.9 door assembly: pivot, leaf, gasket, cam latches, hinges ------ */
  const doorPivot = tag(new THREE.Group(), "Door pivot");
  const HINGE_X = X0 + FRAME_W - 0.008; // pin axis, just inside the frame lip
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
  doorPivot.add(mesh(leafGeo, mat.shell, "Door leaf"));

  // leaf stiffeners: three vertical ribs + a mid kick plate
  const leafH = H - CHASSIS - 0.2;
  for (const dx of [X0 + FRAME_W + 0.09, X0 + W * 0.5, X0 + W - 0.11]) {
    doorPivot.add(
      wallBox(
        mat.shell,
        0.1,
        leafH,
        0.014,
        nDoor,
        upY,
        new THREE.Vector3(px(dx), CHASSIS + leafH / 2 + 0.1, FACE + 0.008),
        "Door stiffener",
      ),
    );
  }

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
  for (const rx of [X0 + FRAME_W + 0.06, X0 + W - 0.1]) {
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
      // fold-flat lever, kept inside the frame rebate
      const handle = box(mat.accent, 0.03, 0.14, 0.018, "Latch handle", 0.008);
      handle.position.set(px(rx) + 0.009, hy - 0.045, FACE + 0.017);
      handle.rotation.x = -0.1;
      doorPivot.add(handle);
    }
  }

  // keepers belong to the frame, not the leaf
  for (const rx of [X0 + FRAME_W + 0.06, X0 + W - 0.1]) {
    for (const ky of [CHASSIS + 0.13, H - 0.13]) {
      const k = box(mat.alloy, 0.06, 0.055, 0.045, "Latch keeper", 0.008);
      k.position.set(rx, ky, D / 2 - 0.028);
      A_DOOR.group.add(k);
    }
  }

  // hinges on the -X side: pin on the axis, one strap each side
  for (const hy of [CHASSIS + 0.22, CHASSIS + (H - CHASSIS) / 2, H - 0.24]) {
    const pin = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 14), mat.steel, "Hinge pin");
    pin.position.set(HINGE_X, hy, HINGE_Z);
    A_DOOR.group.add(pin);
    const leafArm = box(mat.steel, 0.09, 0.1, 0.014, "Hinge strap", 0.005);
    leafArm.position.set(px(HINGE_X + 0.048), hy, FACE + 0.008);
    doorPivot.add(leafArm);
    const frameArm = box(mat.steel, 0.09, 0.1, 0.014, "Hinge strap", 0.005);
    frameArm.position.set(HINGE_X + 0.048, hy, D / 2 - 0.014);
    A_DOOR.group.add(frameArm);
  }

  // handle bar + stencils on the leaf, kept clear of the reefer unit on the
  // right-hand side of the door face
  const barX = X0 + 0.45;
  const bar = box(mat.accent, 0.34, 0.03, 0.026, "Door handle bar", 0.01);
  bar.position.set(px(barX), CHASSIS + 0.44, FACE + 0.022);
  doorPivot.add(bar);

  const coldTex = makeStencil("FROZEN \u25B2 -25\u00B0C", "#79b8c9", 640, 150);
  const coldMat = mat.stencil.clone();
  coldMat.map = coldTex;
  doorPivot.add(
    decal(
      0.3,
      0.07,
      nDoor,
      new THREE.Vector3(px(barX), CHASSIS + 0.26, FACE + 0.003),
      coldMat,
      "Cold-chain stencil",
    ),
  );

  /* --- 5.10 refrigeration unit (mounted on the door, swings with it) ---- */
  // Lives inside doorPivot so it swings with the leaf, but keeps its own
  // assembly so the exploded view can pull it clear of the door.
  // the reefer is modelled on the door, so it hangs off the pivot
  doorPivot.add(A_REEFER.group);

  // Depth budget (pivot-local z). The door leaf face sits at FACE, which is
  // LEAF_RECESS behind the certified 1.53 m envelope, so the whole unit is
  // built inside that rebate: nothing — not even the fan blades or the LCD —
  // ever crosses the envelope.
  const UNIT_FACE = FACE + 0.028; // outermost surface of the unit

  const unitW = 1.16;
  const unitH = 0.92;
  const unitCx = X0 + W - 0.18 - unitW / 2; // right-hand side of the door face
  const unitCy = CHASSIS + (H - CHASSIS) * 0.56;

  // brushed stainless bezel plate, bolted to the leaf
  const bezel = box(mat.bezel, unitW + 0.06, unitH + 0.06, 0.016, "Reefer bezel", 0.02);
  bezel.position.set(px(unitCx), unitCy, FACE + 0.006);
  A_REEFER.group.add(bezel);

  // ducted housing behind the face
  const housing = box(mat.shroud, unitW, unitH, 0.026, "Reefer housing", 0.012);
  housing.position.set(px(unitCx), unitCy, FACE + 0.019);
  A_REEFER.group.add(housing);

  // ---- condenser intake grille (upper half of the unit face) ------------
  const grilleTex = makeCondenserGrille();
  const grilleMat = mat.plate.clone();
  grilleMat.map = grilleTex;
  grilleMat.roughness = 0.75;
  grilleMat.metalness = 0.2;
  A_REEFER.group.add(
    decal(
      unitW - 0.12,
      unitH * 0.42,
      nDoor,
      new THREE.Vector3(px(unitCx), unitCy + unitH * 0.26, UNIT_FACE - 0.014),
      grilleMat,
      "Condenser grille",
    ),
  );

  // ---- evaporator fan: shroud ring + five blades on a spinning hub ------
  const shroud = mesh(
    new THREE.CylinderGeometry(0.17, 0.19, 0.03, 28, 1, true),
    mat.shroud,
    "Fan shroud",
  );
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(px(unitCx), unitCy + unitH * 0.26, UNIT_FACE - 0.016);
  A_REEFER.group.add(shroud);

  const hub = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.026, 18), mat.steel, "Fan hub");
  hub.rotation.x = Math.PI / 2;
  hub.position.set(px(unitCx), unitCy + unitH * 0.26, UNIT_FACE - 0.016);
  A_REEFER.group.add(hub);

  const fan = tag(new THREE.Group(), "Evaporator fan");
  fan.position.set(px(unitCx), unitCy + unitH * 0.26, UNIT_FACE - 0.012);
  A_REEFER.group.add(fan);
  for (let i = 0; i < 5; i++) {
    const blade = box(mat.steel, 0.13, 0.085, 0.008, "Fan blade", 0.004);
    blade.position.set(
      Math.cos((i / 5) * Math.PI * 2) * 0.1,
      Math.sin((i / 5) * Math.PI * 2) * 0.1,
      0,
    );
    blade.rotation.z = (i / 5) * Math.PI * 2 + 0.4;
    fan.add(blade);
  }

  // ---- flat front control panel: the non-metallic fascia -----------------
  // A moulded composite panel on a brushed-steel sub-frame — a completely
  // different material response from the aluminium hull and frame.
  const panelTex = makeReeferPanel();
  const panelMat = mat.panel.clone();
  panelMat.map = panelTex.texture;
  const panelW = 0.44;
  const panelH = panelW * 0.5;
  const panelCx = unitCx + 0.32;
  const panelCy = unitCy - unitH * 0.3;

  const subFrame = box(mat.bezel, panelW + 0.05, panelH + 0.05, 0.018, "Panel sub-frame", 0.006);
  subFrame.position.set(px(panelCx), panelCy, FACE + 0.012);
  A_REEFER.group.add(subFrame);

  A_REEFER.group.add(
    wallBox(
      panelMat,
      panelW,
      panelH,
      0.012,
      nDoor,
      upY,
      new THREE.Vector3(px(panelCx), panelCy, UNIT_FACE - 0.006),
      "Reefer control panel",
      0.005,
    ),
  );

  // Backlit LCD readout, floating just in front of the fascia. The quad is
  // sized/placed to match the LCD well in the panel texture (u 0.043–0.453,
  // v 0.621–0.914), so the digits glow exactly where they are painted.
  const lcdMat = mat.lcd.clone();
  lcdMat.map = panelTex.lcd;
  lcdMat.emissiveMap = panelTex.lcd;
  A_REEFER.group.add(
    wallBox(
      lcdMat,
      panelW * 0.41,
      panelH * 0.293,
      0.004,
      nDoor,
      upY,
      new THREE.Vector3(px(panelCx) - panelW * 0.252, panelCy + panelH * 0.267, UNIT_FACE - 0.002),
      "LCD readout",
      0.002,
    ),
  );

  // membrane keycaps standing proud of the fascia
  for (const [dx, dy, label] of [
    [-0.13, -0.07, "SET"],
    [-0.06, -0.07, "\u25BC"],
    [0.01, -0.07, "\u25B2"],
    [0.08, -0.07, "MODE"],
  ] as [number, number, string][]) {
    const key = box(mat.shroud, 0.036, 0.03, 0.005, `Key ${label}`, 0.003);
    key.position.set(px(panelCx) + dx, panelCy + dy, UNIT_FACE - 0.0015);
    A_REEFER.group.add(key);
  }

  // power inlet socket + cable hook on the unit's lower-left flank, clear of
  // the control panel
  const inletX = unitCx - unitW / 2 + 0.1;
  const inletY = unitCy - unitH / 2 + 0.1;
  const inlet = box(mat.dark, 0.075, 0.06, 0.022, "Power inlet", 0.008);
  inlet.position.set(px(inletX), inletY, FACE + 0.016);
  A_REEFER.group.add(inlet);
  const inletPins = mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.016, 8),
    mat.steel,
    "Inlet pins",
  );
  inletPins.rotation.x = Math.PI / 2;
  inletPins.position.set(px(inletX), inletY, UNIT_FACE - 0.004);
  A_REEFER.group.add(inletPins);

  const hook = mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 16), mat.steel, "Cable hook");
  hook.position.set(px(inletX) - 0.07, inletY + 0.16, UNIT_FACE - 0.014);
  A_REEFER.group.add(hook);

  // service stripe + unit stencil, both on the bezel
  const stripe = box(mat.accent, unitW + 0.08, 0.012, 0.02, "Unit service stripe", 0.004);
  stripe.position.set(px(unitCx), unitCy - unitH / 2 - 0.032, FACE + 0.008);
  A_REEFER.group.add(stripe);

  const reeferTagTex = makeStencil("RKN REEFER UNIT", "#79b8c9", 512, 130);
  const reeferTagMat = mat.stencil.clone();
  reeferTagMat.map = reeferTagTex;
  A_REEFER.group.add(
    decal(
      0.26,
      0.066,
      nDoor,
      new THREE.Vector3(px(unitCx) - unitW / 2 + 0.15, unitCy + 0.02, UNIT_FACE - 0.0125),
      reeferTagMat,
      "Unit stencil",
    ),
  );

  /* --- 5.11 side livery on the +X wall --------------------------------- */
  const liverySide = makeLivery({
    code: "RKN",
    type: "LD-9 COLD CHAIN",
    tag: "-25\u00B0C \u2026 +25\u00B0C \u00B7 3.6 M\u00B3",
  });
  const sideMat = mat.decal.clone();
  sideMat.map = liverySide;
  A_HULL.group.add(
    decal(
      1.0,
      0.6,
      nPosX,
      new THREE.Vector3(X0 + W - RAIL_T + 0.002, CHASSIS + (H - CHASSIS) * 0.58, 0),
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
      nNegX,
      new THREE.Vector3(X0 + RAIL_T - 0.002, CHASSIS + 0.3, -0.25),
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
    // the hardware stays modelled either way; power only affects the backlight
    // and whether the condenser blower turns (see animate() below)
    lcdMat.emissiveIntensity = on ? 0.75 : 0.1;
    mat.lcd.emissiveIntensity = on ? 0.75 : 0.1;
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
      const t = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
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
      iataVolumeM3: RKN_DIMENSIONS.interiorVolume,
      footprintM2: W * D,
      tareKg: 285,
      maxGrossKg: 3500,
      payloadKg: 3500 - 285,
      interiorM3: RKN_DIMENSIONS.interiorVolume,
      tempRange: "-25 \u00B0C \u2026 +25 \u00B0C",
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
    setReefer,
    setSetpoint(celsius: number) {
      panelTex.setSetpoint(celsius);
    },
    animate(elapsed: number, delta: number) {
      if (reeferOn) {
        fan.rotation.z += delta * 14;
        // condenser blower: a slow breathing on the LCD backlight
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
        for (const k of ["map", "normalMap", "roughnessMap", "emissiveMap", "aoMap", "metalnessMap"]) {
          if (rec[k] instanceof THREE.Texture) texs.add(rec[k] as THREE.Texture);
        }
        m.dispose();
      });
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
      panelTex.dispose();
      grilleTex.dispose();
    },
  };
}
