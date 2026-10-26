import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * dqf.ts — DQF · LD-8 full-width lower-deck container (Boeing 767/787).
 *
 * Certified envelope (Dokasch / AviusULD / Granger Aerospace sheets):
 *   base plate 96 × 60.4 in (2438 × 1534 mm), height 64 in (1626 mm), roof
 *   span 125 in (3175 mm) — literally two LD-2 contours mirrored, each wing
 *   running the LD-2's 368 mm / ≈13° slope, so one LD-8 does the work of a
 *   DPE pair in the 767 hold. Internal volume ≈ 6.9 m³, tare ≈ 127 kg,
 *   max gross 2449 kg.
 */

export const DQF_DIMENSIONS = {
  baseWidth: 2.438,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 3.175,
  /** trapezoid with full-height slopes: knee at the profile base */
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function dqfProfile(): V2[] {
  const d = DQF_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createDQFContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = DQF_DIMENSIONS;
  return createProfileContainer(
    {
      code: "DQF",
      typeName: "LD-8 LOWER DECK",
      slopeLabel: "13.5° WING TAPER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 127,
      maxGrossKg: 2449,
      iataVolumeM3: 6.9,
      plateId: "DQF 8125",
      plateCarrier: "YL",
      plateSerial: "DQF08125YL-8125",
    },
    options,
  );
}
