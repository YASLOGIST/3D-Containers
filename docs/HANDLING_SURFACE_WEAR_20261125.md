# Handling surface wear — 25 November 2026

Baseline e6d919c. The existing transverse floor wear strips now have a
dedicated metallic material, rather than borrowing the wall liner's
palette. In-service appearance adds deterministic fine slide marks,
faint handling haze and edge abrasion. Pallet base plates receive a
separate large-surface wear pattern; underside reinforcing ribs use the
existing alloy material. Factory-clean mode omits the cosmetic wear
map. No change to shape, thickness, cargo placement or load rating.

The 512x128 strip texture and 512x512 deck texture are generated locally,
cached, and used only on existing parts. No added geometry, postprocess,
external assets, or dependencies. One additional albedo texture is used
per active model. These are illustrative surface marks, not measured
wear depth, friction coefficients, or defect/maintenance evidence.

MacBook M1 Pro WebKit 1440x900: AKE open, RAP open and PMC unloaded,
before/after, each with factory-clean and in-service selected through
the UI. Six pages HTTP 200, active WebGL, no JS exceptions or overflow.
All three STL before/after pairs identical by SHA-256. AKE loaded demo
also retains 27/27 placed cartons. Displayed counts remain unchanged:
AKE 46.6k triangles / 118 calls, RAP 67.5k / 180, PMC 27.1k / 101.
Brief HUD readings ranged 58–60 FPS; not a sustained GPU benchmark.
134/134 tests, type-check and build passed.

The change covers modeled strips and deck plates, not the entire inner
hull floor. Manufacturer reference textures, true physical abrasion,
hardware-localized wear, low-end and physical phone measurements remain
separate work.
