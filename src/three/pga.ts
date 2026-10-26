import { createPallet, palletProfile, type BuildOptions, type PalletSpec } from "./pmc";
import type { V2, ViewerContainer } from "./primitives";

/**
 * pga.ts — PGA 20 ft certified pallet (96 × 238.5 in).
 *
 * Certified base (Nordisk Aviation / industry sheets, NAS 3610 2G1P):
 * 6058 × 2438 mm (238.5 × 96 in), tare from ≈ 541 kg, max gross
 * 13608 kg (30,000 lb). Main-deck only on the 747F — the heavy-haul base
 * for vehicles, engines and outsize machinery. Built by the shared
 * pallet engine in pmc.ts with the PGA spec; the netted contour uses
 * the standard 244 cm main-deck build height.
 */

export const PGA_DIMENSIONS = {
  width: 6.058,
  depth: 2.438,
  thickness: 0.05,
  contourHeight: 2.438,
} as const;

export const PGA_SPEC: PalletSpec = {
  code: "PGA",
  groupTag: "PGA_20FT",
  width: PGA_DIMENSIONS.width,
  depth: PGA_DIMENSIONS.depth,
  thickness: PGA_DIMENSIONS.thickness,
  contourHeight: PGA_DIMENSIONS.contourHeight,
  tareKg: 541,
  maxGrossKg: 13608,
  plateId: "PGA 2054",
  plateCarrier: "YL",
  plateSerial: "PGA2054YL-0205",
};

export function pgaProfile(): V2[] {
  return palletProfile(PGA_SPEC);
}

export function createPGAContainer(options: Partial<BuildOptions> = {}): ViewerContainer {
  return createPallet(PGA_SPEC, options);
}
