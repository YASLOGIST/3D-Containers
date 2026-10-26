import { createProfileContainer, symmetricProfile, type ProfileBuildOptions } from "./profileContainer";
import type { V2, ViewerContainer } from "./primitives";

/**
 * akh.ts — AKH · LD3-45 lower-deck container (A320 family).
 *
 * Certified envelope (AviusULD / ANA Cargo / Alitalia published sheets):
 *   base 60.4 × 61.5 in (1534 × 1562 mm) on a K-base, height 45 in (1143 mm),
 *   double-wing contour reaching 96 in (2438 mm) overall at the roof line,
 *   internal volume ≈ 3.3 m³ (ANA), tare ≈ 82 kg, max gross 1588 kg.
 * The knee height (0.30 m) is a nominal modelling choice approximating the
 * A320 bilge curve; the wing angle therefore reads ≈ 28° from vertical.
 */

export const AKH_DIMENSIONS = {
  baseWidth: 1.534,
  baseLength: 1.562,
  height: 1.143,
  topWidth: 2.438,
  kneeHeight: 0.3,
} as const;

export function akhProfile(): V2[] {
  const d = AKH_DIMENSIONS;
  return symmetricProfile(d.baseWidth, d.topWidth, d.kneeHeight, d.height);
}

export function createAKHContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AKH_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AKH",
      typeName: "LD3-45 LOWER DECK",
      slopeLabel: "28.2° WING TAPER",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      depth: d.baseLength,
      height: d.height,
      tareKg: 82,
      maxGrossKg: 1588,
      iataVolumeM3: 3.3,
      plateId: "AKH 22045",
      plateCarrier: "YL",
      plateSerial: "AKH22045YL-0451",
    },
    options,
  );
}
