import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import type { V2, ViewerContainer } from "./primitives";

/**
 * aga.ts — AGA · M-2 20-ft main-deck box (747F / 747 Combi, 777F centre).
 *
 * Certified envelope (Bringer / Shapiro IATA guide / Qubictron tables):
 *   96 × 238.5 in base (2438 × 6058 mm — the PGA 20-ft pallet footprint),
 *   height 96 in (2438 mm), AS1825 volume 33.7 m³, tare ≈ 1000 kg,
 *   max gross 11,340 kg (25,000 lb). The largest rigid box in the fleet:
 *   two M-1 footprints long. Roof chamfer break (1.90 m) and 1.90 m roof
 *   flat are nominal modelling choices (unpublished), sized so the live
 *   geometric volume lands on the certified figure. Profile runs across
 *   the 96 in width; the 6.06 m length extrudes along Z with the door on
 *   the end face, as on the real unit.
 */

export const AGA_DIMENSIONS = {
  baseWidth: 2.438,
  baseLength: 6.058,
  height: 2.438,
  /** roof flat width (nominal) */
  topWidth: 1.9,
  kneeHeight: 1.9,
} as const;

export function agaProfile(): V2[] {
  const d = AGA_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createAGAContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AGA_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AGA",
      typeName: "M-2 20FT MAIN DECK",
      slopeLabel: "26.6° ROOF CHAMFER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 1000,
      maxGrossKg: 11340,
      iataVolumeM3: 33.7,
      plateId: "AGA 20238",
      plateCarrier: "YL",
      plateSerial: "AGA20238YL-6058",
    },
    options,
  );
}
