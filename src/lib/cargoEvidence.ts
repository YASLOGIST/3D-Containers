/**
 * Provenance-aware assessment of an illustrative cargo placement.
 * All values are sourced from the model registry and sandbox planner.
 * No OEM structural, restraint, aircraft or operational limits are inferred.
 */
import { MODELS, type ModelId } from "../three/models";
import type { CargoItem, CargoPlan } from "./cargoPlacement";

export type EvidenceBasis = "registry-reference" | "geometric-preview" | "requires-external-evidence";
export type EvidenceStatus =
  | "within-reference" | "exceeds-reference"
  | "preview-placed" | "preview-rejected"
  | "not-run" | "not-evaluated" | "not-verified";

export interface CargoEvidenceCheck {
  id: string;
  name: string;
  basis: EvidenceBasis;
  status: EvidenceStatus;
  explanation: string;
  evidence: string;
}

export interface CargoEvidenceReport {
  model: ModelId;
  /** This report cannot assert approval, independently of simulated checks. */
  operationallyApproved: false;
  submittedCartons: number;
  placedCartons: number;
  rejectedCartons: number;
  requestedMassKg: number | null;
  acceptedMassKg: number;
  nominalPayloadKg: number;
  checks: CargoEvidenceCheck[];
}

/** Pure evidence classification; it must never mutate or re-plan the cargo. */
export function assessCargoEvidence(
  model: ModelId, items: readonly CargoItem[], plan: CargoPlan,
): CargoEvidenceReport {
  const rating = MODELS[model].ratings;
  // Invalid input must not turn into a misleading finite "pass" because the
  // planner ignores rejected cartons. Evaluate submitted, not only placed mass.
  const validMass = items.every(item => Number.isFinite(item.massKg) && item.massKg > 0);
  const requestedMassKg = validMass
    ? items.reduce((sum, item) => sum + item.massKg, 0)
    : null;
  const finiteRequested = requestedMassKg !== null && Number.isFinite(requestedMassKg);
  const nominalStatus: EvidenceStatus = !items.length
    ? "not-run"
    : !finiteRequested
      ? "not-evaluated"
      : requestedMassKg! > rating.payloadKg + 1e-6
        ? "exceeds-reference"
        : "within-reference";
  const placed = plan.placed.length, rejected = plan.rejected.length;
  const placementStatus: EvidenceStatus = !items.length ? "not-run"
    : rejected > 0 || placed !== items.length ? "preview-rejected" : "preview-placed";
  const checks: CargoEvidenceCheck[] = [
    {
      id: "nominal-payload",
      name: "Requested mass vs nominal payload",
      basis: "registry-reference",
      status: nominalStatus,
      explanation: nominalStatus === "not-run" ? "Add cargo to compare its requested mass."
        : nominalStatus === "not-evaluated" ? "Invalid or non-finite submitted mass; comparison unavailable."
        : `${requestedMassKg!.toFixed(1)} kg requested / ${rating.payloadKg.toFixed(1)} kg registry payload. ${nominalStatus === "exceeds-reference" ? "Requested mass exceeds the reference." : "Within the registry number only."}`,
      evidence: "ULD360 model registry reference rating — OEM source/variant approval is not established.",
    },
    {
      id: "preview-placement",
      name: "Conservative 3D placement",
      basis: "geometric-preview",
      status: placementStatus,
      explanation: placementStatus === "not-run" ? "No carton placement has been attempted."
        : `${placed} placed, ${rejected} rejected of ${items.length} submitted. The preview uses axis-aligned boxes, sampled inner-core clearance and a first-fit rule.`,
      evidence: "ULD360 first-fit preview planner; not a certified cargo securing or load plan.",
    },
    {
      id: "floor-strength",
      name: "Floor strength / concentrated loads",
      basis: "requires-external-evidence",
      status: "not-verified",
      explanation: "No OEM floor rating, dynamic load or stack-strength evidence is supplied for this configuration.",
      evidence: "Requires manufacturer ULD configuration documents and verified floor/stack load limits.",
    },
    {
      id: "restraints",
      name: "Restraints, nets and attachment points",
      basis: "requires-external-evidence",
      status: "not-verified",
      explanation: "Geometric support does not validate restraint forces, net strength or attachment integrity.",
      evidence: "Requires approved restraint specifications, hardware and cargo-securing procedures.",
    },
    {
      id: "aircraft",
      name: "Aircraft / hold compatibility",
      basis: "requires-external-evidence",
      status: "not-verified",
      explanation: "Nominal aircraft references are schematic; individual aircraft clearance is not verified.",
      evidence: "Requires operator-approved aircraft loading and ULD compatibility documents.",
    },
    {
      id: "trim",
      name: "Aircraft balance / load distribution approval",
      basis: "requires-external-evidence",
      status: "not-verified",
      explanation: "The 3×3 mass footprint estimates carton distribution, not aircraft trim or allowable load position.",
      evidence: "Requires aircraft weight-and-balance data, operational rules and approved loading plan.",
    },
  ];
  if (MODELS[model].reeferOption) {
    checks.push({
      id: "temperature",
      name: "Temperature-control performance",
      basis: "requires-external-evidence",
      status: "not-verified",
      explanation: "No qualified thermal endurance, power or cargo temperature validation is supplied.",
      evidence: "Requires the specific refrigerated ULD certification, operational and thermal records.",
    });
  }
  return {
    model, operationallyApproved: false, submittedCartons: items.length,
    placedCartons: placed, rejectedCartons: rejected,
    requestedMassKg: finiteRequested ? requestedMassKg : null,
    acceptedMassKg: plan.loadedKg, nominalPayloadKg: rating.payloadKg,
    checks,
  };
}
