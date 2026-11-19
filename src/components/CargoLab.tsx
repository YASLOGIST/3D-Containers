import { useRef, useState } from "react";
import {
  AKE_CARGO_CORE,
  type CargoItem,
  type CargoPlan,
} from "@/lib/cargoPlacement";
import { Btn } from "./ui";

const PRESETS = [
  { name: "Small", widthM: 0.4, depthM: 0.4, heightM: 0.4, massKg: 20 },
  { name: "Medium", widthM: 0.6, depthM: 0.4, heightM: 0.35, massKg: 35 },
  { name: "Large", widthM: 0.8, depthM: 0.6, heightM: 0.45, massKg: 65 },
] as const;

const REASONS = {
  invalid: "Invalid dimensions or mass",
  oversize: "Exceeds conservative interior bounds",
  overweight: "Exceeds remaining nominal payload",
  "no-space": "No collision-free, supported position",
} as const;

export function CargoLab({
  items, plan, onChange, isAKE, onOpenDoor, onLoadDemo,
}: {
  items: CargoItem[];
  plan: CargoPlan;
  onChange: (items: CargoItem[]) => void;
  isAKE: boolean;
  onOpenDoor: () => void;
  onLoadDemo: () => void;
}) {
  const sequence = useRef(1);
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

  if (!isAKE) return (
    <div className="space-y-3 text-sm text-dim">
      <p>The carton-placement sandbox currently supports AKE / LD-3 only.</p>
      <p>Select <strong className="text-ink">AKE</strong> above to inspect your cargo plan. Other ULD models remain unchanged.</p>
    </div>
  );

  return (
    <div className="space-y-3 font-mono text-[11px]">
      <div className="border border-amber/30 bg-amber/5 p-2 text-[10px] leading-relaxed text-ink/80">
        <strong className="text-amber">ENGINEERING SANDBOX</strong>
        <p className="mt-1">Conservative rectangular core only. No certified ULD fit, structural support, restraints, load securing or aircraft centre-of-gravity checks. Estimates are not loading instructions.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["Placed cartons", `${plan.placed.length} / ${items.length}`],
          ["Accepted mass", `${plan.loadedKg.toFixed(1)} kg`],
          ["Core utilization", `${plan.coreUtilizationPct.toFixed(1)}%`],
          ["Free payload", `${plan.availableKg.toFixed(1)} kg`],
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
        Core: {AKE_CARGO_CORE.widthM.toFixed(2)} × {AKE_CARGO_CORE.depthM.toFixed(2)} × {AKE_CARGO_CORE.heightM.toFixed(2)} m.
        It is smaller than the ULD's rated cargo volume.
      </div>

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
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#bfe8f3]">Instant scene / 30 cartons</div>
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
          <Btn onClick={onOpenDoor}>cutaway inspection view</Btn>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <Btn key={p.name} onClick={() => add(p)}>+ {p.name}</Btn>
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="stencil text-[10px] text-ink">Cargo manifest · session only</span>
          <Btn tone="ghost" disabled={!items.length} onClick={() => { onChange([]); setValidation(""); }}>
            clear all
          </Btn>
        </div>
        {items.length === 0 && (
          <p className="py-3 text-[10px] text-dim">Add a carton to visualize its position inside the AKE.</p>
        )}
        {items.map(item => {
          const problem = plan.rejected.find(r => r.item.id === item.id);
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 border border-line-soft bg-void/45 px-2 py-2">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{item.label} <span className={problem ? "text-signal" : "text-jade"}>· {problem ? "NOT PLACED" : "PLACED"}</span></div>
                <div className="mt-0.5 text-[9px] text-dim">{item.widthM} × {item.depthM} × {item.heightM} m · {item.massKg} kg</div>
                {problem && <p className="mt-1 text-[9px] text-signal">{REASONS[problem.reason]}</p>}
              </div>
              <Btn tone="ghost" title={`Remove ${item.label}`} onClick={() => onChange(items.filter(i => i.id !== item.id))}>remove</Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}
