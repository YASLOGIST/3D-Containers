/**
 * Cargo field diagnostics for the conservative visual loading sandbox.
 * These values describe only the preview cartons, not aircraft limits,
 * ULD floor strength, restraint forces, or certified balance.
 */
import type { CargoCore, CargoPlan, CargoPlacement } from "./cargoPlacement";
import { projectedCartonMetrics, type PreviewVerticalLayer } from "./cargoProjection";

export interface CargoFieldCell {
  row: number;
  column: number;
  kg: number;
  kgPerM2: number;
}
export interface CargoSignature {
  totalKg: number;
  centroid: { x: number; y: number; z: number } | null;
  /** Signed displacement from the preview-core centre as % of its full span. */
  lateralOffsetPct: number;
  longitudinalOffsetPct: number;
  cells: CargoFieldCell[];
  maxCellKg: number;
  peakKgPerM2: number;
}

/** CSV export of the measurable sandbox, intentionally marked non-certified. */
export function exportCargoSignatureCSV(
  modelCode: string,
  plan: Pick<CargoPlan, "placed">,
  signature: CargoSignature,
): string {
  const escape = (s: string) => {
    // Treat generated identifiers as text; prevent spreadsheet formula injection.
    const safe = /^[=+@\-\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const rows: string[][] = [[
    "type", "ULD", "identifier", "x_m", "y_m", "z_m",
    "width_m", "depth_m", "height_m", "mass_kg",
  ]];
  rows.push(["NOTICE", modelCode, "ULD_PREVIEW_ONLY_NOT_AIRCRAFT_LOADING_APPROVAL", "", "", "", "", "", "", ""]);
  for (const b of plan.placed) {
    rows.push(["CARTON", modelCode, b.label,
      String(b.x), String(b.y), String(b.z),
      String(b.widthM), String(b.depthM), String(b.heightM), String(b.massKg)]);
  }
  for (const c of signature.cells) {
    rows.push(["MASS_CELL", modelCode, `row${c.row}-col${c.column}`,
      "", "", "", "", "", "", c.kg.toFixed(4)]);
  }
  if (signature.centroid) {
    rows.push(["WEIGHTED_CENTROID", modelCode, "visual estimate",
      String(signature.centroid.x), String(signature.centroid.y),
      String(signature.centroid.z), "", "", "", String(signature.totalKg)]);
  }
  return rows.map(row => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

/** A per-carton plan-view allocation; geometric projection, NOT transferred floor loading. */
function projectedMassForCell(
  box: CargoPlacement,
  core: CargoCore,
  row: number,
  column: number,
): number {
  if (![box.x, box.y, box.z, box.widthM, box.depthM, box.heightM, box.massKg]
    .every(Number.isFinite) ||
    box.widthM <= 0 || box.depthM <= 0 || box.heightM <= 0 || box.massKg <= 0 ||
    !Number.isFinite(core.widthM) || !Number.isFinite(core.depthM) ||
    core.widthM <= 0 || core.depthM <= 0 ||
    row < 0 || row > 2 || column < 0 || column > 2 ||
    !Number.isInteger(row) || !Number.isInteger(column)) return 0;

  const spanX = core.widthM / 3;
  const spanZ = core.depthM / 3;
  const left = box.x - box.widthM / 2;
  const right = box.x + box.widthM / 2;
  const near = box.z - box.depthM / 2;
  const far = box.z + box.depthM / 2;
  const x0 = core.minX + column * spanX;
  const z0 = core.minZ + row * spanZ;
  const dx = Math.max(0, Math.min(right, x0 + spanX) - Math.max(left, x0));
  const dz = Math.max(0, Math.min(far, z0 + spanZ) - Math.max(near, z0));
  return box.massKg * dx * dz / (box.widthM * box.depthM);
}

export interface CargoZoneContributor {
  id: string;
  label: string;
  cartonMassKg: number;
  /** Mass allocated by horizontal overlap with the zone, including stacked cartons. */
  projectedKg: number;
  sharePct: number;
  verticalLayer: PreviewVerticalLayer;
}

export interface CargoZoneBreakdown {
  row: number;
  column: number;
  projectedKg: number;
  /** Projected mass / grid-cell area, NOT floor pressure. */
  projectedKgPerM2: number;
  contributors: CargoZoneContributor[];
}

/** Explain the existing 3×3 field using its exact same overlap allocation. */
export function getCargoZoneBreakdown(
  plan: Pick<CargoPlan, "placed">,
  core: CargoCore,
  row: number,
  column: number,
): CargoZoneBreakdown {
  const area = core.widthM * core.depthM / 9;
  const contributions = plan.placed.flatMap(box => {
    const allocated = projectedMassForCell(box, core, row, column);
    if (!(allocated > 0)) return [];
    const layer = projectedCartonMetrics(box, core.floorY).layer;
    return [{
      id: box.id, label: box.label, cartonMassKg: box.massKg,
      projectedKg: allocated, sharePct: 0, verticalLayer: layer,
    }];
  });
  const projectedKg = contributions.reduce((sum, item) => sum + item.projectedKg, 0);
  const contributors = contributions
    .map(item => ({
      ...item, sharePct: projectedKg > 0 ? item.projectedKg / projectedKg * 100 : 0,
    }))
    .sort((a, b) => b.projectedKg - a.projectedKg || a.id.localeCompare(b.id));
  return {
    row, column, projectedKg,
    projectedKgPerM2: area > 0 && Number.isFinite(area) ? projectedKg / area : 0,
    contributors,
  };
}

export function computeCargoSignature(
  plan: Pick<CargoPlan, "placed">,
  core: CargoCore,
): CargoSignature {
  const cells: CargoFieldCell[] = Array.from({ length: 9 }, (_, i) => ({
    row: Math.floor(i / 3),
    column: i % 3,
    kg: 0,
    kgPerM2: 0,
  }));
  const area = core.widthM * core.depthM / 9;
  let mass = 0, mx = 0, my = 0, mz = 0;

  for (const box of plan.placed) {
    if (![box.x, box.y, box.z, box.widthM, box.depthM, box.heightM, box.massKg]
      .every(Number.isFinite) ||
      box.widthM <= 0 || box.depthM <= 0 || box.heightM <= 0 || box.massKg <= 0) continue;
    mass += box.massKg;
    mx += box.massKg * box.x;
    my += box.massKg * box.y;
    mz += box.massKg * box.z;

    for (const cell of cells) {
      cell.kg += projectedMassForCell(box, core, cell.row, cell.column);
    }
  }

  for (const cell of cells) cell.kgPerM2 = area > 0 ? cell.kg / area : 0;
  const centroid = mass > 0 ? { x: mx / mass, y: my / mass, z: mz / mass } : null;
  const centerX = core.minX + core.widthM / 2;
  const centerZ = core.minZ + core.depthM / 2;
  return {
    totalKg: mass,
    centroid,
    lateralOffsetPct: centroid && core.widthM > 0
      ? (centroid.x - centerX) / core.widthM * 100 : 0,
    longitudinalOffsetPct: centroid && core.depthM > 0
      ? (centroid.z - centerZ) / core.depthM * 100 : 0,
    cells,
    maxCellKg: Math.max(0, ...cells.map(c => c.kg)),
    peakKgPerM2: Math.max(0, ...cells.map(c => c.kgPerM2)),
  };
}
