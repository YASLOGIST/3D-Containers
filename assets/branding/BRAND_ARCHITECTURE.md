# YASLOGIST — service-family brand architecture

Brand owner: YASLOGIST. Asset source: the two user-supplied Air Cargo & Aviation logos. These are **service identity**, not a manufacturer certificate or airline operational label.

## Brand family

| Service | Current identity | Intended future identity |
| --- | --- | --- |
| **Air** | Air Cargo & Aviation — approved source assets in this folder | Active ULD workbench theme |
| Land | No artwork supplied or approved in this change | Reserved service-specific logo/theme slot |
| Ocean | No artwork supplied or approved in this change | Reserved service-specific logo/theme slot |

Do not invent land/ocean marks or reuse the aviation identity as if it were a final multimodal group symbol.

## Air logos — source of truth

- `air/original-color-emblem.png`: full-resolution circular blue and navy AIR CARGO & AVIATION emblem. Use as **primary service identity** in the website header, landing material, service cards and desktop/mobile navigation.
- `air/original-minimal-monogram.jpg`: full-resolution monochrome YL / airplane mark with service description. Use as **secondary technical identity** on a discreet ULD operator-mark decal, technical plate, documentation and monochrome reproduction.
- Runtime-optimized transparent logos are under `src/assets/branding/` and generated from these originals, not redrawn or changed in meaning.

## Presentation rules

1. Current app uses a restrained navy/sky-blue accent palette on its controls. Actual hazard/stencil labels remain visible in safety yellow and are never blue-washed just to match a logo.
2. Keep identification plates, tare, maximum gross, serial/barcode, handling warnings, door locks and load limits legible and unobscured. The operator-mark placard must never substitute for a traceable airline/ULD owner mark.
3. Do not place the monogram as a floating decal independent of the door. For rigid models it is attached to the **door pivot**; for models without a suitable rigid door, the UI remains the service-identity surface instead.
4. Never apply logo art as a structural part of a load/airworthiness model.
5. Preserve source artwork without accumulating duplicate historical variants in the production bundle; review all exported GLB/PNG screenshots to confirm the logo stays correctly registered at normal and macro viewing distances.

## Acceptance / provenance limits

The demo is a **YASLOGIST-branded ULD visualization lab**. Air Cargo & Aviation is a user-selected YASLOGIST service identity; it is not a certificate, IATA inspection label, airplane approval or an assertion about ownership of depicted generic manufacturer equipment. Original graphics should be reviewed for trademark use and supplier permission before any commercial deployment.
