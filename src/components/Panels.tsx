import { useMemo } from "react";
import type { Assembly } from "@/three/akeLD3";
import { highlightTS } from "@/lib/io";
import type { ModelInfo } from "@/three/models";
import { Btn, Chip, Row } from "./ui";
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
        <Chip tone="steel">{model.name.split("·")[1]?.trim() ?? model.code}</Chip>
        <Chip>
          {model.palletOption ? "flat pallet" : model.contourOption ? "contoured" : "uniform cuboid"}
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
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">{k}</div>
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
        <Row k="Geometric volume" v={`${stats?.volumeM3.toFixed(3) ?? "—"} m³`} tone="amber" />
        <Row k="Footprint" v={`${stats?.footprintM2.toFixed(3) ?? "—"} m²`} />
      </div>

      <div className="border-t border-line-soft pt-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-steel" />
          <span className="stencil text-[9.5px] text-dim">measured bounding box</span>
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
          {model.family.charAt(0).toUpperCase() + model.family.slice(1)} — {model.volumeLabel}.
        </p>
      </div>

      <p className="border-t border-line-soft pt-2 text-[10.5px] leading-relaxed text-mute">
        {model.blurb}
      </p>
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
      assemblies.reduce((a, x) => ({ m: a.m + x.meshes, t: a.t + x.triangles }), { m: 0, t: 0 }),
    [assemblies],
  );
  return (
    <div className="space-y-1">
      {assemblies.map((a) => {
        const active = hovered === a.id;
        return (
          <div
            key={a.id}
            onMouseEnter={() => onHover(a.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onFocus(a.id)}
            className={cn(
              "group cursor-pointer border-l-2 px-2 py-1.5 transition-all duration-200",
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
          </div>
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
  onDownload,
}: {
  source: string;
  filename: string;
  onDownload: () => void;
}) {
  const html = useMemo(() => highlightTS(source), [source]);
  const lines = source.split("\n").length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Chip tone="amber">akeLD3.ts</Chip>
        <Chip>{lines} lines</Chip>
        <Chip>three r180</Chip>
        <Btn className="ml-auto" onClick={onDownload}>
          download .ts
        </Btn>
        <Btn
          onClick={() => {
            navigator.clipboard?.writeText(source);
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
        Self-contained generator: import it, call <code className="text-steel">createAKEContainer()</code>,
        add the returned <code className="text-steel">group</code> to any scene — or hand it to the
        GLTF / OBJ / STL exporters below.
      </p>
      <div className="mt-1 font-mono text-[10px] text-dim">exported as {filename}</div>
    </div>
  );
}
