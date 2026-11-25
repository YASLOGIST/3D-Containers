# ULD360 — articulated door and export validation (25 November 2026)

Baseline: 80efb67 (PR #28). This is a representative digital geometry
audit, not a mechanical design approval, manufacturing or airworthiness
assessment.

## Findings and corrections

- RKN/RAP previously swung immediately even though the common control
  deck displayed an initial release phase. Both now use the common
  rigidDoorPose sequence: latch rotation with the leaf seated through
  18% progress, followed by a smooth swing to 112 degrees. Their original
  rods, hubs and handles are grouped into articulated spindles. The 2 mm
  illustrative gasket relaxation is consistent with the other generators.
- A non-coplanar triangle-surface crossing probe (14 models, nine
  progress values, 126 sampled configurations) found leaf/end-frame
  crossings in AKE, DQF, AKH, ALF, RKN, RAP, AMA, AMD and AGA, principally
  at large swing angles. RAP also had a climate bezel/end-frame crossing
  at early progress. The other five rigid models had no such crossing.
- A candidate offset sweep explored 5 X offsets and 8 Z offsets for each
  model, while keeping the original closed leaf placement. Chosen offsets
  were 10 mm outward in Z for AKE, RKN, DQF, AKH, ALF, AMA, AMD and AGA,
  and 15 mm for RAP; X was unchanged. Other profiles are unchanged.
  Explicit pins in AKE and the reefers remain inside the nominal depth
  envelope. These are illustrative hinge-axis clearances, not OEM
  hinge specifications. RAP's unit center is constrained below the top
  frame (10 mm illustrative clearance) without reducing the bezel size.
- Closed physical STL spans matched the baseline to the 0.1 mm reporting
  precision in all 14 rigid models. This is envelope agreement, not a
  claim of identical parts or manufacturer conformity.

## Verified results

Physical MacBook Pro M1 Pro on AC power.

| Check | Result |
|---|---|
| Baseline rigid STL sampling, 5 poses x 14 | 70/70 edge-closed |
| Final rigid STL, 7 poses x 2 detail/rivet configurations x 14 | 196/196 edge-closed |
| Final textile AKE, 3 poses x 2 configurations | 6/6 intentional open surface meshes |
| Final selected moving/fixed surface crossing regression | 280/280 samples without a detected crossing |
| Reproduction of all 202 STL specimens | SHA-256 identical |
| npm run verify | 121/121 tests, TypeScript and Vite build |
| Python rotated-GLB bounds regression | passed |
| Local WebKit UI exports | 12 rigid downloads + 1 textile STL |
| RKN/RAP at progress 0.09 and 1, GLB/OBJ/STL | 0 mm span discrepancy at 0.1 mm reporting precision |
| Fabric export warning | tooltip and toast verified in WebKit |

All rigid specimens used zero cargo, default contour, mill finish and
paired detail/rivet settings (both enabled or both disabled). Progress
samples: 0, 0.09, 0.18, 0.25, 0.5, 0.75, 1. Textile samples: 0, 0.5, 1.
The fabric curtain/straps are rendered as intentional open sheets
(120 boundary edges in minimal and 260 in detailed variants), with
no oversubscribed edges or near-zero faces detected. The STL control
and export notification explicitly disclose this, rather than making
an incorrect print-ready claim or filling fabric surfaces.

The GLB structural-bounds checker formerly transformed the eight corners
of each local accessor AABB, overestimating some rotated meshes. A
3.7 mm apparent difference in RKN at 9% release disappeared after
reading and transforming real POSITION vertices. The synthetic rotated
triangle regression demonstrates why the previous method was inaccurate.
No geometry was removed to make that check pass.

## Reproduce

    npm run verify
    python3 -B scripts/test_verify_export_meshes.py
    node --import tsx scripts/audit_door_pose_exports.ts /tmp/uld360-new-audit
    python3 scripts/verify_stl_topology.py /tmp/uld360-new-audit/*.stl

The output directory must not already exist. The audit uses the actual
registered builders, production geometry export transformation and
Three.js binary STL exporter with a deterministic canvas shim. The
WebKit download test separately exercises real browser buttons.

## Limits

The surface regression checks rigid door leaves and, on reefers, the
unit housing and bezel, versus the fixed end-frame, hull and named
corner/edge extrusions at 20 progress samples. It detects non-coplanar
triangle-edge crossings (excluding endpoint-only contacts within 1
micrometre). It does not establish continuous collision detection,
minimum clearance, coplanar or fully contained intersections, hardware
contact forces, hinge-knuckle alignment, lock engagement under load,
all auxiliary hardware, exploded views, arbitrary cargo manifests,
or manufacturing tolerance. Door progress is an animation parameter,
not an OEM mechanical simulator. No certificate is inferred from
edge-closed meshes or sampled surface-crossing results.
