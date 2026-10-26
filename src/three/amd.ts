import { createProfileContainer, type ProfileBuildOptions } from "./profileContainer";
import { ULD_CONSTANTS, type V2, type ViewerContainer } from "./primitives";

/**
 * amd.ts — AMD · M1H main-deck contoured container (747F / 747 Combi).
 *
 * Certified envelope (Dokasch / Unilode / Atlas Air 747F data sheets):
 *   M base 96 × 125 in (2438 × 3175 mm), height 118 in (2997 mm) — the
 *   standard 747 freighter main-deck ULD. The section is asymmetric: the
 *   centreline-facing wall runs the full 118 in while the fuselage side
 *   breaks into a long slope under the crown (contour D), so a side-by-side
 *   pair fills the 747 tube. AS1825 volume 21.2 m³, tare ≈ 370 kg,
 *   max gross 6804 kg. Knee height (2.25 m) and roof break (x = +0.15 m)
 *   are nominal — contour D's break points are not published; they are
 *   sized so the live geometric volume approaches the certified figure.
 *   Profile runs across the 96 in width (−X = fuselage side), extruded
 *   along the 125 in length, matching how the unit sits on the deck.
 */

export const AMD_DIMENSIONS = {
  baseWidth: 2.438,
  baseLength: 3.175,
  height: 2.997,
  /** roof flat measured from the centreline wall (2.438/2 − roofBreakX) */
  topWidth: 1.069,
  kneeHeight: 2.25,
  /** x where the roof flat breaks into the fuselage-side slope (nominal) */
  roofBreakX: 0.15,
} as const;

export function amdProfile(): V2[] {
  const d = AMD_DIMENSIONS;
  const hw = d.baseWidth / 2;
  return [
    { x: -hw, y: ULD_CONSTANTS.CHASSIS },
    { x: hw, y: ULD_CONSTANTS.CHASSIS },
    { x: hw, y: d.height },
    { x: d.roofBreakX, y: d.height },
    { x: -hw, y: d.kneeHeight },
  ];
}

export function createAMDContainer(options: Partial<ProfileBuildOptions> = {}): ViewerContainer {
  const d = AMD_DIMENSIONS;
  return createProfileContainer(
    {
      code: "AMD",
      typeName: "M1H MAIN DECK",
      slopeLabel: "CONTOUR D · 118 IN",
      baseWidth: d.baseWidth,
      topWidth: d.topWidth,
      kneeHeight: d.kneeHeight,
      profile: amdProfile(),
      depth: d.baseLength,
      height: d.height,
      tareKg: 370,
      maxGrossKg: 6804,
      iataVolumeM3: 21.2,
      plateId: "AMD 11896",
      plateCarrier: "YL",
      plateSerial: "AMD11896YL-1180",
    },
    options,
  );
}
