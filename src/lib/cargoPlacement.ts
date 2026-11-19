/**
 * AKE cargo placement sandbox: conservative axis-aligned core only.
 *
 * Neither the modeled 4.3 m³ rating nor a nominal ULD envelope is a guarantee
 * of available rectangular space. This deliberately smaller core sits inside
 * the nominal AKE profile; wall fittings, restraint and aircraft CG/position
 * are NOT verified. Never use these estimates for operational loading.
 */
export interface CargoItem {
  id: string;
  label: string;
  widthM: number;
  depthM: number;
  heightM: number;
  massKg: number;
}

export interface CargoPlacement extends CargoItem {
  /** World-space centre of the carton, in metres. */
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

/** A conservative box within the AKE nominal tapered interior, metres. */
export const AKE_CARGO_CORE = {
  minX: -0.88,
  minZ: -0.66,
  floorY: 0.15,
  widthM: 1.21,
  depthM: 1.32,
  heightM: 1.37,
} as const;

const EPS = 1e-6;
const MAX_ITEMS = 40;

/** Visible one-click scene: 30 equal-sized cartons in a stable 3D stack. */
export function demoAKECargo(): CargoItem[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `demo-${index + 1}`,
    label: `Demo ${String(index + 1).padStart(2, "0")}`,
    widthM: 0.36,
    depthM: 0.38,
    heightM: 0.32,
    massKg: 18,
  }));
}

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
  // Full footprint on one carton: conservative, no unsupported bridges.
  return placed.some(p =>
    Math.abs(p.y + p.heightM - box.y) <= EPS &&
    box.x >= p.x - EPS && box.x + box.widthM <= p.x + p.widthM + EPS &&
    box.z >= p.z - EPS && box.z + box.depthM <= p.z + p.depthM + EPS
  );
}

function candidates(values: number[]) {
  return [...new Set(values.map(v => Math.round(v * 1e6) / 1e6))]
    .sort((a, b) => a - b);
}

function valid(item: CargoItem) {
  return [item.widthM, item.depthM, item.heightM, item.massKg].every(Number.isFinite) &&
    item.widthM > 0 && item.depthM > 0 && item.heightM > 0 && item.massKg > 0;
}

/** Greedy, deterministic first-fit placement; order is significant. */
export function planAKECargo(items: readonly CargoItem[], payloadKg = 1496): CargoPlan {
  const core = AKE_CARGO_CORE;
  const coreM3 = core.widthM * core.depthM * core.heightM;
  const local: Array<CargoItem & { x: number; y: number; z: number }> = [];
  const rejected: CargoRejection[] = [];
  let loadedKg = 0;
  let usedM3 = 0;

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
  // Never silently omit items beyond the safe preview cap.
  for (const item of items.slice(MAX_ITEMS)) {
    rejected.push({ item, reason: "no-space" });
  }
  return {
    placed: local.map(p => ({
      ...p,
      x: core.minX + p.x + p.widthM / 2,
      y: core.floorY + p.y + p.heightM / 2,
      z: core.minZ + p.z + p.depthM / 2,
    })),
    rejected,
    loadedKg,
    usedM3,
    coreM3,
    coreUtilizationPct: (usedM3 / coreM3) * 100,
    availableKg: Math.max(0, payloadKg - loadedKg),
  };
}
