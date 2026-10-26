import { asymmetricProfile, createProfileContainer, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * akc.ts — AKC · LD-1 lower-deck container (Boeing widebodies, MD-11).
 *
 * Certified envelope (ACL Airshop / EUAS / Bringer published sheets):
 *   K-family base 61.5 × 60.4 in (1562 × 1534 mm), height 64 in (1626 mm),
 *   SINGLE contour reaching 92 in (2337 mm) overall — a deeper fuselage
 *   wedge than the LD-3's 79 in, which is why the LD-1 is a Boeing/MD-11
 *   hold shape rather than a universal one. AS1825 volume 5.0 m³ (internal
 *   ≈ 4.8 m³), tare ≈ 85 kg, max gross 1588 kg. The section is the AKE-style
 *   right trapezoid (vertical centreline wall, one 25.5° slope), built by
 *   the shared profile engine from an explicit asymmetric polygon.
 */

export const AKC_DIMENSIONS = {
  baseWidth: 1.562,
  baseLength: 1.534,
  height: 1.626,
  topWidth: 2.337,
  kneeHeight: ULD_CONSTANTS.CHASSIS,
} as const;

export function akcProfile(): V2[] {
  const d = AKC_DIMENSIONS;
  return asymmetricProfile(d.baseWidth, d.topWidth, d.height);
}

export function createAKCContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AKC_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AKC",
      typeName: "LD-1 LOWER DECK",
      slopeLabel: "25.5° CONTOUR TAPER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      profile: akcProfile(),
      depth: d.baseLength,
      height: d.height,
      tareKg: 85,
      maxGrossKg: 1588,
      iataVolumeM3: 4.8,
      plateId: "AKC 1092",
      plateCarrier: "YL",
      plateSerial: "AKC01092YL-0921",
    },
    options,
  );
}
