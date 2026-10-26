import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * alp.ts — ALP · LD-11 full-width rectangular lower-deck container.
 *
 * Certified envelope (EUAS / ACL Airshop / Astracon published sheets):
 *   125 × 60.4 in base (3175 × 1534 mm), height 64 in (1626 mm), NO contour
 *   — the LD-6 footprint with vertical walls, trading the fuselage wedge
 *   for a plain rectangular box that cubes out perfectly. Internal volume
 *   ≈ 7.2 m³, tare ≈ 185 kg, max gross 3176 kg. Suitable for 747/777/787
 *   and DC-10/MD-11 lower holds.
 */

export const ALP_DIMENSIONS = {
  baseWidth: 3.175,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 3.175,
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function alpProfile(): V2[] {
  const d = ALP_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createALPContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = ALP_DIMENSIONS;
  return createProfileContainer(
    {
      code: "ALP",
      typeName: "LD-11 LOWER DECK",
      slopeLabel: "VERTICAL WALLS",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 185,
      maxGrossKg: 3176,
      iataVolumeM3: 7.2,
      plateId: "ALP 11125",
      plateCarrier: "YL",
      plateSerial: "ALP11125YL-1125",
    },
    options,
  );
}
