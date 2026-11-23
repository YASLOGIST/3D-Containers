import type { CargoPlan } from "@/lib/cargoPlacement";

interface Props {
  active: boolean;
  ready: boolean;
  modelCode: string;
  plan: CargoPlan;
  itemCount: number;
  hidden?: boolean;
  onStart: () => void;
  onAnalyze: () => void;
  onInspect: () => void;
  onClear: () => void;
}

/** A compact first-use flow: preview cargo, then inspect its mass signature. */
export function CargoMissionDock({
  active, ready, modelCode, plan, itemCount, hidden,
  onStart, onAnalyze, onInspect, onClear,
}: Props) {
  return (
    <div className={`pointer-events-none absolute inset-x-2 bottom-[100px] z-20 mx-auto max-w-[440px] sm:bottom-[93px] lg:bottom-[56px] lg:max-w-[420px] xl:bottom-[65px] xl:max-w-[470px] ${hidden ? "hidden lg:block" : ""}`}>
      <div className="pointer-events-auto border border-[#5b8fa5]/60 bg-[#09131c]/92 px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,.40)] backdrop-blur-md sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="min-w-0 flex-1 basis-[140px]">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-[#78c5bd]" aria-hidden="true" />
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#b7deec]">
                {modelCode} / cargo preview
              </span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] font-semibold text-white" aria-live="polite">
              {active
                ? `${plan.placed.length}/${itemCount} placed · ${plan.loadedKg.toFixed(0)} kg · ${plan.coreUtilizationPct.toFixed(0)}% core`
                : ready ? "Load sample cargo to explore" : "Preparing 3D viewer…"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={active ? onAnalyze : onStart}
              disabled={!ready}
              title={active ? "Open cargo mass distribution and engineering lenses" : "Load a model-aware demonstration cargo"}
              aria-label={active ? "Inspect cargo mass distribution" : "Load 3D cargo preview"}
              className="min-h-10 shrink-0 border border-[#aad6e6] bg-[#9ccedf] px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#091521] hover:bg-[#daf1fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
            >
              {active ? "◇ ANALYZE" : "▶ LOAD 3D"}
            </button>
            {active && (
              <button type="button" onClick={onStart} disabled={!ready}
                title="Reload the demo cargo" aria-label="Reload demo cargo"
                className="min-h-10 min-w-9 shrink-0 border border-[#507589] px-1 font-mono text-[14px] text-[#c9e2eb] hover:bg-[#294253] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">
                ↻
              </button>
            )}
            <button
              type="button"
              onClick={onInspect}
              disabled={!ready}
              aria-label="Edit the cargo manifest"
              className="min-h-10 shrink-0 border border-[#507589] px-2 font-mono text-[10px] font-semibold text-[#c9e2eb] hover:bg-[#294253] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
            >
              EDIT
            </button>
            {active && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear cargo preview"
                className="min-h-10 min-w-7 shrink-0 font-mono text-[15px] text-[#91adba] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
