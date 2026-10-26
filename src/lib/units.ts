/** Unit conversions shared by the viewport labels and the spec sheet. */

export const LB_PER_KG = 2.20462;
export const IN_PER_M = 39.3701;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function mToIn(m: number): number {
  return m * IN_PER_M;
}

/**
 * Human distance for CAD readouts: metres for structural spans, millimetres
 * for small features, always with the imperial equivalent aviation crews
 * quote on the ramp. e.g. "1.524 m · 60.00 in", "50 mm · 1.97 in".
 */
export function formatDistance(m: number): string {
  const inches = `${mToIn(m).toFixed(2)} in`;
  return m < 0.1
    ? `${(m * 1000).toFixed(0)} mm · ${inches}`
    : `${m.toFixed(3)} m · ${inches}`;
}
