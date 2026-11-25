# ULD360 material microfinish — 25 November 2026

Visual-only refinement based on the aac3d71 release. The shell rolling
grain now uses shorter directional strokes and a separate calibrated
roughness map. Painted and bead-blast finishes use the existing
isotropic grain instead of directional brushing. Alloy and steel
hardware share a 256x256 roughness/normal pair; rivets share its
roughness map. Rubber/fittings are dielectric with a visible matte
diffuse grain instead of a dark map multiplied by an almost-black tint.
Service patina includes restrained cosmetic handling haze, not real
corrosion evidence. Visual inspection of the first candidate prompted
a reduction in haze and roughness variation before release.

The new hardware pair adds 131,072 source texels (~0.5 MiB of uncompressed
RGBA base-level pixels, excluding mipmaps and driver allocations).
No new geometry, draw calls, external assets or dependencies are
introduced by these changes. Material texture lookups do increase.

MacBook M1 Pro WebKit local preview, 1440x900, AKE/RKN/PMC all HTTP 200,
WebGL available, no page JavaScript errors. Final AKE screenshot
46.6k triangles and 117 draw calls, same as previous production.
RKN 49.1k/130 and PMC 27.7k/103 displayed. Brief drag smoke passed
on an initial candidate, but the sample was too short to substantiate
a sustained frame-rate claim. No physical mobile or GPU memory benchmark.

npm run verify: 129/129 tests; type-check and build pass. Tests cover
shared hardware texture identity, dimensions, linear data color space,
rubber dielectric response and isotropic skin selection. All appearances
are representative, not measured OEM material data or defect evidence.
