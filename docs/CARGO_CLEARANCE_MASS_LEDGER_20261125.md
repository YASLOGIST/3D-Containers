# ULD360 cargo geometry and mass ledger — 25 November 2026

Baseline e294063. The purpose is to improve the illustrative cargo
sandbox, not authorize physical loading.

## Findings and changes

- A triangle-versus-carton-box probe of the 17 default demo scenes
  found three RAP cartons intersecting centrally placed temperature
  probes and one carton on each of PAG, PMC and PGA intersecting
  the corner hardware. The optional pallet contour is a visual
  envelope, not a physical obstacle.
- RAP now uses an illustrative wall-adjacent probe location outside
  the cargo core. This is not a validated sensor installation.
- Pallet core margins increase from 140 mm to 210 mm to avoid
  the modeled 190 mm corner blocks inset 10 mm, leaving 10 mm
  illustrative clearance. All 17 demos still fit 27 cartons.
- Profile core calculation evaluates in-range polygon vertex
  heights rather than only nine uniformly spaced heights.
- Invalid payload overrides fail closed; an override may lower but
  cannot increase the registry reference limit.
- A mass ledger attributes each carton to a single supported base
  through the planner's support chain. It reports summed mass,
  weighted height above the preview floor, base/stacked counts,
  and heaviest attributed stack. Ambiguous, invalid, overlapping,
  duplicated, out-of-core or unsupported input fails closed.

## Verification and limits

The regression tests use real procedural model meshes and 459 demo
cartons in closed-door, zero-load-contour, detailed, riveted scenes.
They test non-instanced, visible, non-decal triangle surfaces against
carton interiors inset 0.1 mm, not merely outer bounding boxes.
All 17 demos pass that sampled check. This excludes instanced
fasteners, containment without a surface crossing, other poses,
arbitrary manifests and continuous motion. The conservative reference
floor is not a measured physical contact plane. The ledger is
bookkeeping, not load transfer, structural strength, floor pressure
or aircraft centre of gravity. Tare mass is excluded. No OEM or
operator certification is claimed.

Run npm run verify to repeat the checks.
