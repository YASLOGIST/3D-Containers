import * as THREE from "three";
import { makeIdPlate, makeLivery, makeStencil } from "./textures";
import {
  assemblyFactory,
  box,
  cornerRailSection,
  createBaseMaterials,
  decal,
  FINISHES,
  mesh,
  offsetPolygon,
  ringSection,
  RivetRun,
  roundedShape,
  tag,
  ULD_CONSTANTS,
  wallBox,
  type Assembly,
  type FinishId,
  type V2,
  type ViewerContainer,
} from "./primitives";

/**
 * profileContainer.ts — parameterized generator for EXTRUDED-SECTION ULDs.
 * It generalizes the bespoke AKE·LD-3 recipe (kept in akeLD3.ts) to any
 * convex constant section: hull ring extrusion, corner-rail edge frame, end
 * rings, a hinged door leaf and a blind end are all successive inward
 * offsets of ONE nominal polygon, so AKH·LD3-45 (dual-wing hexagon),
 * ALF·LD6 (dual-wing trapezoid), AMA·M-1 and AGA·M-2 (roof-chamfer
 * hexagons) and the single-slope AKC·LD-1 / DPE·LD-2 right trapezoids all
 * share this single engine.
 *
 * Profile contract: counter-clockwise from the bottom-left corner, y from
 * CHASSIS (0.09 m) to the overall height, convex; symmetric sections are
 * built by symmetricProfile(), single-slope sections are passed explicitly
 * (asymmetricProfile()). Units are metres throughout. Ratings are nominal
 * published values supplied by each wrapper; the geometric volume reported in
 * stats is computed live from the profile and kept separate from the
 * certified (IATA) volume, exactly as in the other generators.
 */

const { WALL, RAIL_T, RAIL_W, END_FRAME, RING_BEV, FRAME_W, CHASSIS, CORNER_R, LEAF_T, LEAF_BEVEL, LEAF_CLEAR, LEAF_RECESS, MAX_DOOR } = ULD_CONSTANTS;

export interface ProfileContainerConfig {
  /** type code, e.g. "AKH" */
  code: string;
  /** short type line for livery, e.g. "LD3-45 LOWER DECK" */
  typeName: string;
  /** slope caption for the side livery glyph, e.g. "28.2° WING TAPER" */
  slopeLabel: string;
  baseWidth: number;
  topWidth: number;
  /** y where the slope starts; ≤ CHASSIS means a full trapezoid */
  kneeHeight: number;
  /**
   * Explicit section polygon (CCW from bottom-left). When supplied it wins
   * over the symmetric builder — used by the single-slope LD1/LD2 sections,
   * whose contour leans out on the fuselage side only.
   */
  profile?: V2[];
  depth: number;
  height: number;
  tareKg: number;
  maxGrossKg: number;
  iataVolumeM3: number;
  /** data-plate fields */
  plateId: string;
  plateCarrier: string;
  plateSerial: string;
}

export interface ProfileBuildOptions {
  /** accepted for parity with the AKE toggle; these sections are fixed */
  contour?: boolean;
  finish: FinishId;
  detail: boolean;
  rivets: boolean;
  /** 0..1 door swing */
  doorOpen: number;
}

/** Symmetric section: quad trapezoid when the knee sits at the profile base, otherwise a hexagon. */
export function symmetricProfile(baseWidth: number, topWidth: number, kneeHeight: number, height: number): V2[] {
  const bw = baseWidth / 2;
  const tw = topWidth / 2;
  if (kneeHeight <= CHASSIS + 1e-6 || Math.abs(topWidth - baseWidth) < 1e-9) {
    return [
      { x: -bw, y: CHASSIS },
      { x: bw, y: CHASSIS },
      { x: tw, y: height },
      { x: -tw, y: height },
    ];
  }
  return [
    { x: -bw, y: CHASSIS },
    { x: bw, y: CHASSIS },
    { x: bw, y: kneeHeight },
    { x: tw, y: height },
    { x: -tw, y: height },
    { x: -bw, y: kneeHeight },
  ];
}

/**
 * Single-slope trapezoid in the AKE convention: vertical centreline wall on
 * −X, contour leaning out on +X, envelope centred on the top width so the
 * base's left corner sits at −topWidth/2. Used by LD1 (AKC) and LD2 (DPE).
 */
export function asymmetricProfile(baseWidth: number, topWidth: number, height: number): V2[] {
  const x0 = -topWidth / 2;
  return [
    { x: x0, y: CHASSIS },
    { x: x0 + baseWidth, y: CHASSIS },
    { x: x0 + topWidth, y: height },
    { x: x0, y: height },
  ];
}

/** Leftmost polygon x at height y (convex sections: scan edge crossings). */
function leftXAtY(poly: V2[], y: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a.y - y) * (b.y - y) > 0 || Math.abs(b.y - a.y) < 1e-9) continue;
    const t = (y - a.y) / (b.y - a.y);
    best = Math.min(best, a.x + (b.x - a.x) * t);
  }
  return best;
}

interface SideEdge {
  a: V2;
  b: V2;
  /** outward 2-D normal (CCW section) */
  n: THREE.Vector2;
  len: number;
  mid: V2;
}

export function createProfileContainer(
  cfg: ProfileContainerConfig,
  options: Partial<ProfileBuildOptions> = {},
): ViewerContainer {
  const o: ProfileBuildOptions = {
    finish: "mill",
    detail: true,
    rivets: true,
    doorOpen: 0,
    ...options,
  };
  const BW = cfg.baseWidth;
  const TW = cfg.topWidth;
  const BL = cfg.depth;
  const H = cfg.height;

  const mat = createBaseMaterials(o.finish);
  const root = tag(new THREE.Group(), `${cfg.code}_ULD`);
  const rivets = new RivetRun();

  /* --- the section stack: one symmetric polygon, successive offsets ----- */
  const nominal = cfg.profile ?? symmetricProfile(BW, TW, cfg.kneeHeight, H);
  const hullOut = offsetPolygon(nominal, RAIL_T);
  const cavity = offsetPolygon(nominal, RAIL_T + WALL);
  const leafPoly = offsetPolygon(nominal, FRAME_W + LEAF_CLEAR + LEAF_BEVEL);
  const rHull = CORNER_R - RAIL_T;
  const rOpen = 0.014;
  const rLeaf = 0.012;

  // Section landmarks (valid for quad/hexagon, widening or chamfered)
  const minX = Math.min(...nominal.map((p) => p.x));
  const maxX = Math.max(...nominal.map((p) => p.x));
  const envCx = (minX + maxX) / 2;
  const bottomPts = nominal.filter((p) => Math.abs(p.y - CHASSIS) < 1e-6);
  const bottomLeft = Math.min(...bottomPts.map((p) => p.x));
  const bottomRight = Math.max(...bottomPts.map((p) => p.x));
  const bottomCx = (bottomLeft + bottomRight) / 2;
  const topPts = nominal.filter((p) => Math.abs(p.y - H) < 1e-6);
  const topSpan = Math.max(...topPts.map((p) => p.x)) - Math.min(...topPts.map((p) => p.x));

  const sideEdges: SideEdge[] = [];
  for (let i = 0; i < nominal.length; i++) {
    const a = nominal[i];
    const b = nominal[(i + 1) % nominal.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.15) continue;
    const n = new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize();
    if (Math.abs(n.x) > 0.45) {
      sideEdges.push({ a, b, n, len, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    }
  }
  const edgePointAtY = (e: SideEdge, y: number): V2 => {
    const t = THREE.MathUtils.clamp((y - e.a.y) / (e.b.y - e.a.y || 1), 0, 1);
    return { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t };
  };

  const nDoor = new THREE.Vector3(0, 0, 1);
  const nBlind = new THREE.Vector3(0, 0, -1);

  /* --- assemblies -------------------------------------------------------- */
  const assemblies: Assembly[] = [];
  const assembly = assemblyFactory(root, assemblies);
  const A_HULL = assembly("hull", "Hull shell", "Contour tube, 32 mm wall", [0, 0.3, 0]);
  const A_FRAME = assembly("frame", "Edge frame", "Aluminium extrusions + rivets", [0, 0.66, 0]);
  const A_BASE = assembly("base", "Base chassis", "Skid frame, castings, fork pockets", [0, -0.62, 0]);
  const A_DOOR = assembly("door", "Door assembly", "Hinged leaf, cam latch rods", [0, 0, 0.9]);
  const A_END = assembly("blind", "Blind end", "Closed end panel + livery", [0, 0, -0.9]);

  /* --- hull: hollow contour tube, open at both ends ---------------------- */
  const hullLen = BL - END_FRAME * 2;
  const hullGeo = new THREE.ExtrudeGeometry(
    ringSection(hullOut, cavity, rHull, Math.max(CORNER_R - RAIL_T - WALL, 0.008)),
    { depth: hullLen, bevelEnabled: false, curveSegments: 10, steps: 1 },
  );
  hullGeo.translate(0, 0, -hullLen / 2);
  A_HULL.group.add(mesh(hullGeo, mat.shell, "Hull — contour tube"));

  if (topSpan > 0.25) {
    const topPanel = box(mat.alloy, topSpan - 0.13, RAIL_T, BL - 0.13, "Top panel", 0.006);
    topPanel.position.set(envCx, H - RAIL_T / 2, 0);
    A_HULL.group.add(topPanel);
  }
  const belly = box(mat.chassis, BW - 0.16, 0.012, BL - 0.2, "Belly pan", 0.004);
  belly.position.set(bottomCx, 0.006, 0);
  A_HULL.group.add(belly);

  // interior fit-out, visible with the door open
  const floorY = CHASSIS + RAIL_T + WALL;
  for (const dz of [-BL * 0.25, 0, BL * 0.25]) {
    const strip = box(mat.hullInner, BW - 0.26, 0.008, 0.1, "Floor wear strip", 0.003);
    strip.position.set(bottomCx, floorY + 0.005, dz);
    A_HULL.group.add(strip);
  }
  const railHeights = [CHASSIS + (H - CHASSIS) * 0.3, CHASSIS + (H - CHASSIS) * 0.65];
  for (const yy of railHeights) {
    const rail = wallBox(
      mat.hullInner, hullLen - 0.2, 0.045, 0.02,
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(leftXAtY(cavity, yy) + 0.012, yy, 0),
      "Interior tie-down rail",
    );
    A_HULL.group.add(rail);
  }

  /* --- stiffeners, belt course, roller pads, tie-downs ------------------ */
  if (o.detail) {
    const ribCount = Math.max(2, Math.round(BL / 0.55));
    for (const e of sideEdges) {
      const n3 = new THREE.Vector3(e.n.x, e.n.y, 0);
      const up3 = new THREE.Vector3(e.b.x - e.a.x, e.b.y - e.a.y, 0).normalize();
      for (let i = 0; i < ribCount; i++) {
        const z = ribCount === 1 ? 0 : -BL / 2 + 0.18 + (i * (BL - 0.36)) / (ribCount - 1);
        A_HULL.group.add(wallBox(
          mat.shell, 0.085, e.len - 0.16, RAIL_T, n3, up3,
          new THREE.Vector3(e.mid.x - n3.x * (RAIL_T / 2), e.mid.y - n3.y * (RAIL_T / 2), z),
          "Wall stiffener",
        ));
      }
    }

    // horizontal belt course on a tall, truly vertical wall when the section
    // has one (steep slopes have near-horizontal normals too — test dx)
    const leftVertical = sideEdges.find((e) => e.n.x < 0 && Math.abs(e.b.x - e.a.x) < 0.02 && e.len > 0.5);
    if (leftVertical) {
      const loY = Math.min(leftVertical.a.y, leftVertical.b.y);
      const hiY = Math.max(leftVertical.a.y, leftVertical.b.y);
      const p = edgePointAtY(leftVertical, loY + (hiY - loY) * 0.6);
      A_HULL.group.add(wallBox(
        mat.shell, BL - 0.26, 0.055, RAIL_T,
        new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(p.x + RAIL_T * 0.5, p.y, 0),
        "Belt course",
      ));
    }

    // fuselage roller-guide wear pads on the upper sloped wall (right side)
    const rightSlope = sideEdges
      .filter((e) => e.n.x > 0.45 && Math.abs(e.b.x - e.a.x) > 0.1)
      .sort((a, b) => b.mid.y - a.mid.y)[0];
    if (rightSlope) {
      const n3 = new THREE.Vector3(rightSlope.n.x, rightSlope.n.y, 0);
      const up3 = new THREE.Vector3(rightSlope.b.x - rightSlope.a.x, rightSlope.b.y - rightSlope.a.y, 0).normalize();
      const padY = rightSlope.a.y + (rightSlope.b.y - rightSlope.a.y) * 0.78;
      const p = edgePointAtY(rightSlope, padY);
      for (const z of [-BL * 0.32, BL * 0.32]) {
        A_HULL.group.add(wallBox(
          mat.dark, 0.13, 0.19, RAIL_T * 0.6, n3, up3,
          new THREE.Vector3(p.x - n3.x * (RAIL_T * 0.3), p.y - n3.y * (RAIL_T * 0.3), z),
          "Roller guide pad", 0.01,
        ));
      }
    }

    for (const ty of railHeights) {
      const cavityWall = leftXAtY(cavity, ty);
      for (const tz of [-BL * 0.3, BL * 0.3]) {
        const pocket = box(mat.dark, 0.014, 0.06, 0.07, "Tie-down pocket", 0.004);
        pocket.position.set(cavityWall + 0.007, ty, tz);
        A_HULL.group.add(pocket);
        const ring = mesh(new THREE.TorusGeometry(0.019, 0.005, 8, 18), mat.steel, "Tie-down ring");
        ring.rotation.y = Math.PI / 2;
        ring.position.set(cavityWall + 0.02, ty, tz);
        A_HULL.group.add(ring);
      }
    }
  }

  /* --- edge frame: extrusions wrapping every hull fillet ---------------- */
  const N = nominal.length;
  const legs: number[] = [];
  nominal.forEach((p, i) => {
    const prev = nominal[(i - 1 + N) % N];
    const next = nominal[(i + 1) % N];
    const { shape, leg } = cornerRailSection(p, prev, next, CORNER_R, RAIL_T, RAIL_W);
    legs.push(leg);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: BL, bevelEnabled: false, curveSegments: 8, steps: 1 });
    geo.translate(0, 0, -BL / 2);
    A_FRAME.group.add(mesh(geo, mat.alloy, `Corner extrusion ${i + 1}`));
  });
  nominal.forEach((p, i) => {
    const q = nominal[(i + 1) % N];
    const d = new THREE.Vector2(q.x - p.x, q.y - p.y);
    const edgeLen = d.length();
    d.normalize();
    const n = new THREE.Vector3(d.y, -d.x, 0); // outward (CCW section)
    const span = edgeLen - legs[i] - legs[(i + 1) % N];
    if (span < 0.06) return;
    const mid = new THREE.Vector3((p.x + q.x) / 2, (p.y + q.y) / 2, 0).addScaledVector(n, -RAIL_T / 2);
    A_FRAME.group.add(wallBox(mat.alloy, BL, span, RAIL_T, n, new THREE.Vector3(d.x, d.y, 0), mid, `Edge extrusion ${i + 1}`, 0.003));
    if (o.rivets) {
      rivets.line(
        new THREE.Vector3(mid.x, mid.y, -BL / 2 + 0.11),
        new THREE.Vector3(mid.x, mid.y, BL / 2 - 0.11),
        n, 0.15,
      );
    }
  });

  /* --- base chassis, corner castings, fork pockets ---------------------- */
  const chassis = box(mat.chassis, BW - 0.04, CHASSIS, BL - 0.04, "Skid frame", 0.012);
  chassis.position.set(bottomCx, CHASSIS / 2, 0);
  A_BASE.group.add(chassis);

  const beamOff = Math.min(0.44, BW / 2 - 0.2);
  for (const sx of [-beamOff, beamOff]) {
    const bh = CHASSIS + 0.004;
    const beam = box(mat.chassis, 0.14, bh, BL - 0.02, "Longitudinal beam", 0.008);
    beam.position.set(bottomCx + sx, bh / 2, 0);
    A_BASE.group.add(beam);
  }

  for (const cx of [bottomLeft + 0.1, bottomRight - 0.1]) {
    for (const cz of [-BL / 2 + 0.1, BL / 2 - 0.1]) {
      const c = box(mat.alloy, 0.18, CHASSIS + 0.006, 0.18, "Corner casting", 0.022);
      c.position.set(cx, (CHASSIS + 0.006) / 2, cz);
      A_BASE.group.add(c);
      const bore = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 20), mat.dark, "Casting bore");
      bore.position.set(cx, 0.013, cz);
      A_BASE.group.add(bore);
    }
  }

  for (const z of [-BL * 0.26, BL * 0.26]) {
    const y = CHASSIS * 0.55;
    for (const s of [-1, 1]) {
      const n = new THREE.Vector3(s, 0, 0);
      const faceX = bottomCx + s * (BW / 2 - 0.02);
      A_BASE.group.add(wallBox(
        mat.dark, 0.3, 0.064, 0.019, n, new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(faceX + s * 0.0095, y, z), "Fork pocket", 0.006,
      ));
      A_BASE.group.add(wallBox(
        mat.steel, 0.34, 0.009, 0.019, n, new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(faceX + s * 0.0095, y - 0.0365, z), "Pocket wear lip", 0.003,
      ));
    }
  }

  /* --- end frames -------------------------------------------------------- */
  const ringGeo = new THREE.ExtrudeGeometry(
    ringSection(offsetPolygon(nominal, RING_BEV), offsetPolygon(nominal, FRAME_W - RING_BEV), Math.max(CORNER_R - RING_BEV, 0.01), rOpen),
    { depth: END_FRAME - RING_BEV * 2, bevelEnabled: true, bevelThickness: RING_BEV, bevelSize: RING_BEV, bevelSegments: 2, curveSegments: 10, steps: 1 },
  );
  const ringShiftDoor = BL / 2 - (END_FRAME - 0.008);
  const ringShiftBlind = -BL / 2 + 0.008;
  A_DOOR.group.add(mesh(ringGeo.clone().translate(0, 0, ringShiftDoor), mat.alloy, "Door end frame"));
  A_END.group.add(mesh(ringGeo.clone().translate(0, 0, ringShiftBlind), mat.alloy, "Blind end frame"));
  ringGeo.dispose();

  if (o.rivets) {
    const circle = offsetPolygon(nominal, 0.03);
    circle.forEach((p, i) => {
      const q = circle[(i + 1) % circle.length];
      const d = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
      const a = new THREE.Vector3(p.x + d.x * 0.07, p.y + d.y * 0.07, BL / 2 - 0.012);
      const b = new THREE.Vector3(q.x - d.x * 0.07, q.y - d.y * 0.07, BL / 2 - 0.012);
      rivets.line(a, b, nDoor, 0.16);
      rivets.line(a.clone().setZ(-BL / 2 + 0.012), b.clone().setZ(-BL / 2 + 0.012), nBlind, 0.16);
    });
  }

  /* --- blind end: panel, livery, identification plate ------------------- */
  const blindGeo = new THREE.ExtrudeGeometry(
    roundedShape(offsetPolygon(nominal, FRAME_W + LEAF_BEVEL), rOpen),
    { depth: 0.03, bevelEnabled: true, bevelThickness: LEAF_BEVEL, bevelSize: LEAF_BEVEL, bevelSegments: 2, curveSegments: 10 },
  );
  const blindFaceZ = -BL / 2 + 0.01;
  blindGeo.translate(0, 0, blindFaceZ + LEAF_BEVEL);
  A_END.group.add(mesh(blindGeo, mat.shell, "Blind end panel"));

  const liveryEnd = makeLivery({
    code: cfg.code,
    type: cfg.typeName,
    tag: `${BW.toFixed(2)} × ${BL.toFixed(2)} × ${H.toFixed(2)} M`,
    profileLabel: `${BW.toFixed(2)} / ${TW.toFixed(2)} M`,
    section: "contour",
  });
  const idTex = makeIdPlate({
    width: 0.36, height: 0.19, id: cfg.plateId, carrier: cfg.plateCarrier, serial: cfg.plateSerial,
    tareKg: cfg.tareKg, maxGrossKg: cfg.maxGrossKg, volumeM3: cfg.iataVolumeM3,
  });
  const liveryEndMat = mat.decal.clone();
  liveryEndMat.map = liveryEnd;
  const idMat = mat.plate.clone();
  idMat.map = idTex;

  const panelH = H - CHASSIS;
  const liveryW = Math.min(1.3, BW * 0.66);
  const liveryH = Math.min(liveryW * 0.8, panelH * 0.52);
  A_END.group.add(decal(liveryW, liveryH, nBlind,
    new THREE.Vector3(envCx, CHASSIS + panelH * 0.62, blindFaceZ - 0.002), liveryEndMat, "End livery decal"));
  A_END.group.add(decal(0.36, 0.19, nBlind,
    new THREE.Vector3(envCx, CHASSIS + 0.17, blindFaceZ - 0.002), idMat, "ULD identification plate"));

  /* --- door assembly: pivot, leaf, gasket, cam latches, hinges ---------- */
  // Hinge axis at the leaf's leftmost x (the wing-tip post on widening
  // sections): every leaf point then swings outward (+Z) with no frame
  // clipping — the symmetric-profile counterpart of the AKE's centreline
  // hinge. Knuckles still follow the leaf's left edge chain.
  const doorPivot = tag(new THREE.Group(), "Door pivot");
  const HINGE_X = Math.min(...leafPoly.map((p) => p.x)) + 0.004;
  const HINGE_Z = BL / 2 - END_FRAME * 0.5;
  doorPivot.position.set(HINGE_X, 0, HINGE_Z);
  A_DOOR.group.add(doorPivot);
  const px = (x: number) => x - HINGE_X;

  const leafGeo = new THREE.ExtrudeGeometry(roundedShape(leafPoly, rLeaf), {
    depth: LEAF_T, bevelEnabled: true, bevelThickness: LEAF_BEVEL, bevelSize: LEAF_BEVEL, bevelSegments: 2, curveSegments: 10,
  });
  const leafZ = BL / 2 - LEAF_RECESS - (LEAF_T + LEAF_BEVEL) - HINGE_Z;
  const FACE = leafZ + LEAF_T + LEAF_BEVEL;
  leafGeo.translate(-HINGE_X, 0, leafZ);
  doorPivot.add(mesh(leafGeo, mat.shell, "Door leaf"));

  const leafBottom = leafPoly.filter((p) => Math.abs(p.y - leafPoly[0].y) < 1e-6);
  const leafBottomSpan = Math.max(...leafBottom.map((p) => p.x)) - Math.min(...leafBottom.map((p) => p.x));
  const leafCx = (Math.max(...leafBottom.map((p) => p.x)) + Math.min(...leafBottom.map((p) => p.x))) / 2;

  const leafH = H - CHASSIS - 0.2;
  for (const dx of [leafCx - leafBottomSpan * 0.24, leafCx + leafBottomSpan * 0.24]) {
    doorPivot.add(wallBox(
      mat.shell, 0.1, leafH, 0.014, nDoor, new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(px(dx), CHASSIS + leafH / 2 + 0.1, FACE + 0.008), "Door stiffener",
    ));
  }
  // perimeter ribs following each sloped leaf edge (both wings / chamfers)
  for (let i = 0; i < leafPoly.length; i++) {
    const a = leafPoly[i];
    const b = leafPoly[(i + 1) % leafPoly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (Math.abs(dx) < 0.05 || Math.abs(dy) < 0.05 || segLen < 0.3) continue;
    doorPivot.add(wallBox(
      mat.shell, 0.1, segLen - 0.18, 0.014, nDoor, new THREE.Vector3(dx, dy, 0),
      new THREE.Vector3(px((a.x + b.x) / 2), (a.y + b.y) / 2, FACE + 0.008), "Door stiffener",
    ));
  }

  const sealGeo = new THREE.ExtrudeGeometry(
    ringSection(offsetPolygon(leafPoly, 0.012), offsetPolygon(leafPoly, 0.05), rLeaf, Math.max(rLeaf - 0.04, 0.01)),
    { depth: 0.016, bevelEnabled: false, curveSegments: 10 },
  );
  sealGeo.translate(-HINGE_X, 0, leafZ - 0.017);
  doorPivot.add(mesh(sealGeo, mat.dark, "Door gasket", false));

  const rodXs = [leafCx - leafBottomSpan * 0.34, leafCx + leafBottomSpan * 0.34];
  for (const rx of rodXs) {
    const rodLen = H - CHASSIS - 0.2;
    const rod = mesh(new THREE.CylinderGeometry(0.012, 0.012, rodLen, 14), mat.steel, "Cam latch rod");
    rod.position.set(px(rx), CHASSIS + rodLen / 2 + 0.1, FACE + 0.013);
    doorPivot.add(rod);
    for (const hy of [CHASSIS + 0.2, CHASSIS + (H - CHASSIS) * 0.55, H - 0.2]) {
      const hub = box(mat.steel, 0.048, 0.05, 0.04, "Latch hub", 0.01);
      hub.position.set(px(rx), hy, FACE + 0.013);
      doorPivot.add(hub);
      const handle = box(mat.accent, 0.03, 0.14, 0.018, "Latch handle", 0.008);
      handle.position.set(px(rx) + 0.009, hy - 0.045, FACE + 0.017);
      handle.rotation.x = -0.1;
      doorPivot.add(handle);
    }
  }
  for (const rx of rodXs) {
    for (const ky of [CHASSIS + 0.13, H - 0.13]) {
      const k = box(mat.alloy, 0.06, 0.055, 0.045, "Latch keeper", 0.008);
      k.position.set(rx, ky, BL / 2 - 0.028);
      A_DOOR.group.add(k);
    }
  }

  // Hinge knuckles along the leaf's left edge chain (bottom-left → top-left),
  // alternating leaf-side / frame-side so they interleave when closed.
  const leftChain: V2[] = [leafPoly[0]];
  for (let i = leafPoly.length - 1; i >= 1; i--) {
    if (leafPoly[i].x > leafCx) break;
    leftChain.push(leafPoly[i]);
  }
  const knuckleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.12, 14);
  let knuckleIdx = 0;
  for (let i = 0; i + 1 < leftChain.length; i++) {
    const a = leftChain[i];
    const b = leftChain[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const dir3 = new THREE.Vector3(b.x - a.x, b.y - a.y, 0).normalize();
    const fractions = segLen > 0.45 ? [0.28, 0.72] : [0.5];
    for (const f of fractions) {
      const at = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      const knuckle = mesh(knuckleGeo, mat.steel, "Hinge knuckle");
      knuckle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir3);
      if (knuckleIdx % 2 === 0) {
        knuckle.position.set(px(at.x), at.y, FACE - 0.012);
        doorPivot.add(knuckle);
      } else {
        knuckle.position.set(at.x, at.y, BL / 2 - LEAF_RECESS - 0.012);
        A_DOOR.group.add(knuckle);
      }
      knuckleIdx++;
    }
  }

  const bar = box(mat.accent, 0.34, 0.03, 0.026, "Door handle bar", 0.01);
  bar.position.set(px(leafCx), CHASSIS + 0.46, FACE + 0.022);
  doorPivot.add(bar);

  const pullTex = makeStencil("PULL ▼", "#ffb020", 512, 160);
  const pullMat = mat.stencil.clone();
  pullMat.map = pullTex;
  doorPivot.add(decal(0.26, 0.082, nDoor,
    new THREE.Vector3(px(leafCx), CHASSIS + 0.32, FACE + 0.003), pullMat, "Handling stencil"));
  const leafIdMat = mat.plate.clone();
  leafIdMat.map = idTex;
  doorPivot.add(decal(0.34, 0.18, nDoor,
    new THREE.Vector3(px(leafCx - 0.02), H - 0.34, FACE + 0.003), leafIdMat, "Door data plate"));

  doorPivot.rotation.y = -o.doorOpen * MAX_DOOR;

  /* --- side livery + warning stencil ------------------------------------ */
  const liverySide = makeLivery({
    code: cfg.code,
    type: cfg.typeName,
    tag: `MAX GROSS ${cfg.maxGrossKg} KG · ${cfg.iataVolumeM3.toFixed(1)} M³`,
    profileLabel: cfg.slopeLabel,
    section: "contour",
  });
  const sideMat = mat.decal.clone();
  sideMat.map = liverySide;
  const rightEdge = sideEdges.filter((e) => e.n.x > 0).sort((a, b) => b.len - a.len)[0];
  if (rightEdge) {
    const n3 = new THREE.Vector3(rightEdge.n.x, rightEdge.n.y, 0);
    const w = Math.min(1.06, BL * 0.68);
    const h = Math.min(w * 0.6, rightEdge.len * 0.6);
    A_HULL.group.add(decal(w, h, n3,
      new THREE.Vector3(
        rightEdge.mid.x - n3.x * (RAIL_T - 0.002),
        rightEdge.mid.y - n3.y * (RAIL_T - 0.002),
        0,
      ), sideMat, "Side livery decal"));
  }

  const warnTex = makeStencil("NO STEP", "#e2513c", 512, 140);
  const warnMat = mat.stencil.clone();
  warnMat.map = warnTex;
  const leftEdge = sideEdges.filter((e) => e.n.x < 0).sort((a, b) => a.mid.y - b.mid.y)[0];
  if (leftEdge) {
    const n3 = new THREE.Vector3(leftEdge.n.x, leftEdge.n.y, 0);
    const p = edgePointAtY(leftEdge, Math.min(CHASSIS + 0.3, leftEdge.mid.y));
    A_HULL.group.add(decal(0.3, 0.082, n3,
      new THREE.Vector3(p.x - n3.x * (RAIL_T - 0.002), p.y - n3.y * (RAIL_T - 0.002), -BL * 0.16),
      warnMat, "Warning stencil"));
  }

  const rivetMesh = o.rivets ? rivets.build(mat.rivet) : null;
  if (rivetMesh) A_FRAME.group.add(rivetMesh);

  /* --- stats -------------------------------------------------------------- */
  let triangles = 0;
  let meshCount = 0;
  for (const a of assemblies) {
    a.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.geometry) return;
      meshCount++;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      const g = m.geometry;
      const t = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
      const tri = Math.round(t * inst);
      triangles += tri;
      a.meshes++;
      a.triangles += tri;
    });
  }

  const sectionArea = Math.abs(THREE.ShapeUtils.area(nominal.map((p) => new THREE.Vector2(p.x, p.y))));

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
      iataVolumeM3: cfg.iataVolumeM3,
      footprintM2: BW * BL,
      tareKg: cfg.tareKg,
      maxGrossKg: cfg.maxGrossKg,
      payloadKg: cfg.maxGrossKg - cfg.tareKg,
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
        for (const k of ["map", "normalMap", "roughnessMap", "aoMap", "metalnessMap"]) {
          if (rec[k] instanceof THREE.Texture) texs.add(rec[k] as THREE.Texture);
        }
        m.dispose();
      });
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
