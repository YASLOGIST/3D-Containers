# ULD360 — concave corner and ventilated fan shroud topology (25 Nov 2026)

## Scope and actual result

This is a follow-up to the previous [24 November mesh audit](MESH_QUALITY_AUDIT_20261124.md),
which documented 14 of 17 STL demo assemblies as edge-closed under one
specific pose. It is not a replacement for the historical report.

**The new result is 15/17**: AKH now has zero open/over-subscribed
edges. The remaining RKN and RAP have no open boundary edges after
their fan shrouds were given physical rim thickness, but retain
nonmanifold shared/overlapping rail and wall-stiffener geometry.

| Model | Before | After | Remaining |
|---|---|---|---|
| AKH | 16 open boundary edges | 0 open / 0 nonmanifold | None flagged by edge pairing |
| RKN | 56 open; 2,262 nonmanifold | 0 open; 2,262 nonmanifold | Rail and stiffener contacts |
| RAP | 120 open; ~2,700 nonmanifold | 0 open; ~2,700 nonmanifold | Rail and stiffener contacts |

The two independent edge validators use different floating-point welding
tolerances. Their exact RAP nonmanifold edge counts differ slightly
(2,700 from Trimesh; 2,704 from the project standard-library checker),
but **both agree it is not a manifold solid**.

## Cause and scope of changes

1. **AKH concave knees:** The shared corner-rail generator previously
   constructed a convex fillet at a concave knee, creating
   self-overlapping cross-sections and missing extruded end-cap triangles.
   Reflex corners now use the intersection of two inward-offset rail
   strips to create a simple constant-thickness elbow. Other convex
   corners retain their existing radiused implementation. A new test
   inspects all six AKH corner extrusions, including their end caps.
2. **RKN / RAP airflow:** The original open-ended CylinderGeometry
   represented only an infinitely thin conical wall. Replacing it with
   a LatheGeometry annulus (illustrative 4 mm wall thickness) adds
   inner surfaces and front/rear rims, while leaving the central
   airflow bore open. It does **not** cap airflow or introduce a fake
   solid fan disc. Separate tests check both shroud sizes, nonzero
   air passages, boundary edge closure and invalid parameters.
3. **Remaining reefer rail intersections:** These are still present.
   No automatic merge, hole fill, arbitrary shifts or removal of
   functional internal hardware was performed. Repair requires
   selected physical/OEM geometry references.

No certified manufacturer tolerance, fatigue, thermal performance or
load-bearing claim is inferred from these visual-model improvements.

## Verification evidence

- MacBook Pro M1 Pro, local WebKit preview, 1366×768 CSS pixels:
  all 17 model STL downloads worked through real buttons with no
  page JavaScript exceptions (no forced clicks).
- The three altered models (AKH, RKN, RAP) were re-exported in
  **GLB, OBJ and STL** (9 files). All three formats parsed and agreed
  on the structural bounding-axis dimensions to at most **0.8 mm**.
- scripts/verify_stl_topology.py checked the 17 exported STL files:
  15 were edge-closed; the only exceptions were RKN and RAP.
- An independently installed temporary Trimesh parser confirmed
  **15 watertight results**, both reefers non-watertight, and no
  open edges remaining in the reefers.
- npm run verify passed **114/114** tests with TypeScript and Vite
  build. Added unit tests for reflex corners and both annular shrouds.
- Side-by-side screenshots of the RKN closed-door exterior showed
  no obvious presentation regression, although the fan hardware is
  partly concealed by the refrigeration fascia in that viewpoint.

## Critical limits and next engineering gates

The STL topology checks weld coordinates within defined precision and
validate edge incidence/winding, not global boolean unions, internal
self-intersections, minimum structural thickness or certification.
Even the 15 closed demo assemblies are **not manufacturer-validated CAD**.

To advance RKN and RAP, use dimensioned reference drawings to model
separate structural rail contacts and reefer fan chamber surfaces,
rather than inventing an artificially closed air-duct system.

All tests were non-commercial and used existing toolchains; third-party
analysis libraries were installed into a disposable temporary folder
and were **not** added as project dependencies.
