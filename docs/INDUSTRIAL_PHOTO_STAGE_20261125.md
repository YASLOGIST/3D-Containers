# Industrial photo stage — 25 November 2026

Baseline b831d49. Replace the hangar gradient backdrop with a low-contrast
procedural 2:1 architectural panorama (clerestory panes, structural bays,
sectional doors and overhead fixtures). The existing room reflection probe
is retained. This is art-directed distant scenery, not a real hangar,
HDR capture, architectural geometry or physical lighting simulation.

Refine the existing apron texture with aggregate, trowel variation and
thin slab joints. Remove the repeated painted boxes from the tiled
concrete and instead render a single 6.4 x 5.8 m illustrative bay marking
on an independent scene-only plane. Studio mode removes the apron and
marking for clean presentation. The marking adds one draw call and
two triangles in hangar/dusk only. Panorama 1024x512 and paint 512x512
on desktop; quarter source pixels on touch-first devices. No new assets,
dependencies or postprocessing. Scene-only stage is excluded from exports.

MacBook M1 Pro WebKit 1440x900: baseline and first candidate, AKE/RAP
hangar, PMC studio, AKE dusk; all eight pages HTTP 200, no exceptions,
WebGL active, no overflow. The final panorama was adjusted to bring
architectural details toward the visible horizon. Final local preview
rechecked all four configurations. AKE/RAP binary STL exports remained
byte-identical to baseline. AKE 46.6k triangles / 119 calls, RAP 67.5k /
181 calls, PMC studio 27.1k / 101 calls. HUD displayed idle state.
138/138 tests, type-check/build. Tests cover panorama aspect ratio,
source cache, resolution budgets and separated marking/tile wrapping.

The stage is a subtle visual improvement, not photorealistic warehouse
geometry. No sustained FPS, physical phone, or material photometry claim.
