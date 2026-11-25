# Ground contact and inspection lighting — 25 November 2026

Baseline 8f50d92. Add a 128x128 procedural alpha texture to a single
scene-only ground plane, sized using the lowest section profile
rather than the wider upper contour. The contact cue complements
existing directional shadows; it is not ray-traced ambient occlusion.
It is hidden for exploded, sectioned and wireframe inspections.
It is outside the model root, and does not enter engineering exports.
The interior inspection fill is now zero at a closed rigid leaf,
increases smoothly after release using actual displayed door progress,
and is disabled for pallets. Section mode retains a fixed inspection
fill. No claim of a real installed lamp or measured illuminance.

MacBook Pro M1 Pro, isolated WebKit, 1440x900: four representative
before/after configurations (AKE closed/open, RKN open, PMC closed),
all eight pages HTTP 200, WebGL active, no JS exceptions or overflow.
AKE screenshot comparison showed a subtle grounding cue and a dark
rubber door rim. The scene adds one draw call and two triangles.
No postprocessing pass, new external assets or dependencies.
132/132 tests, type-check and production build passed.
No sustained GPU benchmark, physical mobile validation or OEM
lighting measurement. Further work: localised hardware occlusion,
realistic floor surface and calibrated material/reference photography.
