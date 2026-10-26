import { useCallback, useEffect, useRef, useState } from "react";

import akeSource from "./three/akeLD3.ts?raw";
import akcSource from "./three/akc.ts?raw";
import dpeSource from "./three/dpe.ts?raw";
import dqfSource from "./three/dqf.ts?raw";
import akhSource from "./three/akh.ts?raw";
import alfSource from "./three/alf.ts?raw";
import alpSource from "./three/alp.ts?raw";
import rknSource from "./three/rkn.ts?raw";
import rapSource from "./three/rap.ts?raw";
import amaSource from "./three/ama.ts?raw";
import amdSource from "./three/amd.ts?raw";
import agaSource from "./three/aga.ts?raw";
import pmcSource from "./three/pmc.ts?raw";
import profileSource from "./three/profileContainer.ts?raw";
import primitivesSource from "./three/primitives.ts?raw";
import viewerSource from "./three/AKEViewer.ts?raw";
import textureSource from "./three/textures.ts?raw";
import modelsSource from "./three/models.ts?raw";
import annotationsSource from "./three/annotations.ts?raw";
import plannerSource from "./lib/planner.ts?raw";
import stateSource from "./lib/state.ts?raw";
import unitsSource from "./lib/units.ts?raw";

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
  "akc.ts": akcSource,
  "dpe.ts": dpeSource,
  "dqf.ts": dqfSource,
  "akh.ts": akhSource,
  "alf.ts": alfSource,
  "alp.ts": alpSource,
  "rkn.ts": rknSource,
  "rap.ts": rapSource,
  "ama.ts": amaSource,
  "amd.ts": amdSource,
  "aga.ts": agaSource,
  "pmc.ts": pmcSource,
  "profileContainer.ts": profileSource,
  "models.ts": modelsSource,
  "primitives.ts": primitivesSource,
  "AKEViewer.ts": viewerSource,
  "textures.ts": textureSource,
  "annotations.ts": annotationsSource,
  "planner.ts": plannerSource,
  "state.ts": stateSource,
  "units.ts": unitsSource,
} as const;

type SourceName = keyof typeof SOURCES;

const SOURCE_META: Record<SourceName, { entry: string; description: string }> =
  {
    "akeLD3.ts": {
      entry: "createAKEContainer()",
      description:
        "Contoured LD-3 generator: one offset polygon drives hull, frames, door and hardware.",
    },
    "akc.ts": {
      entry: "createAKCContainer()",
      description:
        "LD-1 wrapper: deep 92 in single-contour trapezoid bound to the profile engine via an explicit asymmetric section.",
    },
    "dpe.ts": {
      entry: "createDPEContainer()",
      description:
        "LD-2 wrapper: 767 half-width P-base envelope bound to the profile engine via an explicit asymmetric section.",
    },
    "dqf.ts": {
      entry: "createDQFContainer()",
      description:
        "LD-8 wrapper: 767 full-width twin-LD2 trapezoid bound to the symmetric-profile engine.",
    },
    "akh.ts": {
      entry: "createAKHContainer()",
      description:
        "LD3-45 wrapper: certified A320-family envelope bound to the symmetric-profile engine.",
    },
    "alf.ts": {
      entry: "createALFContainer()",
      description:
        "LD6 wrapper: full-width twin-contour envelope bound to the symmetric-profile engine.",
    },
    "alp.ts": {
      entry: "createALPContainer()",
      description:
        "LD-11 wrapper: rectangular full-width lower-deck envelope bound to the profile engine.",
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
    "ama.ts": {
      entry: "createAMAContainer()",
      description:
        "M-1 wrapper: main-deck 96 in envelope with nominal roof chamfer, bound to the symmetric-profile engine.",
    },
    "amd.ts": {
      entry: "createAMDContainer()",
      description:
        "M1H wrapper: asymmetric 118 in contour-D section (explicit polygon) bound to the profile engine.",
    },
    "aga.ts": {
      entry: "createAGAContainer()",
      description:
        "M-2 wrapper: 20-ft PGA-footprint main-deck box bound to the symmetric-profile engine.",
    },
    "profileContainer.ts": {
      entry: "createProfileContainer()",
      description:
        "Parameterized engine for extruded-section ULDs (AKC, DPE, DQF, AKH, ALF, ALP, AMA, AMD, AGA): ring hull, edge frame, hinged door, blind end, chassis.",
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
        "Renderer lifecycle, perspective/orthographic cameras, section cuts, measurement, compare envelopes, idle rendering and mesh exports.",
    },
    "textures.ts": {
      entry: "makeBrushedMetal / makeReeferPanel",
      description:
        "Deterministic cached Canvas PBR maps, placards, stencils and controller readouts.",
    },
    "annotations.ts": {
      entry: "createAnnotations()",
      description:
        "Model-aware 3D dimension furniture with metric + imperial readouts, generated from registry measurements.",
    },
    "planner.ts": {
      entry: "computePlan()",
      description:
        "Pure load-planning arithmetic: utilisation, volumetric and chargeable weight, overload status.",
    },
    "state.ts": {
      entry: "encodeShareState / decodeShareState",
      description:
        "Shareable URL-hash codec for the full workbench configuration, decoded defensively field by field.",
    },
    "units.ts": {
      entry: "formatDistance()",
      description:
        "Metric/imperial conversions shared by dimension sprites, measurement labels and the planner.",
    },
  };

const isSourceName = (value: string): value is SourceName => value in SOURCES;

type Tab = "spec" | "parts" | "source";
const TAB_ORDER: Tab[] = ["spec", "parts", "source"];

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
  const [perf, setPerf] = useState({
    fps: 0,
    triangles: 0,
    calls: 0,
    idle: false,
  });
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
          onBuild: (c, measuredSize) => {
            setStats(c.stats as Stats);
            setAssemblies([...c.assemblies]);
            // Viewer measures door-closed / load-stowed: the certified pose.
            setMeasured(measuredSize);
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

    // Canvas-drawn placards need the webfonts resolved before the first
    // bake — but a hanging font request must never block the viewer.
    let booted = false;
    const bootOnce = () => {
      if (booted) return;
      booted = true;
      boot();
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(bootOnce).catch(bootOnce);
      window.setTimeout(bootOnce, 1200);
    } else bootOnce();

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

  /* Showcase: a 7 s choreographed door/load + explode cycle that returns
     every control to its starting value. Pure UI animation over existing
     non-structural state (door swing, explode, pallet load). */
  const [showcase, setShowcase] = useState(false);
  const showcaseRaf = useRef(0);
  const stopShowcase = useCallback(() => {
    cancelAnimationFrame(showcaseRaf.current);
    setShowcase(false);
  }, []);
  const runShowcase = useCallback(() => {
    if (showcase) {
      stopShowcase();
      return;
    }
    setShowcase(true);
    const s0 = stateRef.current;
    const pallet = MODELS[s0.model].palletOption;
    const from = { door: s0.door, explode: s0.explode, load: s0.load };
    const DURATION = 7000;
    const start = performance.now();
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const seg = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
    const tick = (now: number) => {
      const t = clamp01((now - start) / DURATION);
      const open = seg(t, 0.02, 0.3) - seg(t, 0.74, 0.98);
      const boom = seg(t, 0.38, 0.62) - seg(t, 0.74, 0.98);
      if (pallet) {
        patch({ load: from.load + (1 - from.load) * open, explode: from.explode + (1 - from.explode) * boom });
      } else {
        patch({ door: from.door + (1 - from.door) * open, explode: from.explode + (1 - from.explode) * boom });
      }
      if (t < 1) showcaseRaf.current = requestAnimationFrame(tick);
      else setShowcase(false);
    };
    showcaseRaf.current = requestAnimationFrame(tick);
  }, [patch, showcase, stopShowcase]);
  useEffect(() => stopShowcase, [state.model, stopShowcase]);

  const toastId = useRef(0);
  const notify = useCallback((message: string) => {
    const id = ++toastId.current;
    setToast(message);
    window.setTimeout(() => {
      if (toastId.current === id) setToast(null);
    }, 2600);
  }, []);

  /* Stable callbacks keep the memoised panels out of hover/perf re-renders. */
  const onViewCb = useCallback(
    (view: "front" | "top" | "contour" | "iso") =>
      viewer.current?.setView(view),
    [],
  );
  const onFrameCb = useCallback(() => viewer.current?.frameAll(), []);
  const onMeasureClearCb = useCallback(
    () => viewer.current?.clearMeasure(),
    [],
  );
  const onFocusCb = useCallback(
    (id: string | null) => viewer.current?.focus(id),
    [],
  );

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

  const onListHover = useCallback((id: string | null) => {
    setHighlight(id);
    viewer.current?.highlight(id);
  }, []);

  const onDownloadSource = useCallback(() => {
    downloadText(SOURCES[source], source, "text/typescript");
    notify(`${source} downloaded`);
  }, [source, notify]);
  const onCopySource = useCallback(
    (ok: boolean) =>
      notify(ok ? `${source} copied` : "Clipboard unavailable"),
    [source, notify],
  );

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
      const keyIndex = "1234567890qer".indexOf(k); // w stays the wireframe toggle
      if (keyIndex >= 0 && keyIndex < ids.length) selectModel(ids[keyIndex]);
      else if (k === "f") viewer.current?.frameAll();
      else if (k === "i") viewer.current?.setView("iso");
      else if (k === "o")
        patch({
          projection: state.projection === "persp" ? "ortho" : "persp",
        });
      else if (k === "d") patch({ dimensions: !state.dimensions });
      else if (k === "w") patch({ wireframe: !state.wireframe });
      else if (k === "s") patch({ section: !state.section });
      else if (k === "c")
        patch(
          state.section
            ? { sectionCaps: !state.sectionCaps }
            : { section: true, sectionCaps: true },
        );
      else if (k === "m") toggleMeasure(!measureOn);
      else if (k === "p") void doSnapshot();
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
      <header className="anim-in pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-3 [margin-top:env(safe-area-inset-top)] [margin-left:env(safe-area-inset-left)] [margin-right:env(safe-area-inset-right)] sm:p-4">
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
            onClick={runShowcase}
            disabled={!ready || !!error}
            pressed={showcase}
            title="Animated showcase: door/load cycle + exploded view, then back"
          >
            {showcase ? "■ showcase" : "▶ showcase"}
          </Btn>
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
            onView={onViewCb}
            onFrame={onFrameCb}
            measureOn={measureOn}
            onMeasureToggle={toggleMeasure}
            onMeasureClear={onMeasureClearCb}
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
            {TAB_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`tab-${item}`}
                aria-selected={tab === item}
                aria-controls={`panel-${item}`}
                tabIndex={tab === item ? 0 : -1}
                onClick={() => setTab(item)}
                onKeyDown={(e) => {
                  const idx = TAB_ORDER.indexOf(item);
                  const next =
                    e.key === "ArrowRight"
                      ? TAB_ORDER[(idx + 1) % TAB_ORDER.length]
                      : e.key === "ArrowLeft"
                        ? TAB_ORDER[
                            (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length
                          ]
                        : e.key === "Home"
                          ? TAB_ORDER[0]
                          : e.key === "End"
                            ? TAB_ORDER[TAB_ORDER.length - 1]
                            : null;
                  if (!next) return;
                  e.preventDefault();
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }}
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
            <div
              role="tabpanel"
              id="panel-spec"
              aria-labelledby="tab-spec"
              className="h-full"
            >
              <Panel
                title="Specification"
                code={`${spec.code} envelope`}
                className="h-full overflow-y-auto scroll-slim"
              >
                <SpecSheet stats={stats} measured={measured} model={spec} compareModel={state.compare !== "none" ? MODELS[state.compare] : null} />
              </Panel>
            </div>
          )}
          {tab === "parts" && (
            <div
              role="tabpanel"
              id="panel-parts"
              aria-labelledby="tab-parts"
              className="h-full"
            >
              <Panel
                title="Assembly tree"
                code={`${assemblies.length} groups`}
                className="h-full overflow-y-auto scroll-slim"
              >
                <PartsList
                  assemblies={assemblies}
                  hovered={highlight}
                  onHover={onListHover}
                  onFocus={onFocusCb}
                />
              </Panel>
            </div>
          )}
          {tab === "source" && (
            <div
              role="tabpanel"
              id="panel-source"
              aria-labelledby="tab-source"
              className="h-full"
            >
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
                    pressed={source === name}
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
                onDownload={onDownloadSource}
                onCopy={onCopySource}
              />
              </Panel>
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- bottom status strip ---------------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-line-soft bg-deck/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
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
          <span
            className="text-dim"
            title={
              perf.idle
                ? "Scene settled — renderer idling at ~4 Hz until the next interaction"
                : undefined
            }
          >
            {perf.idle ? "idle" : `${perf.fps} fps`} ·{" "}
            {(perf.triangles / 1000).toFixed(1)}k tris · {perf.calls} calls
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
              <span key={copy} className="flex" aria-hidden={copy === 1}>
                {marquee.map((text, i) => (
                  <span key={`${copy}-${i}`} className="px-6">
                    {text} <span className="text-amber/60">/</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </footer>

      {/* ---------------- mobile sheet ---------------- */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(38px+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <div className="flex items-center justify-center gap-1.5 px-3 pb-2">
          <Btn
            active={sheet && tab === "spec"}
            pressed={sheet && tab === "spec"}
            onClick={() => {
              setTab("spec");
              setSheet(true);
            }}
          >
            spec
          </Btn>
          <Btn
            active={sheet && tab === "parts"}
            pressed={sheet && tab === "parts"}
            onClick={() => {
              setTab("parts");
              setSheet(true);
            }}
          >
            parts
          </Btn>
          <Btn
            active={sheet && tab === "source"}
            pressed={sheet && tab === "source"}
            onClick={() => {
              setTab("source");
              setSheet(true);
            }}
          >
            source
          </Btn>
          <Btn
            active={sheet}
            pressed={sheet}
            onClick={() => setSheet((open) => !open)}
          >
            {sheet ? "hide" : "controls"}
          </Btn>
        </div>
        {sheet && (
          <div className="max-h-[58dvh] overflow-y-auto scroll-slim border-t border-line bg-deck/95 p-3 backdrop-blur">
            {tab === "spec" && (
              <SpecSheet stats={stats} measured={measured} model={spec} compareModel={state.compare !== "none" ? MODELS[state.compare] : null} />
            )}
            {tab === "parts" && (
              <PartsList
                assemblies={assemblies}
                hovered={highlight}
                onHover={onListHover}
                onFocus={onFocusCb}
              />
            )}
            {tab === "source" && (
              <div className="h-[46dvh]">
                <SourcePanel
                  source={SOURCES[source]}
                  filename={source}
                  entry={activeSource.entry}
                  description={activeSource.description}
                  onDownload={onDownloadSource}
                  onCopy={onCopySource}
                />
              </div>
            )}
            <div className="mt-3">
              <ControlDeck
                state={state}
                set={patch}
                onView={onViewCb}
                onFrame={onFrameCb}
                measureOn={measureOn}
                onMeasureToggle={toggleMeasure}
                onMeasureClear={onMeasureClearCb}
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
