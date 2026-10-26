/**
 * ============================================================================
 *  models.ts — the registry that lets one viewer drive several container
 *  families. Each entry carries its display metadata (for the UI), its
 *  certified dimensions (for the dimension overlay) and the builder function.
 *
 *  Adding a container = write one generator file that implements ContainerBase,
 *  then add a single entry here. No viewer, exporter or UI logic changes.
 * ============================================================================
 */
import type {
  ContainerBase,
  ContainerStats,
  FinishId,
  ViewerContainer,
} from "./primitives";
import { AKE_DIMENSIONS, createAKEContainer } from "./akeLD3";
import { AKH_DIMENSIONS, createAKHContainer } from "./akh";
import { ALF_DIMENSIONS, createALFContainer } from "./alf";
import { RKN_DIMENSIONS, createRKNContainer } from "./rkn";
import { RAP_DIMENSIONS, createRAPContainer } from "./rap";
import { AMA_DIMENSIONS, createAMAContainer } from "./ama";
import { PMC_DIMENSIONS, createPMCContainer } from "./pmc";

export type ModelId = "ake" | "akh" | "alf" | "rkn" | "rap" | "ama" | "pmc";

/** Everything the UI can ask a model to build. */
export interface ViewerOptions {
  contour: boolean;
  finish: FinishId;
  detail: boolean;
  rivets: boolean;
  doorOpen: number;
  reefer: boolean;
  setpoint: number;
  /** 0..1 cargo-load contour (pallets only) */
  load: number;
}

export interface ModelInfo {
  id: ModelId;
  /** short type code, e.g. "AKE" */
  code: string;
  /** full designation, e.g. "AKE · LD-3" */
  name: string;
  /** descriptive family line */
  family: string;
  blurb: string;
  /** certified envelope in metres */
  dims: {
    width: number;
    depth: number;
    height: number;
    /** width at the top of the envelope (differs from width only on the AKE) */
    topWidth: number;
    /** nominal netted cargo build height above a pallet deck, if applicable */
    contourHeight?: number;
  };
  /** generator module shown by the in-app source inspector */
  sourceFile: string;
  /** model-specific capability line for the status marquee */
  featureLabel: string;
  /** numeric ratings shared by the specification sheet and 3-D data plates */
  ratings: {
    tareKg: number;
    maxGrossKg: number;
    payloadKg: number;
    volumeM3: number;
  };
  /** certified controller range for active refrigeration models */
  setpointRange?: { min: number; max: number; default: number };
  /** does the contour toggle apply to this model? */
  contourOption: boolean;
  /** does the refrigeration panel apply to this model? */
  reeferOption: boolean;
  /** is this a flat pallet (no walls, no door, cargo contour instead)? */
  palletOption: boolean;
  /** section-drawing kind for symmetric profile families (AKH/ALF/AMA) */
  annotationKind?: "dual-contour" | "roof-chamfer";
  /** slope angle from vertical drawn on the dimension overlay, degrees */
  taperDeg?: number;
  /** caption under the slope angle, e.g. "WING ANGLE (EACH SIDE)" */
  taperLabel?: string;
  /** human-readable certified volume */
  volumeLabel: string;
  /** extra spec rows for the specification sheet */
  specs: { k: string; v: string; tone?: "amber" | "steel" }[];
  build(options: ViewerOptions): ViewerContainer;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  ake: {
    id: "ake",
    code: "AKE",
    name: "AKE · LD-3",
    family: "lower-deck cargo container",
    blurb:
      "Contoured lower-deck container. The right trapezoid section with a 16.5° fuselage-side taper is derived from one nominal polygon, so hull, cavity, end frames and door leaf stay dimensionally exact when the taper is switched off.",
    dims: {
      width: AKE_DIMENSIONS.baseWidth,
      depth: AKE_DIMENSIONS.baseLength,
      height: AKE_DIMENSIONS.height,
      topWidth: AKE_DIMENSIONS.topWidth,
    },
    contourOption: true,
    reeferOption: false,
    palletOption: false,
    volumeLabel: "4.3 m³ · 152 ft³",
    sourceFile: "akeLD3.ts",
    featureLabel: "cam-latch plug door · 112° swing",
    ratings: { tareKg: 92, maxGrossKg: 1588, payloadKg: 1496, volumeM3: 4.3 },
    specs: [
      { k: "Upper contour", v: "2.01 m", tone: "steel" },
      { k: "Taper angle", v: "16.5°", tone: "steel" },
      { k: "Certified volume", v: "4.3 m³ · 152 ft³" },
      { k: "Tare mass", v: "92 kg" },
      { k: "Max gross", v: "1588 kg", tone: "amber" },
      { k: "Net payload", v: "1496 kg" },
    ],
    build: (o) => createAKEContainer(o),
  },
  akh: {
    id: "akh",
    code: "AKH",
    name: "AKH · LD3-45",
    family: "narrowbody lower-deck container",
    blurb:
      "The LD3-45 for A320-family lower decks: only 45 in (1.14 m) tall, with wings sloping out on both sides from a low knee to a 2.44 m overall width that fills the narrowbody fuselage. Built by the shared symmetric-profile engine; the 0.30 m knee is a nominal approximation of the A320 bilge curve.",
    dims: {
      width: AKH_DIMENSIONS.baseWidth,
      depth: AKH_DIMENSIONS.baseLength,
      height: AKH_DIMENSIONS.height,
      topWidth: AKH_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "dual-contour",
    taperDeg: (Math.atan2((AKH_DIMENSIONS.topWidth - AKH_DIMENSIONS.baseWidth) / 2, AKH_DIMENSIONS.height - AKH_DIMENSIONS.kneeHeight) * 180) / Math.PI,
    taperLabel: "WING ANGLE (EACH SIDE)",
    volumeLabel: "3.3 m³ · 116 ft³",
    sourceFile: "akh.ts",
    featureLabel: "A320-family lower deck · double-wing 45 in contour",
    ratings: { tareKg: 82, maxGrossKg: 1588, payloadKg: 1506, volumeM3: 3.3 },
    specs: [
      { k: "Overall top width", v: "2.44 m", tone: "steel" },
      { k: "Wing angle", v: "28.2° each side", tone: "steel" },
      { k: "Certified volume", v: "3.3 m³ · 116 ft³" },
      { k: "Tare mass", v: "82 kg" },
      { k: "Max gross", v: "1588 kg", tone: "amber" },
      { k: "Net payload", v: "1506 kg" },
    ],
    build: (o) => createAKHContainer(o),
  },
  alf: {
    id: "alf",
    code: "ALF",
    name: "ALF · LD6",
    family: "full-width lower-deck container",
    blurb:
      "The LD6 spans the full widebody lower-deck width on a 60.4 × 125 in base: two LD-3 contours mirrored back to back, each wing sloping the full height at ≈16° to a 4.06 m roof line. One ALF replaces a pair of AKEs — compare them side by side with the envelope overlay.",
    dims: {
      width: ALF_DIMENSIONS.baseWidth,
      depth: ALF_DIMENSIONS.baseLength,
      height: ALF_DIMENSIONS.height,
      topWidth: ALF_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "dual-contour",
    taperDeg: (Math.atan2((ALF_DIMENSIONS.topWidth - ALF_DIMENSIONS.baseWidth) / 2, ALF_DIMENSIONS.height - ALF_DIMENSIONS.kneeHeight) * 180) / Math.PI,
    taperLabel: "WING ANGLE (EACH SIDE)",
    volumeLabel: "8.9 m³ · 316 ft³",
    sourceFile: "alf.ts",
    featureLabel: "full-width lower deck · twin-LD3 double contour",
    ratings: { tareKg: 230, maxGrossKg: 3175, payloadKg: 2945, volumeM3: 8.95 },
    specs: [
      { k: "Overall top width", v: "4.06 m", tone: "steel" },
      { k: "Wing angle", v: "16.1° each side", tone: "steel" },
      { k: "Certified volume", v: "8.9 m³ · 316 ft³" },
      { k: "Tare mass", v: "230 kg" },
      { k: "Max gross", v: "3175 kg", tone: "amber" },
      { k: "Net payload", v: "2945 kg" },
    ],
    build: (o) => createALFContainer(o),
  },
  rkn: {
    id: "rkn",
    code: "RKN",
    name: "RKN · LD-9",
    family: "refrigerated reefer container",
    blurb:
      "Insulated cold-chain container. A uniform cuboid with no sloped side, closed by a hinged door carrying the refrigeration unit: condenser grille, evaporator fan and a flat front control panel in a composite fascia with a backlit LCD readout.",
    dims: {
      width: RKN_DIMENSIONS.width,
      depth: RKN_DIMENSIONS.depth,
      height: RKN_DIMENSIONS.height,
      topWidth: RKN_DIMENSIONS.width,
    },
    contourOption: false,
    reeferOption: true,
    palletOption: false,
    volumeLabel: "3.6 m³ internal",
    sourceFile: "rkn.ts",
    featureLabel: "active reefer · condenser fan · live setpoint",
    ratings: { tareKg: 285, maxGrossKg: 3500, payloadKg: 3215, volumeM3: 3.6 },
    setpointRange: { min: -25, max: 25, default: -18 },
    specs: [
      { k: "Section", v: "uniform cuboid", tone: "steel" },
      { k: "Taper angle", v: "0.0° — no slope", tone: "steel" },
      { k: "Internal volume", v: "3.6 m³" },
      { k: "Temp range", v: "-25 °C … +25 °C", tone: "amber" },
      { k: "Tare mass", v: "285 kg" },
      { k: "Max gross", v: "3500 kg", tone: "amber" },
    ],
    build: (o) => createRKNContainer(o),
  },
  rap: {
    id: "rap",
    code: "RAP",
    name: "RAP · LD-9",
    family: "large refrigerated reefer",
    blurb:
      "Large insulated reefer on a uniform cuboid with no sloped sides. Heavy 60 mm sandwich panels, deep reinforced corner posts, doubled edge extrusions and heavy base castings carry a large integrated climate-control unit on the front panel: condenser grille, twin evaporator fans and a flat composite control panel.",
    dims: {
      width: RAP_DIMENSIONS.width,
      depth: RAP_DIMENSIONS.depth,
      height: RAP_DIMENSIONS.height,
      topWidth: RAP_DIMENSIONS.width,
    },
    contourOption: false,
    reeferOption: true,
    palletOption: false,
    volumeLabel: "6.6 m³ internal",
    sourceFile: "rap.ts",
    featureLabel: "twin-fan climate unit · glycol service ports",
    ratings: { tareKg: 450, maxGrossKg: 6033, payloadKg: 5583, volumeM3: 6.6 },
    setpointRange: { min: -20, max: 30, default: 4 },
    specs: [
      { k: "Section", v: "uniform cuboid", tone: "steel" },
      { k: "Taper angle", v: "0.0° — no slope", tone: "steel" },
      { k: "Internal volume", v: "6.6 m³ · 233 ft³" },
      { k: "Temp range", v: "-20 °C … +30 °C", tone: "amber" },
      { k: "Tare mass", v: "450 kg" },
      { k: "Max gross", v: "6033 kg", tone: "amber" },
    ],
    build: (o) => createRAPContainer(o),
  },
  ama: {
    id: "ama",
    code: "AMA",
    name: "AMA · M-1",
    family: "main-deck container",
    blurb:
      "Main-deck box for 747F / 777F freighters on the same 96 × 125 in M-base as the PMC pallet: vertical walls rising 96 in with chamfered upper corners under a flat roof to clear the fuselage crown. Chamfer break (1.95 m) and 2.60 m roof flat are nominal — no manufacturer publishes them.",
    dims: {
      width: AMA_DIMENSIONS.baseWidth,
      depth: AMA_DIMENSIONS.baseLength,
      height: AMA_DIMENSIONS.height,
      topWidth: AMA_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "roof-chamfer",
    taperDeg: (Math.atan2((AMA_DIMENSIONS.baseWidth - AMA_DIMENSIONS.topWidth) / 2, AMA_DIMENSIONS.height - AMA_DIMENSIONS.kneeHeight) * 180) / Math.PI,
    taperLabel: "ROOF CHAMFER",
    volumeLabel: "17.6 m³ · 621 ft³",
    sourceFile: "ama.ts",
    featureLabel: "main-deck box · 96 in height · PMC footprint",
    ratings: { tareKg: 314, maxGrossKg: 6804, payloadKg: 6490, volumeM3: 17.6 },
    specs: [
      { k: "Roof flat", v: "2.60 m (nominal)", tone: "steel" },
      { k: "Roof chamfer", v: "30.5° each side", tone: "steel" },
      { k: "Certified volume", v: "17.6 m³ · 621 ft³" },
      { k: "Tare mass", v: "314 kg" },
      { k: "Max gross", v: "6804 kg", tone: "amber" },
      { k: "Net payload", v: "6490 kg" },
    ],
    build: (o) => createAMAContainer(o),
  },
  pmc: {
    id: "pmc",
    code: "PMC",
    name: "PMC · P6P",
    family: "main-deck cargo pallet",
    blurb:
      "Flat low-profile pallet: a solid aluminium base plate with continuous seat tracks around all four edges for cargo-net attachment, raised edge lips, reinforced corners and four-way fork entry. The optional translucent block above the plate shows the standard netted cargo contour.",
    dims: {
      width: PMC_DIMENSIONS.width,
      depth: PMC_DIMENSIONS.depth,
      height: PMC_DIMENSIONS.thickness,
      topWidth: PMC_DIMENSIONS.width,
      contourHeight: PMC_DIMENSIONS.contourHeight,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: true,
    volumeLabel: "12.6 m³ netted contour",
    sourceFile: "pmc.ts",
    featureLabel: "96 × 125 in pallet · 62 mm seat-track pitch",
    ratings: { tareKg: 120, maxGrossKg: 6804, payloadKg: 6684, volumeM3: 12.6 },
    specs: [
      { k: "Section", v: "flat plate, 50 mm", tone: "steel" },
      { k: "Taper angle", v: "0.0° — flat", tone: "steel" },
      {
        k: "Cargo contour",
        v: `1.62 m · ${(PMC_DIMENSIONS.width * PMC_DIMENSIONS.depth * 1.62).toFixed(1)} m³`,
      },
      { k: "Seat tracks", v: "4 continuous, 62 mm pitch", tone: "amber" },
      { k: "Tare mass", v: "120 kg" },
      { k: "Max gross", v: "6804 kg", tone: "amber" },
    ],
    build: (o) => createPMCContainer(o),
  },
};

/** Optional hooks a generator may expose beyond the shared contract. */
export interface ReeferControls {
  setReefer?(on: boolean): void;
  setSetpoint?(celsius: number): void;
}

export type ContainerWithOptionalReefer = ContainerBase & ReeferControls;

export function isReefer(
  c: ContainerBase | null,
): c is ContainerWithOptionalReefer {
  return !!c && typeof (c as ReeferControls).setReefer === "function";
}

/** Helper for the viewer: safe access to the optional reefer hooks. */
export function reeferOf(c: ContainerBase | null): ReeferControls | null {
  return isReefer(c) ? c : null;
}

export type { ContainerStats };
