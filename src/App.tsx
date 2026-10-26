import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import akeSource from "./three/akeLD3.ts?raw";
import rknSource from "./three/rkn.ts?raw";
import rapSource from "./three/rap.ts?raw";
import pmcSource from "./three/pmc.ts?raw";
import primitivesSource from "./three/primitives.ts?raw";
import viewerSource from "./three/AKEViewer.ts?raw";
import textureSource from "./three/textures.ts?raw";
import modelsSource from "./three/models.ts?raw";
import annotationsSource from "./three/annotations.ts?raw";

import {
  AKEViewer,
  DEFAULT_STATE,
  type HoverInfo,
  type MeasureInfo,
  type SectionInfo,
  type ViewerState,
} from "@/three/AKEViewer";
import { decodeShareState, encodeShareState } from "@/lib/state";
import { formatDistance } from "@/lib/units";
import { MODELS, type ModelId } from "@/three/models";
import type { Assembly } from "@/three/primitives";
import { ControlDeck } from "@/components/ControlDeck";
import {
  PartsList,
  SourcePanel,
  SpecSheet,
  type Stats,
} from "@/components/Panels";
import { Btn, Chip, Panel } from "@/components/ui";
import { downloadBlob, downloadText } from "@/lib/io";
import { cn } from "@/utils/cn";

const SOURCES = {
  "akeLD3.ts": akeSource,
  "rkn.ts": rknSource,
  "rap.ts": rapSource,
  "pmc.ts": pmcSource,
  "models.ts": modelsSource,
  "primitives.ts": primitivesSource,
  "AKEViewer.ts": viewerSource,
  "textures.ts": textureSource,
  "annotations.ts": annotationsSource,
} as const;

type SourceName = keyof typeof SOURCES;

const SOURCE_META: Record<SourceName, { entry: string; description: string }> =
  {
    "akeLD3.ts": {
      entry: "createAKEContainer()",
      description:
        "Contoured LD-3 generator: one offset polygon drives hull, frames, door and hardware.",
    },
    "rkn.ts": {
      entry: "createRKNContainer()",
      description:
        "Uniform refrigerated LD-9 generator with articulated door and live controller artwork.",
    },
    "rap.ts": {
      entry: "createRAPContainer()",
      description:
        "Full-width cold-chain generator with insulated panels and twin condenser fans.",
    },
    "pmc.ts": {
      entry: "createPMCContainer()",
      description:
        "Main-deck pallet generator with seat tracks, underside structure and load contour.",
    },
    "models.ts": {
      entry: "MODELS",
      description:
        "Declarative ULD registry: dimensions, ratings, controls and generator bindings.",
    },
    "primitives.ts": {
      entry: "offsetPolygon / ringSection",
      description:
        "Shared CAD kernel, material palette, instanced rivets and container contract.",
    },
    "AKEViewer.ts": {
      entry: "AKEViewer",
      description:
        "Renderer lifecycle, model-aware camera framing, lighting, picking and mesh exports.",
    },
    "textures.ts": {
      entry: "makeBrushedMetal / makeReeferPanel",
      description:
        "Deterministic cached Canvas PBR maps, placards, stencils and controller readouts.",
    },
    "annotations.ts": {
      entry: "createAnnotations()",
      description:
        "Model-aware 3D dimension furniture generated from registry measurements.",
    },
  };

const isSourceName = (value: string): value is SourceName => value in SOURCES;

type Tab = "spec" | "parts" | "source";

/** Initial workbench state: defaults overlaid with any shared URL hash. */
function initialState(): ViewerState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const shared = decodeShareState(window.location.hash);
  const merged = { ...DEFAULT_STATE, ...shared };
  // A shared setpoint must respect the selected model's controller range.
  const range = MODELS[merged.model].setpointRange;
  if (range) {
    merged.setpoint =
      shared.setpoint !== undefined
        ? Math.min(range.max, Math.max(range.min, shared.setpoint))
        : range.default;
  }
  if (merged.compare === merged.model) merged.compare = "none";
  return merged;
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<AKEViewer | null>(null);
  const [bootState] = useState<ViewerState>(initialState);

  const [state, setState] = useState<ViewerState>(bootState);
  const [stats, setStats] = useState<Stats | null>(null);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [measured, setMeasured] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [perf, setPerf] = useState({ fps: 0, triangles: 0, calls: 0 });
  const [tab, setTab] = useState<Tab>("spec");
  const [source, setSource] = useState<SourceName>(
    isSourceName(MODELS[bootState.model].sourceFile)
      ? (MODELS[bootState.model].sourceFile as SourceName)
      : "akeLD3.ts",
  );
  const [measureOn, setMeasureOn] = useState(false);
  const [measure, setMeasure] = useState<MeasureInfo | null>(null);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  /* ---------------- boot the viewer ---------------- */
  useEffect(() => {
    let live = true;
    let v: AKEViewer | null = null;

    const boot = () => {
      if (!live || !host.current) return;
      try {
        v = new AKEViewer(host.current, bootState, {
          onBuild: (c) => {
            setStats(c.stats as Stats);
            setAssemblies([...c.assemblies]);
            const box = new THREE.Box3().setFromObject(c.group);
            const size = box.getSize(new THREE.Vector3());
            setMeasured({ x: size.x, y: size.y, z: size.z });
            setError(null);
            setReady(true);
          },
          onHover: setHover,
          onPerf: setPerf,
          onMeasure: setMeasure,
          onSection: setSectionInfo,
          onError: (message) => {
            setError(message);
            if (message) setReady(true);
          },
        });
        viewer.current = v;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? `WebGL could not start: ${cause.message}`
            : "WebGL could not start on this device.",
        );
        setReady(true);
      }
    };

    // Canvas-drawn placards need the webfonts resolved before the first bake.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(boot).catch(boot);
    else boot();

    return () => {
      live = false;
      v?.dispose();
      viewer.current = null;
    };
  }, []);

  const patch = useCallback((next: Partial<ViewerState>) => {
    setState((s) => ({ ...s, ...next }));
    viewer.current?.setState(next);
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(
      () => setToast((current) => (current === message ? null : current)),
      2600,
    );
  };

  const selectModel = (id: ModelId) => {
    const next = MODELS[id];
    patch({
      model: id,
      setpoint: next.setpointRange?.default ?? state.setpoint,
      compare: state.compare === id ? "none" : state.compare,
    });
    if (isSourceName(next.sourceFile)) setSource(next.sourceFile);
    setHighlight(null);
    setHover(null);
  };

  /* ---------------- exports ---------------- */
  const doExport = async (kind: "glb" | "obj" | "stl") => {
    const v = viewer.current;
    if (!v || exporting) return;
    setExporting(true);
    const stamp = MODELS[state.model].name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
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
        const buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer;
        downloadBlob(new Blob([buffer], { type: "model/stl" }), `${stamp}.stl`);
        notify(`STL written · ${(data.byteLength / 1024).toFixed(0)} KB`);
      }
    } catch (cause) {
      notify(
        cause instanceof Error
          ? `${kind.toUpperCase()} export failed · ${cause.message.slice(0, 60)}`
          : `${kind.toUpperCase()} export failed`,
      );
    } finally {
      setExporting(false);
    }
  };

  const onListHover = (id: string | null) => {
    setHighlight(id);
    viewer.current?.highlight(id);
  };

  const toggleMeasure = useCallback((on: boolean) => {
    setMeasureOn(on);
    viewer.current?.setMeasureMode(on);
    if (!on) setMeasure(null);
  }, []);

  /* ---------------- shareable URL state ---------------- */
  useEffect(() => {
    const encoded = `#${encodeShareState(state)}`;
    const t = window.setTimeout(() => {
      if (window.location.hash !== encoded) {
        window.history.replaceState(null, "", encoded);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const onHash = () => {
      const shared = decodeShareState(window.location.hash);
      if (!Object.keys(shared).length) return;
      const current = stateRef.current;
      const merged = { ...current, ...shared };
      // Ignore hashes that merely echo our own writes.
      if (encodeShareState(merged) === encodeShareState(current)) return;
      const range = MODELS[merged.model].setpointRange;
      if (range) {
        merged.setpoint = Math.min(
          range.max,
          Math.max(range.min, merged.setpoint),
        );
      }
      if (merged.compare === merged.model) merged.compare = "none";
      setState(merged);
      viewer.current?.setState(merged);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${encodeShareState(state)}`;
    if (!navigator.clipboard) {
      notify("Copy the address-bar URL to share this setup");
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => notify("Share link copied"))
      .catch(() => notify("Clipboard unavailable"));
  };

  const doSnapshot = async () => {
    const v = viewer.current;
    if (!v || exporting) return;
    setExporting(true);
    try {
      const blob = await v.snapshotPNG();
      const stamp = MODELS[state.model].name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadBlob(blob, `${stamp}-view.png`);
      notify(`PNG written · ${(blob.size / 1024).toFixed(0)} KB`);
    } catch {
      notify("Snapshot failed");
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;
      const ids = Object.keys(MODELS) as ModelId[];
      const k = e.key.toLowerCase();
      if (k >= "1" && k <= "4") selectModel(ids[Number(k) - 1]);
      else if (k === "f") viewer.current?.frameAll();
      else if (k === "i") viewer.current?.setView("iso");
      else if (k === "o")
        patch({
          projection: state.projection === "persp" ? "ortho" : "persp",
        });
      else if (k === "d") patch({ dimensions: !state.dimensions });
      else if (k === "w") patch({ wireframe: !state.wireframe });
      else if (k === "s") patch({ section: !state.section });
      else if (k === "m") toggleMeasure(!measureOn);
      else if (k === "escape") {
        if (measureOn) toggleMeasure(false);
        else viewer.current?.clearMeasure();
        setSheet(false);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const spec = MODELS[state.model];
  const dimsLabel = spec.palletOption
    ? `${spec.dims.width.toFixed(2)} × ${spec.dims.depth.toFixed(2)} m deck · ${(spec.dims.contourHeight ?? 0).toFixed(2)} m contour`
    : `${spec.dims.width.toFixed(2)} × ${spec.dims.depth.toFixed(2)} × ${spec.dims.height.toFixed(2)} m`;
  const taperDegrees =
    Math.atan2(spec.dims.topWidth - spec.dims.width, spec.dims.height) *
    (180 / Math.PI);
  const sectionLabel = spec.contourOption
    ? state.contour
      ? `upper contour ${(spec.dims.topWidth * 1000).toFixed(0)} mm · ${taperDegrees.toFixed(1)}° taper`
      : "prismatic base section · contour disabled"
    : spec.palletOption
      ? "96 × 125 in pallet · netted build contour"
      : "uniform cuboid · no slope";
  const marquee = [
    `${spec.name} · ${spec.family}`,
    `width ${(spec.dims.width * 1000).toFixed(0)} mm`,
    `depth ${(spec.dims.depth * 1000).toFixed(0)} mm`,
    spec.palletOption
      ? `deck ${(spec.dims.height * 1000).toFixed(0)} mm`
      : `height ${(spec.dims.height * 1000).toFixed(0)} mm`,
    sectionLabel,
    ...spec.specs.map((row) => `${row.k} ${row.v}`),
    spec.featureLabel,
    `generator ${spec.sourceFile}`,
    "generated at runtime · no mesh assets",
  ];
  const activeSource = SOURCE_META[source];
  const measureLabel =
    measure?.distance != null
      ? `${formatDistance(measure.distance)} · Δ ${measure.dx.toFixed(2)}/${measure.dy.toFixed(2)}/${measure.dz.toFixed(2)} m`
      : measureOn && measure?.points === 1
        ? "first point set — click the second"
        : null;
  const sectionReadout = sectionInfo
    ? `${sectionInfo.axis.toUpperCase()} +${sectionInfo.offset.toFixed(2)} m`
    : `${Math.round(state.sectionPos * 100)}%`;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-void text-ink">
      {/* ---------------- 3-D viewport ---------------- */}
      <div
        ref={host}
        className="absolute inset-0"
        aria-label="Interactive 3D viewport"
      />
      <p className="sr-only">
        Interactive aviation ULD model. Drag to orbit, scroll to zoom, and use
        the control deck or assembly tree to inspect parts. Focus the 3D canvas
        and use arrow keys to pan.
      </p>

      {/* ambient overlays: vignette + scanlines */}
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
          <div
            role="group"
            aria-label="Select ULD model"
            className="flex border border-line bg-panel/90 p-0.5 backdrop-blur-sm"
          >
            {(Object.keys(MODELS) as ModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => selectModel(id)}
                title={MODELS[id].family}
                aria-pressed={state.model === id}
                className={cn(
                  "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70",
                  state.model === id
                    ? "bg-amber text-void shadow-[0_0_14px_-4px_rgba(255,176,32,0.9)]"
                    : "text-dim hover:bg-raise hover:text-ink",
                )}
              >
                {MODELS[id].code}
              </button>
            ))}
          </div>
          <Btn
            onClick={() => doExport("glb")}
            disabled={!ready || !!error || exporting}
            title="Binary glTF — drops into any viewer"
          >
            <DlIcon /> glb
          </Btn>
          <Btn
            onClick={() => doExport("obj")}
            disabled={!ready || !!error || exporting}
            title="Wavefront OBJ · metres"
            className="hidden sm:inline-flex"
          >
            <DlIcon /> obj
          </Btn>
          <Btn
            onClick={() => doExport("stl")}
            disabled={!ready || !!error || exporting}
            title="Binary STL · units are metres (scale ×1000 for mm slicers)"
            className="hidden sm:inline-flex"
          >
            <DlIcon /> stl
          </Btn>
          <Btn
            onClick={doSnapshot}
            disabled={!ready || !!error || exporting}
            title="Save the current viewport as PNG"
          >
            png
          </Btn>
          <Btn
            onClick={copyLink}
            title="Copy a link that reproduces this exact setup"
          >
            link
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
            onView={(view) => viewer.current?.setView(view)}
            onFrame={() => viewer.current?.frameAll()}
            measureOn={measureOn}
            onMeasureToggle={toggleMeasure}
            onMeasureClear={() => viewer.current?.clearMeasure()}
            measureLabel={measureLabel}
            sectionLabel={sectionReadout}
          />
        </div>
      </div>

      {/* ---------------- right: instrument stack ---------------- */}
      <aside className="anim-rise pointer-events-none absolute bottom-16 right-3 top-[86px] z-20 hidden w-[336px] flex-col gap-2 lg:flex xl:right-4">
        <div className="pointer-events-auto">
          <div
            role="tablist"
            aria-label="Inspector view"
            className="flex border border-line bg-panel/90 p-0.5 backdrop-blur-sm"
          >
            {(["spec", "parts", "source"] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={cn(
                  "flex-1 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70",
                  tab === item
                    ? "bg-amber text-void"
                    : "text-dim hover:bg-raise hover:text-ink",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto min-h-0 flex-1 overflow-hidden">
          {tab === "spec" && (
            <Panel
              title="Specification"
              code={`${spec.code} envelope`}
              className="h-full overflow-y-auto scroll-slim"
            >
              <SpecSheet stats={stats} measured={measured} model={spec} />
            </Panel>
          )}
          {tab === "parts" && (
            <Panel
              title="Assembly tree"
              code={`${assemblies.length} groups`}
              className="h-full overflow-y-auto scroll-slim"
            >
              <PartsList
                assemblies={assemblies}
                hovered={highlight}
                onHover={onListHover}
                onFocus={(id) => viewer.current?.focus(id)}
              />
            </Panel>
          )}
          {tab === "source" && (
            <Panel
              title="Repository source"
              code="typescript"
              className="flex h-full flex-col"
              bodyClass="min-h-0 flex-1 px-3 py-2.5"
            >
              <div className="mb-2 flex flex-wrap gap-1">
                {(Object.keys(SOURCES) as SourceName[]).map((name) => (
                  <Btn
                    key={name}
                    active={source === name}
                    onClick={() => setSource(name)}
                  >
                    {name}
                  </Btn>
                ))}
              </div>
              <SourcePanel
                source={SOURCES[source]}
                filename={source}
                entry={activeSource.entry}
                description={activeSource.description}
                onDownload={() => {
                  downloadText(SOURCES[source], source, "text/typescript");
                  notify(`${source} downloaded`);
                }}
                onCopy={(ok) =>
                  notify(ok ? `${source} copied` : "Clipboard unavailable")
                }
              />
            </Panel>
          )}
        </div>
      </aside>

      {/* ---------------- bottom status strip ---------------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-line-soft bg-deck/85 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
          <span
            className={cn(
              "flex items-center gap-1.5",
              error ? "text-signal" : "text-jade",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                error ? "bg-signal" : "blink bg-jade",
              )}
            />
            {error
              ? "viewport unavailable"
              : ready
                ? "geometry live"
                : "building"}
          </span>
          <span className="text-dim">
            {perf.fps} fps · {(perf.triangles / 1000).toFixed(1)}k tris ·{" "}
            {perf.calls} calls
          </span>
          <span className="hidden text-dim sm:inline">
            meshes {stats?.meshes ?? "—"} · vol{" "}
            {stats?.volumeM3.toFixed(2) ?? "—"} m³
          </span>
          <span className="hidden text-dim lg:inline">{spec.name}</span>
          <span className="ml-auto hidden max-w-[38%] truncate text-amber md:inline">
            {measureOn
              ? (measureLabel ?? "measure · click two surface points")
              : hover
                ? `${hover.assembly} → ${hover.part}`
                : "hover the model to identify components"}
          </span>
          <span className="sr-only" role="status" aria-live="polite">
            {measure?.distance != null
              ? `Measured distance ${formatDistance(measure.distance)}`
              : ""}
          </span>
        </div>
        <div className="relative h-[18px] overflow-hidden border-t border-line-soft/70 bg-void/60">
          <div className="marquee-track absolute flex whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.2em] text-dim">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex">
                {marquee.map((text) => (
                  <span key={text} className="px-6">
                    {text} <span className="text-amber/60">/</span>
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
          <Btn
            active={sheet && tab === "spec"}
            onClick={() => {
              setTab("spec");
              setSheet(true);
            }}
          >
            spec
          </Btn>
          <Btn
            active={sheet && tab === "parts"}
            onClick={() => {
              setTab("parts");
              setSheet(true);
            }}
          >
            parts
          </Btn>
          <Btn
            active={sheet && tab === "source"}
            onClick={() => {
              setTab("source");
              setSheet(true);
            }}
          >
            source
          </Btn>
          <Btn active={sheet} onClick={() => setSheet((open) => !open)}>
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
                  entry={activeSource.entry}
                  description={activeSource.description}
                  onDownload={() => {
                    downloadText(SOURCES[source], source, "text/typescript");
                    notify(`${source} downloaded`);
                  }}
                  onCopy={(ok) =>
                    notify(ok ? `${source} copied` : "Clipboard unavailable")
                  }
                />
              </div>
            )}
            <div className="mt-3">
              <ControlDeck
                state={state}
                set={patch}
                onView={(view) => viewer.current?.setView(view)}
                onFrame={() => viewer.current?.frameAll()}
                measureOn={measureOn}
                onMeasureToggle={toggleMeasure}
                onMeasureClear={() => viewer.current?.clearMeasure()}
                measureLabel={measureLabel}
                sectionLabel={sectionReadout}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------------- toast ---------------- */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute bottom-[70px] left-1/2 z-40 -translate-x-1/2 border border-amber/50 bg-panel/95 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-amber transition-all duration-300",
          toast ? "opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {toast ?? ""}
      </div>

      {/* ---------------- WebGL failure state ---------------- */}
      {error && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/95 p-6 text-center">
          <div className="max-w-md border border-signal/50 bg-panel/90 p-6">
            <div className="stencil text-[11px] text-signal">
              viewport offline
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">
              3D preview unavailable
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mute">{error}</p>
            <Btn className="mt-5" onClick={() => window.location.reload()}>
              reload viewer
            </Btn>
          </div>
        </div>
      )}

      {/* ---------------- boot veil ---------------- */}
      <div
        aria-hidden={ready}
        className={cn(
          "pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-void transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="text-center">
          <div className="stencil text-[11px] text-amber">
            extruding contour section
          </div>
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
      <path
        d="M6 34 L6 12 L26 6 L38 10 L38 30 L18 36 Z"
        fill="#151a20"
        stroke="#39434d"
        strokeWidth="1.2"
      />
      <path d="M6 12 L26 6 L26 28 L6 34 Z" fill="url(#mk)" opacity="0.9" />
      <path d="M26 6 L38 10 L38 30 L26 28 Z" fill="#8d959c" opacity="0.55" />
      <path d="M6 34 L18 36 L38 30 L26 28 Z" fill="#0e1216" />
      <path
        d="M10 16 L22 12 M10 21 L22 17 M10 26 L22 22"
        stroke="#2b333b"
        strokeWidth="1"
      />
      <circle cx="32" cy="20" r="1.6" fill="#ffb020" />
    </svg>
  );
}

function DlIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M6 1v7M3 5.5 6 8.5 9 5.5M1.5 10.5h9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
