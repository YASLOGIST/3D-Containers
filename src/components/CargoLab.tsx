import { useMemo, useRef, useState } from "react";
import {
  cargoCoreForModel,
  type CargoItem,
  type CargoPlan,
} from "@/lib/cargoPlacement";
import { Btn } from "./ui";
import { MODELS, type ModelId } from "@/three/models";
import { assessCargoEvidence } from "@/lib/cargoEvidence";
import { CargoEvidencePanel } from "@/components/CargoEvidencePanel";
import { diagnoseCartons, exportCartonDiagnosticsCSV } from "@/lib/cargoDiagnostics";
import { downloadText } from "@/lib/io";
import { cargoMassLedger } from "@/lib/cargoMassLedger";

const PRESETS = [
  { name: "Small", widthM: 0.4, depthM: 0.4, heightM: 0.4, massKg: 20 },
  { name: "Medium", widthM: 0.6, depthM: 0.4, heightM: 0.35, massKg: 35 },
  { name: "Large", widthM: 0.8, depthM: 0.6, heightM: 0.45, massKg: 65 },
] as const;

export function CargoLab({
  items, plan, onChange, model, contour, onOpenDoor, onLoadDemo,
  selectedCartonId, onSelectCarton,
}: {
  items: CargoItem[];
  plan: CargoPlan;
  onChange: (items: CargoItem[]) => void;
  model: ModelId;
  contour: boolean;
  onOpenDoor: () => void;
  onLoadDemo: () => void;
  selectedCartonId: string | null;
  onSelectCarton: (id: string | null) => void;
}) {
  const sequence = useRef(1);
  const core = cargoCoreForModel(model, contour);
  const spec = MODELS[model];
  const ledger = cargoMassLedger(plan.placed, core);
  const evidence = assessCargoEvidence(model, items, plan);
  const diagnostics = useMemo(
    () => diagnoseCartons(model, items, plan, contour),
    [model, items, plan, contour],
  );
  const [manifestFilter, setManifestFilter] = useState<"all" | "placed" | "rejected">("all");
  const visibleRows = diagnostics.rows.filter(row =>
    manifestFilter === "all" || row.status === manifestFilter,
  );
  const [draft, setDraft] = useState({
    widthM: "0.40", depthM: "0.40", heightM: "0.40", massKg: "20",
  });
  const [validation, setValidation] = useState("");

  const add = (values: { widthM: number; depthM: number; heightM: number; massKg: number }) => {
    if (items.length >= 40) { setValidation("Preview limit: 40 cartons"); return; }
    if (Object.values(values).some(v => !Number.isFinite(v) || v <= 0)) {
      setValidation("Enter positive, finite dimensions and mass.");
      return;
    }
    const item: CargoItem = {
      id: `carton-${Date.now()}-${sequence.current++}`,
      label: `Carton ${items.length + 1}`,
      ...values,
    };
    setValidation("");
    onChange([...items, item]);
  };

  return (
    <div className="space-y-3 font-mono text-[11px]">
      <div className="border border-amber/30 bg-amber/5 p-2 text-[10px] leading-relaxed text-ink/80">
        <strong className="text-amber">{spec.code} · ENGINEERING SANDBOX</strong>
        <p className="mt-1">Conservative {spec.palletOption ? "pallet load envelope" : "rectangular inner core"} only. Manufacturer-specific hardware, nets, hold compatibility, restraints, structural support and aircraft centre-of-gravity are not validated. Not loading instructions.</p>
      </div>

      <CargoEvidencePanel report={evidence} />

      <div className="grid grid-cols-2 gap-2">
        {[
          ["Placed cartons", `${plan.placed.length} / ${items.length}`],
          ["Placed preview mass", `${plan.loadedKg.toFixed(1)} kg`],
          ["Core utilization", `${plan.coreUtilizationPct.toFixed(1)}%`],
          ["Remaining nominal payload*", `${plan.availableKg.toFixed(1)} kg`],
          ["Cargo volume", `${plan.usedM3.toFixed(3)} m³`],
          ["Preview core", `${plan.coreM3.toFixed(2)} m³`],
        ].map(([label, value]) => (
          <div key={label} className="border border-line bg-void/55 p-2">
            <div className="text-[9px] uppercase tracking-wider text-dim">{label}</div>
            <div className="mt-1 text-[13px] font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] uppercase leading-relaxed tracking-wider text-dim">
        Core: {core.widthM.toFixed(2)} × {core.depthM.toFixed(2)} × {core.heightM.toFixed(2)} m.
        It is smaller than the ULD's rated cargo volume.
      </div>

      <section aria-label="Cargo mass ledger" className="border border-line bg-void/55 p-2">
        <h3 className="stencil text-[10px] text-ink">Mass ledger · geometric preview</h3>
        {!ledger.valid ? <p className="mt-1 text-signal">Ledger unavailable: ambiguous or invalid placement.</p>
          : !plan.placed.length ? <p className="mt-1 text-dim">Add cargo to inspect mass attribution.</p>
          : <>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-ink">
              <div>Weighted centroid above preview floor<br /><strong>{ledger.centroidAboveCoreFloorM!.toFixed(3)} m</strong></div>
              <div>Base cartons / stacked cartons<br /><strong>{ledger.floorBaseCount} / {ledger.supportedAboveCount}</strong></div>
              <div>Heaviest attributed stack<br /><strong>{ledger.maxStackMassKg!.toFixed(1)} kg</strong></div>
              <div>Mass attributed to base cartons<br /><strong>{ledger.allocatedKg.toFixed(1)} kg</strong></div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-dim">Single-support carton bookkeeping only; not measured floor reactions, stack strength, floor pressure or aircraft centre of gravity. Container tare mass is excluded.</p>
          </>}
      </section>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="stencil text-[10px] text-ink">Add an axis-aligned carton</div>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["widthM", "Width (m)"],
            ["depthM", "Depth (m)"],
            ["heightM", "Height (m)"],
            ["massKg", "Mass (kg)"],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-[9px] uppercase tracking-wider text-dim">
              {label}
              <input
                aria-label={label}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={draft[key]}
                onChange={e => setDraft(s => ({ ...s, [key]: e.target.value }))}
                className="mt-1 block w-full border border-line bg-void px-2 py-1.5 text-[12px] text-ink outline-none focus:border-amber"
              />
            </label>
          ))}
        </div>
        {validation && <p role="alert" className="text-[10px] text-signal">{validation}</p>}
        <div className="border border-[#608ba2]/60 bg-[#123040]/70 p-2">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#bfe8f3]">{spec.code} · Instant scene / 27 cartons</div>
          <p className="mb-2 text-[10px] leading-relaxed text-[#afc8d4]">
            Load a ready-to-inspect 3D example with a cutaway view and live capacity metrics.
          </p>
          <Btn onClick={onLoadDemo} className="w-full border-[#8fcde2] bg-[#9ccedd] text-[#09141b] hover:bg-[#c0e6f0]">
            ▶ launch loaded 3D scene
          </Btn>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Btn tone="amber" onClick={() => add({
            widthM: Number(draft.widthM), depthM: Number(draft.depthM),
            heightM: Number(draft.heightM), massKg: Number(draft.massKg),
          })}>+ add carton</Btn>
          <Btn onClick={onOpenDoor}>{spec.palletOption ? "inspect pallet loading" : "cutaway inspection view"}</Btn>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <Btn key={p.name} onClick={() => add(p)}>+ {p.name}</Btn>
          ))}
        </div>
      </div>

      <section aria-label="Carton diagnostics" className="space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="stencil text-[10px] text-ink">Carton diagnostics · session only</h3>
            <p className="mt-1 font-mono text-[9px] text-dim" aria-live="polite">
              {diagnostics.placed} placed · {diagnostics.rejected} not placed · {diagnostics.total} submitted
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Btn tone="ghost" title="Export per-carton diagnostics as CSV"
              disabled={!items.length}
              onClick={() => downloadText(
                exportCartonDiagnosticsCSV(diagnostics),
                `uld360-${spec.code.toLowerCase()}-carton-diagnostics.csv`,
                "text/csv",
              )}>
              export CSV
            </Btn>
            <Btn tone="ghost" disabled={!items.length}
              onClick={() => { onChange([]); setValidation(""); setManifestFilter("all"); }}>
              clear all
            </Btn>
          </div>
        </div>
        <div role="group" aria-label="Filter carton diagnostics" className="flex flex-wrap gap-1">
          {([
            ["all", "All", diagnostics.total],
            ["rejected", "Not placed", diagnostics.rejected],
            ["placed", "Placed", diagnostics.placed],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={manifestFilter === key}
              onClick={() => setManifestFilter(key)}
              className={`min-h-9 border px-2.5 font-mono text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${manifestFilter === key
                ? "border-[#8ed4e8] bg-[#193d50] text-white"
                : "border-[#47677b] text-[#bbd5e2] hover:bg-[#19303d]"}`}>
              {label} ({count})
            </button>
          ))}
        </div>
        {items.length === 0 && (
          <p className="py-3 text-[10px] text-dim">Add a carton or load the demo to inspect its position in the selected ULD.</p>
        )}
        {items.length > 0 && !visibleRows.length && (
          <p role="status" className="py-3 text-[10px] text-dim">
            No cartons in this category. Choose All to view the manifest.
          </p>
        )}
        <div className="space-y-1.5">
          {visibleRows.map(row => {
            const item = items[row.index - 1];
            const rejected = row.status === "rejected";
            return (
              <article key={row.id} className={`border p-2 ${selectedCartonId === row.id
                ? "border-[#76ddf1] bg-[#123d50]/75" : "border-line-soft bg-void/45"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-semibold text-ink">
                      {item.label}
                      <span className={rejected ? "text-signal" : "text-jade"}>
                        {" · "}{rejected ? "NOT PLACED" : "PREVIEW PLACED"}
                      </span>
                    </div>
                    <div className="mt-0.5 break-words font-mono text-[9px] text-dim">
                      {item.widthM} × {item.depthM} × {item.heightM} m · {item.massKg} kg
                    </div>
                    {rejected && (
                      <p className="mt-1 text-[10px] font-semibold text-[#e9af9c]">
                        {row.title}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!rejected && (
                      <button type="button" aria-pressed={selectedCartonId === row.id}
                        aria-label={`Highlight ${item.label} in 3D`}
                        onClick={() => onSelectCarton(selectedCartonId === row.id ? null : row.id)}
                        className="min-h-10 border border-[#79bdd6] bg-[#163747] px-2 font-mono text-[9px] font-semibold text-[#caf3fc] hover:bg-[#285369] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        {selectedCartonId === row.id ? "Clear focus" : "Highlight 3D"}
                      </button>
                    )}
                    <Btn tone="ghost" title={`Remove ${item.label}`}
                      onClick={() => onChange(items.filter(i => i.id !== item.id))}>remove</Btn>
                  </div>
                </div>
                <details className="mt-1">
                  <summary className="min-h-9 cursor-pointer select-none py-2 font-mono text-[10px] text-[#9dd3e6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                    {rejected ? "Why not placed? · How to fix" : "Position · carton details"}
                  </summary>
                  <div className="space-y-1.5 border-t border-line-soft pb-1 pt-2 text-[10px] leading-relaxed text-[#bfd4dd]">
                    <p>{row.explanation}</p>
                    <p><strong className="text-[#b7e5f1]">Next:</strong> {row.nextStep}</p>
                    {row.centreM && (
                      <p>
                        Core-relative centre: X {row.centreM.x.toFixed(3)} m ·
                        Y {row.centreM.y.toFixed(3)} m · Z {row.centreM.z.toFixed(3)} m.
                        Not aircraft station coordinates.
                      </p>
                    )}
                    <p>
                      Carton volume: {row.volumeM3?.toFixed(4) ?? "unavailable"} m³ ·
                      illustrative density: {row.densityKgM3?.toFixed(1) ?? "unavailable"} kg/m³.
                    </p>
                    {row.projection && (
                      <div className="border border-[#496c80]/70 bg-[#0c2834]/65 p-2"
                        aria-label="Illustrative carton footprint metrics">
                        <p className="font-semibold text-[#b8e8f4]">Plan-view load index · NOT floor pressure</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-[9px] text-[#9dbdcd]">Horizontal projection</span>
                            <strong>{row.projection.planAreaM2?.toFixed(3) ?? "N/A"} m²</strong>
                          </div>
                          <div>
                            <span className="block text-[9px] text-[#9dbdcd]">Carton mass ÷ area</span>
                            <strong>{row.projection.arealMassIndexKgM2?.toFixed(1) ?? "N/A"} kg/m²</strong>
                          </div>
                        </div>
                        <p className="mt-1.5">
                          {row.projection.layer === "preview-floor" ? "Base at preview floor" :
                            row.projection.layer === "above-preview-floor"
                              ? `Base ${row.projection.baseAboveFloorM?.toFixed(3)} m above preview floor`
                              : "Vertical layer unavailable"}.
                          Projected rectangle only, not verified contact area or transferred floor loading.
                        </p>
                      </div>
                    )}
                    <p>Neither density nor plan-view mass index establishes floor pressure,
                      support strength, restraint adequacy, or aircraft approval.</p>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
        <p className="font-mono text-[9px] leading-relaxed text-[#bb9d78]">
          Diagnostics describe this first-fit 3D sandbox only. No OEM or aircraft loading approval is implied.
        </p>
      </section>
    </div>
  );
}
