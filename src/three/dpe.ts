import { asymmetricProfile, createProfileContainer, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * dpe.ts — DPE · LD-2 lower-deck container (Boeing 767).
 *
 * Certified envelope (Dokasch / AviusULD / Air Canada Cargo sheets):
 *   P base 47 × 60.4 in (1194 × 1534 mm), height 64 in (1626 mm), single
 *   contour reaching 61.5 in (1562 mm) overall. The LD-2 exists because the
 *   767's narrower hold takes two of these abreast where a pair of LD-3s
 *   would waste a third of the width. Internal volume ≈ 3.4 m³ (AS1825
 *   3.5 m³), tare ≈ 75 kg, max gross 1225 kg. AKE-style right trapezoid
 *   with a shallow 12.8° slope, via the shared profile engine.
 */

export const DPE_DIMENSIONS = {
  baseWidth: 1.194,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 1.562,
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function dpeProfile(): V2[] {
  const d = DPE_DIMENSIONS;
  return asymmetricProfile(d.baseWidth, d.topWidth, d.height);
}

export function createDPEContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = DPE_DIMENSIONS;
  return createProfileContainer(
    {
      code: "DPE",
      typeName: "LD-2 LOWER DECK",
      slopeLabel: "12.8° CONTOUR TAPER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      profile: dpeProfile(),
      depth: d.baseLength,
      height: d.height,
      tareKg: 75,
      maxGrossKg: 1225,
      iataVolumeM3: 3.4,
      plateId: "DPE 2047",
      plateCarrier: "YL",
      plateSerial: "DPE02047YL-2470",
    },
    options,
  );
}
