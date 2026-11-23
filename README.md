<div align="center">
  <img src="assets/readme/uld-cinematic-hero.gif" alt="ULD360 by YASLOGIST: an animated conceptual aviation cargo container in a hangar, with a moving scan and technical signals" width="100%" />
</div>

<div align="center">
  <h1>ULD360</h1>
  <p><strong>Procedural aviation ULD geometry, built and explored in the browser.</strong></p>
  <p>A creative engineering project by <a href="https://www.yaslogist.com"><strong>YASLOGIST</strong></a>.</p>
  <p>
    <a href="#01--the-system">The system</a> &nbsp;·&nbsp;
    <a href="#02--the-fleet">The fleet</a> &nbsp;·&nbsp;
    <a href="#03--architecture">Architecture</a> &nbsp;·&nbsp;
    <a href="#05--ignition">Quick start</a> &nbsp;·&nbsp;
    <a href="#06--engineering-notes">Engineering notes</a>
  </p>
  <sub><a href="assets/readme/uld-cinematic-poster.png">View the static hero poster</a> · The hero is a conceptual illustration, not a dimensional rendering.</sub>
</div>

---

## `01 /` The system

**ULD360** is an interactive laboratory for exploring aviation unit load devices (ULDs). It generates container and pallet geometry in the browser with TypeScript and Three.js rather than loading pre-made 3D models. React provides the workbench controls; procedural Canvas textures supply finishes, placards and simulated controller displays.

| Explore | Inspect | Take away |
| :--- | :--- | :--- |
| Switch between 17 modeled ULD types; adjust finishes, doors, details and model-specific options. | Orbit, compare envelopes, cut sections, measure points and inspect dimensions or assemblies. | Export GLB, OBJ or STL meshes, save a viewport PNG, inspect source, or share viewer settings by URL. |

> **Engineering boundary** — This is a visualization and estimation tool, not a certified loading, fit or airworthiness system. Model dimensions, contours and ratings are registry values or approximations; verify against current manufacturer, airline and aircraft documentation before operational use. The hero is artwork, not one of the application's generated models.

## `02 /` The fleet

The [model registry](src/three/models.ts) binds metadata and controls to each generator. Three families have dedicated generators, eleven use the shared profile engine, and three use the shared pallet engine.

| Generator path | Modeled types | Approach |
| :--- | :--- | :--- |
| Dedicated | **AKE**, **RKN**, **RAP** | Contoured lower-deck container and two refrigerated-container representations. |
| Shared profile | **AKC**, **DPE**, **DQF**, **AQP**, **AKH**, **ALF**, **ALP**, **AAP**, **AMA**, **AMD**, **AGA** | Extruded section profiles with family-specific metadata and geometry. |
| Shared pallet | **PAG**, **PMC**, **PGA** | Parameterized pallet bases and cargo-load contours. |

<details>
<summary><strong>Reference dimensions and ratings in the model registry</strong></summary>

The following rounded values describe the configured models, not certification for a particular physical ULD. Dimensions are width × depth × height; pallet height is base thickness. Pallet volumes describe the modeled netted cargo contour.

| Model | Dimensions | Volume / tare / max gross |
| :--- | :--- | :--- |
| AKE · LD-3 | 1.53 × 1.56 × 1.62 m | 4.3 m³ (152 ft³) / Tare 92 kg · Gross 1,588 kg |
| AKC · LD-1 | 1.56 × 1.53 × 1.63 m | 4.8 m³ (170 ft³) / Tare 85 kg · Gross 1,588 kg |
| DPE · LD-2 | 1.19 × 1.53 × 1.63 m | 3.4 m³ (120 ft³) / Tare 75 kg · Gross 1,225 kg |
| DQF · LD-8 | 2.44 × 1.53 × 1.63 m | 6.9 m³ (245 ft³) / Tare 127 kg · Gross 2,449 kg |
| AQP · LD-4 | 2.44 × 1.53 × 1.63 m | 5.5 m³ (195 ft³) / Tare 120 kg · Gross 2,449 kg |
| AKH · LD3-45 | 1.53 × 1.56 × 1.14 m | 3.3 m³ (116 ft³) / Tare 82 kg · Gross 1,588 kg |
| ALF · LD6 | 3.18 × 1.53 × 1.63 m | 8.9 m³ (316 ft³) / Tare 230 kg · Gross 3,175 kg |
| ALP · LD-11 | 3.18 × 1.53 × 1.63 m | 7.2 m³ (253 ft³) / Tare 185 kg · Gross 3,176 kg |
| AAP · LD-9 | 3.18 × 2.24 × 1.63 m | 10.8 m³ (381 ft³) / Tare 270 kg · Gross 6,033 kg |
| RKN · LD-9 | 2.00 × 1.53 × 1.62 m | 3.6 m³ internal / Tare 285 kg · Gross 3,500 kg |
| RAP · LD-9 | 3.18 × 2.44 × 1.62 m | 6.6 m³ (233 ft³) / Tare 450 kg · Gross 6,033 kg |
| AMA · M-1 | 3.18 × 2.44 × 2.44 m | 17.6 m³ (621 ft³) / Tare 314 kg · Gross 6,804 kg |
| AMD · M1H | 2.44 × 3.18 × 3.00 m | 21.2 m³ (750 ft³) / Tare 370 kg · Gross 6,804 kg |
| AGA · M-2 | 2.44 × 6.06 × 2.44 m | 33.7 m³ (1,190 ft³) / Tare 1,000 kg · Gross 11,340 kg |
| PAG · P1P | 3.18 × 2.24 × 0.05 m | 11.5 m³ netted contour / Tare 110 kg · Gross 6,033 kg |
| PMC · P6P | 3.18 × 2.44 × 0.05 m | 12.6 m³ netted contour / Tare 120 kg · Gross 6,804 kg |
| PGA · 20 ft | 6.06 × 2.44 × 0.05 m | 36.0 m³ netted contour / Tare 541 kg · Gross 13,608 kg |

</details>

<details>
<summary><strong>Model notes and interpretation</strong></summary>

- AKE's contour toggle changes its geometry; profile families use their own defined sections, including rectangular, single-contour, dual-contour and roof-chamfer shapes.
- RKN and RAP include refrigeration-related details and setpoint displays. These are **simulated visual controls**, not measured temperature or connected refrigeration equipment.
- The spec sheet includes a 2D reference section and an aircraft hold-fit schematic. The latter uses a nominal floor position and simplified section; it is not a loading diagram or proof of clearance.
- The compare overlay is an envelope comparison; it does not validate contour, aircraft position, restraints or certification.
- Dimensions, ratings and specific model options are maintained in [`src/three/models.ts`](src/three/models.ts) and the corresponding generator modules. They should not be assumed to describe every real-world variant.

</details>

## `03 /` Architecture

<div align="center">
  <img src="assets/readme/uld-flow.gif" alt="Animated illustration of the workbench flow: model registry, procedural geometry, Three.js viewer and mesh export" width="100%" />
</div>

```mermaid
flowchart LR
    User["User"] --> UI["React workbench<br/>App + ControlDeck + panels"]
    UI --> Registry["Model registry<br/>metadata + builder"]
    Registry --> Geometry["Generators<br/>AKE / RKN / RAP<br/>profile / pallet"]
    Kernel["Geometry primitives<br/>polygon offsets + assemblies"] --> Geometry
    Textures["Canvas textures<br/>materials + labels"] --> Geometry
    Geometry --> Viewer["Three.js viewer<br/>camera + inspection"]
    UI --> Viewer
    Viewer --> Mesh["GLB / OBJ / STL"]
    Viewer --> Image["PNG snapshot"]
    UI --> Planner["Local load-planning arithmetic"]
    UI --> State["URL-hash viewer state"]
```

**Execution flow**

1. The React workbench initializes the viewer and restores any valid settings from the URL hash.
2. A registry entry selects a generator. Shared primitives build the model; Canvas-generated maps and labels supply material detail.
3. The Three.js viewer presents the scene and responds to camera, assembly and inspection controls. The planner separately computes estimates from entered cargo values and registry ratings.
4. Exporters serialize the current container group; snapshot and source-download actions create local browser downloads. Share links encode viewer settings, **not** planner cargo inputs or divisor.

<details>
<summary><strong>Procedural geometry and materials</strong></summary>

- [`primitives.ts`](src/three/primitives.ts) contains shared geometry helpers, including polygon offsetting, extruded sections and instanced rivet runs. Family generators assemble named parts used by the workbench.
- [`profileContainer.ts`](src/three/profileContainer.ts) implements the shared profile-based container path; [`pmc.ts`](src/three/pmc.ts) contains the shared pallet engine.
- [`textures.ts`](src/three/textures.ts) and [`textureSupport.ts`](src/three/textureSupport.ts) generate and cache Canvas textures. The runtime does not require external 3D model or texture files; optional web fonts are requested separately and have fallbacks.
- [`AKEViewer.ts`](src/three/AKEViewer.ts) manages the Three.js scene, camera, inspection tools, render lifecycle and mesh exporters. Scene coordinates use metres.

</details>

## `04 /` Workbench & outputs

| Capability | What it does | Important boundary |
| :--- | :--- | :--- |
| **Geometry** | Adjust finish and assembly options, animate doors or exploded views, and inspect part groups. | Controls vary by model. |
| **Inspection** | Perspective or orthographic view, dimensions, point-to-point measurement, section cuts and compare envelope. | Section clipping is view-only; exports remain whole and uncapped. |
| **Planning** | Estimate payload and volume utilization, dimensional and chargeable weight, and overload status from entered cargo. | The Studio adds a **cargo-only illustrative mass centroid**, not a certified aircraft centre-of-gravity, floor-strength, restraint or trim calculation. Carrier-specific charging rules and rounding may differ. |
| **Exchange** | Download binary `.glb`, `.obj`, binary `.stl`, a PNG snapshot or selected TypeScript source. | GLB exports visible objects; OBJ/STL export geometry. Check units and output in the target application. |
| **Share** | Encode viewer configuration in the URL hash. | Planner inputs are session-only and are not shared. |

### Model-aware 3D cargo placement sandbox (prototype)

The compact **Cargo 3D** bar at the bottom of the scene offers **LOAD 3D** for whichever ULD family is selected. All **17 registry models**, including **PAG / PMC / PGA pallets**, now get their own 27-carton demonstration, a model-specific outline and a cargo inspector. Switching models preserves selection; a demo manifest is recomputed for the new dimensions, whereas manually entered cargo is kept and re-evaluated. The bar is deliberately slim and no longer blocks the middle of the viewer. Use **EDIT** or the **cargo** tab to change carton dimensions and mass, remove boxes, inspect rejected cargo and view utilization metrics. The cargo manifest is session-only.

The preview derives an **inset rectangular core** from each nominal section profile, with additional illustrative margins for refrigeration units. Pallets get a load space above their plate; their alternative translucent load contour is hidden while cartons are present to avoid overlapping presentations. The deterministic first-fit algorithm (`src/lib/cargoPlacement.ts`) prevents carton-to-carton collisions, checks core bounds, requires full single-carton or floor support, and limits accepted mass by the registry payload rating. This does **not** validate contact with interior fittings or cabin restraints, manufacturer-specific clearances, the cargo net, pallet security, strength, centre-of-gravity, or airworthiness. These are **visual estimates only**, not approved operating or loading instructions. GLB/OBJ/STL exports contain the ULD model, not the carton overlays; share links do not preserve the manifest. The regression suite checks all 17 preview cores and the carton packing invariants.

### Engineering Lenses / Mass Signature (experimental)

The **◇ lenses** action and **studio** inspector reveal four one-tap scenes without changing the selected ULD: **HERO OPTICS** (factory-finish studio lighting), **TECH TEARDOWN** (orthographic component explosion), **CUTAWAY** (view-only clipped interior), and **MASS FIELD** (model-aware 3-D cargo with a 3 × 3 projected mass grid and mass-weighted cargo centroid). The in-studio switches allow lighting rig and in-service/factory surface changes, while **FIELD ON/OFF** displays or hides the projected mass overlay. The viewer continues to use adaptive resolution and settled-scene throttling.

The demo cartons now use separate deterministic kraft-fibre textures on their top, labeled front and side faces, with fold seams and crossed closing tape. Cartons reuse one UV-atlas texture and one PBR material per box (rather than multiple draw calls per cardboard face); shadows refresh only when geometry changes. The sandbox exports its measurements as a clearly marked **non-certified CSV**, separate from the existing ULD-only GLB/OBJ/STL exports.

The mass field divides the preview core into nine equal plan-view areas and apportions each accepted carton's mass by overlap of its horizontal footprint. It includes stacked cartons in their footprint cells and calculates a mass-weighted centroid from carton positions. The `kg/m²` number is **projected mass per grid area**, not actual physical contact pressure or a safe floor-load threshold. Neither the box models nor this analytical view can certify real ULD hardware clearances, load securing, centre-of-gravity limits, floor strength, vibration, or airworthiness. These tools are designed as engineering explorations; uniqueness is not claimed. See `src/lib/cargoSignature.ts` and the tests for numerical evidence.

### Presentation focus and public sharing

The initial scene now uses a fixed three-quarter camera view prioritizing the mechanical door with the contoured side still visible. Dimension callouts and automatic orbit start **off** to keep the silhouette readable and allow the existing settled-scene GPU throttle to engage; both remain available as explicit controls and are retained by shared-viewer URLs.

The top-bar **⊞ focus** action switches to a full-canvas presentation HUD for showcasing the 3D scene without stacked control panels. **Escape** or **exit focus** restores the full workbench. It preserves the current unit, camera and cargo overlay. The studio presentation uses static HUD guides and does not add a second renderer or continuous decorative animation. The production domain is `https://containers.yaslogist.com/`, with a 1200 × 630 conceptual promotional cover (`public/og-uld360-v1.jpg`) for LinkedIn/Open Graph and Twitter large-image previews. The cover is illustrative artwork, not a live screenshot or an OEM-certified aircraft loading scene.

## `05 /` Ignition

**Requirements:** Node.js **20.19 or newer**, npm, and a browser with JavaScript and WebGL available.

```bash
# Install exactly the dependencies in the lockfile
npm ci

# Start the Vite development server
npm run dev

# In another terminal: tests, TypeScript check and production build
npm run verify

# Serve the completed production build locally
npm run preview
```

The build writes `dist/index.html`. [`vite-plugin-singlefile`](vite.config.ts) inlines the application bundle and CSS into that file; external Google Fonts are optional, with system fallbacks. For the development server and production preview, follow the local address printed by Vite.

<details>
<summary><strong>Individual commands</strong></summary>

```bash
npm test             # Node test runner via tsx
npm run typecheck    # TypeScript, no output
npm run build        # typecheck + Vite production build
```

The repository's [CI workflow](.github/workflows/ci.yml) runs tests and build on Node 20.19 and 22, audits dependencies at the high-severity threshold, and uploads the Node 22 single-file build. CI configuration describes the checks; it is not a claim that a particular remote run passed.

</details>

## `06 /` Engineering notes

**Realism validation:** The AKE industrial detail layer includes distinct rigid-metal / textile-curtain closure demonstrations, factory/service surface conditions, physically grounded metal and paint responses, and distance-adaptive microhardware. Rigid profile-container doors now release twin cam spindles before hinged rotation, with a clickable operator handle; the timing, damping and gasket motion are illustrative rather than OEM-certified physical forces. The workbench uses user-provided **YASLOGIST Air Cargo & Aviation** service branding, keeping hazard decals and ULD identification separate. See [REALISM_VALIDATION.md](docs/REALISM_VALIDATION.md) and [BRAND_ARCHITECTURE.md](assets/branding/BRAND_ARCHITECTURE.md). Manufacturer-specific geometry and live loading remain unverified.

| Area | Status in this repository | Evidence / limitations |
| :--- | :--- | :--- |
| ULD geometry and inspection | Implemented | [Registry](src/three/models.ts), [generators](src/three/), [viewer](src/three/AKEViewer.ts); model details and options differ. |
| Planner and sharing | Implemented | [Planner](src/lib/planner.ts) is an estimate; [state codec](src/lib/state.ts) handles viewer settings only. |
| Automated checks | Implemented | [Tests](tests/) cover generator and geometry invariants, planning, state, UI-related logic and viewer math; they are not a substitute for an operational or browser certification. |
| Live deployment | Verified on 2026-11-23 | [Production](https://containers.yaslogist.com/) returned HTTP 200 and the matching Vercel deployment was READY at commit bf6073a5; future availability is not guaranteed. LinkedIn's cached share preview requires a separate Post Inspector check. |

<details>
<summary><strong>Repository map</strong></summary>

```text
src/
  App.tsx                 React workbench, state and download actions
  components/             Controls, panels and shared UI
  lib/                    Planner, share-state codec, units and downloads
  three/                  Registry, procedural generators, textures and viewer
tests/                    Automated TypeScript tests
vite.config.ts            Vite, React, Tailwind and single-file build
assets/readme/            README artwork and rendering source
```

</details>

<details>
<summary><strong>About the README artwork</strong></summary>

The hero uses a locally stored AI-generated conceptual illustration with composited typography and procedural motion. The loop and the animated flow strip are GIFs for GitHub-compatible playback; [the static poster](assets/readme/uld-cinematic-poster.png) is available for readers who prefer still imagery. The artwork can be regenerated with [`render_cinematic.py`](assets/readme/render_cinematic.py), Pillow and DejaVu fonts; this is a documentation-only tool, not an application dependency.

</details>

---

<div align="center">
  <p><strong>ULD360 &nbsp; / &nbsp; YASLOGIST</strong></p>
  <p>Geometry made tangible. Engineering made visible.</p>
  <p><a href="https://www.yaslogist.com">www.yaslogist.com ↗</a></p>
</div>
