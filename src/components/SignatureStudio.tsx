import { memo, useMemo, useState } from "react";
import { MODELS, type ModelId } from "@/three/models";
import { getCargoZoneBreakdown, type CargoSignature } from "@/lib/cargoSignature";
import { cargoCoreForModel } from "@/lib/cargoPlacement";
import type { CargoPlan } from "@/lib/cargoPlacement";
import type { MoodId, ViewerState } from "@/three/AKEViewer";
import { cn } from "@/utils/cn";

export type StudioPreset = "hero" | "teardown" | "cutaway" | "field";

const PRESETS: { id: StudioPreset; idLabel: string; name: string; info: string }[] = [
  { id: "hero", idLabel: "01", name: "HERO OPTICS", info: "Studio lighting · physically based finish" },
  { id: "teardown", idLabel: "02", name: "TECH TEARDOWN", info: "Orthographic · exposed assemblies" },
  { id: "cutaway", idLabel: "03", name: "CUTAWAY", info: "Internal profile · opening study" },
  { id: "field", idLabel: "04", name: "MASS FIELD", info: "Cargo 3D · centroid & density map" },
];

const formatOffset = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export const SignatureStudio = memo(function SignatureStudio({
  model, state, plan, signature, fieldVisible, activePreset,
  onPreset, onFieldVisible, onPatch, onExport, onInspectCarton,
}: {
  model: ModelId;
  state: ViewerState;
  plan: CargoPlan;
  signature: CargoSignature;
  fieldVisible: boolean;
  activePreset: StudioPreset | null;
  onPreset: (mode: StudioPreset) => void;
  onFieldVisible: (visible: boolean) => void;
  onPatch: (patch: Partial<ViewerState>) => void;
  onExport: () => void;
  onInspectCarton: (id: string) => void;
}) {
  const max = Math.max(1, signature.maxCellKg);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selectedBreakdown = useMemo(() => {
    if (selectedZone === null || selectedZone < 0 || selectedZone >= 9) return null;
    return getCargoZoneBreakdown(
      plan, cargoCoreForModel(model, state.contour),
      Math.floor(selectedZone / 3), selectedZone % 3,
    );
  }, [model, plan, selectedZone, state.contour]);
  return (
    <div className="space-y-3 font-mono text-[10px]">
      <div className="relative overflow-hidden border border-[#4a8aa6]/60 bg-[radial-gradient(ellipse_at_top_right,rgba(64,147,174,.24),transparent_70%),#0b1c29] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] uppercase tracking-[.23em] text-[#9bc9dc]">YAS / ENGINEERING LENSES</span>
          <span className="border border-[#76b4d0]/40 px-1.5 py-0.5 text-[9px] text-[#bcdfeb]">{MODELS[model].code}</span>
        </div>
        <div className="mt-2 font-display text-[20px] font-bold uppercase tracking-[.07em] text-white">
          See past the skin.
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-[#a8c5d1]">
          Four repeatable engineering views. Same model, different evidence.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map(preset => (
          <button key={preset.id} type="button" onClick={() => onPreset(preset.id)}
            aria-pressed={activePreset === preset.id}
            className={cn(
              "min-h-[100px] border p-2 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#a6dce9]",
              activePreset === preset.id
                ? "border-[#96d7ed] bg-[#173b4b] shadow-[0_0_20px_rgba(80,160,188,.13)]"
                : "border-[#37515f] bg-[#121d25] hover:border-[#789bad] hover:bg-[#1a303c]",
            )}>
            <span className="text-[9px] tracking-[.16em] text-[#8db9c9]">{preset.idLabel} / LENS</span>
            <div className="mt-2 font-display text-[12px] font-bold tracking-[.05em] text-white">{preset.name}</div>
            <p className="mt-1 text-[9px] leading-[1.4] text-[#a4b9c5]">{preset.info}</p>
          </button>
        ))}
      </div>

      <div className="border border-[#416373]/70 bg-[#0b1721]/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-display text-[12px] font-bold uppercase tracking-[.10em] text-white">Cargo Mass Signature</div>
            <div className="mt-0.5 text-[9px] tracking-[.05em] text-[#99bdcd]">
              3 × 3 projected mass field
            </div>
          </div>
          <button type="button" aria-pressed={fieldVisible}
            disabled={!plan.placed.length}
            onClick={() => onFieldVisible(!fieldVisible)}
            className={cn("min-w-[75px] border px-2 py-1.5 text-[10px] font-semibold uppercase",
              fieldVisible ? "border-[#8bc7da] bg-[#356477] text-white"
                : "border-[#4d6876] text-[#aac8d4] hover:border-[#89c5d7]",
              !plan.placed.length && "cursor-not-allowed opacity-40")}>
            {fieldVisible ? "FIELD ON" : "FIELD OFF"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["ACCEPTED MASS", `${signature.totalKg.toFixed(1)} kg`],
            ["PEAK FOOTPRINT", `${signature.peakKgPerM2.toFixed(1)} kg/m²`],
            ["LATERAL OFFSET", formatOffset(signature.lateralOffsetPct)],
            ["FORE/AFT OFFSET", formatOffset(signature.longitudinalOffsetPct)],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#284555]/80 bg-[#132c39]/55 p-2">
              <div className="text-[8px] uppercase tracking-[.08em] text-[#91b3c2]">{label}</div>
              <div className="mt-1 font-display text-[15px] font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-3">
          <div className="grid aspect-square w-[45%] shrink-0 grid-cols-3 gap-1 rounded-sm border border-[#355364] bg-[#06131b] p-1" role="group"
            aria-label="Inspect nine projected mass zones">
            {signature.cells.map(c => {
              const ratio = c.kg / max;
              const index = c.row * 3 + c.column;
              const selected = selectedZone === index;
              return (
                <button key={`${c.row}-${c.column}`} type="button"
                  aria-label={`Inspect zone row ${c.row + 1} column ${c.column + 1}, ${c.kg.toFixed(1)} kg projected`}
                  aria-pressed={selected} disabled={!c.kg}
                  onClick={() => {
                    setSelectedZone(current => current === index ? null : index);
                    setShowAll(false);
                  }}
                  className={cn(
                    "flex min-h-11 items-center justify-center border font-mono text-[9px] font-semibold text-white",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5efff]",
                    selected ? "border-[#d9f8ff] ring-2 ring-[#86e7f6]" : "border-white/10",
                    !c.kg ? "cursor-default" : "hover:border-[#b7e7f6]",
                  )}
                  style={{ background: c.kg
                    ? `rgba(${Math.round(39 + ratio * 171)}, ${Math.round(111 + ratio * 24)}, ${Math.round(147 - ratio * 78)}, ${(0.22 + ratio * .65).toFixed(2)})`
                    : "rgba(20,37,48,.55)" }}>
                  {c.kg ? c.kg.toFixed(0) : "·"}
                </button>
              );
            })}
          </div>
          <div className="flex-1 space-y-1.5 text-[9px] leading-relaxed text-[#a7c0cc]">
            <div className="text-[10px] font-bold uppercase text-[#d6ecf4]">Where mass sits</div>
            <p>Tap a numbered zone to inspect the contributing cartons. Values include stacked cartons.</p>
            <p className="text-[#d6b37c]">This is a plan-view projection, not floor pressure or certified loading.</p>
            {!plan.placed.length && <p>Add or load cartons to activate.</p>}
          </div>
        </div>
        {selectedBreakdown && (
          <section aria-label="Selected mass zone breakdown"
            className="mt-2 border border-[#5594ae]/70 bg-[#102936]/85 p-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-mono text-[11px] font-bold text-white">
                  Zone R{selectedBreakdown.row + 1} / C{selectedBreakdown.column + 1}
                </h3>
                <p className="mt-1 text-[10px] text-[#c8e6ee]">
                  {selectedBreakdown.projectedKg.toFixed(2)} kg projected ·
                  {" "}{selectedBreakdown.projectedKgPerM2.toFixed(1)} kg/m² index
                </p>
              </div>
              <button type="button" aria-label="Close selected mass zone"
                onClick={() => setSelectedZone(null)}
                className="min-h-9 min-w-9 border border-[#52788a] text-[#d2edf4] hover:bg-[#245062]">×</button>
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-[#a8c7d7]">
              <span>{selectedBreakdown.contributors.length} contributing cartons</span>
              <span>share of projected zone mass</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {(showAll ? selectedBreakdown.contributors : selectedBreakdown.contributors.slice(0, 4))
                .map(carton => (
                  <div key={carton.id}
                    className="flex flex-wrap items-center justify-between gap-2 border border-[#345c71] bg-[#0b1b27]/80 px-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-semibold text-[#edfaff]">{carton.label}</div>
                      <div className="mt-1 text-[9px] text-[#b5d2de]">
                        {carton.projectedKg.toFixed(2)} kg · {carton.sharePct.toFixed(1)}% of zone
                        {" · "}{carton.verticalLayer === "above-preview-floor" ? "elevated" :
                          carton.verticalLayer === "preview-floor" ? "floor level" : "unknown level"}
                      </div>
                    </div>
                    <button type="button"
                      aria-label={`Highlight ${carton.label} contributing to zone in 3D`}
                      onClick={() => onInspectCarton(carton.id)}
                      className="min-h-10 border border-[#5d9cb5] px-2 text-[9px] font-bold text-[#b9e7f6] hover:bg-[#22475a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                      Inspect 3D
                    </button>
                  </div>
                ))}
            </div>
            {!showAll && selectedBreakdown.contributors.length > 4 && (
              <button type="button" onClick={() => setShowAll(true)}
                className="mt-2 min-h-10 w-full border border-[#466f83] text-[10px] text-[#d2e9ef] hover:bg-[#254858]">
                Show all {selectedBreakdown.contributors.length} contributors
              </button>
            )}
            <p className="mt-2 text-[9px] leading-relaxed text-[#e4c58d]">
              Shares use horizontal overlap, even for elevated cartons.
              Not a contact-force, restraint, structural or aircraft trim assessment.
            </p>
          </section>
        )}
      </div>

      <button type="button" onClick={onExport} disabled={!plan.placed.length}
        className="min-h-10 w-full border border-[#608fa4] bg-[#143443] px-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#d1e7ed] hover:border-[#a2d8ea] hover:bg-[#235063] disabled:cursor-not-allowed disabled:opacity-40">
        ↓ Export inspection data / CSV
      </button>

      <div className="border-t border-line-soft pt-3">
        <div className="mb-2 text-[9px] uppercase tracking-[.18em] text-[#95b5c4]">Surface / lighting study</div>
        <div className="flex gap-1">
          {(["factory", "service"] as const).map(condition => (
            <button type="button" key={condition}
              aria-pressed={state.surfaceCondition === condition}
              onClick={() => onPatch({ surfaceCondition: condition })}
              className={cn("min-h-9 flex-1 border px-2 text-[10px] uppercase",
                state.surfaceCondition === condition
                  ? "border-[#87c3d7] bg-[#204355] text-white"
                  : "border-line text-[#9bb7c6] hover:border-[#75a9c0]")}>
              {condition === "factory" ? "Factory" : "In Service"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {(["hangar", "studio", "dusk"] as MoodId[]).map(light => (
            <button key={light} type="button"
              aria-pressed={state.mood === light}
              onClick={() => onPatch({ mood: light })}
              className={cn("min-h-9 flex-1 border px-2 text-[10px] uppercase",
                state.mood === light
                  ? "border-[#87c3d7] bg-[#204355] text-white"
                  : "border-line text-[#9bb7c6] hover:border-[#75a9c0]")}>
              {light === "dusk" ? "Apron" : light}
            </button>
          ))}
        </div>
      </div>

      <p className="border-t border-line-soft pt-2 text-[9px] leading-relaxed text-[#98adba]">
        ENGINEERING PREVIEW — no OEM validation, approved flight loading, restraint analysis, or unique-feature claim.
      </p>
    </div>
  );
});
