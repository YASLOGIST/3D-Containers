import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * aqp.ts — AQP · LD-4 rectangular lower-deck container.
 *
 * Certified envelope (EUAS / ACL Airshop / Bringer published sheets):
 *   96 × 60.4 in base (2438 × 1534 mm), height 64 in (1626 mm), NO contour
 *   — the LD-8 silhouette with vertical walls: the middle sibling of the
 *   767 lower-deck trio (DPE · LD-2 half / DQF · LD-8 contoured / AQP · LD-4
 *   rectangular). Internal volume ≈ 5.5 m³, tare ≈ 120 kg, max gross
 *   2449 kg. Suitable for 767/777/787 lower holds.
 */

export const AQP_DIMENSIONS = {
  baseWidth: 2.438,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 2.438,
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function aqpProfile(): V2[] {
  const d = AQP_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createAQPContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AQP_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AQP",
      typeName: "LD-4 LOWER DECK",
      slopeLabel: "VERTICAL WALLS",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 120,
      maxGrossKg: 2449,
      iataVolumeM3: 5.5,
      plateId: "AQP 4108",
      plateCarrier: "YL",
      plateSerial: "AQP4108YL-0418",
    },
    options,
  );
}
