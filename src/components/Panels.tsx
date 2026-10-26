import { useMemo, useState } from "react";
import type { Assembly } from "@/three/primitives";
import { highlightTS } from "@/lib/io";
import { computePlan } from "@/lib/planner";
import { kgToLb } from "@/lib/units";
import type { ModelInfo } from "@/three/models";
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

export function SpecSheet({
  stats,
  measured,
  model,
}: {
  stats: Stats | null;
  measured: { x: number; y: number; z: number } | null;
  model: ModelInfo;
}) {
  const { dims } = model;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="amber">IATA {model.code}</Chip>
        <Chip tone="steel">
          {model.name.split("·")[1]?.trim() ?? model.code}
        </Chip>
        <Chip>
          {model.palletOption
            ? "flat pallet"
            : model.contourOption
              ? "contoured"
              : "uniform cuboid"}
        </Chip>
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
          </div>
        ))}
      </div>

      <div>
        {model.specs.map((r) => (
          <Row key={r.k} k={r.k} v={r.v} tone={r.tone ?? "ink"} />
        ))}
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
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim">
          {model.palletOption
            ? "The plate is a flat sheet: every vertex sits exactly on the certified base, and the contour block is a transparent build guide."
            : model.contourOption
              ? "Filleted corners keep the solid inscribed in the certified envelope — no vertex ever crosses it."
              : "Every vertex of the generated cuboid lands exactly on the certified envelope."}{" "}
          {model.family.charAt(0).toUpperCase() + model.family.slice(1)} —{" "}
          {model.volumeLabel}.
        </p>
      </div>

      <p className="border-t border-line-soft pt-2 text-[10.5px] leading-relaxed text-mute">
        {model.blurb}
      </p>

      <LoadPlanner key={model.id} model={model} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Load planner — estimated payload / volume utilisation               */
/* ------------------------------------------------------------------ */

function LoadPlanner({ model }: { model: ModelInfo }) {
  const { ratings } = model;
  const [cargoKg, setCargoKg] = useState(() => Math.round(ratings.payloadKg / 2));
  const [cargoM3, setCargoM3] = useState(() => Math.round(ratings.volumeM3 * 50) / 100);
  const [divisor, setDivisor] = useState<"6000" | "5000">("6000");
  const plan = computePlan({
    ...ratings,
    cargoKg,
    cargoM3,
    divisor: Number(divisor),
  });
  const maxKg = Math.ceil(ratings.payloadKg * 1.25);
  const maxM3 = Math.round(ratings.volumeM3 * 125) / 100;
  const over = plan.status !== "ok" && plan.status !== "empty";
  const statusText =
    plan.status === "empty"
      ? "NO CARGO ENTERED"
      : plan.status === "ok"
        ? "WITHIN CERTIFIED LIMITS"
        : plan.status === "overweight"
          ? `OVERWEIGHT BY ${Math.abs(Math.round(plan.remainingKg))} KG`
          : plan.status === "overvolume"
            ? `OVER VOLUME BY ${(cargoM3 - ratings.volumeM3).toFixed(2)} M³`
            : "OVERWEIGHT AND OVER VOLUME";

  return (
    <div className="border-t border-line-soft pt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 bg-amber" />
        <span className="stencil text-[9.5px] text-dim">load planner</span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
          estimated
        </span>
      </div>

      <Slider
        label="cargo mass"
        value={cargoKg}
        min={0}
        max={maxKg}
        step={5}
        onChange={setCargoKg}
        display={`${cargoKg.toLocaleString()} kg`}
      />
      <Slider
        label="cargo volume"
        value={cargoM3}
        min={0}
        max={maxM3}
        step={0.05}
        onChange={setCargoM3}
        display={`${cargoM3.toFixed(2)} m³`}
      />

      <PlanBar label="payload" pct={plan.payloadPct} />
      <PlanBar label="volume" pct={plan.volumePct} />

      <div
        role="status"
        className={cn(
          "mt-2 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
          plan.status === "ok"
            ? "border-jade/50 bg-jade/10 text-jade"
            : over
              ? "border-signal/60 bg-signal/10 text-signal"
              : "border-line bg-void/40 text-dim",
        )}
      >
        {over ? "! " : ""}
        {statusText}
      </div>

      <div className="mt-1">
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
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">
          volumetric divisor cm³/kg
        </span>
        <Segmented
          value={divisor}
          onChange={setDivisor}
          ariaLabel="Volumetric divisor"
          options={[
            { value: "6000", label: "6000" },
            { value: "5000", label: "5000" },
          ]}
        />
      </div>
      <p className="mt-1.5 text-[9.5px] leading-relaxed text-dim">
        Estimated from certified ratings only. Real limits also depend on
        aircraft position, restraint and contour — verify against the load
        sheet before flying freight.
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

export function PartsList({
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

export function SourcePanel({
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
