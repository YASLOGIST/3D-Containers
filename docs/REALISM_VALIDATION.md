# 3D-Containers — visual realism validation ledger

Status: **visual prototype / engineering estimation**, NOT an approved ULD CAD model, loading instruction, aircraft-fit certificate, or airworthiness source.

## Implemented in AKE realism pass 1

- Added a separate named **AKE precision details** module with shallow raised sheet joints, riveted seam detail, metal door embossing, service covers and small captive screw heads.
- Details follow their actual parent groups (hull, blind end, hinged door), use instanced tiny fasteners, and disappear with the existing detail/rivet controls.
- Kept the existing AKE envelope, modeling registry, measurements, section tools, exports, and door-pivot mechanism unchanged.
- Corrected the PBR material model so **painted sheet** uses a low-metalness coating and deterministic fine-grain normal/roughness maps. Unpainted alloy retains the anisotropic brushed finish. Surface maps are regenerated when switching material categories.
- Adjusted the mill aluminum default roughness to avoid a mirror-polished appearance.

### Design boundary

This model currently represents a **generic rigid aluminium hinged-metal-door LD3**. It is not a claim that all AKE/LD3 containers use that door. Many real AKE units have fabric curtains, strap restraint and variant-specific closures; those require a **separate explicitly named generator/option**, not an invisible change to an existing door.

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

- Manufacturer-specific AKE door choices (fabric flap, rigid hinged door), each with verified hardware, restraint arrangement, texture and movement.
- Cross-referenced industrial details for AKC, DPE, DQF, AQP, AKH, ALF, ALP, AAP, RKN, RAP, AMA, AMD, AGA, PAG, PMC, PGA. Reusing one detail layout blindly would be misleading.
- Verified internal wall panels, ribs, track and base features from maker drawings. Add a source link and confidence flag to each measured part.
- Benchmark real phones, retina Macs and Windows GPUs. Add detail LOD where profiling justifies it, avoiding indiscriminate tessellation.
- Formally separate approximate volume/hold schematic from model-certified engineering specs in the UI.
