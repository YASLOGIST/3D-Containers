import { MODELS, type ModelId, type ModelInfo } from "../three/models";

export type ModelCatalogFilter = "all" | "lower" | "main" | "pallet" | "reefer";

export const MODEL_CATALOG_FILTERS: ReadonlyArray<{
  id: ModelCatalogFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "lower", label: "Lower deck" },
  { id: "main", label: "Main deck" },
  { id: "pallet", label: "Pallets" },
  { id: "reefer", label: "Refrigerated" },
];

/**
 * Search the reference catalogue without altering ULD ratings or the model.
 * Deck groups are derived from the registry's schematic hold placement,
 * not an approved aircraft loading/compatibility list.
 */
export function filterModelCatalog(
  query: string,
  filter: ModelCatalogFilter = "all",
): ModelId[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (Object.keys(MODELS) as ModelId[]).filter((id) => {
    const m = MODELS[id];
    const groupMatches =
      filter === "all" ||
      (filter === "lower" && m.hold.deck === "lower") ||
      (filter === "main" && m.hold.deck === "main") ||
      (filter === "pallet" && m.palletOption) ||
      (filter === "reefer" && m.reeferOption);
    if (!groupMatches) return false;
    const text = [
      m.code, m.name, m.family, m.aircraft, m.featureLabel,
      m.volumeLabel, m.hold.aircraft, m.sourceFile,
    ].join(" ").toLowerCase();
    return tokens.every(token => text.includes(token));
  });
}

/** Read-only sharing of the same reference data shown by the workbench. */
export function formatModelReferenceBrief(m: ModelInfo): string {
  const d = m.dims;
  const r = m.ratings;
  const lines = [
    "YASLOGIST ULD360 — REFERENCE TECHNICAL BRIEF",
    m.name + " | " + m.family,
    "",
    "NOMINAL ENVELOPE",
    "Base width: " + d.width.toFixed(3) + " m",
    "Depth: " + d.depth.toFixed(3) + " m",
    (m.palletOption ? "Pallet thickness" : "Height") + ": " + d.height.toFixed(3) + " m",
    "Top width: " + d.topWidth.toFixed(3) + " m",
    ...(d.contourHeight !== undefined
      ? ["Illustrative cargo contour height: " + d.contourHeight.toFixed(3) + " m"]
      : []),
    "",
    "REFERENCE RATINGS",
    "Tare: " + r.tareKg + " kg",
    "Maximum gross: " + r.maxGrossKg + " kg",
    "Net payload: " + r.payloadKg + " kg",
    "Volume: " + r.volumeM3.toFixed(2) + " m³",
    "",
    "REGISTRY DETAILS",
    ...m.specs.map(s => s.k + ": " + s.v),
    "Nominal aircraft applicability (registry): " + m.aircraft,
    "Feature: " + m.featureLabel,
    "",
    "Illustrative reference only. NOT an OEM-approved ULD specification,",
    "aircraft compatibility clearance, loading plan, or restraint approval.",
    "Validate the specific unit, aircraft position, and manufacturer data.",
  ];
  return lines.join("\n");
}
