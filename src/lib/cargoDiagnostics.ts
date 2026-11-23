import { cargoCoreForModel, type CargoItem, type CargoPlan } from "./cargoPlacement";
import { MODELS, type ModelId } from "../three/models";

export type CartonStatus = "placed" | "rejected";
export type CartonDiagnosticReason =
  | "placed" | "invalid" | "oversize" | "overweight" | "no-space" | "preview-limit";

export interface CartonDiagnostic {
  index: number;
  id: string;
  label: string;
  status: CartonStatus;
  reason: CartonDiagnosticReason;
  title: string;
  explanation: string;
  nextStep: string;
  massKg: number;
  volumeM3: number | null;
  densityKgM3: number | null;
  /** Preview-core-relative centre, not aircraft station coordinates. */
  centreM: { x: number; y: number; z: number } | null;
}

export interface CartonDiagnostics {
  model: ModelId;
  total: number;
  placed: number;
  rejected: number;
  rows: CartonDiagnostic[];
  /** Explicitly false: the preview cannot issue an operational certificate. */
  operationallyApproved: false;
}

const MAX_PREVIEW_CARTONS = 40;
const positive = (value: number) => Number.isFinite(value) && value > 0;
const measurement = (value: number) => positive(value) ? value.toFixed(2) : "invalid";
const axisName = { widthM: "width", depthM: "depth", heightM: "height" } as const;

/**
 * Explain the existing first-fit outcome; do not infer physical stacking,
 * certified floor strength, aircraft trim or an alternative valid packing.
 */
export function diagnoseCartons(
  model: ModelId,
  items: readonly CargoItem[],
  plan: CargoPlan,
  contour = true,
): CartonDiagnostics {
  const core = cargoCoreForModel(model, contour);
  const nominalPayload = MODELS[model].ratings.payloadKg;
  const placedById = new Map(plan.placed.map(item => [item.id, item]));
  const rejectedById = new Map(plan.rejected.map(r => [r.item.id, r.reason]));
  let priorPlacedMass = 0;
  const rows = items.map((item, index): CartonDiagnostic => {
    const placed = placedById.get(item.id);
    const rejected = rejectedById.get(item.id);
    const validDimensions = positive(item.widthM) && positive(item.depthM) && positive(item.heightM);
    const v = validDimensions ? item.widthM * item.depthM * item.heightM : NaN;
    const volumeM3 = positive(v) && Number.isFinite(v) ? v : null;
    const density = volumeM3 != null && positive(item.massKg) ? item.massKg / volumeM3 : NaN;
    const densityKgM3 = positive(density) && Number.isFinite(density) ? density : null;
    const common = {
      index: index + 1,
      id: item.id,
      label: item.label,
      massKg: item.massKg,
      volumeM3,
      densityKgM3,
    };
    if (placed) {
      priorPlacedMass += item.massKg;
      return {
        ...common, status: "placed", reason: "placed",
        title: "Position found in preview",
        explanation: "The first-fit preview found a non-overlapping, heuristically supported position within its conservative core.",
        nextStep: "Inspect the model and mass field. This does not verify the real load, supports, restraints or stacking strength.",
        centreM: {
          x: placed.x - core.minX,
          y: placed.y - core.floorY,
          z: placed.z - core.minZ,
        },
      };
    }

    // Items beyond 40 are not searched; the planner currently labels them
    // 'no-space'. Distinguish the UI explanation from a geometry failure.
    if (index >= MAX_PREVIEW_CARTONS) {
      return {
        ...common, status: "rejected", reason: "preview-limit",
        title: "40-carton preview limit",
        explanation: "The demo planner did not attempt placement because this item exceeds its 40-carton preview limit.",
        nextStep: "Remove earlier items before retrying. This is a software preview limit, not a ULD capacity rating.",
        centreM: null,
      };
    }
    if (rejected === "invalid") {
      const invalidFields = [
        ["width", item.widthM], ["depth", item.depthM],
        ["height", item.heightM], ["mass", item.massKg],
      ].filter(([, val]) => !positive(val as number)).map(([name]) => name);
      return {
        ...common, status: "rejected", reason: "invalid",
        title: "Invalid carton values",
        explanation: "Invalid or non-positive: " + (invalidFields.join(", ") || "carton input") + ". All dimensions and mass must be positive finite numbers.",
        nextStep: "Correct the listed values and add the carton again.",
        centreM: null,
      };
    }
    if (rejected === "oversize") {
      const exceeded = (Object.keys(axisName) as Array<keyof typeof axisName>)
        .filter(axis => item[axis] > core[axis] + 1e-6)
        .map(axis => axisName[axis] + " " + measurement(item[axis]) + " m > " + measurement(core[axis]) + " m");
      return {
        ...common, status: "rejected", reason: "oversize",
        title: "Outside conservative preview core",
        explanation: "Exceeded: " + (exceeded.join("; ") || "one or more conservative dimensions") + ".",
        nextStep: "Reduce the relevant dimension or choose another ULD. Carton rotation and real interior clearances are not validated.",
        centreM: null,
      };
    }
    if (rejected === "overweight") {
      const remainingKg = Math.max(0, nominalPayload - priorPlacedMass);
      return {
        ...common, status: "rejected", reason: "overweight",
        title: "Exceeds remaining nominal payload",
        explanation: measurement(item.massKg) + " kg requested; " + measurement(remainingKg) +
          " kg nominal reference remainder at this step (previously placed: " + measurement(priorPlacedMass) + " kg).",
        nextStep: "Reduce requested mass or revise the manifest. Real ULD/aircraft loading approval is not evaluated.",
        centreM: null,
      };
    }
    if (rejected === "no-space") {
      return {
        ...common, status: "rejected", reason: "no-space",
        title: "No location found by first-fit",
        explanation: "No non-overlapping, heuristically supported location was found using this item order and unrotated cartons.",
        nextStep: "Try a smaller carton or revise the insertion order. This result does not prove that no valid loading arrangement exists.",
        centreM: null,
      };
    }
    // A conservative fallback if the supplied plan is stale or incomplete.
    return {
      ...common, status: "rejected", reason: "no-space",
      title: "Placement result unavailable",
      explanation: "The manifest and preview result do not match. No load position is claimed.",
      nextStep: "Re-run the preview and review the manifest before interpreting the result.",
      centreM: null,
    };
  });
  return {
    model, total: items.length, placed: rows.filter(row => row.status === "placed").length,
    rejected: rows.filter(row => row.status === "rejected").length,
    rows, operationallyApproved: false,
  };
}

function cell(value: string): string {
  // Spreadsheet viewers may evaluate formula-like labels from user input.
  const safe = /^[=+@\-\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}

/** CSV is a descriptive sandbox report; it does not certify flight loading. */
export function exportCartonDiagnosticsCSV(report: CartonDiagnostics): string {
  const header = [
    "ULD","Item","ID","Label","Preview status","Reason","Mass kg",
    "Carton volume m3","Carton density kg/m3","Centre X m (preview core)",
    "Centre Y m (preview core)","Centre Z m (preview core)","Explanation","Next step",
  ];
  const num = (value: number | null, dp = 3) => value != null && Number.isFinite(value)
    ? value.toFixed(dp) : "";
  const rows = report.rows.map(row => [
    report.model.toUpperCase(), String(row.index), row.id, row.label,
    row.status, row.reason, num(row.massKg), num(row.volumeM3, 4),
    num(row.densityKgM3, 2), num(row.centreM?.x ?? null),
    num(row.centreM?.y ?? null), num(row.centreM?.z ?? null),
    row.explanation, row.nextStep,
  ].map(cell).join(","));
  return [
    header.map(cell).join(","),
    ...rows,
    "",
    cell("LIMITATION") + "," + cell("ILLUSTRATIVE 3D FIRST-FIT PREVIEW — NOT CERTIFIED FOR ULD OR AIRCRAFT LOADING"),
    cell("NOT CHECKED") + "," + cell("Floor strength, restraint loads, aircraft approval, stacking strength, and dynamic cargo forces"),
  ].join("\r\n") + "\r\n";
}
