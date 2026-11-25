# ULD360 reefer mesh topology — paired-wall placement correction

25 November 2026. This is an incremental follow-up to the dated
MESH_QUALITY_AUDIT_20261125.md report. Earlier figures remain historically
correct for the previous build; this document describes a newer candidate.

## Root-cause attribution and changes

An edge-incidence attribution pass on the existing export scene isolated
every remaining over-subscribed edge into three categories:

| Part / cause | RKN before | RAP before | Fix |
|---|---:|---:|---|
| Duplicated long-wall stiffeners, placed at container center instead of opposite walls | 1,350 | 1,800 | Position on actual -X and +X sides |
| Duplicated tie-down rails, placed twice against the -X interior wall | 900 | 900 | Place one rail on each interior side |
| RKN fixed/moving hinge leaves touching in the closed pose | 12 | — | Shift fixed strap 4 mm in depth without exceeding the reference envelope |
| RAP overlapping top-unit coil fin slabs | — | 4 | Twelve separated, narrower fins with airflow clearance |
| **Total over-subscribed edges** | **2,262** | **2,704** | **Zero in the tested pose** |

All changes correct demonstrably duplicated or coincident visual geometry.
The temperature control, cooling fan airflow opening, door kinematics,
nominal outer dimensions and live viewer/export architecture are unchanged.

## Independent verification

Test hardware: iMac Intel Core i5, 8 GB RAM, macOS 13.7.8, connected to AC.
The MacBook Pro was not stressed because it was on battery at 19%.

- The actual registered procedural model builders exported binary STL for
  all 17 models using the production Three.js STLExporter and the same
  geometry-only export transformation as the viewer. The test pose used
  a closed door, zero cargo and detail/rivets enabled. Total triangle
  count: 742,240.
- The repository's Python stdlib STL parser found **17 of 17**
  edge-closed meshes, with no boundary, over-subscribed or degenerate
  triangles in that pose.
- An independently installed, temporary Trimesh 4.12.2 + NumPy 1.26.4
  check found 17/17 watertight, winding-consistent and with positive
  accepted solid volumes in that same pose.
- Native Safari opened the local preview on the iMac. An open-door RKN
  screenshot was visually inspected to check that interior rails are
  represented on the wall surfaces instead of stacked at the center.
- New automated regression tests verify different left/right positions,
  4 mm clearance between moving and fixed RKN hinge straps, separate RAP
  coil fins and the actual exported binary STL edge incidence for
  both reefers.
- The entire suite passed 118/118 unit tests, TypeScript type-check,
  Vite production build, and git diff whitespace validation.

## Actual user-interface export and Safari comparison

On the same Intel iMac, an isolated Playwright WebKit 1.55.1 session
used real UI buttons to download GLB, OBJ and STL for RKN and RAP
(6 browser downloads, HTTP 200, no page JavaScript exceptions).
The independent format validator found exactly 0 mm structural-axis
disagreement for both modified reefer models. Trimesh separately
loaded the downloaded GLB and checked each downloaded STL as
watertight, winding-consistent and with positive signed volume.

This test browser was a pinned, frozen WebKit build for macOS 13
and must not be treated as a modern cross-platform browser benchmark.

Side-by-side native macOS Safari inspection of the open-door RKN on
the old production build versus the new local preview confirmed the
former misplaced bars hanging through the middle of the cargo bay
are replaced by structural rails against the actual side walls.

## Precision and safety limits

An edge-closed STL is NOT proof of a boolean-unioned manufacturing solid.
Separate watertight shells may intersect, overlap, or be topologically
disconnected. Trimesh is_volume does not approve wall thickness,
internal collision-free construction, material, manufacturing tolerance,
pressure sealing, cargo suitability or airworthiness.

Only one representative, closed-door/zero-load pose was independently
checked. Door kinematic sweeps and configurable detail levels require
separate topology and collision tests, particularly in preparation for
physical CAD export. Manufacturer drawings are still required to verify
the scale, layout and dimensions of the illustrated cold-chain hardware.
No manufacturer-certified geometry, 3D printing readiness or aircraft
load-planning use is claimed.

The generated STL files and temporary third-party packages were held
only in isolated /tmp directories, not committed to GitHub.
