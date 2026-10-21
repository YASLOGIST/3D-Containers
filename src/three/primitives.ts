/**
 * ============================================================================
 *  primitives.ts — model-agnostic building blocks shared by the ULD
 *  generators (AKE / LD-3, RKN / LD-9 …).
 *
 *  Everything here is deliberately independent of any specific container
 *  type: 2-D section maths, mesh factories, the instanced rivet run, the
 *  procedural material set and the common container contract that
 *  AKEViewer.ts drives. A new container is therefore a single file that
 *  composes these parts — no renderer, exporter or UI code changes.
 * ============================================================================
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeBrushedMetal, makeSpeckle } from "./textures";

/* ========================================================================== */
/* 1. Finishes — shared across every container family                         */
/* ========================================================================== */

export type FinishId = "mill" | "graphite" | "cargo" | "airline" | "titanium";

export const FINISHES: Record<
  FinishId,
  {
    label: string;
    note: string;
    color: string;
    metalness: number;
    roughness: number;
    clearcoat: number;
    clearcoatRoughness: number;
  }
> = {
  mill: {
    label: "Mill Aluminium",
    note: "5052-H32 sheet, bare",
    color: "#b8bec4",
    metalness: 1.0,
    roughness: 0.33,
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
  },
  graphite: {
    label: "Anodised Graphite",
    note: "Type II hard coat",
    color: "#59616a",
    metalness: 1.0,
    roughness: 0.26,
    clearcoat: 0.18,
    clearcoatRoughness: 0.35,
  },
  cargo: {
    label: "Cargo Yellow",
    note: "Ramp handling livery",
    color: "#e9a516",
    metalness: 0.72,
    roughness: 0.29,
    clearcoat: 0.75,
    clearcoatRoughness: 0.16,
  },
  airline: {
    label: "Airline Blue",
    note: "Two-pack enamel",
    color: "#1e5f8c",
    metalness: 0.66,
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  },
  titanium: {
    label: "Bead-blast Ti",
    note: "Matte blast, warm alloy",
    color: "#9a8f7d",
    metalness: 1.0,
    roughness: 0.52,
    clearcoat: 0.0,
    clearcoatRoughness: 0.9,
  },
};

/* ========================================================================== */
/* 2. Section maths                                                           */
/* ========================================================================== */

export type V2 = { x: number; y: number };

/**
 * Manufacturing constants shared by every container family (metres). Keeping
 * them in one place means a change to wall thickness or frame width is applied
 * consistently across the AKE and RKN generators.
 */
export const ULD_CONSTANTS = {
  WALL: 0.032, // hull wall thickness
  RAIL_T: 0.015, // edge extrusion: hull is inset this far, rails restore it
  RAIL_W: 0.13, // edge extrusion leg width, measured along the section
  END_FRAME: 0.06, // axial depth of the door / blind end frames
  RING_BEV: 0.008, // chamfer on the end frames (compensated by the generators)
  FRAME_W: 0.075, // radial width of the end frame ring
  CHASSIS: 0.09, // base skid-frame height
  CORNER_R: 0.07, // hull corner radius (the four long corners)
  LEAF_T: 0.042, // door leaf thickness
  LEAF_BEVEL: 0.007,
  LEAF_CLEAR: 0.005, // radial gap between leaf and frame opening
  LEAF_RECESS: 0.036, // door face sits this far behind the envelope
  MAX_DOOR: THREE.MathUtils.degToRad(112), // door swing, radians at full open
} as const;

/**
 * Creates an assembly group under `root` and registers it, so every generator
 * builds the same exploded-view structure.
 */
export function assemblyFactory(root: THREE.Group, out: Assembly[]) {
  return (id: string, label: string, note: string, dir: [number, number, number]) => {
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
    out.push(a);
    return a;
  };
}

/**
 * Offsets a convex CCW polygon inward by `d` (outward when negative) by
 * shifting every edge along its inward normal and re-intersecting neighbouring
 * edge lines. One nominal section therefore yields hull, cavity, frame opening
 * and door leaf for any container shape.
 */
export function offsetPolygon(pts: V2[], d: number): V2[] {
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dir = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
    const nrm = new THREE.Vector2(-dir.y, dir.x); // inward for a CCW polygon
    return { p: new THREE.Vector2(p.x, p.y).addScaledVector(nrm, d), dir };
  });
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const den = a.dir.x * b.dir.y - a.dir.y * b.dir.x;
    if (Math.abs(den) < 1e-9) {
      out.push({ x: b.p.x, y: b.p.y });
      continue;
    }
    const t = ((b.p.x - a.p.x) * b.dir.y - (b.p.y - a.p.y) * b.dir.x) / den;
    out.push({ x: a.p.x + a.dir.x * t, y: a.p.y + a.dir.y * t });
  }
  return out;
}

/** THREE.Shape with every corner filleted by `radius`. */
export function roundedShape(pts: V2[], radius: number): THREE.Shape {
  const n = pts.length;
  const shape = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const vIn = new THREE.Vector2(cur.x - prev.x, cur.y - prev.y);
    const vOut = new THREE.Vector2(next.x - cur.x, next.y - cur.y);
    const r = Math.min(
      Math.max(radius, 0.0008),
      vIn.length() * 0.45,
      vOut.length() * 0.45,
    );
    vIn.normalize().multiplyScalar(r);
    vOut.normalize().multiplyScalar(r);
    const a = new THREE.Vector2(cur.x - vIn.x, cur.y - vIn.y);
    const b = new THREE.Vector2(cur.x + vOut.x, cur.y + vOut.y);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

/** Ring-shaped section: outer polygon with a concentric inner hole. */
export function ringSection(outer: V2[], inner: V2[], rOuter: number, rInner: number) {
  const shape = roundedShape(outer, rOuter);
  shape.holes.push(new THREE.Path(roundedShape(inner, rInner).getPoints(40).reverse()));
  return shape;
}

/**
 * Cross-section of a corner extrusion. Real ULD frame members run straight
 * along each edge AND wrap the hull fillet, so the section is built from the
 * nominal outline (two straights + the corner arc) and the same curve offset
 * inward by the extrusion thickness. The result is a watertight L that mates
 * with the straight edge bands without leaving a crescent gap at the radius.
 */
export function cornerRailSection(
  p: V2,
  prev: V2,
  next: V2,
  R: number,
  Rt: number,
  W: number,
) {
  const P = new THREE.Vector2(p.x, p.y);
  const uP = new THREE.Vector2(prev.x - p.x, prev.y - p.y).normalize();
  const uN = new THREE.Vector2(next.x - p.x, next.y - p.y).normalize();
  const bis = uP.clone().add(uN).normalize();
  const alpha = Math.acos(THREE.MathUtils.clamp(bis.dot(uP), -1, 1)); // half angle
  const tanD = R / Math.tan(alpha); // corner → arc tangent point
  const C = P.clone().addScaledVector(bis, R / Math.sin(alpha)); // arc centre
  const inP = new THREE.Vector2(uP.y, -uP.x); // inward normal along the prev edge
  const inN = new THREE.Vector2(-uN.y, uN.x); // inward normal along the next edge

  const T1 = P.clone().addScaledVector(uP, tanD);
  const T2 = P.clone().addScaledVector(uN, tanD);
  const E1 = P.clone().addScaledVector(uP, Math.max(W, tanD + 0.03));
  const E2 = P.clone().addScaledVector(uN, Math.max(W, tanD + 0.03));
  const Ri = Math.max(R - Rt, 0.004);
  // inner tangent points: same radial directions from C, radius R - Rt
  const i1 = C.clone().addScaledVector(T1.clone().sub(C).normalize(), Ri);
  const i2 = C.clone().addScaledVector(T2.clone().sub(C).normalize(), Ri);
  const E1i = E1.clone().addScaledVector(inP, Rt);
  const E2i = E2.clone().addScaledVector(inN, Rt);

  const a1 = Math.atan2(T1.y - C.y, T1.x - C.x);
  const a2 = Math.atan2(T2.y - C.y, T2.x - C.x);
  const am = Math.atan2(P.y - C.y, P.x - C.x); // arc mid-point faces the corner
  const norm = (v: number) => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const ccw = norm(am - a1) < norm(a2 - a1); // does a CCW sweep pass through am?

  const s = new THREE.Shape();
  s.moveTo(E1.x, E1.y);
  s.lineTo(T1.x, T1.y);
  s.absarc(C.x, C.y, R, a1, a2, !ccw);
  s.lineTo(E2.x, E2.y);
  s.lineTo(E2i.x, E2i.y);
  s.lineTo(i2.x, i2.y);
  s.absarc(C.x, C.y, Ri, Math.atan2(i2.y - C.y, i2.x - C.x), Math.atan2(i1.y - C.y, i1.x - C.x), ccw);
  s.lineTo(i1.x, i1.y);
  s.lineTo(E1i.x, E1i.y);
  s.closePath();
  return { shape: s, leg: Math.max(W, tanD + 0.03) };
}

/* ========================================================================== */
/* 3. Mesh factories                                                          */
/* ========================================================================== */

export function tag<T extends THREE.Object3D>(o: T, part: string): T {
  o.name = part;
  o.userData.part = part;
  return o;
}

export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  part: string,
  shadow = true,
) {
  const m = new THREE.Mesh(geo, mat);
  tag(m, part);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** Axis-aligned rounded plate. */
export function box(
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  part: string,
  r = 0.004,
) {
  const rr = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
  return mesh(new RoundedBoxGeometry(w, h, d, 2, rr), mat, part);
}

/**
 * Plate mounted on an arbitrary wall. `normal` is the outward wall normal,
 * `upHint` the direction the plate's height should follow. Builds a proper
 * right-handed basis (x = y × n) so nothing is ever mirrored — essential for
 * slanted walls and for door leaves hung on a hinge.
 *   w → across the wall, h → along upHint, d → thickness out of the wall.
 */
export function wallBox(
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  normal: THREE.Vector3,
  upHint: THREE.Vector3,
  at: THREE.Vector3,
  part: string,
  r = 0.005,
) {
  const n = normal.clone().normalize();
  const y = upHint.clone().addScaledVector(n, -upHint.dot(n)).normalize();
  const x = new THREE.Vector3().crossVectors(y, n).normalize();
  const m = box(mat, w, h, d, part, r);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  m.position.copy(at);
  return m;
}

/** Flat decal on an arbitrary wall, text kept upright. */
export function decal(
  w: number,
  h: number,
  normal: THREE.Vector3,
  at: THREE.Vector3,
  mat: THREE.Material,
  part: string,
) {
  const m = wallBox(mat, w, h, 0.0006, normal, new THREE.Vector3(0, 1, 0), at, part, 0.0002);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** Collects instance matrices so every rivet shares a single draw call. */
export class RivetRun {
  private mats: THREE.Matrix4[] = [];
  private up = new THREE.Vector3(0, 1, 0);
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 0.55, 1);

  /** A run of rivets from a to b, sitting on the surface offset by `normal`. */
  line(a: THREE.Vector3, b: THREE.Vector3, normal: THREE.Vector3, spacing = 0.13) {
    const len = a.distanceTo(b);
    const count = Math.max(2, Math.round(len / spacing));
    const dir = b.clone().sub(a).normalize();
    for (let i = 0; i < count; i++) {
      const p = a
        .clone()
        .addScaledVector(dir, (len * (i + 0.5)) / count)
        .addScaledVector(normal, 0.004);
      this.at(p, normal);
    }
  }

  at(p: THREE.Vector3, normal: THREE.Vector3) {
    this.q.setFromUnitVectors(this.up, normal.clone().normalize());
    this.mats.push(new THREE.Matrix4().compose(p.clone(), this.q, this.s));
  }

  build(mat: THREE.Material) {
    if (!this.mats.length) return null;
    const im = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.0058, 8, 6),
      mat,
      this.mats.length,
    );
    this.mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    tag(im, "Rivets (instanced)");
    return im;
  }
}

/* ========================================================================== */
/* 4. Materials                                                               */
/* ========================================================================== */

export interface BaseMaterials {
  /** contoured / skin material — brushed metal, finish-driven */
  shell: THREE.MeshPhysicalMaterial;
  /** interior liner */
  hullInner: THREE.MeshStandardMaterial;
  /** bright extruded aluminium frame */
  alloy: THREE.MeshStandardMaterial;
  /** hardware, latch rods, hinges */
  steel: THREE.MeshStandardMaterial;
  /** rubber gaskets, fittings */
  dark: THREE.MeshStandardMaterial;
  /** painted steel base frame */
  chassis: THREE.MeshStandardMaterial;
  /** safety yellow */
  accent: THREE.MeshStandardMaterial;
  /** livery / placard base */
  decal: THREE.MeshStandardMaterial;
  /** data plates */
  plate: THREE.MeshStandardMaterial;
  /** stencils */
  stencil: THREE.MeshStandardMaterial;
  /** instanced rivets */
  rivet: THREE.MeshStandardMaterial;
}

/**
 * The shared metallic palette. Brushed-metal roughness + Sobel-derived normals
 * come from TEXTURES.ts, so every container gets the same real aluminium
 * response; a generator may extend the returned set with its own materials.
 */
export function createBaseMaterials(finish: FinishId): BaseMaterials {
  const brushed = makeBrushedMetal(1024, 1);
  brushed.roughnessMap.repeat.set(2.5, 2.5);
  brushed.normalMap.repeat.set(2.5, 2.5);
  const speckle = makeSpeckle(512);
  speckle.repeat.set(4, 4);

  const f = FINISHES[finish];
  return {
    shell: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color),
      metalness: f.metalness,
      roughness: f.roughness,
      roughnessMap: brushed.roughnessMap,
      normalMap: brushed.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      clearcoat: f.clearcoat,
      clearcoatRoughness: f.clearcoatRoughness,
      envMapIntensity: 1.15,
    }),
    hullInner: new THREE.MeshStandardMaterial({
      color: "#98a0a7",
      metalness: 0.5,
      roughness: 0.66,
      side: THREE.DoubleSide,
      envMapIntensity: 0.6,
    }),
    alloy: new THREE.MeshStandardMaterial({
      color: "#c4cbd1",
      metalness: 1.0,
      roughness: 0.24,
      envMapIntensity: 1.3,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: "#d5dade",
      metalness: 1.0,
      roughness: 0.15,
      envMapIntensity: 1.45,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: "#1b1f23",
      metalness: 0.22,
      roughness: 0.88,
      map: speckle,
      envMapIntensity: 0.45,
    }),
    chassis: new THREE.MeshStandardMaterial({
      color: "#2c3238",
      metalness: 0.85,
      roughness: 0.5,
      envMapIntensity: 0.8,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: "#ffb020",
      metalness: 0.45,
      roughness: 0.38,
      emissive: new THREE.Color("#2d1b00"),
      envMapIntensity: 0.95,
    }),
    decal: new THREE.MeshStandardMaterial({
      metalness: 0.12,
      roughness: 0.56,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      envMapIntensity: 0.8,
    }),
    plate: new THREE.MeshStandardMaterial({
      metalness: 0.9,
      roughness: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      envMapIntensity: 1.1,
    }),
    stencil: new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.72,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    }),
    rivet: new THREE.MeshStandardMaterial({
      color: "#d2d8dd",
      metalness: 1.0,
      roughness: 0.28,
      envMapIntensity: 1.3,
    }),
  };
}

/* ========================================================================== */
/* 5. Container contract                                                      */
/* ========================================================================== */

/** One exploded-view assembly. Every generator returns the same shape. */
export interface Assembly {
  id: string;
  label: string;
  note: string;
  group: THREE.Group;
  home: THREE.Vector3;
  explode: THREE.Vector3;
  meshes: number;
  triangles: number;
}

/**
 * Common numeric spec every generator reports. Extra model-specific keys are
 * allowed via the index signature (e.g. the RKN's interior volume).
 */
export interface ContainerStats {
  meshes: number;
  triangles: number;
  /** geometric volume of the certified envelope, m³ */
  volumeM3: number;
  /** certified internal volume, m³ */
  iataVolumeM3: number;
  footprintM2: number;
  tareKg: number;
  maxGrossKg: number;
  payloadKg: number;
  [extra: string]: number | string;
}

/** A container as seen by the viewer: geometry contract + shared palette. */
export interface ViewerContainer extends ContainerBase {
  materials: BaseMaterials;
  stats: ContainerStats;
}

/**
 * The contract AKEViewer.ts (and any other renderer) drives. Generators extend
 * it with their own `materials` and `stats` shapes.
 */
export interface ContainerBase {
  group: THREE.Group;
  assemblies: Assembly[];
  doorPivot: THREE.Group;
  profile: V2[];
  setFinish(id: FinishId): void;
  setDoorOpen(t: number): void;
  /** optional per-frame hook (spinning fans, blinking LEDs) */
  animate?(elapsed: number, delta: number): void;
  /** optional hook for pallets: raise/lower the cargo-load contour (0..1) */
  setLoad?(t: number): void;
  dispose(): void;
}
