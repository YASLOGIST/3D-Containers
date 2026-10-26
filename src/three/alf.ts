import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * alf.ts — ALF · LD6 full-width lower-deck container (widebody).
 *
 * Certified envelope (AviusULD / Astracon / DSV published sheets):
 *   base 60.4 × 125 in (1534 × 3175 mm), height 64 in (1626 mm), roof contour
 *   160 in (4064 mm) overall — effectively two LD-3 contours mirrored, so
 *   each wing slopes at the LD-3's ≈ 16° for the full height (no knee).
 *   Internal volume ≈ 8.95 m³, tare ≈ 230 kg, max gross 3175 kg (AS36100
 *   2L5C). The door spans the 125 in long side, matching the published
 *   2959 mm door opening. Orientation follows the project convention:
 *   profile across X (3175 mm), depth along Z (1534 mm).
 */

export const ALF_DIMENSIONS = {
  baseWidth: 3.175,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 4.064,
  /** trapezoid with full-height slopes: knee at the profile base */
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function alfProfile(): V2[] {
  const d = ALF_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createALFContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = ALF_DIMENSIONS;
  return createProfileContainer(
    {
      code: "ALF",
      typeName: "LD6 full-width LOWER DECK",
      slopeLabel: "16.1° WING TAPER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 230,
      maxGrossKg: 3175,
      iataVolumeM3: 8.95,
      plateId: "ALF 61025",
      plateCarrier: "YL",
      plateSerial: "ALF61025YL-1250",
    },
    options,
  );
}
