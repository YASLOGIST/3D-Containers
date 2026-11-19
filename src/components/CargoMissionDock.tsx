import { useState } from "react";
import type { CargoPlan } from "@/lib/cargoPlacement";

interface Props {
  active: boolean;
  plan: CargoPlan;
  itemCount: number;
  onStart: () => void;
  onInspect: () => void;
  onClear: () => void;
}

export function CargoMissionDock({
  active, plan, itemCount, onStart, onInspect, onClear,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const pct = Math.max(0, Math.min(100, plan.coreUtilizationPct));
  return (
    <div className="pointer-events-none absolute bottom-[108px] left-3 right-3 z-20 sm:bottom-[105px] lg:hidden xl:bottom-[95px] xl:left-1/2 xl:right-auto xl:block xl:w-[520px] xl:-translate-x-1/2">
      <div className="pointer-events-auto overflow-hidden border border-[#5e8fa8]/60 bg-[#09131c]/95 shadow-[0_18px_65px_rgba(0,0,0,.65),0_0_32px_rgba(75,150,184,.12)] backdrop-blur-xl">
        <div className="h-[2px] w-full bg-[linear-gradient(90deg,#3e6b89,#a8dbe5,#3e6b89)]" />
        <div className="flex items-center justify-between gap-2 border-b border-[#40627b]/40 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-[#6fbf8f] shadow-[0_0_13px_#6fbf8f]" aria-hidden="true" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.19em] text-[#b2dfea]">
              CARGO LAB / LIVE STUDIO
            </span>
          </div>
          <button
            type="button"
            aria-label={expanded ? "Collapse cargo studio" : "Expand cargo studio"}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
            className="border border-[#4b6e7e]/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#a9c4ce] hover:border-[#a9dbea] hover:text-white"
          >
            {expanded ? "− minimize" : "+ expand"}
          </button>
        </div>
        {expanded && (
          <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.21em] text-[#8bb8cb]">
                  {active ? "3D loading simulation active" : "New interactive engineering workspace"}
                </p>
                <h2 className="mt-1 font-display text-[18px] font-bold uppercase leading-tight tracking-[0.055em] text-white sm:text-[21px]">
                  {active ? "THE CONTAINER IS LOADED" : "SEE INSIDE THE CONTAINER"}
                </h2>
              </div>
              <div className="shrink-0 border border-[#4c8199]/60 bg-[#1a3343]/65 px-2 py-1 text-center">
                <div className="font-display text-[20px] font-bold leading-none text-[#c1e4ee]">
                  {active ? plan.placed.length : "30"}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-wider text-[#9dc7d5]">
                  {active ? "placed" : "demo crates"}
                </div>
              </div>
            </div>
            <p className="mt-2 max-w-[410px] text-[11px] leading-[1.55] text-[#c2d0d6] sm:text-[12px]">
              {active
                ? "Orbit the cargo, inspect the cutaway and edit each carton in the Cargo workspace."
                : "One click builds a real 3D carton stack, opens the doors and reveals a live cutaway view."}
            </p>
            {active && (
              <div className="mt-3 grid grid-cols-3 gap-2 border-y border-[#315568]/50 py-3">
                {[
                  ["CARTONS", `${plan.placed.length}/${itemCount}`],
                  ["MASS", `${Math.round(plan.loadedKg)} KG`],
                  ["CORE USED", `${Math.round(pct)}%`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="font-mono text-[8px] uppercase tracking-[0.11em] text-[#8cbbc9]">{label}</div>
                    <div className="mt-0.5 font-display text-[17px] font-bold tracking-wide text-white">{value}</div>
                  </div>
                ))}
                <div className="col-span-3 mt-1 h-1.5 overflow-hidden bg-[#1d303c]" role="meter" aria-label="Conservative cargo core volume used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="h-full bg-[linear-gradient(90deg,#4a859d,#b1dfec)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onStart}
                className="min-h-10 flex-1 border border-[#b2dfea] bg-[#9ed0df] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.11em] text-[#06121b] transition-colors hover:bg-[#d1f0fa] sm:text-[11px]"
              >
                {active ? "↻ RELOAD 3D DEMO" : "▶ LAUNCH 3D CARGO DEMO"}
              </button>
              <button
                type="button"
                onClick={onInspect}
                className="min-h-10 border border-[#64869a] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.09em] text-[#d5e7ef] hover:bg-[#273f4c] sm:text-[11px]"
              >
                {active ? "EDIT CARGO" : "OPEN WORKSPACE"}
              </button>
              {active && (
                <button type="button" onClick={onClear} className="min-h-10 px-2 font-mono text-[10px] uppercase text-[#a0b5bd] underline decoration-[#5b788a] underline-offset-4 hover:text-white">
                  reset
                </button>
              )}
            </div>
            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.085em] text-[#8ea8b5]">
              Prototype inspection only · not approved for aircraft loading
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
