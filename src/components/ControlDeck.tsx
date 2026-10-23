import { FINISHES, type FinishId } from "@/three/primitives";
import { MODELS } from "@/three/models";
import type { MoodId, ViewerState } from "@/three/AKEViewer";
import { Btn, Panel, Segmented, Slider, Toggle } from "./ui";
import { cn } from "@/utils/cn";

const FINISH_ORDER: FinishId[] = [
  "mill",
  "graphite",
  "cargo",
  "airline",
  "titanium",
];

export function ControlDeck({
  state,
  set,
  onView,
  onFrame,
}: {
  state: ViewerState;
  set: (p: Partial<ViewerState>) => void;
  onView: (v: "front" | "top" | "contour" | "iso") => void;
  onFrame: () => void;
}) {
  const finish = FINISHES[state.finish];
  const spec = MODELS[state.model];

  return (
    <Panel
      title={`Control deck · ${spec.code}`}
      code={`${spec.code} / PARAMETRIC`}
      className="w-[286px] max-w-full"
      bodyClass="px-3 py-2.5 space-y-3"
    >
      {/* ---- surface ------------------------------------------------- */}
      <Block label="Surface">
        <div className="flex gap-1.5">
          {FINISH_ORDER.map((id) => {
            const f = FINISHES[id];
            const active = state.finish === id;
            return (
              <button
                key={id}
                type="button"
                title={f.label}
                onClick={() =>
                  set({
                    finish: id,
                    metalness: f.metalness,
                    roughness: f.roughness,
                  })
                }
                className={cn(
                  "group relative h-8 flex-1 border transition-all duration-200",
                  active
                    ? "border-amber shadow-[0_0_16px_-4px_rgba(255,176,32,0.9)]"
                    : "border-line hover:border-mute",
                )}
                style={{
                  background: `linear-gradient(160deg, ${f.color} 0%, ${shade(f.color, -0.45)} 100%)`,
                }}
              >
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-[2px] transition-colors",
                    active
                      ? "bg-amber"
                      : "bg-transparent group-hover:bg-mute/60",
                  )}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-ink">
            {finish.label}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
            {finish.note}
          </span>
        </div>
      </Block>

      {/* ---- material sliders ---------------------------------------- */}
      <Block label="Material response">
        <Slider
          label="metalness"
          value={state.metalness}
          min={0}
          max={1}
          onChange={(v) => set({ metalness: v })}
          display={state.metalness.toFixed(2)}
        />
        <Slider
          label="roughness"
          value={state.roughness}
          min={0.03}
          max={1}
          onChange={(v) => set({ roughness: v })}
          display={state.roughness.toFixed(2)}
        />
        <Slider
          label="env intensity"
          value={state.envIntensity}
          min={0}
          max={2.2}
          onChange={(v) => set({ envIntensity: v })}
          display={`${state.envIntensity.toFixed(2)}×`}
        />
      </Block>

      {/* ---- kinematics ---------------------------------------------- */}
      <Block label={spec.palletOption ? "Cargo build" : "Kinematics"}>
        {!spec.palletOption && (
          <Slider
            label="door swing"
            value={state.door}
            min={0}
            max={1}
            onChange={(v) => set({ door: v })}
            display={`${Math.round(state.door * 112)}°`}
          />
        )}
        {spec.palletOption && (
          <Slider
            label="cargo contour"
            value={state.load}
            min={0}
            max={1}
            onChange={(v) => set({ load: v })}
            display={`${Math.round(state.load * (spec.dims.contourHeight ?? 1.62) * 100)} cm`}
          />
        )}
        <Slider
          label="exploded view"
          value={state.explode}
          min={0}
          max={1}
          onChange={(v) => set({ explode: v })}
          display={`${Math.round(state.explode * 100)}%`}
        />
        {spec.setpointRange && (
          <Slider
            label="setpoint"
            value={state.setpoint}
            min={spec.setpointRange.min}
            max={spec.setpointRange.max}
            step={0.5}
            onChange={(v) => set({ setpoint: v })}
            display={`${state.setpoint.toFixed(1)} \u00B0C`}
          />
        )}
      </Block>

      {/* ---- geometry toggles ---------------------------------------- */}
      <Block label="Geometry">
        <div className="grid grid-cols-2 gap-x-3">
          {spec.contourOption && (
            <Toggle
              label="Contour"
              hint={`${spec.dims.topWidth.toFixed(2)} m top`}
              value={state.contour}
              onChange={(v) => set({ contour: v })}
            />
          )}
          {spec.reeferOption && (
            <Toggle
              label="Reefer unit"
              hint="fan · lcd"
              value={state.reefer}
              onChange={(v) => set({ reefer: v })}
            />
          )}
          {!spec.palletOption && (
            <Toggle
              label="Stiffeners"
              hint="ribs · pads"
              value={state.detail}
              onChange={(v) => set({ detail: v })}
            />
          )}
          {!spec.palletOption && (
            <Toggle
              label="Rivets"
              hint="instanced"
              value={state.rivets}
              onChange={(v) => set({ rivets: v })}
            />
          )}
          {spec.palletOption && (
            <Toggle
              label="Tie-downs"
              hint="studs · rings"
              value={state.detail}
              onChange={(v) => set({ detail: v })}
            />
          )}
          <Toggle
            label="Dimensions"
            hint="CAD lines"
            value={state.dimensions}
            onChange={(v) => set({ dimensions: v })}
          />
          <Toggle
            label="Wireframe"
            value={state.wireframe}
            onChange={(v) => set({ wireframe: v })}
          />
          <Toggle
            label="Orbit"
            hint="auto-rotate"
            value={state.autoRotate}
            onChange={(v) => set({ autoRotate: v })}
          />
        </div>
      </Block>

      {/* ---- scene + camera ------------------------------------------ */}
      <Block label="Lighting rig">
        <Segmented<MoodId>
          value={state.mood}
          onChange={(v) => set({ mood: v })}
          ariaLabel="Lighting rig"
          options={[
            { value: "hangar", label: "Hangar" },
            { value: "dusk", label: "Apron" },
            { value: "studio", label: "Studio" },
          ]}
        />
        <div className="mt-2 grid grid-cols-5 gap-1">
          <Btn onClick={() => onView("iso")} title="Three-quarter view">
            iso
          </Btn>
          <Btn onClick={() => onView("front")} title="Door elevation">
            front
          </Btn>
          <Btn onClick={() => onView("contour")} title="Contour side">
            side
          </Btn>
          <Btn onClick={() => onView("top")} title="Plan view">
            top
          </Btn>
          <Btn onClick={onFrame} title="Frame the whole container">
            fit
          </Btn>
        </div>
      </Block>
    </Panel>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="stencil text-[9.5px] text-dim">{label}</span>
        <span className="h-px flex-1 bg-line-soft" />
      </div>
      {children}
    </div>
  );
}

/** Darken/lighten a hex colour for the swatch gradients. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)),
    );
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}
