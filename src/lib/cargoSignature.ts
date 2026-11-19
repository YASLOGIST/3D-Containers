/**
 * Cargo field diagnostics for the conservative visual loading sandbox.
 * These values describe only the preview cartons, not aircraft limits,
 * ULD floor strength, restraint forces, or certified balance.
 */
import type { CargoCore, CargoPlan } from "./cargoPlacement";

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
  const spanX = core.widthM / 3;
  const spanZ = core.depthM / 3;
  const area = spanX * spanZ;
  let mass = 0, mx = 0, my = 0, mz = 0;

  for (const box of plan.placed) {
    if (![box.x, box.y, box.z, box.widthM, box.depthM, box.heightM, box.massKg]
      .every(Number.isFinite) ||
      box.widthM <= 0 || box.depthM <= 0 || box.heightM <= 0 || box.massKg <= 0) continue;
    mass += box.massKg;
    mx += box.massKg * box.x;
    my += box.massKg * box.y;
    mz += box.massKg * box.z;

    const left = box.x - box.widthM / 2;
    const right = box.x + box.widthM / 2;
    const near = box.z - box.depthM / 2;
    const far = box.z + box.depthM / 2;
    const footprint = box.widthM * box.depthM;
    for (const cell of cells) {
      const x0 = core.minX + cell.column * spanX;
      const z0 = core.minZ + cell.row * spanZ;
      const dx = Math.max(0, Math.min(right, x0 + spanX) - Math.max(left, x0));
      const dz = Math.max(0, Math.min(far, z0 + spanZ) - Math.max(near, z0));
      cell.kg += box.massKg * dx * dz / footprint;
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
