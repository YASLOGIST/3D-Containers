import type { CargoPlan } from "@/lib/cargoPlacement";

interface Props {
  active: boolean;
  modelCode: string;
  plan: CargoPlan;
  itemCount: number;
  hidden?: boolean;
  onStart: () => void;
  onInspect: () => void;
  onClear: () => void;
}

/** Slim, unobtrusive mission bar; detailed instrumentation lives in inspector. */
export function CargoMissionDock({
  active, modelCode, plan, itemCount, hidden,
  onStart, onInspect, onClear,
}: Props) {
  return (
    <div className={`pointer-events-none absolute inset-x-2 bottom-[100px] z-20 mx-auto max-w-[420px] sm:bottom-[93px] lg:bottom-[56px] lg:max-w-[360px] xl:bottom-[65px] xl:max-w-[440px] ${hidden ? "hidden lg:block" : ""}`}>
      <div className="pointer-events-auto border border-[#5b8fa5]/60 bg-[#09131c]/92 px-2.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,.40)] backdrop-blur-md sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-[#78c5bd]" aria-hidden="true" />
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#b7deec]">
                {modelCode} / cargo 3D
              </span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] font-semibold text-white" aria-live="polite">
              {active
                ? `${plan.placed.length}/${itemCount} placed · ${plan.loadedKg.toFixed(0)} kg · ${plan.coreUtilizationPct.toFixed(0)}% core`
                : "Model-aware loading preview"}
            </div>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="min-h-9 shrink-0 border border-[#aad6e6] bg-[#9ccedf] px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#091521] hover:bg-[#daf1fa]"
          >
            {active ? "↻ RELOAD" : "▶ LOAD 3D"}
          </button>
          <button
            type="button"
            onClick={onInspect}
            aria-label="Edit the cargo manifest"
            className="min-h-9 shrink-0 border border-[#507589] px-2.5 font-mono text-[10px] font-semibold text-[#c9e2eb] hover:bg-[#294253]"
          >
            EDIT
          </button>
          {active && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear cargo preview"
              className="min-h-9 shrink-0 px-1 font-mono text-[10px] text-[#91adba] hover:text-white"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
