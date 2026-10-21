/**
 * ============================================================================
 *  pmc.ts — procedural generator for an IATA PMC (P6P) air-cargo pallet,
 *           built entirely from Three.js primitives. No external model files,
 *           no image assets.
 *
 *  Certified base (metres, nominal):
 *      width ................. 3.18 (X)
 *      depth ................. 2.44 (Z)
 *      base thickness ........ 0.05 (Y) — a flat, low-profile sheet
 *
 *  The PMC is the one member of the suite with no walls and no door: it is a
 *  solid aluminium base plate with continuous seat tracks around all four
 *  edges for cargo-net attachment, raised edge lips, reinforced corners and a
 *  four-way fork entry. An optional translucent contour block above the plate
 *  represents the standard netted cargo build.
 *
 *  Implements the same ContainerBase contract as the AKE / RKN / RAP
 *  generators. Because a pallet has no hinged door, `doorPivot` is an empty
 *  group and `setDoorOpen()` is a documented no-op — the contour is driven by
 *  the optional `setLoad()` hook instead.
 * ============================================================================
 */
import * as THREE from "three";
import { makeCargoNetTexture, makeIdPlate, makeStencil } from "./textures";
import {
  ContainerBase,
  FINISHES,
  assemblyFactory,
  createBaseMaterials,
  decal,
  mesh,
  box,
  RivetRun,
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

/* Manufacturing constants (metres). */
const PLATE_T = 0.05; // base plate thickness
const LIP_H = 0.016; // raised edge lip
const TRACK_W = 0.075; // seat-track rail width
const TRACK_T = 0.014; // seat-track rail height above the plate
const RAIL_INSET = 0.055; // track centre-line inset from the plate edge
const CORNER_BLK = 0.19; // reinforced corner block
const BEAM_W = 0.14; // longitudinal support beam width
const SKID_H = 0.016; // skid height under the plate
const FORK_H = 0.032; // fork entry height
const CONTOUR_H = 1.62; // standard netted cargo contour

/* ========================================================================== */
/* 1. Dimensions                                                              */
/* ========================================================================== */

export const PMC_DIMENSIONS = {
  /** base width along X */
  width: 3.18,
  /** base depth along Z */
  depth: 2.44,
  /** base plate thickness along Y */
  thickness: PLATE_T,
  /** standard netted cargo contour above the base */
  contourHeight: CONTOUR_H,
} as const;

/* ========================================================================== */
/* 2. Materials                                                               */
/* ========================================================================== */

export interface PMCMaterials extends BaseMaterials {
  /** the top deck: solid metallic silver plate */
  deck: THREE.MeshPhysicalMaterial;
  /** anodised seat tracks on the long (X) edges */
  track: THREE.MeshStandardMaterial;
  /** anodised seat tracks on the short (Z) edges */
  trackShort: THREE.MeshStandardMaterial;
  /** translucent cargo-load contour */
  contour: THREE.MeshPhysicalMaterial;
}

function createMaterials(finish: FinishId) {
  const base = createBaseMaterials(finish);
  const trackTex = makeSeatTrackTexture();
  const netTex = makeCargoNetTexture();
  // one canvas == one metre of rail: 16 studs per metre ≈ 62 mm pitch
  trackTex.repeat.set(1, PMC_DIMENSIONS.width - 0.12);
  const trackTexShort = trackTex.clone();
  trackTexShort.needsUpdate = true;
  trackTexShort.repeat.set(1, PMC_DIMENSIONS.depth - 0.12);

  const f = FINISHES[finish];
  const m: PMCMaterials = {
    ...base,
    // the deck is the headline surface: a solid metallic silver plate
    deck: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color),
      metalness: Math.min(1, f.metalness + 0.05),
      roughness: Math.max(0.18, f.roughness - 0.08),
      roughnessMap: base.shell.roughnessMap,
      normalMap: base.shell.normalMap,
      normalScale: new THREE.Vector2(0.22, 0.22),
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.25,
    }),
    track: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      metalness: 0.95,
      roughness: 0.38,
      map: trackTex,
      envMapIntensity: 1.1,
    }),
    trackShort: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      metalness: 0.95,
      roughness: 0.38,
      map: trackTexShort,
      envMapIntensity: 1.1,
    }),
    contour: new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.1,
      roughness: 0.5,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
      map: netTex,
      alphaMap: netTex,
      envMapIntensity: 0.5,
    }),
  };
  return { mats: m, trackTex, trackTexShort, netTex };
}

/* Local import shim keeps the generator readable ---------------------------- */
import { makeSeatTrack } from "./textures";
const makeSeatTrackTexture = makeSeatTrack;

/* ========================================================================== */
/* 3. Section — a flat plate                                                  */
/* ========================================================================== */

/** The PMC "profile" is a flat plate: a thin rectangle at the base. */
export function pmcProfile(): V2[] {
  const { width: W } = PMC_DIMENSIONS;
  const x0 = -W / 2;
  return [
    { x: x0, y: 0 },
    { x: x0 + W, y: 0 },
    { x: x0 + W, y: PLATE_T },
    { x: x0, y: PLATE_T },
  ];
}

/* ========================================================================== */
/* 4. Build options and result                                                */
/* ========================================================================== */

export interface BuildOptions {
  finish: FinishId;
  /** seat-track studs, tie-down rings, placards, fork lips */
  detail: boolean;
  /** instanced rivet runs along the plate edges */
  rivets: boolean;
  /** 0..1 door swing — pallets have no door (accepted for interface parity) */
  doorOpen: number;
  /** 0..1 cargo-load contour above the base */
  load: number;
}

export const DEFAULT_OPTIONS: BuildOptions = {
  finish: "mill",
  detail: true,
  rivets: true,
  doorOpen: 0,
  load: 0.35,
};

export interface PMCContainer extends ContainerBase {
  materials: PMCMaterials;
  stats: ContainerStats & {
    contourM3: number;
    contourHeightM: number;
    tareKg: number;
  };
  /** raise / lower the translucent cargo-load contour */
  setLoad(t: number): void;
}

/* ========================================================================== */
/* 5. The generator                                                           */
/* ========================================================================== */

export function createPMCContainer(options: Partial<BuildOptions> = {}): PMCContainer {
  const o: BuildOptions = { ...DEFAULT_OPTIONS, ...options };
  const { width: W, depth: D, thickness: T } = PMC_DIMENSIONS;

  const { mats: mat, trackTex, trackTexShort, netTex } = createMaterials(o.finish);
  const root = tag(new THREE.Group(), "PMC_P6P");
  const rivets = new RivetRun();

  const X0 = -W / 2; // -X edge
  const Z0 = -D / 2; // -Z edge
  const nTop = new THREE.Vector3(0, 1, 0);
  const nPosX = new THREE.Vector3(1, 0, 0);
  const nNegX = new THREE.Vector3(-1, 0, 0);
  const nPosZ = new THREE.Vector3(0, 0, 1);
  const nNegZ = new THREE.Vector3(0, 0, -1);
  const upY = new THREE.Vector3(0, 1, 0);
  const upZ = new THREE.Vector3(0, 0, 1);
  const upX = new THREE.Vector3(1, 0, 0);

  /* --- 5.1 assemblies ---------------------------------------------------- */
  const assemblies: Assembly[] = [];
  const assembly = assemblyFactory(root, assemblies);
  const A_DECK = assembly("deck", "Base plate", "Aluminium deck, 50 mm sheet", [0, 0.34, 0]);
  const A_TRACKS = assembly("tracks", "Seat tracks", "Continuous net-attachment rails", [0, 0.72, 0]);
  const A_STRUCTURE = assembly("structure", "Underside", "Skids, beams, fork entry", [0, -0.62, 0]);
  const A_CONTOUR = assembly("contour", "Cargo contour", "Netted load outline (optional)", [0, 0.9, 0]);

  /* --- 5.2 base plate ---------------------------------------------------- */
  const deck = box(mat.deck, W - 0.04, T, D - 0.04, "Pallet base plate", 0.01);
  deck.position.set(0, SKID_H + T / 2, 0);
  A_DECK.group.add(deck);

  // reinforcing ribs pressed into the underside of the plate
  for (const dz of [-0.95, -0.45, 0, 0.45, 0.95]) {
    const rib = box(mat.deck, W - 0.3, 0.014, 0.1, "Deck stiffening rib", 0.005);
    rib.position.set(0, SKID_H + 0.008, dz);
    A_DECK.group.add(rib);
  }

  /* --- 5.3 continuous seat tracks along all four edges ------------------- */
  const trackLenX = W - 0.12;
  const trackLenZ = D - 0.12;
  const trackY = SKID_H + T + TRACK_T / 2;

  // Long rails run along Z, short rails along X. wallBox's h follows upHint,
  // so h carries the rail length, w the rail height and d the wall offset.
  // Each orientation gets its own texture repeat so the stud pitch stays
  // ~62 mm on both.
  for (const sx of [-1, 1]) {
    A_TRACKS.group.add(
      wallBox(
        mat.track,
        TRACK_W,
        trackLenZ,
        TRACK_T,
        sx > 0 ? nPosX : nNegX,
        upZ,
        new THREE.Vector3(X0 + (sx > 0 ? W - RAIL_INSET : RAIL_INSET), trackY, 0),
        "Seat track (long edge)",
        0.004,
      ),
    );
  }
  for (const sz of [-1, 1]) {
    A_TRACKS.group.add(
      wallBox(
        mat.trackShort,
        TRACK_W,
        trackLenX,
        TRACK_T,
        sz > 0 ? nPosZ : nNegZ,
        upX,
        new THREE.Vector3(0, trackY, Z0 + (sz > 0 ? D - RAIL_INSET : RAIL_INSET)),
        "Seat track (short edge)",
        0.004,
      ),
    );
  }

  // discrete tie-down studs + rings along the tracks
  if (o.detail) {
    const studs: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      const x = X0 + (sx > 0 ? W - RAIL_INSET : RAIL_INSET);
      for (let i = -3; i <= 3; i++) studs.push(new THREE.Vector3(x, trackY + TRACK_T, i * 0.36));
    }
    for (const sz of [-1, 1]) {
      const z = Z0 + (sz > 0 ? D - RAIL_INSET : RAIL_INSET);
      for (let i = -3; i <= 3; i++) studs.push(new THREE.Vector3(i * 0.46, trackY + TRACK_T, z));
    }
    for (const p of studs) {
      const stud = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 12), mat.steel, "Tie-down stud");
      stud.position.copy(p).setY(trackY + TRACK_T + 0.008);
      A_TRACKS.group.add(stud);
      const ring = mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16), mat.steel, "Net tie-down ring");
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(p).setY(trackY + TRACK_T + 0.02);
      A_TRACKS.group.add(ring);
    }
  }

  /* --- 5.4 raised edge lips, reinforced corners -------------------------- */
  const lipY = SKID_H + T + LIP_H / 2;
  for (const sx of [-1, 1]) {
    const lip = box(mat.alloy, 0.03, LIP_H, D - 0.06, "Edge lip", 0.004);
    lip.position.set(X0 + (sx > 0 ? W - 0.015 : 0.015), lipY, 0);
    A_DECK.group.add(lip);
  }
  for (const sz of [-1, 1]) {
    const lip = box(mat.alloy, W - 0.06, LIP_H, 0.03, "Edge lip", 0.004);
    lip.position.set(0, lipY, Z0 + (sz > 0 ? D - 0.015 : 0.015));
    A_DECK.group.add(lip);
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const blk = box(mat.alloy, CORNER_BLK, T + LIP_H, CORNER_BLK, "Reinforced corner", 0.02);
      blk.position.set(
        X0 + (sx > 0 ? W - CORNER_BLK / 2 - 0.01 : CORNER_BLK / 2 + 0.01),
        SKID_H + (T + LIP_H) / 2,
        Z0 + (sz > 0 ? D - CORNER_BLK / 2 - 0.01 : CORNER_BLK / 2 + 0.01),
      );
      A_DECK.group.add(blk);
      // corner seat-track turn: a small block where the two rails meet
      const turn = box(mat.track, TRACK_W, TRACK_T, TRACK_W, "Track corner block", 0.003);
      turn.position.set(
        blk.position.x,
        trackY,
        blk.position.z,
      );
      A_TRACKS.group.add(turn);
    }
  }

  /* --- 5.5 underside: skids, beams, four-way fork entry ------------------ */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const skid = box(mat.chassis, 0.34, SKID_H, 0.5, "Landing skid", 0.01);
      skid.position.set(
        X0 + (sx > 0 ? W - 0.42 : 0.42),
        SKID_H / 2,
        Z0 + (sz > 0 ? D - 0.5 : 0.5),
      );
      A_STRUCTURE.group.add(skid);
    }
  }
  // three support beams running the full depth
  for (const bx of [X0 + 0.7, X0 + W / 2, X0 + W - 0.7]) {
    const beam = box(mat.chassis, BEAM_W, SKID_H + 0.018, D - 0.1, "Longitudinal beam", 0.008);
    beam.position.set(bx, (SKID_H + 0.018) / 2, 0);
    A_STRUCTURE.group.add(beam);
  }
  for (const cz of [-0.9, 0.9]) {
    const cross = box(mat.chassis, W - 0.24, SKID_H + 0.014, 0.12, "Cross member", 0.008);
    cross.position.set(0, (SKID_H + 0.014) / 2, cz);
    A_STRUCTURE.group.add(cross);
  }

  // four-way fork entry: slots through the plate at both ends and both sides
  const forkY = SKID_H + FORK_H / 2 + 0.004;
  for (const sz of [-1, 1]) {
    for (const fx of [-0.55, 0.55]) {
      const slot = box(
        mat.dark,
        0.34,
        FORK_H,
        0.1,
        "Fork entry (end)",
        0.006,
      );
      slot.position.set(fx, forkY, Z0 + (sz > 0 ? D - 0.1 : 0.1));
      A_STRUCTURE.group.add(slot);
      const lip = wallBox(
        mat.steel,
        0.38,
        0.01,
        0.1,
        sz > 0 ? nPosZ : nNegZ,
        upY,
        new THREE.Vector3(fx, forkY - FORK_H / 2 - 0.004, slot.position.z),
        "Fork wear lip",
        0.003,
      );
      A_STRUCTURE.group.add(lip);
    }
  }
  for (const sx of [-1, 1]) {
    for (const fz of [-0.75, 0.75]) {
      const slot = box(mat.dark, 0.1, FORK_H, 0.34, "Fork entry (side)", 0.006);
      slot.position.set(X0 + (sx > 0 ? W - 0.1 : 0.1), forkY, fz);
      A_STRUCTURE.group.add(slot);
    }
  }

  /* --- 5.6 markings: pallet ID, weights, orientation --------------------- */
  const idTex = makeIdPlate({
    width: 0.42,
    height: 0.22,
    id: "PMC 4127",
    carrier: "LH",
    serial: "PMC4127LH-0713",
  });
  const idMat = mat.plate.clone();
  idMat.map = idTex;
  A_DECK.group.add(
    decal(
      0.42,
      0.22,
      nTop,
      new THREE.Vector3(X0 + 0.62, SKID_H + T + 0.001, Z0 + 0.42),
      idMat,
      "Pallet identification plate",
    ),
  );

  const pmcTex = makeStencil("PMC", "#ffb020", 512, 200);
  const pmcMat = mat.stencil.clone();
  pmcMat.map = pmcTex;
  A_DECK.group.add(
    decal(
      0.4,
      0.16,
      nTop,
      new THREE.Vector3(X0 + 0.62, SKID_H + T + 0.001, Z0 + 0.95),
      pmcMat,
      "Pallet type stencil",
    ),
  );

  const netTexStencil = makeStencil("NET POINTS", "#79b8c9", 512, 140);
  const netMat = mat.stencil.clone();
  netMat.map = netTexStencil;
  A_TRACKS.group.add(
    decal(
      0.32,
      0.088,
      nTop,
      new THREE.Vector3(X0 + W - 0.5, SKID_H + T + 0.001, Z0 + 0.4),
      netMat,
      "Net stencil",
    ),
  );

  const warnTex = makeStencil("MAX 6804 KG", "#e2513c", 640, 150);
  const warnMat = mat.stencil.clone();
  warnMat.map = warnTex;
  A_DECK.group.add(
    decal(
      0.38,
      0.09,
      nTop,
      new THREE.Vector3(X0 + W - 0.6, SKID_H + T + 0.001, Z0 + D - 0.42),
      warnMat,
      "Weight stencil",
    ),
  );

  // arrow stencils showing pallet orientation on the short edges
  const arrowTex = makeStencil("\u25B2 FRONT", "#e8ecef", 512, 150);
  const arrowMat = mat.stencil.clone();
  arrowMat.map = arrowTex;
  A_DECK.group.add(
    decal(
      0.34,
      0.1,
      nPosZ,
      new THREE.Vector3(X0 + W - 0.6, SKID_H + T - 0.01, Z0 + D - 0.002),
      arrowMat,
      "Orientation stencil",
    ),
  );

  /* --- 5.7 optional cargo-load contour ---------------------------------- */
  // A translucent net block above the plate plus a bounding-box outline, so
  // the standard build volume reads at a glance.
  const contourGroup = tag(new THREE.Group(), "Cargo contour");
  A_CONTOUR.group.add(contourGroup);

  const contourMat = mat.contour.clone();
  contourMat.map = netTex;
  contourMat.alphaMap = netTex;
  netTex.repeat.set(10, 6);
  const contourMesh = box(
    contourMat,
    W - 0.1,
    1,
    D - 0.1,
    "Cargo load contour",
    0.004,
  );
  contourMesh.castShadow = false;
  contourMesh.receiveShadow = false;
  contourGroup.add(contourMesh);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W - 0.1, 1, D - 0.1)),
    new THREE.LineBasicMaterial({ color: "#ffb020", transparent: true, opacity: 0.55 }),
  );
  outline.name = "Contour outline";
  outline.userData.isAnnotation = true;
  contourGroup.add(outline);

  const applyLoad = (t: number) => {
    const k = THREE.MathUtils.clamp(t, 0, 1);
    const h = Math.max(0.02, k * CONTOUR_H);
    contourMesh.scale.set(1, h, 1);
    contourMesh.position.set(0, SKID_H + T + h / 2, 0);
    outline.scale.set(1, h, 1);
    outline.position.copy(contourMesh.position);
    contourGroup.visible = k > 0.001;
    contourMat.opacity = 0.05 + k * 0.12;
  };
  applyLoad(o.load);

  /* --- 5.8 rivets along the plate edges --------------------------------- */
  if (o.rivets) {
    const y = SKID_H + T;
    rivets.line(new THREE.Vector3(X0 + 0.06, y, -D / 2 + 0.1), new THREE.Vector3(X0 + 0.06, y, D / 2 - 0.1), nNegX, 0.16);
    rivets.line(new THREE.Vector3(X0 + W - 0.06, y, -D / 2 + 0.1), new THREE.Vector3(X0 + W - 0.06, y, D / 2 - 0.1), nPosX, 0.16);
    rivets.line(new THREE.Vector3(-W / 2 + 0.1, y, Z0 + 0.06), new THREE.Vector3(W / 2 - 0.1, y, Z0 + 0.06), nNegZ, 0.16);
    rivets.line(new THREE.Vector3(-W / 2 + 0.1, y, Z0 + D - 0.06), new THREE.Vector3(W / 2 - 0.1, y, Z0 + D - 0.06), nPosZ, 0.16);
  }
  const rivetMesh = o.rivets ? rivets.build(mat.rivet) : null;
  if (rivetMesh) A_DECK.group.add(rivetMesh);

  /* --- 5.9 stats --------------------------------------------------------- */
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

  return {
    group: root,
    materials: mat,
    assemblies,
    // a pallet has no hinged door; the group exists for interface parity
    doorPivot: tag(new THREE.Group(), "Door pivot (n/a — pallet)"),
    profile: pmcProfile(),
    stats: {
      meshes: meshCount,
      triangles,
      volumeM3: W * D * T,
      iataVolumeM3: W * D * CONTOUR_H,
      footprintM2: W * D,
      tareKg: 120,
      maxGrossKg: 6804,
      payloadKg: 6804 - 120,
      contourM3: W * D * CONTOUR_H,
      contourHeightM: CONTOUR_H,
    },
    setFinish(id: FinishId) {
      const f = FINISHES[id];
      mat.shell.color.set(f.color);
      mat.shell.metalness = f.metalness;
      mat.shell.roughness = f.roughness;
      mat.shell.needsUpdate = true;
      mat.deck.color.set(f.color);
      mat.deck.metalness = Math.min(1, f.metalness + 0.05);
      mat.deck.roughness = Math.max(0.18, f.roughness - 0.08);
      mat.deck.needsUpdate = true;
    },
    setDoorOpen() {
      /* no door on a pallet — accepted so the viewer can drive every model */
    },
    setLoad: applyLoad,
    animate(elapsed: number) {
      // the contour breathes very slightly so the net reads as a soft volume
      contourMat.opacity = 0.05 + (o.load || 0.35) * 0.12 + Math.sin(elapsed * 1.4) * 0.015;
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
        for (const k of ["map", "normalMap", "roughnessMap", "alphaMap", "aoMap", "metalnessMap"]) {
          if (rec[k] instanceof THREE.Texture) texs.add(rec[k] as THREE.Texture);
        }
        m.dispose();
      });
      geos.forEach((g) => g.dispose());
      texs.forEach((t) => t.dispose());
      trackTex.dispose();
      trackTexShort.dispose();
      netTex.dispose();
    },
  };
}
