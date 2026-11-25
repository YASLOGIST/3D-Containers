/**
 * Model-aware ULD cargo preview. This is an intentionally conservative
 * AABB sandbox, NOT a certified fit, structural or restraint calculation.
 */
import { MODELS, type ModelId } from "../three/models";
import { contourProfile } from "../three/akeLD3";

export interface CargoItem {
  id: string;
  label: string;
  widthM: number;
  depthM: number;
  heightM: number;
  massKg: number;
}
export interface CargoPlacement extends CargoItem {
  x: number;
  y: number;
  z: number;
}
export interface CargoRejection {
  item: CargoItem;
  reason: "invalid" | "oversize" | "overweight" | "no-space";
}
export interface CargoPlan {
  placed: CargoPlacement[];
  rejected: CargoRejection[];
  loadedKg: number;
  usedM3: number;
  coreM3: number;
  coreUtilizationPct: number;
  availableKg: number;
}
export interface CargoCore {
  minX: number;
  minZ: number;
  floorY: number;
  widthM: number;
  depthM: number;
  heightM: number;
}

const EPS = 1e-6;
const MAX_ITEMS = 40;
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

/** Horizontal segment enclosed by a closed 2D polygon at height y. */
function profileSegment(profile: readonly { x: number; y: number }[], y: number) {
  const intersections: number[] = [];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i], b = profile[(i + 1) % profile.length];
    if (Math.abs(a.y - b.y) <= EPS) continue;
    // Half-open crossing rule avoids double counting at shared vertices.
    if (y >= Math.min(a.y, b.y) && y < Math.max(a.y, b.y)) {
      intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
  }
  intersections.sort((a, b) => a - b);
  return intersections.length >= 2
    ? { left: intersections[0], right: intersections[intersections.length - 1] }
    : null;
}

/**
 * A fixed inner rectangular preview core derived from each model's 2D outline.
 * Uses inward margins larger for reefer units and pallets; these do not certify
 * clearance from interior hardware, structure, nets or particular cargo types.
 */
export function cargoCoreForModel(model: ModelId, contour = true): CargoCore {
  const spec = MODELS[model];
  const reefer = spec.reeferOption;
  const profile = model === "ake" ? contourProfile(contour) : spec.sectionProfile();
  if (spec.palletOption) {
    const minX = Math.min(...profile.map(p => p.x));
    const maxX = Math.max(...profile.map(p => p.x));
    // The shared pallet generator has 190 mm corner blocks inset 10 mm.
    // Leave 10 mm of illustrated clearance beyond their full footprint.
    const padX = 0.21, padZ = 0.21;
    // Plate top is nominal thickness plus the 16 mm skid in pallet engine.
    const floorY = spec.dims.height + 0.021;
    return {
      minX: minX + padX,
      minZ: -spec.dims.depth / 2 + padZ,
      floorY,
      widthM: maxX - minX - padX * 2,
      depthM: spec.dims.depth - padZ * 2,
      heightM: Math.max(0.1, (spec.dims.contourHeight ?? 1.5) - 0.17),
    };
  }
  const low = Math.min(...profile.map(p => p.y));
  const high = Math.max(...profile.map(p => p.y));
  const floorY = low + (reefer ? 0.16 : 0.07);
  const ceilingY = high - (reefer ? 0.20 : 0.10);
  const marginX = reefer ? 0.20 : 0.13;
  const marginZ = reefer ? 0.24 : 0.12;
  // The profile is piecewise linear; include every in-range vertex height
  // so a narrow knee cannot disappear between uniform sample heights.
  const heights = [floorY, ceilingY, ...profile.map(p => p.y)
    .filter(y => y > floorY && y < ceilingY)];
  const sampled = heights.map(y => profileSegment(profile, y))
    .filter((p): p is { left: number; right: number } => !!p);
  if (!sampled.length) throw new Error(`No reference cargo section for ${model}`);
  const minX = Math.max(...sampled.map(s => s.left)) + marginX;
  const maxX = Math.min(...sampled.map(s => s.right)) - marginX;
  const widthM = maxX - minX;
  const depthM = spec.dims.depth - marginZ * 2;
  const heightM = ceilingY - floorY;
  if (![widthM, depthM, heightM].every(finitePositive)) {
    throw new Error(`Cargo preview core is not feasible for ${model}`);
  }
  return { minX, minZ: -spec.dims.depth / 2 + marginZ,
    floorY, widthM, depthM, heightM };
}

/** Adaptive sample with 3 × 3 × 3 stowed boxes, rather than forcing LD-3
 * dimensions into aircraft containers and onto main-deck pallets. */
export function demoCargoForModel(model: ModelId, contour = true): CargoItem[] {
  const core = cargoCoreForModel(model, contour);
  const count = 27;
  const size = {
    widthM: Number((core.widthM / 3 * 0.89).toFixed(4)),
    depthM: Number((core.depthM / 3 * 0.89).toFixed(4)),
    heightM: Number((core.heightM / 3 * 0.89).toFixed(4)),
  };
  const massKg = Number(Math.min(25, MODELS[model].ratings.payloadKg / 40).toFixed(2));
  return Array.from({ length: count }, (_, i) => ({
    id: `${model}-demo-${i + 1}`,
    label: `Demo ${String(i + 1).padStart(2, "0")}`,
    ...size, massKg,
  }));
}

/** Kept as a compatibility alias for legacy LD-3 callers. */
export const AKE_CARGO_CORE = cargoCoreForModel("ake");
export const demoAKECargo = () => demoCargoForModel("ake");

const within = (start: number, span: number, limit: number) =>
  start >= -EPS && span > 0 && start + span <= limit + EPS;

function overlaps(a: { x: number; y: number; z: number; widthM: number; depthM: number; heightM: number },
  b: { x: number; y: number; z: number; widthM: number; depthM: number; heightM: number }) {
  return a.x < b.x + b.widthM - EPS &&
    a.x + a.widthM > b.x + EPS &&
    a.y < b.y + b.heightM - EPS &&
    a.y + a.heightM > b.y + EPS &&
    a.z < b.z + b.depthM - EPS &&
    a.z + a.depthM > b.z + EPS;
}
function supported(
  box: { x: number; y: number; z: number; widthM: number; depthM: number },
  placed: Array<CargoItem & { x: number; y: number; z: number }>,
) {
  if (box.y <= EPS) return true;
  return placed.some(p =>
    Math.abs(p.y + p.heightM - box.y) <= EPS &&
    box.x >= p.x - EPS && box.x + box.widthM <= p.x + p.widthM + EPS &&
    box.z >= p.z - EPS && box.z + box.depthM <= p.z + p.depthM + EPS,
  );
}
function candidates(values: number[]) {
  return [...new Set(values.map(v => Math.round(v * 1e6) / 1e6))]
    .sort((a, b) => a - b);
}
function valid(item: CargoItem) {
  return [item.widthM, item.depthM, item.heightM, item.massKg].every(finitePositive);
}

/** Deterministic, supported first-fit. Not a bin-packing optimizer. */
export function planCargoForModel(
  model: ModelId, items: readonly CargoItem[], contour = true,
  payloadOverride?: number,
): CargoPlan {
  const core = cargoCoreForModel(model, contour);
  const nominal = MODELS[model].ratings.payloadKg;
  // A caller can impose a stricter preview cap, never silently override the
  // registry upward or turn NaN into unlimited capacity.
  const payloadKg = payloadOverride === undefined ? nominal
    : Number.isFinite(payloadOverride) ? Math.max(0, Math.min(nominal, payloadOverride)) : 0;
  const coreM3 = core.widthM * core.depthM * core.heightM;
  const local: Array<CargoItem & { x: number; y: number; z: number }> = [];
  const rejected: CargoRejection[] = [];
  let loadedKg = 0, usedM3 = 0;
  for (const item of items.slice(0, MAX_ITEMS)) {
    if (!valid(item)) {
      rejected.push({ item, reason: "invalid" });
      continue;
    }
    if (item.widthM > core.widthM + EPS ||
      item.depthM > core.depthM + EPS || item.heightM > core.heightM + EPS) {
      rejected.push({ item, reason: "oversize" });
      continue;
    }
    if (loadedKg + item.massKg > payloadKg + EPS) {
      rejected.push({ item, reason: "overweight" });
      continue;
    }
    const ys = candidates([0, ...local.map(p => p.y + p.heightM)]);
    const zs = candidates([0, ...local.map(p => p.z + p.depthM)]);
    const xs = candidates([0, ...local.map(p => p.x + p.widthM)]);
    let location: { x: number; y: number; z: number } | null = null;
    search: for (const y of ys) for (const z of zs) for (const x of xs) {
      const trial = { x, y, z, widthM: item.widthM,
        depthM: item.depthM, heightM: item.heightM };
      if (!within(x, item.widthM, core.widthM) ||
          !within(y, item.heightM, core.heightM) ||
          !within(z, item.depthM, core.depthM)) continue;
      if (local.some(p => overlaps(trial, p))) continue;
      if (!supported(trial, local)) continue;
      location = { x, y, z };
      break search;
    }
    if (!location) {
      rejected.push({ item, reason: "no-space" });
      continue;
    }
    local.push({ ...item, ...location });
    loadedKg += item.massKg;
    usedM3 += item.widthM * item.depthM * item.heightM;
  }
  for (const item of items.slice(MAX_ITEMS)) rejected.push({ item, reason: "no-space" });
  return {
    placed: local.map(p => ({
      ...p,
      x: core.minX + p.x + p.widthM / 2,
      y: core.floorY + p.y + p.heightM / 2,
      z: core.minZ + p.z + p.depthM / 2,
    })),
    rejected, loadedKg, usedM3, coreM3,
    coreUtilizationPct: (usedM3 / coreM3) * 100,
    availableKg: Math.max(0, payloadKg - loadedKg),
  };
}

/** Compatibility with earlier AKE-only callers. */
export function planAKECargo(items: readonly CargoItem[], payloadKg = 1496): CargoPlan {
  return planCargoForModel("ake", items, true, payloadKg);
}
