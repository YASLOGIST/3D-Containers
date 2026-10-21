import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import akeSource from "./three/akeLD3.ts?raw";
import rknSource from "./three/rkn.ts?raw";
import primitivesSource from "./three/primitives.ts?raw";
import viewerSource from "./three/AKEViewer.ts?raw";
import textureSource from "./three/textures.ts?raw";

import { AKEViewer, DEFAULT_STATE, type HoverInfo, type ViewerState } from "@/three/AKEViewer";
import { MODELS, type ModelId } from "@/three/models";
import type { Assembly } from "@/three/primitives";
import { ControlDeck } from "@/components/ControlDeck";
import { PartsList, SourcePanel, SpecSheet, type Stats } from "@/components/Panels";
import { Btn, Chip, Panel } from "@/components/ui";
import { downloadBlob, downloadText } from "@/lib/io";
import { cn } from "@/utils/cn";

const SOURCES = {
  "akeLD3.ts": akeSource,
  "rkn.ts": rknSource,
  "primitives.ts": primitivesSource,
  "AKEViewer.ts": viewerSource,
  "textures.ts": textureSource,
} as const;
type SourceName = keyof typeof SOURCES;

type Tab = "spec" | "parts" | "source";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<AKEViewer | null>(null);

  const [state, setState] = useState<ViewerState>(DEFAULT_STATE);
  const [stats, setStats] = useState<Stats | null>(null);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [measured, setMeasured] = useState<{ x: number; y: number; z: number } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [perf, setPerf] = useState({ fps: 0, triangles: 0, calls: 0 });
  const [tab, setTab] = useState<Tab>("spec");
  const [source, setSource] = useState<SourceName>("akeLD3.ts");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  /* ---------------- boot the viewer ---------------- */
  useEffect(() => {
    let live = true;
    let v: AKEViewer | null = null;

    const boot = () => {
      if (!live || !host.current) return;
      v = new AKEViewer(host.current, DEFAULT_STATE, {
        onBuild: (c) => {
          setStats(c.stats as Stats);
          setAssemblies([...c.assemblies]);
          const box = new THREE.Box3().setFromObject(c.group);
          const s = box.getSize(new THREE.Vector3());
          setMeasured({ x: s.x, y: s.y, z: s.z });
          setReady(true);
        },
        onHover: setHover,
        onPerf: setPerf,
      });
      viewer.current = v;
    };

    // canvas-drawn placards need the webfonts resolved before the first bake
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(boot).catch(boot);
    else boot();

    return () => {
      live = false;
      v?.dispose();
      viewer.current = null;
    };
  }, []);

  const patch = useCallback((p: Partial<ViewerState>) => {
    setState((s) => ({ ...s, ...p }));
    viewer.current?.setState(p);
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  /* ---------------- exports ---------------- */
  const doExport = async (kind: "glb" | "obj" | "stl") => {
    const v = viewer.current;
    if (!v) return;
    const stamp = `ake-ld3-${kind}`;
    if (kind === "glb") {
      const blob = await v.exportGLB();
      downloadBlob(blob, `${stamp}.glb`);
      notify(`GLB written · ${(blob.size / 1024).toFixed(0)} KB`);
    } else if (kind === "obj") {
      const text = v.exportOBJ();
      downloadText(text, `${stamp}.obj`, "text/plain");
      notify(`OBJ written · ${(text.length / 1024).toFixed(0)} KB`);
    } else {
      const data = v.exportSTL();
      downloadBlob(
        new Blob([data as unknown as BlobPart], { type: "model/stl" }),
        `${stamp}.stl`,
      );
      notify(`STL written · ${(data.byteLength / 1024).toFixed(0)} KB`);
    }
  };

  const onListHover = (id: string | null) => {
    setHighlight(id);
    viewer.current?.highlight(id);
  };

  const spec = MODELS[state.model];
  const dimsLabel = `${spec.dims.width.toFixed(2)} × ${spec.dims.depth.toFixed(2)} × ${spec.dims.height.toFixed(2)} m`;
  const marquee = [
    `${spec.name} · ${spec.family}`,
    `width ${(spec.dims.width * 1000).toFixed(0)} mm`,
    `depth ${(spec.dims.depth * 1000).toFixed(0)} mm`,
    `height ${(spec.dims.height * 1000).toFixed(0)} mm`,
    spec.contourOption ? `upper contour ${(spec.dims.topWidth * 1000).toFixed(0)} mm · 16.5° taper` : "uniform cuboid · no slope",
    ...spec.specs.map((r) => `${r.k} ${r.v}`),
    "cam-latch plug door · 112° swing",
    "generated at runtime · no mesh assets",
  ];

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-void text-ink">
      {/* ---------------- 3-D viewport ---------------- */}
      <div ref={host} className="absolute inset-0" />

      {/* ambient overlays: vignette, sweep, scanlines */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* ---------------- top bar ---------------- */}
      <header className="anim-in pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <Mark />
          <div>
            <h1 className="font-display text-[19px] font-bold leading-none tracking-[0.02em] text-ink sm:text-[23px]">
              {spec.code}
              <span className="text-amber">·</span>
              {spec.name.split("·")[1]?.trim()}
            </h1>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-dim sm:text-[10px]">
              procedural uld geometry lab
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          <div className="mr-1 hidden items-center gap-1.5 md:flex">
            <Chip tone="amber">{dimsLabel}</Chip>
            <Chip tone="steel">metallic pbr</Chip>
          </div>
          <div className="flex border border-line bg-panel/90 p-0.5 backdrop-blur-sm">
            {(Object.keys(MODELS) as ModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => patch({ model: id })}
                title={MODELS[id].family}
                className={cn(
                  "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  state.model === id
                    ? "bg-amber text-void shadow-[0_0_14px_-4px_rgba(255,176,32,0.9)]"
                    : "text-dim hover:bg-raise hover:text-ink",
                )}
              >
                {MODELS[id].code}
              </button>
            ))}
          </div>
          <Btn onClick={() => doExport("glb")} title="Binary glTF — drops into any viewer">
            <DlIcon /> glb
          </Btn>
          <Btn onClick={() => doExport("obj")} title="Wavefront OBJ">
            <DlIcon /> obj
          </Btn>
          <Btn onClick={() => doExport("stl")} title="Binary STL for print / CAD">
            <DlIcon /> stl
          </Btn>
          <Btn
            active={tab === "source"}
            onClick={() => {
              setTab("source");
              setSheet(true);
            }}
            title="Read the generator"
          >
            {"</>"} source
          </Btn>
        </div>
      </header>

      {/* ---------------- left: control deck ---------------- */}
      <div className="anim-rise pointer-events-none absolute bottom-16 left-3 z-20 hidden lg:bottom-14 lg:block xl:left-4">
        <div className="pointer-events-auto max-h-[calc(100dvh-190px)] overflow-y-auto scroll-slim pr-1">
          <ControlDeck
            state={state}
            set={patch}
            onView={(v) => viewer.current?.setView(v)}
            onFrame={() => viewer.current?.frameAll()}
          />
        </div>
      </div>

      {/* ---------------- right: instrument stack ---------------- */}
      <aside className="anim-rise pointer-events-none absolute bottom-16 right-3 top-[86px] z-20 hidden w-[336px] flex-col gap-2 lg:flex xl:right-4">
        <div className="pointer-events-auto">
          <div className="flex border border-line bg-panel/90 p-0.5 backdrop-blur-sm">
            {(["spec", "parts", "source"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                  tab === t ? "bg-amber text-void" : "text-dim hover:bg-raise hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto min-h-0 flex-1 overflow-hidden">
          {tab === "spec" && (
            <Panel title="Specification" code="IATA AHM / AS1811" className="h-full overflow-y-auto scroll-slim">
              <SpecSheet stats={stats} measured={measured} model={spec} />
            </Panel>
          )}
          {tab === "parts" && (
            <Panel title="Assembly tree" code={`${assemblies.length} groups`} className="h-full overflow-y-auto scroll-slim">
              <PartsList
                assemblies={assemblies}
                hovered={highlight}
                onHover={onListHover}
                onFocus={(id) => viewer.current?.focus(id)}
              />
            </Panel>
          )}
          {tab === "source" && (
            <Panel title="Generator source" code="three.js" className="flex h-full flex-col" bodyClass="min-h-0 flex-1 px-3 py-2.5">
              <div className="mb-2 flex gap-1">
                {(Object.keys(SOURCES) as SourceName[]).map((n) => (
                  <Btn key={n} active={source === n} onClick={() => setSource(n)}>
                    {n}
                  </Btn>
                ))}
              </div>
              <SourcePanel
                source={SOURCES[source]}
                filename={source}
                onDownload={() => {
                  downloadText(SOURCES[source], source, "text/typescript");
                  notify(`${source} downloaded`);
                }}
              />
            </Panel>
          )}
        </div>
      </aside>

      {/* ---------------- bottom status strip ---------------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-line-soft bg-deck/85 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5 text-jade">
            <span className="blink h-1.5 w-1.5 rounded-full bg-jade" />
            {ready ? "geometry live" : "building"}
          </span>
          <span className="text-dim">
            {perf.fps} fps · {(perf.triangles / 1000).toFixed(1)}k tris · {perf.calls} calls
          </span>
          <span className="hidden text-dim sm:inline">
            meshes {stats?.meshes ?? "—"} · vol {stats?.volumeM3.toFixed(2) ?? "—"} m³
          </span>
          <span className="hidden text-dim lg:inline">{spec.name}</span>
          <span className="ml-auto hidden max-w-[38%] truncate text-amber md:inline">
            {hover ? `${hover.assembly} → ${hover.part}` : "hover the model to identify components"}
          </span>
        </div>
        <div className="relative h-[18px] overflow-hidden border-t border-line-soft/70 bg-void/60">
          <div className="marquee-track absolute flex whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.2em] text-dim">
            {[0, 1].map((k) => (
              <span key={k} className="flex">
                {marquee.map((t) => (
                  <span key={t} className="px-6">
                    {t} <span className="text-amber/60">/</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </footer>

      {/* ---------------- mobile sheet ---------------- */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[38px] z-30 lg:hidden">
        <div className="flex items-center justify-center gap-1.5 px-3 pb-2">
          <Btn active={sheet && tab === "spec"} onClick={() => { setTab("spec"); setSheet(true); }}>
            spec
          </Btn>
          <Btn active={sheet && tab === "parts"} onClick={() => { setTab("parts"); setSheet(true); }}>
            parts
          </Btn>
          <Btn active={sheet} onClick={() => setSheet((s) => !s)}>
            {sheet ? "hide" : "controls"}
          </Btn>
        </div>
        {sheet && (
          <div className="max-h-[58dvh] overflow-y-auto scroll-slim border-t border-line bg-deck/95 p-3 backdrop-blur">
            {tab === "spec" && (
              <SpecSheet stats={stats} measured={measured} model={spec} />
            )}
            {tab === "parts" && (
              <PartsList
                assemblies={assemblies}
                hovered={highlight}
                onHover={onListHover}
                onFocus={(id) => viewer.current?.focus(id)}
              />
            )}
            {tab === "source" && (
              <div className="h-[46dvh]">
                <SourcePanel
                  source={SOURCES[source]}
                  filename={source}
                  onDownload={() => downloadText(SOURCES[source], source, "text/typescript")}
                />
              </div>
            )}
            <div className="mt-3">
              <ControlDeck
                state={state}
                set={patch}
                onView={(v) => viewer.current?.setView(v)}
                onFrame={() => viewer.current?.frameAll()}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------------- toast ---------------- */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-[70px] left-1/2 z-40 -translate-x-1/2 border border-amber/50 bg-panel/95 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-amber transition-all duration-300",
          toast ? "opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {toast ?? ""}
      </div>

      {/* ---------------- boot veil ---------------- */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-void transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="text-center">
          <div className="stencil text-[11px] text-amber">extruding contour section</div>
          <div className="mx-auto mt-3 h-[2px] w-52 overflow-hidden bg-line">
            <div className="h-full w-1/3 animate-[slide_1.1s_linear_infinite] bg-amber" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mark() {
  return (
    <svg viewBox="0 0 44 40" className="h-9 w-9 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd479" />
          <stop offset="1" stopColor="#c2790a" />
        </linearGradient>
      </defs>
      {/* isometric LD-3 silhouette: vertical back wall, leaning contour wall */}
      <path d="M6 34 L6 12 L26 6 L38 10 L38 30 L18 36 Z" fill="#151a20" stroke="#39434d" strokeWidth="1.2" />
      <path d="M6 12 L26 6 L26 28 L6 34 Z" fill="url(#mk)" opacity="0.9" />
      <path d="M26 6 L38 10 L38 30 L26 28 Z" fill="#8d959c" opacity="0.55" />
      <path d="M6 34 L18 36 L38 30 L26 28 Z" fill="#0e1216" />
      <path d="M10 16 L22 12 M10 21 L22 17 M10 26 L22 22" stroke="#2b333b" strokeWidth="1" />
      <circle cx="32" cy="20" r="1.6" fill="#ffb020" />
    </svg>
  );
}

function DlIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M6 1v7M3 5.5 6 8.5 9 5.5M1.5 10.5h9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
