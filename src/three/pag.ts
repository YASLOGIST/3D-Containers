import { createPallet, palletProfile, type BuildOptions, type PalletSpec } from "./pmc";
import type { V2, ViewerContainer } from "./primitives";

/**
 * pag.ts — PAG · P1P 88 × 125 in certified pallet.
 *
 * Certified base (DSV / cargo industry sheets): 3175 × 2235 mm (125 × 88 in),
 * tare ≈ 110 kg, max gross 6033 kg on the main deck (4626 kg lower hold).
 * Built by the shared pallet engine in pmc.ts with the P1P spec. The
 * netted build contour here uses the common 162 cm lower-deck height.
 */

export const PAG_DIMENSIONS = {
  width: 3.175,
  depth: 2.235,
  thickness: 0.05,
  contourHeight: 1.62,
} as const;

export const PAG_SPEC: PalletSpec = {
  code: "PAG",
  groupTag: "PAG_P1P",
  width: PAG_DIMENSIONS.width,
  depth: PAG_DIMENSIONS.depth,
  thickness: PAG_DIMENSIONS.thickness,
  contourHeight: PAG_DIMENSIONS.contourHeight,
  tareKg: 110,
  maxGrossKg: 6033,
  plateId: "PAG 1877",
  plateCarrier: "YL",
  plateSerial: "PAG1877YL-0187",
};

export function pagProfile(): V2[] {
  return palletProfile(PAG_SPEC);
}

export function createPAGContainer(options: Partial<BuildOptions> = {}): ViewerContainer {
  return createPallet(PAG_SPEC, options);
}
