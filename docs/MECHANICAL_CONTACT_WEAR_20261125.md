# Mechanical contact wear — 25 November 2026

Baseline 862315a. Existing hinge pins/knuckles use a dedicated
bearing material, and existing latch hubs, keepers and cams (where
present) use a dedicated contact material. Their roughness differs
from general structural hardware. In-service mode applies two
deterministic 256x128 albedo textures: narrow circumferential bearing
marks and local contact scratches. Factory-clean mode removes the
wear maps. The textures are illustrative surface cues, not measured
tribology, wear depth or damage evidence. Rods, straps, handles and
walls retain their existing materials. The two maps use 65,536 source
texels in total; underlying hardware normal/roughness textures are
shared. No geometry, dependencies or postprocessing added.

Local MacBook M1 Pro WebKit 1440x900, AKE/RAP/AKH at 9% door
progress, both surface states selected in the UI, six before/after
pages HTTP 200, no JS page errors, WebGL active, no overflow.
STL downloads for all three model pairs identical by SHA-256,
all three candidate STLs edge-closed. Draw counts unchanged:
AKE 46.6k tris/118 calls, RAP 67.5k/180, AKH 45.8k/107.
Brief HUD readings 57–60 FPS; no sustained GPU or mobile hardware
performance claim. AKE screenshot inspected at unlatch phase.
136/136 automated tests, typecheck and build. Tests check all 14
rigid models, no wear assignment on pallets/unrelated meshes, and
texture clone lifecycle. No OEM wear or mechanical certification.
