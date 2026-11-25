# ULD360 — carton micro-realism, 25 November 2026

This visual-only update replaces sharp box edges with a shared rounded
unit mesh (1.2% radius, one rounding segment). It preserves the nominal
packing AABB. The new 512×512 atlas retains the previous 262,144 texel
budget and one material: seeded kraft-paper fibres, compressed edges,
single centre flap seam, paper-reinforced tape, distinct underside and
a clearly illustrative non-operational label. No external assets or
dependencies. The rounded radius scales with each carton dimension and
is not a measured manufacturing radius.

Actual MacBook M1 Pro WebKit before/after inspection at 1440×900,
loaded AKE 27-carton demo: both show 27/27, 675 kg, 71% core use;
142 displayed draw calls in both screenshots, triangles approximately
47.1k → 49.7k, no JavaScript page exceptions. The per-carton geometry
has 108 triangles instead of 12 (2,592 extra triangles for 27 cartons,
3,840 for 40). The screenshots show improved edge definition, tape
and more natural carton tones. This is not a continuous GPU benchmark
or physical low-end/mobile performance verification. Existing carton
placement and engineering exports are not altered by the new visuals.

Tests verify nominal geometry bounds, 108 triangles, UV tile gutters,
single material groups and unchanged texture pixel budget.
