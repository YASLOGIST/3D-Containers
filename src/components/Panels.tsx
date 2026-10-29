import { memo, useMemo, type Dispatch, type SetStateAction } from "react";
import type { Assembly } from "@/three/primitives";
import { highlightTS } from "@/lib/io";
import { computePlan, parseCargoQuantity, type CargoScenario } from "@/lib/planner";
import { kgToLb } from "@/lib/units";
import { MODELS, type ModelId, type ModelInfo } from "@/three/models";
import { MODEL_IDS } from "@/lib/state";
import { Btn, Chip, Row, Segmented, Slider } from "./ui";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/* Spec sheet                                                          */
/* ------------------------------------------------------------------ */

export type Stats = {
  meshes: number;
  triangles: number;
  volumeM3: number;
  iataVolumeM3: number;
  footprintM2: number;
  tareKg: number;
  maxGrossKg: number;
  payloadKg: number;
  [extra: string]: number | string;
};

/**
 * Registry reference section, plotted inside its rectangular overall span.
 * This does not track optional geometry changes in the live viewer.
 */
function SectionCard({ model }: { model: ModelInfo }) {
  const pts = model.sectionProfile();
  const minX = Math.min(...pts.map((p) => p.x));
  const envW = Math.max(model.dims.width, model.dims.topWidth);
  const envH = model.palletOption
    ? model.dims.height + (model.dims.contourHeight ?? 0)
    : model.dims.height;
  const padX = envW * 0.07 + 0.04;
  const padTop = envH * 0.1 + 0.04;
  const padBot = envH * 0.07 + 0.03;
  const totalH = envH + padTop + padBot;
  const groundY = totalH - padBot;
  const sy = (y: number) => groundY - y;
  const poly = pts.map((p) => `${p.x.toFixed(4)},${sy(p.y).toFixed(4)}`).join(" ");
  const ticks = Array.from({ length: 9 }, (_, i) => minX - padX * 0.6 + (i * (envW + padX * 1.2)) / 8);
  const slope =
    model.taperDeg !== undefined
      ? `${(model.taperLabel ?? "slope").toLowerCase()} ${model.taperDeg.toFixed(1)}°`
      : model.contourOption || model.annotationKind === "contoured"
        ? `taper ${((Math.atan2(model.dims.topWidth - model.dims.width, model.dims.height) * 180) / Math.PI).toFixed(1)}°`
        : model.palletOption
          ? "netted contour guide"
          : "vertical walls 0.0°";
  return (
    <div className="border border-line-soft bg-void/40 px-2 pb-1.5 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="stencil text-[9.5px] text-dim">registry reference section</span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-steel">{slope}</span>
      </div>
      <svg
        viewBox={`${minX - padX} 0 ${envW + padX * 2} ${totalH}`}
        className="h-[118px] w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${model.code} cross-section: base ${model.dims.width.toFixed(2)} metres, top ${model.dims.topWidth.toFixed(2)} metres, height ${model.dims.height.toFixed(2)} metres`}
      >
        <rect
          x={minX}
          y={sy(envH)}
          width={envW}
          height={envH}
          fill="none"
          stroke="currentColor"
          strokeDasharray="4 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className="text-steel/50"
        />
        <polygon
          points={poly}
          strokeWidth={1.4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="fill-amber/15 stroke-amber/80"
        />
        <line x1={minX - padX * 0.8} y1={groundY} x2={minX + envW + padX * 0.8} y2={groundY} stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="text-dim" />
        {ticks.map((x, i) => (
          <line key={i} x1={x} y1={groundY} x2={x - envW * 0.02} y2={groundY + padBot * 0.55} stroke="currentColor" strokeWidth={0.8} vectorEffect="non-scaling-stroke" className="text-dim/60" />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[9.5px] tabular-nums text-dim">
        <span>base {model.dims.width.toFixed(2)} m</span>
        <span>top {model.dims.topWidth.toFixed(2)} m</span>
        <span>h {model.dims.height.toFixed(2)} m</span>
      </div>
    </div>
  );
}

/**
 * Hold-fit schematic: the model's lateral section placed in its primary
 * aircraft's fuselage tube — ×1 centred or ×2 abreast (mirrored pair).
 * Fuselage diameters are published airframe data; floor position and the
 * simplified lateral section are nominal. A scale schematic for fit
 * intuition, explicitly not a certified loading diagram.
 */
function HoldCard({ model }: { model: ModelInfo }) {
  const h = model.hold;
  const R = h.fuselageM / 2;
  const cy = h.floorDrop; // fuselage centre height above the hold floor
  const GAP = 0.05;
  const single = (mirror: boolean): [number, number][] => {
    const pts: [number, number][] = [[0, 0], [h.base, 0]];
    if (h.knee) pts.push([h.base, h.knee]);
    pts.push([h.top, h.height], [0, h.height]);
    return pts.map(([x, y]) => [mirror ? -(GAP / 2 + x) : GAP / 2 + x, y] as [number, number]);
  };
  const twin = (cx: number): [number, number][] => {
    const pts: [number, number][] = [[-h.base / 2, 0], [h.base / 2, 0]];
    if (h.knee) pts.push([h.base / 2, h.knee]);
    pts.push([h.top / 2, h.height], [-h.top / 2, h.height]);
    if (h.knee) pts.push([-h.base / 2, h.knee]);
    return pts.map(([x, y]) => [cx + x, y] as [number, number]);
  };
  const units =
    h.mode === "single"
      ? h.abreast === 2
        ? [single(true), single(false)]
        : [single(false)]
      : h.abreast === 2
        ? [twin(-(h.base / 2 + GAP / 2)), twin(h.base / 2 + GAP / 2)]
        : [twin(0)];
  const pad = 0.28;
  const top = cy + R;
  const vbH = 2 * R + pad * 2;
  const sy = (y: number) => top + pad - y;
  const floorHalf = Math.sqrt(Math.max(R * R - cy * cy, 0));
  return (
    <div className="border border-line-soft bg-void/40 px-2 pb-1.5 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="stencil text-[9.5px] text-dim">
          hold fit · {h.aircraft} {h.deck} deck
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-steel">
          Ø {h.fuselageM.toFixed(2)} m · ×{h.abreast} abreast
        </span>
      </div>
      <svg
        viewBox={`${-R - pad} 0 ${2 * R + pad * 2} ${vbH}`}
        className="h-[150px] w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${model.code} shown ${h.abreast === 2 ? "as a pair" : "singly"} in a ${h.aircraft} ${h.deck} deck fuselage section (schematic)`}
      >
        <circle cx={0} cy={sy(cy)} r={R} strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="fill-steel/5 stroke-steel/60" />
        <line x1={0} y1={sy(top)} x2={0} y2={sy(cy - R)} stroke="currentColor" strokeDasharray="3 4" strokeWidth={0.8} vectorEffect="non-scaling-stroke" className="text-dim/40" />
        <line x1={-floorHalf} y1={sy(0)} x2={floorHalf} y2={sy(0)} stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" className="text-dim" />
        {units.map((pts, i) => (
          <polygon
            key={i}
            points={pts.map(([x, y]) => `${x.toFixed(3)},${sy(y).toFixed(3)}`).join(" ")}
            strokeWidth={1.3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="fill-amber/15 stroke-amber/80"
          />
        ))}
      </svg>
      <p className="text-[9.5px] leading-snug text-dim">
        Scale schematic — published fuselage Ø; floor position and lateral
        section nominal. Not a certified loading diagram.
      </p>
    </div>
  );
}

function SpecSheetBase({
  cargoScenario,
  setCargoScenario,
  stats,
  measured,
  model,
  compareModel,
  onSelectModel,
}: {
  cargoScenario: CargoScenario;
  setCargoScenario: Dispatch<SetStateAction<CargoScenario>>;
  stats: Stats | null;
  measured: { x: number; y: number; z: number } | null;
  model: ModelInfo;
  compareModel?: ModelInfo | null;
  onSelectModel?: (id: ModelId) => void;
}) {
  const { dims } = model;
  const sectionLabel = model.palletOption
    ? "flat pallet"
    : model.annotationKind === "dual-contour"
      ? "dual contour"
      : model.annotationKind === "roof-chamfer"
        ? "roof chamfer"
        : model.contourOption || model.annotationKind === "contoured"
          ? "contoured"
          : "uniform cuboid";
  // Compare overall spans only; these cannot establish contour fit or position.
  const envelope = {
    x: Math.max(dims.width, dims.topWidth),
    y: model.palletOption ? dims.height + (dims.contourHeight ?? 0) : dims.height,
    z: dims.depth,
  };
  const deltaMm = measured
    ? {
        x: (measured.x - envelope.x) * 1000,
        y: (measured.y - envelope.y) * 1000,
        z: (measured.z - envelope.z) * 1000,
      }
    : null;
  const spansWithinTolerance = deltaMm ? deltaMm.x <= 1 && deltaMm.y <= 1 && deltaMm.z <= 1 : null;
  const fmtDelta = (v: number) => `${v > 0.005 ? "+" : ""}${Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2)}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="amber">IATA {model.code}</Chip>
        <Chip tone="steel">
          {model.name.split("·")[1]?.trim() ?? model.code}
        </Chip>
        <Chip>{sectionLabel}</Chip>
        {model.reeferOption && <Chip tone="steel">active reefer</Chip>}
        {model.palletOption && <Chip tone="steel">netted contour</Chip>}
      </div>

      <div className="grid grid-cols-4 gap-px border border-line-soft bg-line-soft">
        {[
          ["width", dims.width],
          ["depth", dims.depth],
          [model.palletOption ? "thick" : "height", dims.height],
          ["top", dims.topWidth],
        ].map(([k, v]) => (
          <div key={k as string} className="bg-panel px-2 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
              {k}
            </div>
            <div className="font-display text-[19px] font-bold leading-none text-ink etch">
              {(v as number).toFixed(2)}
              <span className="ml-0.5 font-mono text-[10px] text-amber">m</span>
            </div>
            <div className="mt-0.5 font-mono text-[9px] tabular-nums text-dim">
              {((v as number) * 39.3701).toFixed(1)} in
            </div>
          </div>
        ))}
      </div>

      <SectionCard model={model} />
      <HoldCard model={model} />

      <div>
        {model.specs.map((r) => (
          <Row key={r.k} k={r.k} v={r.v} tone={r.tone ?? "ink"} />
        ))}
        <Row k="Aircraft fit" v={model.aircraft} tone="steel" />
        <Row
          k="Geometric volume"
          v={`${stats?.volumeM3.toFixed(3) ?? "—"} m³`}
          tone="amber"
        />
        <Row k="Footprint" v={`${stats?.footprintM2.toFixed(3) ?? "—"} m²`} />
      </div>

      <div className="border-t border-line-soft pt-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-steel" />
          <span className="stencil text-[9.5px] text-dim">
            measured bounding box
          </span>
        </div>
        <Row
          k="x · y · z"
          v={
            measured
              ? `${measured.x.toFixed(3)} × ${measured.y.toFixed(3)} × ${measured.z.toFixed(3)}`
              : "—"
          }
          tone="steel"
        />
        <Row
          k="Δ vs reference spans (mm)"
          v={
            deltaMm
              ? `${fmtDelta(deltaMm.x)} · ${fmtDelta(deltaMm.y)} · ${fmtDelta(deltaMm.z)}`
              : "—"
          }
          tone={spansWithinTolerance === false ? "amber" : "steel"}
        />
        <Row
          k="Overall span check"
          v={spansWithinTolerance === null ? "—" : spansWithinTolerance ? "WITHIN 1 MM" : "SPAN EXCEEDS 1 MM"}
          tone={spansWithinTolerance === false ? "amber" : "steel"}
        />
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim">
          Door closed and pallet load stowed. This compares bounding-box
          dimensions with the registry's overall spans, allowing 1 mm excess.
          It does not check position, contour clearance or certify the model.
          The section above is a registry reference, not a live geometry check.
        </p>
      </div>

      <p className="border-t border-line-soft pt-2 text-[10.5px] leading-relaxed text-mute">
        {model.blurb}
      </p>

      {compareModel && compareModel.id !== model.id && (
        <div className="border-t border-line-soft pt-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-amber" />
            <span className="stencil text-[9.5px] text-dim">
              certified comparison · {model.code} vs {compareModel.code}
            </span>
          </div>
          {(
            [
              ["Certified volume", model.ratings.volumeM3, compareModel.ratings.volumeM3, "m³", 2],
              ["Net payload", model.ratings.payloadKg, compareModel.ratings.payloadKg, "kg", 0],
              ["Footprint", model.dims.width * model.dims.depth, compareModel.dims.width * compareModel.dims.depth, "m²", 2],
              ["Height", model.dims.height, compareModel.dims.height, "m", 2],
              ["Payload density", model.ratings.payloadKg / model.ratings.volumeM3, compareModel.ratings.payloadKg / compareModel.ratings.volumeM3, "kg/m³", 0],
            ] as [string, number, number, string, number][]
          ).map(([k, a, b, unit, dp]) => (
            <Row
              key={k}
              k={k}
              v={`${a.toFixed(dp)} vs ${b.toFixed(dp)} ${unit} (${a - b > 0 ? "+" : ""}${(a - b).toFixed(dp)})`}
              tone="steel"
            />
          ))}
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim">
            Registry-certified figures for both units; the dashed 3-D envelope
            shows the same comparison spatially.
          </p>
        </div>
      )}

      <LoadPlanner model={model} scenario={cargoScenario} setScenario={setCargoScenario} />
      {onSelectModel && <FleetCard model={model} onSelect={onSelectModel} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Load planner — estimated payload / volume utilisation               */
/* ------------------------------------------------------------------ */

/**
 * Fleet-at-a-glance: every family's certified section silhouette as a
 * clickable chip, so the whole catalogue can be scanned and jumped
 * between without cycling the header switcher. Silhouettes are
 * normalized per unit for legibility — the hold-fit card above remains
 * the true-scale reference.
 */
function FleetCard({
  model,
  onSelect,
}: {
  model: ModelInfo;
  onSelect: (id: ModelId) => void;
}) {
  return (
    <div className="border border-line-soft bg-void/40 px-2 pb-1.5 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="stencil text-[9.5px] text-dim">
          fleet at a glance · tap to switch
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-steel">
          {MODEL_IDS.length} families
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MODEL_IDS.map((id) => {
          const m = MODELS[id];
          const pts = m.sectionProfile();
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          const y1 = Math.max(...ys, 0.05);
          const W = 76;
          const H = 46;
          const pad = 3;
          const s = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / y1);
          const ox = W / 2 - ((x0 + x1) / 2) * s;
          const oy = H - pad;
          const d =
            pts
              .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * s + ox).toFixed(1)},${(oy - p.y * s).toFixed(1)}`)
              .join(" ") + " Z";
          const active = id === model.id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={active}
              title={`${m.name} — ${m.family} · ${m.ratings.volumeM3.toFixed(1)} m³ · ${m.ratings.payloadKg} kg payload`}
              className={cn(
                "flex flex-col items-center gap-0.5 border px-1 py-1 text-left transition-colors",
                active
                  ? "border-amber/70 bg-amber/10"
                  : "border-line-soft bg-void/30 hover:border-steel/60 hover:bg-steel/10",
              )}
            >
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
                <path
                  d={d}
                  className={active ? "fill-amber/25 stroke-amber" : "fill-steel/15 stroke-steel/70"}
                  strokeWidth="1.1"
                />
              </svg>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase leading-none tracking-[0.08em]",
                  active ? "text-amber" : "text-dim",
                )}
              >
                {m.code}
              </span>
              <span className="font-mono text-[8.5px] leading-none text-steel">
                {m.ratings.volumeM3.toFixed(1)} m³
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-[9px] normal-case leading-snug text-steel">
        Silhouettes normalized per unit — hold-fit card is the true-scale reference.
      </div>
    </div>
  );
}

function LoadPlanner({ model, scenario, setScenario }: {
  model: ModelInfo;
  scenario: CargoScenario;
  setScenario: Dispatch<SetStateAction<CargoScenario>>;
}) {
  const { ratings } = model;
  const cargoKg = parseCargoQuantity(scenario.cargoKg);
  const cargoM3 = parseCargoQuantity(scenario.cargoM3);
  const plan = cargoKg !== null && cargoM3 !== null
    ? computePlan({ ...ratings, cargoKg, cargoM3, divisor: Number(scenario.divisor) })
    : null;
  const maxKg = Math.max(Math.ceil(ratings.payloadKg * 1.25), cargoKg ?? 0);
  const maxM3 = Math.max(Math.ceil(ratings.volumeM3 * 125) / 100, cargoM3 ?? 0);
  const over = plan !== null && plan.status !== "ok" && plan.status !== "empty";
  const statusText = !plan
    ? "ENTER VALID CARGO MASS AND VOLUME"
    : plan.status === "empty"
      ? "NO CARGO ENTERED"
      : plan.status === "ok"
        ? "WITHIN LISTED WEIGHT & VOLUME"
        : plan.status === "overweight"
          ? "OVERWEIGHT"
          : plan.status === "overvolume"
            ? "OVER VOLUME"
            : "OVERWEIGHT AND OVER VOLUME";
  const update = (key: "cargoKg" | "cargoM3", value: string) =>
    setScenario((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="border-t border-line-soft pt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 bg-amber" />
        <span className="stencil text-[9.5px] text-dim">load planner</span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
          estimated
        </span>
      </div>

      <p className="mb-2 text-[10px] leading-relaxed text-mute">
        Enter a shipment once, then switch models to compare the same load.
        Values stay in this session; they are not included in share links.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["cargoKg", "Cargo mass · kg", scenario.cargoKg, cargoKg],
          ["cargoM3", "Cargo volume · m³", scenario.cargoM3, cargoM3],
        ] as const).map(([key, label, value, parsed]) => (
          <label key={key} className="block font-mono text-[10px] uppercase tracking-[0.08em] text-mute">
            {label}
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => update(key, e.target.value)}
              aria-invalid={parsed === null}
              className="mt-1 block w-full border border-line bg-void px-2 py-1.5 text-[12px] text-ink"
            />
          </label>
        ))}
      </div>
      {(cargoKg === null || cargoM3 === null) && (
        <p className="mt-1 text-[10px] text-signal">Use non-negative numbers with a decimal point (maximum 1,000,000,000).</p>
      )}
      {cargoKg !== null && <Slider label="adjust cargo mass" value={cargoKg} min={0} max={maxKg} step={1} onChange={(v) => update("cargoKg", String(v))} display={`${cargoKg.toLocaleString()} kg`} />}
      {cargoM3 !== null && <Slider label="adjust cargo volume" value={cargoM3} min={0} max={maxM3} step={0.01} onChange={(v) => update("cargoM3", String(v))} display={`${cargoM3.toLocaleString()} m³`} />}

      {plan && <><PlanBar label="payload" pct={plan.payloadPct} /><PlanBar label="volume" pct={plan.volumePct} /></>}

      <div
        role="status"
        className={cn(
          "mt-2 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
          plan?.status === "ok"
            ? "border-jade/50 bg-jade/10 text-jade"
            : over
              ? "border-signal/60 bg-signal/10 text-signal"
              : "border-line bg-void/40 text-dim",
        )}
      >
        {over ? "! " : ""}
        {statusText}
      </div>

      {plan && <div className="mt-1">
        <Row k="Gross (tare + cargo)" v={`${plan.grossKg.toLocaleString()} kg`} tone="amber" />
        <Row
          k="Payload remaining"
          v={`${Math.round(plan.remainingKg).toLocaleString()} kg`}
        />
        <Row
          k="Volumetric weight"
          v={`${Math.round(plan.volumetricKg).toLocaleString()} kg`}
        />
        <Row
          k="Chargeable weight"
          v={`${Math.round(plan.chargeableKg).toLocaleString()} kg · ${Math.round(kgToLb(plan.chargeableKg)).toLocaleString()} lb`}
          tone="steel"
        />
        <Row
          k="Cargo density"
          v={
            plan.densityKgM3 === null
              ? "—"
              : `${Math.round(plan.densityKgM3)} kg/m³ · ${plan.limiting}-limited`
          }
        />
      </div>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
          volumetric divisor cm³/kg
        </span>
        <Segmented
          value={scenario.divisor}
          onChange={(divisor) => setScenario((previous) => ({ ...previous, divisor }))}
          ariaLabel="Volumetric divisor"
          options={[
            { value: "6000", label: "6000" },
            { value: "5000", label: "5000" },
          ]}
        />
      </div>
      <p className="mt-1.5 text-[9.5px] leading-relaxed text-dim">
        Indicative comparison only, not load approval. Actual limits depend on
        the specific ULD, aircraft position, restraint and contour. Chargeable
        weight may also depend on carrier rules and rounding. Verify against
        the applicable load sheet and tariff.
      </p>
    </div>
  );
}

function PlanBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.min(pct, 100);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="w-14 font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
        {label}
      </span>
      <span className="relative h-[6px] flex-1 bg-line">
        <span
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-200",
            pct > 100 ? "bg-signal" : pct > 85 ? "bg-amber" : "bg-jade",
          )}
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span
        className={cn(
          "w-12 text-right font-mono text-[10.5px] tabular-nums",
          pct > 100 ? "text-signal" : "text-mute",
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parts list                                                          */
/* ------------------------------------------------------------------ */

export const SpecSheet = memo(SpecSheetBase);

function PartsListBase({
  assemblies,
  hovered,
  onHover,
  onFocus,
}: {
  assemblies: Assembly[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
}) {
  const total = useMemo(
    () =>
      assemblies.reduce(
        (a, x) => ({ m: a.m + x.meshes, t: a.t + x.triangles }),
        { m: 0, t: 0 },
      ),
    [assemblies],
  );
  return (
    <div className="space-y-1">
      {assemblies.map((a) => {
        const active = hovered === a.id;
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={active}
            title={`Focus ${a.label}`}
            onMouseEnter={() => onHover(a.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(a.id)}
            onBlur={() => onHover(null)}
            onClick={() => onFocus(a.id)}
            className={cn(
              "group block w-full cursor-pointer border-l-2 px-2 py-1.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70",
              active
                ? "border-amber bg-amber/10"
                : "border-line-soft bg-void/30 hover:border-steel/60 hover:bg-raise/60",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "font-display text-[12.5px] font-semibold uppercase tracking-[0.06em] transition-colors",
                  active ? "text-amber" : "text-ink/90 group-hover:text-ink",
                )}
              >
                {a.label}
              </span>
              <span className="font-mono text-[9.5px] tabular-nums text-dim">
                {a.meshes} · {(a.triangles / 1000).toFixed(1)}k
              </span>
            </div>
            <div className="truncate text-[10.5px] text-dim">{a.note}</div>
          </button>
        );
      })}
      <div className="flex items-center justify-between border-t border-line-soft pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
        <span>total</span>
        <span className="text-mute">
          {total.m} meshes · {total.t.toLocaleString()} tris
        </span>
      </div>
      <Btn tone="ghost" className="mt-1 w-full" onClick={() => onFocus(null)}>
        reset focus
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Source drawer                                                       */
/* ------------------------------------------------------------------ */

export const PartsList = memo(PartsListBase);

function SourcePanelBase({
  source,
  filename,
  entry,
  description,
  onDownload,
  onCopy,
}: {
  source: string;
  filename: string;
  entry: string;
  description: string;
  onDownload: () => void;
  onCopy?: (ok: boolean) => void;
}) {
  const html = useMemo(() => highlightTS(source), [source]);
  const lines = source.split("\n").length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Chip tone="amber">{filename}</Chip>
        <Chip>{lines} lines</Chip>
        <Chip>three r180</Chip>
        <Btn className="ml-auto" onClick={onDownload}>
          download .ts
        </Btn>
        <Btn
          onClick={() => {
            if (!navigator.clipboard) {
              onCopy?.(false);
              return;
            }
            navigator.clipboard
              .writeText(source)
              .then(() => onCopy?.(true))
              .catch(() => onCopy?.(false));
          }}
        >
          copy
        </Btn>
      </div>
      <pre
        className="code-scroll scroll-slim min-h-0 flex-1 overflow-auto border border-line-soft bg-void/80 p-3 font-mono text-[11px] leading-[1.55]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="mt-2 text-[10.5px] leading-relaxed text-dim">
        {description} Entry point: <code className="text-steel">{entry}</code>.
        Download or copy the raw TypeScript, or export the generated mesh as GLB
        / OBJ / STL.
      </p>
      <div className="mt-1 font-mono text-[10px] text-dim">
        exported as {filename}
      </div>
    </div>
  );
}

export const SourcePanel = memo(SourcePanelBase);
