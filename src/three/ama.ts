import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import type { V2, ViewerContainer } from "./primitives";

/**
 * ama.ts — AMA · M-1 main-deck container (widebody freighters).
 *
 * Certified envelope (Dokasch / Jettainer / Astracon published sheets):
 *   M base 96 × 125 in (2438 × 3175 mm) — the PMC/P6P footprint — height
 *   96 in (2438 mm), contour "A": vertical walls with chamfered upper
 *   corners under a flat roof (the chamfer clears the 747F crown). Storage
 *   volume 17.6 m³ (AS1825), tare ≈ 314 kg, max gross 6804 kg.
 * The 2.60 m roof flat and 1.95 m knee are nominal modelling choices: no
 * manufacturer publishes the chamfer break, so they approximate the 96 in
 * contour-A envelope (≈ 30° chamfer from vertical). Profile runs across X
 * on the 3175 mm side so the unit compares directly with the PMC pallet.
 */

export const AMA_DIMENSIONS = {
  baseWidth: 3.175,
  baseLength: 2.438,
  height: 2.438,
  /** roof flat width (chamfered-down from the base width) */
  topWidth: 2.6,
  kneeHeight: 1.95,
} as const;

export function amaProfile(): V2[] {
  const d = AMA_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createAMAContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AMA_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AMA",
      typeName: "M-1 MAIN DECK",
      slopeLabel: "30.5° ROOF CHAMFER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 314,
      maxGrossKg: 6804,
      iataVolumeM3: 17.6,
      plateId: "AMA 96125",
      plateCarrier: "YL",
      plateSerial: "AMA96125YL-0961",
    },
    options,
  );
}
