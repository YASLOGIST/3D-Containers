# 3D-Containers — visual realism validation ledger

Status: **visual prototype / engineering estimation**, NOT an approved ULD CAD model, loading instruction, aircraft-fit certificate, or airworthiness source.

## Implemented in AKE realism pass 1

- Added a separate named **AKE precision details** module with shallow raised sheet joints, riveted seam detail, metal door embossing, service covers and small captive screw heads.
- Details follow their actual parent groups (hull, blind end, hinged door), use instanced tiny fasteners, and disappear with the existing detail/rivet controls.
- Kept the existing AKE envelope, modeling registry, measurements, section tools, exports, and door-pivot mechanism unchanged.
- Corrected the PBR material model so **painted sheet** uses a low-metalness coating and deterministic fine-grain normal/roughness maps. Unpainted alloy retains the anisotropic brushed finish. Surface maps are regenerated when switching material categories.
- Adjusted the mill aluminum default roughness to avoid a mirror-polished appearance.

### Design boundary

The workbench supports **two explicit representative AKE closures**: a hinged rigid metal door and a tensioned textile curtain. This matches the existence of solid and flexible doors in real manufacturer catalogues, but neither simulated closure is a serial-specific, certified restraint mechanism. The cloth motion is a deterministic folded-geometry illustration, **not a cloth dynamics solver** or evidence that cargo is restrained.

The simulated seam location, fastener pitch, cover layout, wall thickness, inner fittings and latch construction are concept visual features. Even when enclosed in a correct dimensional envelope, they MUST NOT be called certified manufacturing geometry. A manufacturer-specific digital twin requires the manufacturer's authorised drawings, revision, serial/type identity, full BOM and inspection measurements.

## Reference evidence consulted (12 Nov 2026)

| Source | Evidence useful for | Limitation |
| --- | --- | --- |
| [IATA ULD program](https://www.iata.org/en/programs/cargo/cargo-operations/unit-load-devices/) | ULD airworthiness and oversight obligations | Not a substitute for the applicable technical standards or certification |
| [AviusULD AKE product](https://www.aviusuld.com/products/ake/) | AKE base 1534 × 1562 mm, max height 1616 mm, gross 1588 kg, example 4.30 m³ and type codes | Producer-specific series with variant-dependent construction |
| [ANA Cargo ULD guides](https://www.anacargo.jp/en/int/specification/cm_container.html) | AKE family nominal outer/door dimensions, tare example and aircraft constraints | Operator-specific units; other AKE models differ |
| [China Airlines Cargo ULD data](https://cargo.china-airlines.com/ccnetv2/content/about/UnitLoadDevices.aspx) | LD3 AKE family tare range 58–100 kg and compatible decks | Not a part-by-part bill of materials |
| [JAL Cargo door-lock photo](https://www.jal.co.jp/jp/ja/jalcargo/news/20251027-01/) | Real riveted frame, strap-retained lock and wear patterns | Depicts a different closure variant; DO NOT apply to the current hinged metal door as if identical |

Reference data differs between manufacturers, generations and operators. Keep the model registry labelled nominal/representative until the exact variant is specified and the controlled drawing revision is available.

## Verification and performance

Mandatory on every subsequent realism change:

1. `npm ci && npm run verify` — all generators, planner, share state and viewer math remain green.
2. Geometry regression: AKE envelope and closed-door position remain within nominal bounds.
3. Material regression: painted finish differs from bare-metal finish and stays a dielectric.
4. Motion regression: new components follow the door pivot without detached parts.
5. Device rendering verification: desktop and mobile screenshots on the **same** camera pose and exposure; measure frame timing, triangles, draw calls, texture memory and interactive FPS with a real WebGL browser.
6. Export inspection: open GLB, OBJ and STL in independent viewers, confirm scales, instance support and material fidelity where applicable.
7. Photographic review against an identified variant, at exterior full view, half-meter inspection and close-up. Record known mismatch and its cause.
8. Before operational use: manufacturer/airline documentation, engineering approval and certified fit and restraint checks.

Automated tests alone do not validate photographic similarity or real-device FPS.

## Backlog for the next quality gates

- Replace generic AKE fabric and rigid closure with manufacturer-specific, drawing-matched hardware, straps, restraints and motion once authorized data becomes available.
- Cross-referenced industrial details for AKC, DPE, DQF, AQP, AKH, ALF, ALP, AAP, RKN, RAP, AMA, AMD, AGA, PAG, PMC, PGA. Reusing one detail layout blindly would be misleading.
- Verified internal wall panels, ribs, track and base features from maker drawings. Add a source link and confidence flag to each measured part.
- Benchmark physical phones, retina Macs and Windows GPUs. A screen-space camera-only microfastener LOD now exists; benchmark and extend it rather than indiscriminately increasing tessellation.
- Formally separate approximate volume/hold schematic from model-certified engineering specs in the UI.


## Second pass — visual realism and variant control (12 Nov 2026)

- Rebalanced hangar, dusk and studio lighting to reduce clipped metal highlights and preserve joint contrast. Recalibrated the bare-metal/paint palette without changing geometric envelope or camera controls.
- Added explicit AKE **Rigid metal** and **Flexible curtain** options; only one closure is rendered at a time. The curtain is a contoured dynamically pleated, woven-textile mesh with two articulated straps, a moving lower hem and buckles. It can be inspected open or closed, and the choice persists in shared URLs.
- Added **Factory clean / In service** surface conditions via a cached deterministic low-contrast albedo patina, separated from physical normals and roughness maps. The condition is *art direction*, **not measured defects**, real vehicle wear, or a change to payload rating.
- Added camera-layer microfastener LOD based on projected pixels, preserving visible geometry in export and suppressing unnecessary fine hardware when visually subpixel. Tiny heads are excluded from section-stencil caps.
- Added tests for AKE door variant visibility and dynamic vertex updates, state sharing, surface map caching, and near/far projected sizes.

### Additional manufacturer grounding

| Manufacturer | Specific published evidence | Interpretation |
| --- | --- | --- |
| [DoKaSch AKE LD3](https://www.dokasch.com/en/ake-ld3/) | AKE flexible doors; solid doors optionally available; tare from 64 kg and 1588 kg gross | Door choices exist, but simulated folding/fitting dimensions here are NOT DoKaSch-specific |
| [Satco AKE 34124-901](https://www.satco-inc.com/product-container/?part_number=34124-901) | All-aluminum shell, heavy-duty lower outboard panel, corner gussets, variable door position and options | This model is not a verified Satco parts reconstruction |
| [ANA Cargo ULD list](https://www.anacargo.jp/en/int/specification/cm_container.html) | AKE light-weight container and its operator-specific weight/dimensions | Published tare differs materially from this registry's example |
| [AviusULD AKE](https://www.aviusuld.com/products/ake/) | 1534 × 1562 mm base; 1616 mm max height; 1588 kg MGW | The registry's 1620 mm model height is nominal; no certification claim |

### Explicit acceptance gates not yet met

Photographic similarity remains **not validated** against a controlled, exact manufacturer/variant/serial reference. Chrome headless/WebGL screenshots are useful preliminary evidence but do not establish performance on a physical iPhone, retina Mac, GPU driver or aircraft operations. Exported GLB, OBJ and STL need independent inspection before professional approval.


### Automated and simulated-browser verification (12 Nov 2026)

- `npm run verify`: 37/37 tests passed; TypeScript check passed; Vite single-file build passed (1,431.03 KB raw / 388.73 KB gzip).
- `npm audit --audit-level=high`: 0 vulnerabilities reported in this dependency snapshot.
- Headless Chromium + SwiftShader WebGL: model canvas rendered at 1440×900; dynamically selected both door modes, lifted the curtain to 85%, and switched surface conditions. No page exceptions or console errors were collected.
- A browser download was produced for the **fabric variant**: GLB ~3.35 MB and OBJ ~17.37 MB. These are browser-output smoke tests; a second 3D reader has NOT yet verified their geometry, unit scale, materials and instances.
- An emulated iPhone 13 context rendered the curtain; no horizontal document overflow was reported. The mobile model switcher was subsequently condensed to a horizontal strip and visually checked again.
- Static near-camera photography and live FPS on a physical Mac/iPhone/Windows GPU have not yet been measured. Headless SwiftShader is a software renderer, not device-performance evidence.
- PNG screenshots from these local checks remain under system temp storage and are intentionally not committed to the application repository.

Important: this implementation improves **visual realism and inspection**, not certification, structural dynamics, restraint validation, real damage detection, or airline-approved load planning.
