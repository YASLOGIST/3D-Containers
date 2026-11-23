/**
 * Plan-view footprint indicators of the illustrative 3D preview.
 *
 * The denominator is the carton axis-aligned horizontal projection. It is
 * NOT a verified contact patch, transferred floor load, floor pressure,
 * stacking support reaction, airworthiness or restraint calculation.
 */
import type { CargoPlacement } from "./cargoPlacement";

export type PreviewVerticalLayer = "preview-floor" | "above-preview-floor" | "unknown";

export interface ProjectedCartonMetrics {
  /** Axis-aligned carton horizontal projection in m², not a measured contact patch. */
  planAreaM2: number | null;
  /** Nominal carton mass ÷ projected plan area; not pressure or floor loading. */
  arealMassIndexKgM2: number | null;
  /** Height of the carton base above the sandbox reference floor. */
  baseAboveFloorM: number | null;
  layer: PreviewVerticalLayer;
}

type ProjectedInputs = Pick<CargoPlacement, "widthM" | "depthM" | "heightM" | "massKg" | "y">;

const valid = (n: number) => Number.isFinite(n) && n > 0;
const EPS_M = 1e-5;

/** Pure and bounded; never invents support forces from a geometric overlap. */
export function projectedCartonMetrics(
  carton: ProjectedInputs,
  previewFloorY: number,
): ProjectedCartonMetrics {
  const missing: ProjectedCartonMetrics = {
    planAreaM2: null, arealMassIndexKgM2: null, baseAboveFloorM: null, layer: "unknown",
  };
  if (![carton.widthM, carton.depthM, carton.heightM, carton.massKg].every(valid)) return missing;
  const area = carton.widthM * carton.depthM;
  const ratio = carton.massKg / area;
  if (!valid(area) || !valid(ratio)) return missing;
  if (!Number.isFinite(carton.y) || !Number.isFinite(previewFloorY)) {
    return { ...missing, planAreaM2: area, arealMassIndexKgM2: ratio };
  }
  const unrounded = carton.y - carton.heightM / 2 - previewFloorY;
  if (!Number.isFinite(unrounded) || unrounded < -EPS_M) {
    return { ...missing, planAreaM2: area, arealMassIndexKgM2: ratio };
  }
  const baseAboveFloorM = Math.max(0, unrounded);
  return {
    planAreaM2: area,
    arealMassIndexKgM2: ratio,
    baseAboveFloorM,
    layer: baseAboveFloorM <= EPS_M ? "preview-floor" : "above-preview-floor",
  };
}
