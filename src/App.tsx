import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import aviationEmblem from "./assets/branding/air-cargo-emblem.png";
import aviationPrint from "./assets/branding/yaslogist-air-print.png";

import akeSource from "./three/akeLD3.ts?raw";
import doorMotionSource from "./three/doorKinematics.ts?raw";
import airMarkSource from "./three/airServiceBrand.ts?raw";
import fabricDoorSource from "./three/akeFabricDoor.ts?raw";
import precisionDetailsSource from "./three/akePrecisionDetails.ts?raw";
import akcSource from "./three/akc.ts?raw";
import dpeSource from "./three/dpe.ts?raw";
import dqfSource from "./three/dqf.ts?raw";
import aqpSource from "./three/aqp.ts?raw";
import akhSource from "./three/akh.ts?raw";
import alfSource from "./three/alf.ts?raw";
import alpSource from "./three/alp.ts?raw";
import aapSource from "./three/aap.ts?raw";
import rknSource from "./three/rkn.ts?raw";
import rapSource from "./three/rap.ts?raw";
import amaSource from "./three/ama.ts?raw";
import amdSource from "./three/amd.ts?raw";
import agaSource from "./three/aga.ts?raw";
import pagSource from "./three/pag.ts?raw";
import pmcSource from "./three/pmc.ts?raw";
import pgaSource from "./three/pga.ts?raw";
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
import type { CargoScenario } from "@/lib/planner";
import { cargoCoreForModel, demoCargoForModel, planCargoForModel, type CargoItem } from "@/lib/cargoPlacement";
import { computeCargoSignature, exportCargoSignatureCSV } from "@/lib/cargoSignature";
import { projectedCartonMetrics } from "@/lib/cargoProjection";
import { SignatureStudio, type StudioPreset } from "@/components/SignatureStudio";
import { CargoMissionDock } from "@/components/CargoMissionDock";
import { ModelExplorer } from "@/components/ModelExplorer";
import { CargoLab } from "@/components/CargoLab";
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
import { inspectorTopOffset } from "@/lib/inspectorLayout";
import { cn } from "@/utils/cn";

const SOURCES = {
  "akeLD3.ts": akeSource,
  "doorKinematics.ts": doorMotionSource,
  "airServiceBrand.ts": airMarkSource,
  "akeFabricDoor.ts": fabricDoorSource,
  "akePrecisionDetails.ts": precisionDetailsSource,
  "akc.ts": akcSource,
  "dpe.ts": dpeSource,
  "dqf.ts": dqfSource,
  "aqp.ts": aqpSource,
  "akh.ts": akhSource,
  "alf.ts": alfSource,
  "alp.ts": alpSource,
  "aap.ts": aapSource,
  "rkn.ts": rknSource,
  "rap.ts": rapSource,
  "ama.ts": amaSource,
  "amd.ts": amdSource,
  "aga.ts": agaSource,
  "pag.ts": pagSource,
  "pmc.ts": pmcSource,
  "pga.ts": pgaSource,
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
    "doorKinematics.ts": {
      entry: "rigidDoorPose() / stepDampedDoor()",
      description: "Two-stage latch release and door swing, with deterministic damped display motion; no certified contact pressure.",
    },
    "airServiceBrand.ts": {
      entry: "addAirCargoOperatorMark()",
      description: "Small user-supplied aviation identity placard attached to the door without replacing serial, load or warning plates.",
    },
    "akeFabricDoor.ts": {
      entry: "createAKEFabricDoor()",
      description: "Representative AKE textile door: contoured fabric, woven finish, folding geometry, straps and buckles; not a certified restraint model.",
    },
    "akePrecisionDetails.ts": {
      entry: "addAKEPrecisionDetails()",
      description: "Close-range sheet joins, instanced fasteners, door reinforcement and service details with screen-space LOD.",
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
    "aqp.ts": {
      entry: "createAQPContainer()",
      description:
        "LD-4 wrapper: rectangular 96 × 60.4 in lower-deck envelope bound to the profile engine.",
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
    "aap.ts": {
      entry: "createAAPContainer()",
      description:
        "LD-9 wrapper: rectangular box on the 88 × 125 in P1P base, bound to the profile engine.",
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
    "pag.ts": {
      entry: "createPAGContainer()",
      description:
        "P1P wrapper: 88 × 125 in pallet spec bound to the shared pallet engine in pmc.ts.",
    },
    "pmc.ts": {
      entry: "createPMCContainer()",
      description:
        "Shared pallet engine (PAG/PMC/PGA) with seat tracks, underside structure and load contour.",
    },
    "pga.ts": {
      entry: "createPGAContainer()",
      description:
        "20 ft wrapper: 96 × 238.5 in heavy-haul pallet spec bound to the shared pallet engine in pmc.ts.",
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

type Tab = "spec" | "cargo" | "studio" | "parts" | "source";
const TAB_ORDER: Tab[] = ["spec", "cargo", "studio", "parts", "source"];

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
  const workspace = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const parent = workspace.current;
    const bar = header.current;
    if (!parent || !bar) return;
    const align = () => parent.style.setProperty(
      "--uld-inspector-top",
      String(inspectorTopOffset(bar.getBoundingClientRect().bottom, parent.getBoundingClientRect().top)) + "px",
    );
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(align) : null;
    observer?.observe(bar);
    window.addEventListener("resize", align);
    align();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", align);
      parent.style.removeProperty("--uld-inspector-top");
    };
  }, []);
  const viewer = useRef<AKEViewer | null>(null);
  const [bootState] = useState<ViewerState>(initialState);

  const [state, setState] = useState<ViewerState>(bootState);
  // A shipment belongs to the workbench, not to a particular model or tab.
  const [cargoScenario, setCargoScenario] = useState<CargoScenario>(() => {
    const ratings = MODELS[bootState.model].ratings;
    return {
      cargoKg: String(Math.round(ratings.payloadKg / 2)),
      cargoM3: String(Math.round(ratings.volumeM3 * 50) / 100),
      divisor: "6000",
    };
  });
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([]);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const cargoPlan = useMemo(
    () => planCargoForModel(state.model, cargoItems, state.contour),
    [cargoItems, state.model, state.contour],
  );
  const cargoSignature = useMemo(
    () => computeCargoSignature(cargoPlan, cargoCoreForModel(state.model, state.contour)),
    [cargoPlan, state.model, state.contour],
  );
  const focusedCarton = useMemo(
    () => cargoPlan.placed.find(item => item.id === selectedCargoId) ?? null,
    [cargoPlan, selectedCargoId],
  );
  const selectedProjection = useMemo(
    () => focusedCarton
      ? projectedCartonMetrics(focusedCarton, cargoCoreForModel(state.model, state.contour).floorY)
      : null,
    [focusedCarton, state.model, state.contour],
  );
  const [showMassField, setShowMassField] = useState(false);
  const [studioPreset, setStudioPreset] = useState<StudioPreset | null>(null);
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
  const [mobileDeckOpen, setMobileDeckOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [modelExplorerOpen, setModelExplorerOpen] = useState(false);

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
          onDoorToggle: (next) => {
            setState((current) => ({ ...current, door: next }));
            v?.setState({ door: next });
          },
          onError: (message) => {
            setError(message);
            if (message) setReady(true);
          },
        }, aviationPrint);
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

  // Cartons are a separate inspection overlay: they never enter CAD exports
  // or overwrite the legacy mass/volume-only load planner.
  useEffect(() => {
    if (!ready) return;
    const cargoVisible = studioPreset !== "hero" && studioPreset !== "teardown";
    viewer.current?.setCargoBoxes(
      cargoVisible ? cargoPlan.placed : [],
      cargoVisible && (tab === "cargo" || cargoItems.length > 0),
      cargoSignature,
      cargoVisible && showMassField,
    );
  }, [ready, state.model, cargoPlan, cargoSignature, tab, cargoItems.length, studioPreset, showMassField]);

  useEffect(() => {
    if (ready) viewer.current?.setCargoSelection(focusedCarton?.id ?? null);
  }, [ready, focusedCarton]);

  const launchCargoDemo = useCallback(() => {
    setSelectedCargoId(null);
    setStudioPreset("field");
    setShowMassField(true);
    const model = MODELS[state.model];
    setCargoItems(demoCargoForModel(state.model, state.contour));
    setTab("cargo");
    // Leave model selection unchanged; the scene is built for this ULD.
    setSheet(false);
    patch({
      door: model.palletOption ? 0 : 1,
      load: 0, section: !model.palletOption, sectionAxis: "z",
      sectionPos: 0.53, sectionFlip: false, sectionCaps: false,
      dimensions: false, autoRotate: false, explode: 0, compare: "none",
    });
    viewer.current?.frameAll();
  }, [patch, state.model, state.contour]);

  const openCargoWorkspace = useCallback(() => {
    setStudioPreset(null);
    setTab("cargo");
    setMobileDeckOpen(false);
    setSheet(true);
  }, []);

  const openStudio = useCallback(() => {
    setTab("studio");
    setMobileDeckOpen(false);
    setSheet(true);
  }, []);

  const applyStudioPreset = useCallback((preset: StudioPreset) => {
    const spec = MODELS[state.model];
    setStudioPreset(preset);
    setTab("studio");
    setSheet(false);
    setShowMassField(preset === "field");
    if (preset === "hero") {
      patch({
        mood: "studio", surfaceCondition: "factory",
        metalness: 0.92, roughness: 0.32, envIntensity: 1.4,
        section: false, explode: 0, dimensions: false,
        wireframe: false, autoRotate: false, compare: "none",
        door: 0, load: 0, projection: "persp",
      });
    } else if (preset === "teardown") {
      patch({
        mood: "studio", explode: 0.6, projection: "ortho",
        section: false, dimensions: true, detail: true,
        rivets: true, wireframe: false, autoRotate: false,
        compare: "none", door: spec.palletOption ? 0 : 0.18,
        load: 0,
      });
    } else {
      if (preset === "field" && cargoItems.length === 0) {
        setCargoItems(demoCargoForModel(state.model, state.contour));
      }
      patch({
        mood: preset === "field" ? "studio" : "hangar",
        projection: "persp", explode: 0, dimensions: false,
        section: !spec.palletOption, sectionAxis: "z",
        sectionPos: 0.53, sectionFlip: false, sectionCaps: false,
        door: spec.palletOption ? 0 : 1, load: 0,
        wireframe: false, autoRotate: false, compare: "none",
      });
    }
    viewer.current?.frameAll();
  }, [patch, state.model, state.contour, cargoItems.length]);

  // Make the mass field discoverable from the loading bar, including on mobile.
  // applyStudioPreset closes the sheet for the canvas view; re-open it so the
  // numerical analysis is actually visible on smaller screens.
  const openMassAnalysis = useCallback(() => {
    applyStudioPreset("field");
    setMobileDeckOpen(false);
    setSheet(true);
  }, [applyStudioPreset]);

  const changeCargoItems = useCallback((items: CargoItem[]) => {
    setSelectedCargoId(prev => prev && items.some(item => item.id === prev) ? prev : null);
    setCargoItems(items);
    if (items.length) setStudioPreset(current =>
      current === "hero" || current === "teardown" ? null : current);
  }, []);

  const selectCartonForInspection = useCallback((id: string | null) => {
    setSelectedCargoId(id);
    if (!id) return;
    setStudioPreset(current => current === "hero" || current === "teardown" ? null : current);
    setSheet(false); // Reveal the selected carton immediately on small screens.
    const pallet = MODELS[state.model].palletOption;
    patch({
      door: pallet ? 0 : 1, load: 0, section: !pallet,
      sectionAxis: "z", sectionPos: 0.53, sectionFlip: false,
      sectionCaps: false, autoRotate: false,
    });
  }, [patch, state.model]);

  // Pallet generators also contain an illustrative translucent 'cargo load'
  // mesh. Hide that alternative representation when actual carton previews
  // are present to avoid two overlapping cargo visuals.
  useEffect(() => {
    if (ready && cargoItems.length > 0 && MODELS[state.model].palletOption && state.load > 0) {
      patch({ load: 0 });
    }
  }, [ready, cargoItems.length, state.model, state.load, patch]);

  const exportSignature = useCallback(() => {
    if (!cargoPlan.placed.length) return;
    const csv = exportCargoSignatureCSV(MODELS[state.model].code, cargoPlan, cargoSignature);
    downloadText(csv, `${state.model}-cargo-signature.csv`, "text/csv;charset=utf-8");
  }, [cargoPlan, cargoSignature, state.model]);

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
    if (cargoItems.length > 0 && cargoItems.every(item => item.id.includes("-demo-"))) {
      // Keep the showcase visible when switching between ULD families.
      setCargoItems(demoCargoForModel(id, state.contour));
    }
    patch({
      model: id, load: cargoItems.length > 0 ? 0 : state.load,
      door: next.palletOption ? 0 : state.door,
      section: cargoItems.length > 0 && next.palletOption ? false : state.section,
      setpoint: next.setpointRange?.default ?? state.setpoint,
      compare: state.compare === id ? "none" : state.compare,
    });
    if (isSourceName(next.sourceFile)) setSource(next.sourceFile);
    setHighlight(null);
    setHover(null);
    setSelectedCargoId(null);
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
        const surfaceWarning = state.model === "ake" && state.akeDoor === "fabric"
          ? "STL · open textile surfaces"
          : "STL mesh · not print-certified";
        notify(`${surfaceWarning} · ${(data.byteLength / 1024).toFixed(0)} KB`);
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
      // Do not let scene shortcuts change a ULD while the catalogue is open.
      if (modelExplorerOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setModelExplorerOpen(false);
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;
      const ids = Object.keys(MODELS) as ModelId[];
      const k = e.key.toLowerCase();
      const keyIndex = "1234567890qertyug".indexOf(k); // w stays the wireframe toggle
      if (keyIndex >= 0 && keyIndex < ids.length) selectModel(ids[keyIndex]);
      else if (k === "/") setModelExplorerOpen(true);
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
        setFocusMode(false);
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
      ? "pallet deck · illustrative build contour"
      : "nominal cross-section";
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
    <div ref={workspace} className="air-service-theme relative h-[100dvh] w-screen overflow-hidden bg-void text-ink">
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

      {/* ambient vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Presentation mode: uncluttered viewport, no extra renderer or scene. */}
      {focusMode && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute left-4 top-5 max-w-[75vw] border-l-2 border-[#94d7ed]/80 bg-[#0a1822]/75 py-3 pl-4 pr-6 backdrop-blur-sm sm:left-10 sm:top-9 sm:pl-5">
            <div className="font-mono text-[9px] uppercase tracking-[.23em] text-[#9bd5e9] sm:text-[11px]">
              YASLOGIST / AIR CARGO &amp; AVIATION
            </div>
            <div className="mt-2 font-display text-[26px] font-bold uppercase leading-none tracking-[.045em] text-white sm:text-[44px]">
              ULD360
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#c5e4ee]">
              {spec.code} · {spec.family}
            </div>
          </div>
          <button type="button" onClick={() => setFocusMode(false)}
            className="pointer-events-auto absolute right-3 top-3 min-h-10 border border-[#6aa7be]/75 bg-[#0a1822]/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[.12em] text-white hover:bg-[#244553] focus-visible:outline-[#b3e6f2] sm:right-9 sm:top-9">
            exit focus · esc
          </button>
          <div className="absolute bottom-5 left-5 border-l border-[#8cc7de]/70 pl-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#bfdce7] sm:bottom-9 sm:left-10">
            Interactive ULD engineering · Drag to orbit · Scroll to inspect
          </div>
          <span aria-hidden="true" className="absolute bottom-8 right-9 hidden h-12 w-12 border-b border-r border-[#89d5ea]/60 sm:block" />
        </div>
      )}

      {focusedCarton && (
        <div data-testid="selected-cargo-indicator" role="status" aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-[122px] z-30 w-[min(92vw,400px)] -translate-x-1/2 sm:top-[102px]">
          <div className="pointer-events-auto flex items-center gap-2 border border-[#6bd5ef] bg-[#071e2c]/95 px-3 py-2 shadow-[0_5px_25px_rgba(0,0,0,.40)] backdrop-blur">
            <span aria-hidden="true" className="text-[#6bdcf3]">◇</span>
            <div className="min-w-0 flex-1 font-mono">
              <div className="text-[9px] font-semibold uppercase tracking-[.11em] text-[#8de2f3]">Highlighted · cargo preview</div>
              <div className="truncate text-[11px] text-white">{focusedCarton.label} · {focusedCarton.massKg.toFixed(1)} kg</div>
              {selectedProjection?.arealMassIndexKgM2 != null && (
                <div className="mt-1 text-[10px] text-[#bce4ef]">
                  {selectedProjection.planAreaM2?.toFixed(3)} m² plan view ·
                  {" "}{selectedProjection.arealMassIndexKgM2.toFixed(1)} kg/m² index
                </div>
              )}
              <div className="mt-0.5 text-[9px] text-[#e3c699]">
                {selectedProjection?.layer === "preview-floor" ? "Base at preview floor" :
                  selectedProjection?.layer === "above-preview-floor" ? "Elevated in preview" :
                    "Layer unknown"} · NOT floor pressure
              </div>
            </div>
            <button type="button" onClick={() => setSelectedCargoId(null)}
              aria-label="Clear highlighted carton"
              className="min-h-10 min-w-10 border border-[#436b7e] text-lg text-white hover:bg-[#295268] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">×</button>
          </div>
        </div>
      )}

      {/* High-visibility entrance to the working cargo demonstration. */}
      {!error && !focusMode && (
        <CargoMissionDock
          active={cargoItems.length > 0}
          ready={ready}
          modelCode={spec.code}
          hidden={sheet}
          itemCount={cargoItems.length}
          plan={cargoPlan}
          onStart={launchCargoDemo}
          onAnalyze={openMassAnalysis}
          onInspect={openCargoWorkspace}
          onClear={() => {
            setCargoItems([]);
            setShowMassField(false);
            setStudioPreset(null);
            patch({ section: false, door: 0 });
          }}
        />
      )}

      {/* ---------------- top bar ---------------- */}
      <header ref={header} className={cn(
        "anim-in pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-stretch justify-between gap-1.5 p-2.5 [margin-top:env(safe-area-inset-top)] [margin-left:env(safe-area-inset-left)] [margin-right:env(safe-area-inset-right)] sm:flex-row sm:items-start sm:gap-4 sm:p-4",
        focusMode && "hidden",
      )}>
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
          <span className="aviation-emblem-frame" aria-hidden="true">
            <img src={aviationEmblem} alt=""
              className="aviation-emblem-image"
              decoding="async"
              draggable={false} />
          </span>
          <div>
            <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.19em] text-[#90bfdf] sm:text-[9px]">
              YASLOGIST / ULD360 / AIR CARGO
            </div>
            <h1 className="font-display text-[17px] font-bold leading-none tracking-[0.02em] text-ink sm:text-[23px]">
              {spec.code}
              <span className="text-amber">·</span>
              {spec.name.split("·")[1]?.trim()}
            </h1>
            <p className="mt-1 hidden font-mono text-[9.5px] uppercase tracking-[0.22em] text-dim sm:block sm:text-[10px]">
              ULD visual engineering lab · representative models
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-1.5">
          <div className="mr-1 hidden items-center gap-1.5 md:flex">
            <Chip tone="amber">{dimsLabel}</Chip>
            <Chip tone="steel">metallic pbr</Chip>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={modelExplorerOpen}
            aria-label="Browse 17 ULD models and technical references"
            title="Search and compare ULD reference specifications · press /"
            aria-keyshortcuts="/"
            onClick={() => setModelExplorerOpen(true)}
            className="flex min-h-10 shrink-0 items-center gap-2 border border-[#8ad6ee] bg-[#184457] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.09em] text-white hover:bg-[#28617a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>⌕ Models</span>
            <span className="border border-[#9ed1df]/50 px-1.5 py-0.5 text-[#bce9f5]">{Object.keys(MODELS).length}</span>
          </button>
          <div
            role="group"
            aria-label="Quick-select ULD model"
            className="hidden w-full max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto whitespace-nowrap border border-line bg-panel/90 p-0.5 backdrop-blur-sm xl:flex xl:w-auto xl:max-w-[72vw] xl:flex-wrap xl:justify-end xl:overflow-visible"
          >
            {(Object.keys(MODELS) as ModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => selectModel(id)}
                title={MODELS[id].family}
                aria-pressed={state.model === id}
                className={cn(
                  "shrink-0 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber/70",
                  state.model === id
                    ? "bg-amber text-void shadow-[0_0_14px_-4px_rgba(90,188,235,0.9)]"
                    : "text-dim hover:bg-raise hover:text-ink",
                )}
              >
                {MODELS[id].code}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap pb-0.5 sm:contents">
          <Btn
            active={focusMode}
            pressed={focusMode}
            onClick={() => {
              setFocusMode(true);
              setSheet(false);
              viewer.current?.frameAll();
            }}
            title="Presentation focus view with clear canvas; press Escape to exit"
            className="border-[#5e97b2]/70 text-[#bde0ed]"
          >
            ⊞ focus
          </Btn>
          <Btn
            active={tab === "studio"}
            pressed={tab === "studio"}
            onClick={openStudio}
            className="border-[#5fa6c2]/60 bg-[#17303b]/80 text-[#b5d9e8]"
            title="Engineering lenses: material, teardown, cutaway and cargo mass field"
          >
            ◇ lenses
          </Btn>
          <Btn
            active={tab === "cargo"}
            pressed={tab === "cargo"}
            onClick={openCargoWorkspace}
            className="border-[#76bed6]/70 bg-[#173240]/90 text-[#c3ebf9] hover:border-[#b4e6f2] hover:text-white"
            title="Open the 3D Cargo Loading Laboratory"
          >
            ◈ cargo lab
          </Btn>
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
            title={state.model === "ake" && state.akeDoor === "fabric"
              ? "Binary STL · open textile curtain and straps · not a solid or print-ready"
              : "Binary STL · metre coordinates · preview geometry only; not verified manifold or print-ready"}
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
        </div>
      </header>

      {modelExplorerOpen && (
        <ModelExplorer
          activeModel={state.model}
          onClose={() => setModelExplorerOpen(false)}
          onInspect={(id) => {
            setModelExplorerOpen(false);
            setFocusMode(false);
            setMobileDeckOpen(false);
            setSheet(false);
            selectModel(id);
            viewer.current?.frameAll();
          }}
          onCompare={(id) => {
            setModelExplorerOpen(false);
            setFocusMode(false);
            patch({ compare: id });
            setMobileDeckOpen(false);
            setTab("spec");
            setSheet(true);
          }}
        />
      )}

      {/* ---------------- left: control deck ---------------- */}
      <div className={cn("anim-rise pointer-events-none absolute bottom-16 left-3 z-20 hidden xl:bottom-14 xl:block xl:left-4", focusMode && "xl:!hidden")}>
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
      <aside className={cn("anim-rise pointer-events-none absolute bottom-16 right-3 top-[var(--uld-inspector-top,160px)] z-20 hidden w-[336px] flex-col gap-2 xl:flex xl:right-4", focusMode && "xl:!hidden")}>
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
                <SpecSheet cargoScenario={cargoScenario} setCargoScenario={setCargoScenario} stats={stats} measured={measured} model={spec} compareModel={state.compare !== "none" ? MODELS[state.compare] : null} onSelectModel={selectModel} />
              </Panel>
            </div>
          )}
          {tab === "cargo" && (
            <div role="tabpanel" id="panel-cargo" aria-labelledby="tab-cargo" className="h-full">
              <Panel title="Cargo placement" code={`${spec.code} sandbox`} className="h-full overflow-y-auto scroll-slim">
                <CargoLab items={cargoItems} plan={cargoPlan} onChange={changeCargoItems}
                  model={state.model} contour={state.contour} onLoadDemo={launchCargoDemo}
                  selectedCartonId={focusedCarton?.id ?? null}
                  onSelectCarton={selectCartonForInspection}
                  onOpenDoor={() => patch({
                    door: spec.palletOption ? 0 : 1, load: 0,
                    section: !spec.palletOption, sectionAxis: "z",
                    sectionPos: 0.52, sectionFlip: false, sectionCaps: false,
                  })} />
              </Panel>
            </div>
          )}
          {tab === "studio" && (
            <div role="tabpanel" id="panel-studio" aria-labelledby="tab-studio" className="h-full">
              <Panel title="Signature studio" code={spec.code} className="h-full overflow-y-auto scroll-slim">
                <SignatureStudio
                  model={state.model} state={state} plan={cargoPlan}
                  signature={cargoSignature} fieldVisible={showMassField}
                  activePreset={studioPreset}
                  onPreset={applyStudioPreset}
                  onExport={exportSignature}
                  onInspectCarton={selectCartonForInspection}
                  onFieldVisible={(visible) => {
                    setShowMassField(visible);
                    setStudioPreset(visible ? "field" : null);
                    if (visible) patch({
                      mood: "studio", explode: 0, dimensions: false,
                      section: !spec.palletOption, sectionAxis: "z",
                      sectionPos: 0.53, sectionCaps: false,
                      door: spec.palletOption ? 0 : 1, load: 0,
                      autoRotate: false,
                    });
                  }}
                  onPatch={(next) => { setStudioPreset(null); patch(next); }}
                />
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
      <footer className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-line-soft bg-deck/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm", focusMode && "hidden")}>
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
            {perf.idle ? "idle" : perf.fps ? `${perf.fps} fps` : "— fps"} ·{" "}
            {(perf.triangles / 1000).toFixed(1)}k tris · {perf.calls} calls
          </span>
          <span className="hidden text-dim sm:inline">
            meshes {stats?.meshes ?? "—"} · vol{" "}
            {stats?.volumeM3.toFixed(2) ?? "—"} m³
          </span>
          <span className="hidden text-dim xl:inline">{spec.name}</span>
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
      <div className={cn("pointer-events-auto absolute inset-x-0 bottom-[calc(38px+env(safe-area-inset-bottom))] z-30 xl:hidden", focusMode && "!hidden")}>
        <div className="flex items-center justify-start gap-1.5 overflow-x-auto whitespace-nowrap px-3 pb-2 sm:justify-center">
          <Btn
            active={sheet && tab === "spec"}
            pressed={sheet && tab === "spec"}
            onClick={() => {
              setTab("spec");
              setMobileDeckOpen(false);
              setSheet(true);
            }}
          >
            spec
          </Btn>
          <Btn
            active={sheet && tab === "cargo"}
            pressed={sheet && tab === "cargo"}
            onClick={() => {
              setTab("cargo");
              setMobileDeckOpen(false);
              setSheet(true);
            }}
          >
            cargo
          </Btn>
          <Btn
            active={sheet && tab === "studio"}
            pressed={sheet && tab === "studio"}
            onClick={openStudio}
          >
            lenses
          </Btn>
          <Btn
            active={sheet && tab === "parts"}
            pressed={sheet && tab === "parts"}
            onClick={() => {
              setTab("parts");
              setMobileDeckOpen(false);
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
              setMobileDeckOpen(false);
              setSheet(true);
            }}
          >
            source
          </Btn>
          <Btn
            active={sheet && mobileDeckOpen}
            pressed={sheet && mobileDeckOpen}
            onClick={() => {
              setMobileDeckOpen(true);
              setSheet(true);
            }}
            title="Open ULD material, dimensions and camera controls"
          >
            model
          </Btn>
          <Btn
            active={sheet}
            pressed={sheet}
            onClick={() => setSheet((open) => !open)}
          >
            {sheet ? "hide" : "show"}
          </Btn>
        </div>
        {sheet && (
          <div className="max-h-[58dvh] overflow-y-auto scroll-slim border-t border-line bg-deck/95 p-3 backdrop-blur">
            {mobileDeckOpen && (
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
            )}
            {!mobileDeckOpen && tab === "spec" && (
              <SpecSheet cargoScenario={cargoScenario} setCargoScenario={setCargoScenario} stats={stats} measured={measured} model={spec} compareModel={state.compare !== "none" ? MODELS[state.compare] : null} onSelectModel={selectModel} />
            )}
            {!mobileDeckOpen && tab === "cargo" && (
              <CargoLab items={cargoItems} plan={cargoPlan} onChange={changeCargoItems}
                model={state.model} contour={state.contour} onLoadDemo={launchCargoDemo}
                  selectedCartonId={focusedCarton?.id ?? null}
                  onSelectCarton={selectCartonForInspection}
                onOpenDoor={() => patch({
                  door: spec.palletOption ? 0 : 1, load: 0,
                  section: !spec.palletOption, sectionAxis: "z",
                  sectionPos: 0.52, sectionFlip: false, sectionCaps: false,
                })} />
            )}
            {!mobileDeckOpen && tab === "studio" && (
              <SignatureStudio
                model={state.model} state={state} plan={cargoPlan}
                signature={cargoSignature} fieldVisible={showMassField}
                activePreset={studioPreset}
                onPreset={applyStudioPreset}
                onExport={exportSignature}
                onInspectCarton={selectCartonForInspection}
                onFieldVisible={(visible) => {
                  setShowMassField(visible);
                  setStudioPreset(visible ? "field" : null);
                  if (visible) patch({
                    mood: "studio", explode: 0, dimensions: false,
                    section: !spec.palletOption, sectionAxis: "z",
                    sectionPos: 0.53, sectionCaps: false,
                    door: spec.palletOption ? 0 : 1, load: 0,
                    autoRotate: false,
                  });
                }}
                onPatch={(next) => { setStudioPreset(null); patch(next); }}
              />
            )}
            {!mobileDeckOpen && tab === "parts" && (
              <PartsList
                assemblies={assemblies}
                hovered={highlight}
                onHover={onListHover}
                onFocus={onFocusCb}
              />
            )}
            {!mobileDeckOpen && tab === "source" && (
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
