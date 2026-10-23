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
import { RKN_DIMENSIONS, createRKNContainer } from "./rkn";
import { RAP_DIMENSIONS, createRAPContainer } from "./rap";
import { PMC_DIMENSIONS, createPMCContainer } from "./pmc";

export type ModelId = "ake" | "rkn" | "rap" | "pmc";

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
