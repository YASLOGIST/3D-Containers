# ULD360 export integrity verification — 23 Nov 2026

## Scope and outcome

All 17 modeled ULD entries were selected through an isolated WebKit session
at a 1366 × 768 CSS-pixel desktop viewport. For each entry, the real
application's GLB, OBJ and binary STL buttons were used to download the files
(51 files total). No forced clicks or direct exporter invocation were needed.

A separate Python standard-library-only parser then checked:

1. glTF 2.0 headers, JSON/BIN chunks, nodes, GPU instancing transforms, mesh
   position accessors and bounding spans for each GLB.
2. Numeric vertices and face counts for each OBJ.
3. Triangle count, binary record length and coordinates of each STL.
4. Pairwise X/Y/Z bounding span reconciliation (2 mm gate).

Result: 51/51 files parsed and all 17 families passed. A deliberate
negative-control OBJ with an extreme out-of-bounds vertex was correctly
rejected by the validator. The largest cross-format
bounding-axis difference was 0.8 mm, versus 5.8 mm before the fix. This
checks geometry consistency, not certified CAD accuracy. See the permanent
validator at scripts/verify_export_meshes.py for reproduction.

## Proven bug and correction

Previously, the Three.js OBJ/STL exporters wrote an InstancedMesh primitive
at its local origin instead of replicating its world-space instances. Every
tested model acquired a spurious -0.0058 m Y extent, and some fastening
hardware was not exported in the correct places. GLB already preserved
instancing via the glTF EXT_mesh_gpu_instancing extension.

The geometry-only helper at src/three/geometryExport.ts now makes a temporary,
non-mutating copy for OBJ/STL. Visible GPU instances become ordinary meshes
with their original local transforms. Hidden descendants are omitted.
The live viewer is unchanged. This describes the 23 November export fix;
the GLB exporter received a subsequent compatibility change on 24 November
as documented below. Automated tests verify two translated instances,
hidden subtrees, real OBJ/STL coordinates, and source non-mutation.

## Responsive UI

At desktop widths of 1280–1440 px, the header could wrap below the
inspector's fixed 86 px top offset. The inspector tab strip then intercepted
OBJ/STL clicks. The inspector now uses ResizeObserver and the header's real
rendered bottom, with a 12 px gap, without re-rendering the 3D viewer.
Actual WebKit click/download tests pass without force.

## Reproduction and limitations

Run npm ci && npm run verify, then npm run preview. Download all three formats
for each model into a temporary directory and name each after its ID:
ake.glb, ake.obj, ake.stl, etc. Execute:

    python3 scripts/verify_export_meshes.py /path/to/export-directory

The validator exits nonzero on malformed files, missing files or span
divergence over 2 mm. No Python packages or extra npm dependencies are needed.

GLB uses metres. OBJ/STL are intrinsically unitless: this app's exported
coordinates are in metres. Millimetre-based viewers/slicers need explicit
unit/scale confirmation, commonly ×1000. Do not treat raw STL triangles as
manufacturing-ready or airline-approved solids. Bounding boxes alone cannot
prove watertightness, no self-intersections, safety, restraints, strength or
airworthiness. Manufacturer drawings and physical device performance are
still separate open validation gates.

Test outputs were held in system temporary storage only, not committed to
the project; the testing workstation was a MacBook Pro M1 Pro.


## 24 November topology and GLB interoperability follow-up

A full independently imported topology audit later found only 10 of 17
binary STL demo assemblies were edge-closed in their tested poses.
Repairs to the AKE hinge straps and the omission of printed/ink-only
decals from geometry-only OBJ/STL increased this to 14 of 17.
AKH, RKN and RAP retain documented open/nonmanifold subassemblies.
These must not be automatically filled or certified.

For GLB interoperability, GPU-instanced hardware is now expanded to
standard mesh nodes during export only; this removes reliance on the
optional EXT_mesh_gpu_instancing extension in third-party readers.
The live WebGL viewer still uses hardware instancing.

GLB retains textured branding/printed decals; OBJ and STL omit those
visual-only meshes. The cross-format validator therefore skips explicitly
marked visualOnlyDecal nodes when measuring structural GLB bounds.
Visual whole-scene GLB dimensions may legitimately include decorative
details that are not in a geometry-only export. The maximum compared
structural-axis discrepancy is 0.8 mm across all 17 models.

Apple Model I/O successfully imported 34 OBJ/STL specimens and Trimesh
loaded all 17 GLB scenes, in addition to the structural parser tests.
For specific topology counts and the real-device benchmark, consult
MESH_QUALITY_AUDIT_20261124.md.
