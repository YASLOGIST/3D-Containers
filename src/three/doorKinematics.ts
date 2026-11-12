/**
 * Deterministic representative rigid ULD closure sequence.
 * 0–18%: handles release and cam spindles turn while the leaf stays seated.
 * 18–100%: hinges swing only after both spindles have reached the unlock stop.
 *
 * This models visible kinematic interlocking, NOT OEM-certified latch forces,
 * contact stresses or seal pressure. Do not infer restraint compliance.
 */
export const UNLATCH_FRACTION = 0.18;
const clamp = (v: number) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};

/** Critically damped display motion: a small mass/inertia cue without oscillation
 * or collisions. Frame-rate-independent time integration and monotonic
 * closing/opening protect against visible penetration of the fixed keepers.
 * This is presentation dynamics, not simulated contact force in newtons. */
export function stepDampedDoor(
  current: number, velocity: number, target: number, deltaSeconds: number,
): { position: number; velocity: number } {
  const dt = Math.min(0.05, Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const goal = clamp(target);
  if (dt === 0) return { position: clamp(current), velocity };
  const omega = 14;
  const displacement = clamp(current) - goal;
  const exponential = Math.exp(-omega * dt);
  const temporary = (velocity + omega * displacement) * dt;
  const next = goal + (displacement + temporary) * exponential;
  const nextVelocity = (velocity - omega * temporary) * exponential;
  if (Math.abs(next - goal) < 0.0004 && Math.abs(nextVelocity) < 0.005) {
    return { position: goal, velocity: 0 };
  }
  return { position: clamp(next), velocity: nextVelocity };
}

export function rigidDoorPose(progress: number, maxDoorRadians: number) {
  const t = clamp(progress);
  const unlock = smooth(t / UNLATCH_FRACTION);
  const swing = smooth((t - UNLATCH_FRACTION) / (1 - UNLATCH_FRACTION));
  return {
    progress: t,
    unlocked: t >= UNLATCH_FRACTION,
    latchRadians: unlock * (Math.PI / 3),
    swingRadians: swing * Math.max(0, maxDoorRadians),
    engagement: 1 - unlock,
  };
}
