# ULD360 — keeper concept research, 25 Nov 2026

Baseline: a5f59bb. These scripts are isolated geometric studies, not changes to any production builder.

## Open-fork trial
Run `node --import tsx scripts/study_open_keeper_clearance.ts`.
AKE, 4 positions, 27 configurations (65/80/100 mm gap, 12/20/30 mm depth, 0/8/16 mm recess), 11 sampled poses. The fork uses three independent box probes, not a manufactured part. No latch-hardware crossings were reported, but every configuration intersected the leaf, stiffeners and/or gasket. Minimum 39 pair/pose observations; the best 80 and 100 mm gap variants both used 12 mm depth and zero recess. Reject integration.

## Axially retracting bolt alternative
Run `node --import tsx scripts/study_axial_keeper_release.ts`.
AKE only. Four annular receiver probes (48 mm outer diameter, 18 mm bore, 3 mm thickness) and four 14 mm diameter × 32 mm pin probes. The concept retracts the pins 30 mm during the existing 0–18% release stage, before swing. Pin-center refinement from bottom 180.5 to 182 mm and top 1529.5 to 1528 mm removed four initial pin/frame crossing observations. At 18 samples from 0 to 100%, the refined probes reported zero receiver/moving, receiver/pin, pin/fixed and pin/leaf non-coplanar crossings. Four receiver/frame crossings persisted per pose at the proposed mounting interface. Existing solid rod internals, pin-to-rod relationships, original keepers and other hardware are NOT resolved by this probe. It is not an integrated latch mechanism. The old keeper geometry remains in the source; the diagnostic selectively compares the new probes. It does not demonstrate load-bearing engagement, receiver attachment, a hollow guide, continuous swept clearance or OEM conformity. Do not merge as a functioning lock.

## Independent dimensional audit
Run `node --import tsx scripts/audit_structural_span_extrema.ts`.
All 17 catalog models, closed/stowed, mill finish, detailed/rivets. In the PR49 candidate, all 14 rigid models have depth and height differences rounding to 0.000 mm against listed reference spans. Six X deviations remain (mm): AKE -17.234; AKC -24.211; DPE -13.844; DQF -27.718; AKH -50.511; ALF -32.259. Extremal parts are recorded per model by the script. The three pallet Y differences reflect a stowed physical model compared with an allowed load envelope; they must not be treated as structural height defects. No scaling or reference edits were made. Review nominal section and rounded-corner construction before any dimensional revision.

## Gate
PR49 stays draft. The alternative requires independent design of the pin guide, receiver mounting and actuator linkage; then integration, all-model regression, topology/export, visual and kinematic QA. No commercial/airworthiness claim.
