/**
 * planner.ts — pure load-planning arithmetic for the specification sheet.
 *
 * Every result is an ESTIMATE derived from the registry's certified ratings
 * (tare, max gross, rated volume). It is a planning aid for comparing ULD
 * families, never a substitute for a certified load sheet: real limits also
 * depend on aircraft position, restraint, contour and centre-of-gravity.
 */

export interface PlanInput {
  tareKg: number;
  maxGrossKg: number;
  payloadKg: number;
  /** certified usable cargo volume, m³ */
  volumeM3: number;
  cargoKg: number;
  cargoM3: number;
  /** IATA volumetric divisor, cm³/kg (6000 standard, 5000 express) */
  divisor: number;
}

export type PlanStatus = "empty" | "ok" | "overweight" | "overvolume" | "both";

export interface PlanResult {
  grossKg: number;
  remainingKg: number;
  payloadPct: number;
  volumePct: number;
  /** volumetric (dimensional) weight of the cargo volume, kg */
  volumetricKg: number;
  /** what an airline charges on: the heavier of actual vs volumetric */
  chargeableKg: number;
  /** cargo density; null when no volume is entered */
  densityKgM3: number | null;
  /** density at which this ULD reaches payload and volume limits together */
  criticalDensityKgM3: number;
  status: PlanStatus;
  /** which limit binds first for cargo of this density */
  limiting: "weight" | "volume" | "balanced";
}

const EPS = 1e-9;

export function computePlan(input: PlanInput): PlanResult {
  const cargoKg = Math.max(0, input.cargoKg);
  const cargoM3 = Math.max(0, input.cargoM3);
  const payloadKg = Math.max(0, input.payloadKg);
  const volumeM3 = Math.max(0, input.volumeM3);
  const divisor = input.divisor > 0 ? input.divisor : 6000;

  const grossKg = input.tareKg + cargoKg;
  const volumetricKg = (cargoM3 * 1_000_000) / divisor;
  const densityKgM3 = cargoM3 > EPS ? cargoKg / cargoM3 : null;
  const criticalDensityKgM3 = volumeM3 > EPS ? payloadKg / volumeM3 : 0;

  const overWeight = cargoKg > payloadKg + EPS;
  const overVolume = cargoM3 > volumeM3 + EPS;
  const status: PlanStatus =
    cargoKg <= EPS && cargoM3 <= EPS
      ? "empty"
      : overWeight && overVolume
        ? "both"
        : overWeight
          ? "overweight"
          : overVolume
            ? "overvolume"
            : "ok";

  const limiting: PlanResult["limiting"] =
    densityKgM3 === null || criticalDensityKgM3 <= EPS
      ? "balanced"
      : densityKgM3 > criticalDensityKgM3 * 1.05
        ? "weight"
        : densityKgM3 < criticalDensityKgM3 * 0.95
          ? "volume"
          : "balanced";

  return {
    grossKg,
    remainingKg: payloadKg - cargoKg,
    payloadPct: payloadKg > EPS ? (cargoKg / payloadKg) * 100 : 0,
    volumePct: volumeM3 > EPS ? (cargoM3 / volumeM3) * 100 : 0,
    volumetricKg,
    chargeableKg: Math.max(cargoKg, volumetricKg),
    densityKgM3,
    criticalDensityKgM3,
    status,
    limiting,
  };
}
