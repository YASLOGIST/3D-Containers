import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * aap.ts — AAP · LD-9 rectangular P1P-base container.
 *
 * Certified envelope (DSV / AviusULD / Qantas / Nordisk published sheets):
 *   125 × 88 in base (3175 × 2235 mm), height 64 in (1626 mm), contour
 *   code P = rectangular — a rigid box on the P1P pallet base, the
 *   biggest-volume rigid lower-deck unit. AS 1825 volume ≈ 10.8 m³,
 *   tare ≈ 270 kg (rigid door), max gross 6033 kg (4626 kg operationally
 *   in lower holds). Suitable for 747/777/A350/A380 lower holds and
 *   main decks. Door on the 125 in side, as published (2928 × 1474 mm).
 */

export const AAP_DIMENSIONS = {
  baseWidth: 3.175,
  baseLength: 2.235,
  height: 1.626,
  topWidth: 3.175,
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function aapProfile(): V2[] {
  const d = AAP_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createAAPContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AAP_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AAP",
      typeName: "LD-9 LOWER DECK",
      slopeLabel: "VERTICAL WALLS",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 270,
      maxGrossKg: 6033,
      iataVolumeM3: 10.8,
      plateId: "AAP 9031",
      plateCarrier: "YL",
      plateSerial: "AAP9031YL-0931",
    },
    options,
  );
}
