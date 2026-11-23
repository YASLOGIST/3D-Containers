# ULD360 — mesh topology, exchange interoperability and device performance

Date: 24 November 2026. Target: unmerged development branch at test time.
This is an engineering QA report, not manufacturer or airline certification.

## Scope and verified results

- The actual 1366×768 WebKit UI exported all 17 models to GLB, OBJ and
  binary STL (51 downloads, no forced clicks or direct exporter calls).
- All 51 files passed the independent project format/structural-bounds
  checker, including world-space transform reconciliation (max 0.8 mm
  structural-axis discrepancy).
- Native macOS Apple Model I/O independently imported all 17 OBJ and
  all 17 STL files (34 successful imports). For every model, native
  OBJ and STL bounding spans agreed within the importer precision.
- An additional independent Trimesh import opened all 17 GLB scenes.
  GLB now materializes GPU instances into ordinary glTF mesh nodes for
  broader importer compatibility. The interactive WebGL scene is unchanged.
- The Trimesh and stdlib edge-topology checks agree on the 14/17 closed
  models and the three models with open/nonmanifold topology.

## Binary STL edge topology by model

Test pose: closed doors, zero cargo load, default geometry/details, mill
aluminium, dimension labels off, no camera orbit. Re-exporting a different
pose can change topology and requires revalidation.

| Model | Edge-closed | Boundary edges | Nonmanifold edges (Trimesh) | Notes |
|---|---|---:|---:|---|
| AKE | Yes | 0 | 0 | Corrected coincident door/frame hinge leaves |
| AKC | Yes | 0 | 0 | No edge-topology issue detected |
| DPE | Yes | 0 | 0 | No edge-topology issue detected |
| DQF | Yes | 0 | 0 | No edge-topology issue detected |
| AQP | Yes | 0 | 0 | No edge-topology issue detected |
| AKH | No | 16 | 0 | Open corners at two longitudinal extrusions |
| ALF | Yes | 0 | 0 | No edge-topology issue detected |
| ALP | Yes | 0 | 0 | No edge-topology issue detected |
| AAP | Yes | 0 | 0 | No edge-topology issue detected |
| RKN | No | 56 | 2,262 | Open fan shroud and coincident stiffener/rail edges |
| RAP | No | 120 | 2,700 | Open fan shrouds and coincident stiffener/rail edges |
| AMA | Yes | 0 | 0 | No edge-topology issue detected |
| AMD | Yes | 0 | 0 | No edge-topology issue detected |
| AGA | Yes | 0 | 0 | No edge-topology issue detected |
| PAG | Yes | 0 | 0 | Ink/stencils omitted from geometry-only exports |
| PMC | Yes | 0 | 0 | Ink/stencils omitted from geometry-only exports |
| PGA | Yes | 0 | 0 | Ink/stencils omitted from geometry-only exports |

Status changed from 10/17 closed to 14/17 closed. All 14 closed models
had zero near-zero-area faces under the Trimesh test threshold. The RKN
and RAP fan-shroud openings are intentional for ventilation; capping
them would misrepresent the equipment. AKH and reefer rail construction
need exact design documentation before any topological repair.

### Selective corrections

1. The AKE fixed hinge leaf was given 5 mm depth clearance to avoid
   coincident touching faces, without enlarging the external envelope.
   Its previously observed 12 nonmanifold edges were eliminated.
2. Printed identification labels and stencils are marked as visual-only
   and remain present in GLB, but are not exported as thin solids in
   geometry-only OBJ/STL. This removed approximately 1,090 near-zero
   area triangles per pallet, as well as duplicate edge incidence.
3. GLB export now uses a non-mutating copy of the instanced hardware
   converted to ordinary mesh nodes. This avoids reliance on the optional
   EXT_mesh_gpu_instancing extension when importing into other tools.
   No per-frame instancing was changed in the live viewer.
4. For cross-format physical envelope comparisons, GLB nodes explicitly
   marked visualOnlyDecal are omitted by the validator. Textured GLB
   still includes those decorations, so whole-scene visual bounding boxes
   can differ legitimately from OBJ/STL physical bounds.

## Live hardware WebGL benchmark

Physical workstation: Apple MacBook Pro, M1 Pro, 16 GB RAM, connected
to AC. Isolated Playwright WebKit rendered on Apple GPU, confirmed using
WEBGL_debug_renderer_info. Actual active rotation in the development
build, plus a native Safari AGA visual/HUD smoke check.

| Test case | App render HUD | Median JS rAF | P95 JS rAF | rAF gaps >33.3ms |
|---|---|---:|---:|---:|
| AKE desktop 1440×900 | 60 FPS | 17 ms | 18 ms | 0 |
| AGA desktop 1440×900 | 60 FPS | 17 ms | 18 ms | 0 |
| PMC desktop 1440×900 | 60 FPS | 17 ms | 18 ms | 0 |
| AKE emulated 390×844 on M1 Pro | 60 FPS | 17 ms | 18 ms | 0 |
| AKE stationary, settled | IDLE | 17 ms | 18 ms | 0 |

Mobile viewport emulation still runs on the Mac GPU, not on an iPhone.
The app's idle heartbeat reduces WebGL scene draws to around 4 Hz;
the browser itself continues delivering requestAnimationFrame callbacks.
JS rAF cadence and the app's FPS display are not a hardware GPU-time
or energy measurement. Native Safari showed 60 FPS in one screenshot,
not a continuous Safari profiling trace.

GPU wattage, thermal behavior under long sessions, per-tab RSS and exact
energy/frame were not measured. A short subprocess RSS sample did not
reliably include WebKit processes managed by launchd, so no memory figure
is reported. No invasive, privileged GPU/system-wide capture was used.

## Reproduce

The repository contains two Python standard-library-only validators:

    python3 scripts/verify_export_meshes.py /path/to/export-folder
    python3 scripts/verify_stl_topology.py /path/to/export-folder/*.stl
    python3 scripts/verify_stl_topology.py --require-closed /path/to/export-folder/ake.stl

The topology parser welds STL coordinates at seven decimal places
(0.1 micrometre in metre units) and flags faces with area below
1e-10 square metres. The alternative Trimesh reader was temporarily
installed for independent verification, not added as a project
dependency. Tests rejected deliberately nonmanifold pre-fix STL
samples in strict mode.

## Limits and unresolved gates

Neither successful edge pairing nor a successful OBJ/STL/GLB import
establishes closed boolean unions, no self-intersections, minimum wall
thickness, physical tolerances, strain limits, airworthiness or an OEM
approved CAD model. Apple Model I/O is an independent OS mesh importer,
not a dedicated manufacturing CAD validation suite.

Remaining engineering gates:
- Review the AKH corner-extrusion ends using verified construction
  drawings; do not apply indiscriminate mesh hole filling.
- Review RKN/RAP wall stiffeners, tie-down rail contacts and ventilated
  fan-shroud design using physical/OEM references.
- Test actual iPhone/older Windows hardware and measure GPU power,
  per-app memory, frame times and thermal throttling with legitimate
  isolated instrumentation.
- For manufacturing workflows, validate in an independent CAD suite
  and with certified manufacturer geometry. STL remains a visualization
  exchange output, never an aircraft loading or print certification.
