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
import { AKE_DIMENSIONS, contourProfile, createAKEContainer } from "./akeLD3";
import { AKC_DIMENSIONS, akcProfile, createAKCContainer } from "./akc";
import { DPE_DIMENSIONS, createDPEContainer, dpeProfile } from "./dpe";
import { DQF_DIMENSIONS, createDQFContainer, dqfProfile } from "./dqf";
import { AAP_DIMENSIONS, aapProfile, createAAPContainer } from "./aap";
import { AKH_DIMENSIONS, akhProfile, createAKHContainer } from "./akh";
import { ALF_DIMENSIONS, alfProfile, createALFContainer } from "./alf";
import { ALP_DIMENSIONS, alpProfile, createALPContainer } from "./alp";
import { AQP_DIMENSIONS, aqpProfile, createAQPContainer } from "./aqp";
import { RKN_DIMENSIONS, createRKNContainer, rknProfile } from "./rkn";
import { RAP_DIMENSIONS, createRAPContainer, rapProfile } from "./rap";
import { AMA_DIMENSIONS, amaProfile, createAMAContainer } from "./ama";
import { AMD_DIMENSIONS, amdProfile, createAMDContainer } from "./amd";
import { AGA_DIMENSIONS, agaProfile, createAGAContainer } from "./aga";
import { PAG_DIMENSIONS, pagProfile, createPAGContainer } from "./pag";
import { PMC_DIMENSIONS, createPMCContainer, pmcProfile } from "./pmc";
import { PGA_DIMENSIONS, pgaProfile, createPGAContainer } from "./pga";
import type { V2 } from "./primitives";

export type ModelId = "ake" | "akc" | "dpe" | "dqf" | "aqp" | "akh" | "alf" | "alp" | "aap" | "rkn" | "rap" | "ama" | "amd" | "aga" | "pag" | "pmc" | "pga";

/**
 * Nominal aircraft-hold placement for the schematic hold-fit preview.
 * Fuselage diameters are published airframe data; floorDrop (fuselage
 * centre → cargo floor) and the simplified lateral section are NOMINAL —
 * the card is a scale schematic, not a certified loading diagram.
 */
export interface HoldInfo {
  aircraft: string;
  deck: "lower" | "main";
  /** fuselage outer diameter, metres */
  fuselageM: number;
  abreast: 1 | 2;
  /** single = centre-anchored trapezoid pair; twin = bilaterally symmetric */
  mode: "single" | "twin";
  /** lateral section: base width, top width, height (m) */
  base: number;
  top: number;
  height: number;
  /** slope break height above the hold floor, metres */
  knee?: number;
  /** fuselage centre height above the cargo floor, metres (nominal) */
  floorDrop: number;
}

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
  /** section-drawing kind for profile-engine families (AKC/DPE/AKH/ALF/AMA/AGA) */
  annotationKind?: "contoured" | "dual-contour" | "roof-chamfer";
  /** nominal aircraft/deck compatibility line (published ULD guides) */
  aircraft: string;
  /** certified cross-section polygon for the 2-D section preview card */
  sectionProfile: () => V2[];
  /** nominal hold placement for the schematic hold-fit preview */
  hold: HoldInfo;
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
    aircraft: "747 · 767 · 777 · 787 · A330 · A340 · A380 · MD-11 lower deck",
    sectionProfile: () => contourProfile(true),
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 2, mode: "single", base: 1.53, top: 2.01, height: 1.62, floorDrop: 1.7 },
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
  akc: {
    id: "akc",
    code: "AKC",
    name: "AKC · LD-1",
    family: "lower-deck cargo container",
    blurb:
      "The original half-width lower-deck contour: same K base as the LD-3 but a deeper single wedge reaching 2.34 m across the top at 25.5°, tailored to Boeing and MD-11 holds. Compare it against the AKE to see exactly where the extra 0.5 m³ lives.",
    dims: {
      width: AKC_DIMENSIONS.baseWidth,
      depth: AKC_DIMENSIONS.baseLength,
      height: AKC_DIMENSIONS.height,
      topWidth: AKC_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "contoured",
    volumeLabel: "4.8 m³ · 170 ft³",
    sourceFile: "akc.ts",
    aircraft: "747 · 767 · 777 · 787 · MD-11 lower deck",
    sectionProfile: akcProfile,
    hold: { aircraft: "Boeing 747", deck: "lower", fuselageM: 6.5, abreast: 2, mode: "single", base: 1.562, top: 2.337, height: 1.626, floorDrop: 1.7 },
    featureLabel: "deep single contour · Boeing/MD-11 holds",
    ratings: { tareKg: 85, maxGrossKg: 1588, payloadKg: 1503, volumeM3: 4.8 },
    specs: [
      { k: "Upper contour", v: "2.34 m", tone: "steel" },
      { k: "Taper angle", v: "25.5°", tone: "steel" },
      { k: "Certified volume", v: "4.8 m³ · 170 ft³" },
      { k: "Tare mass", v: "85 kg" },
      { k: "Max gross", v: "1588 kg", tone: "amber" },
      { k: "Net payload", v: "1503 kg" },
    ],
    build: (o) => createAKCContainer(o),
  },
  dpe: {
    id: "dpe",
    code: "DPE",
    name: "DPE · LD-2",
    family: "lower-deck cargo container",
    blurb:
      "Half-width container for the 767's narrower hold: a 47 in P base with a shallow 12.8° single contour to 61.5 in overall, loaded two abreast where a pair of LD-3s would waste a third of the hold width.",
    dims: {
      width: DPE_DIMENSIONS.baseWidth,
      depth: DPE_DIMENSIONS.baseLength,
      height: DPE_DIMENSIONS.height,
      topWidth: DPE_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "contoured",
    volumeLabel: "3.4 m³ · 120 ft³",
    sourceFile: "dpe.ts",
    aircraft: "767 lower deck (two abreast) · also 747/777/787",
    sectionProfile: dpeProfile,
    hold: { aircraft: "Boeing 767", deck: "lower", fuselageM: 5.03, abreast: 2, mode: "single", base: 1.194, top: 1.562, height: 1.626, floorDrop: 1.7 },
    featureLabel: "767 half-width · two-abreast lower deck",
    ratings: { tareKg: 75, maxGrossKg: 1225, payloadKg: 1150, volumeM3: 3.4 },
    specs: [
      { k: "Upper contour", v: "1.56 m", tone: "steel" },
      { k: "Taper angle", v: "12.8°", tone: "steel" },
      { k: "Certified volume", v: "3.4 m³ · 120 ft³" },
      { k: "Tare mass", v: "75 kg" },
      { k: "Max gross", v: "1225 kg", tone: "amber" },
      { k: "Net payload", v: "1150 kg" },
    ],
    build: (o) => createDPEContainer(o),
  },
  dqf: {
    id: "dqf",
    code: "DQF",
    name: "DQF · LD-8",
    family: "full-width lower-deck container",
    blurb:
      "The 767's full-width lower-deck unit: two LD-2 contours mirrored on a 96 in base plate, wings reaching a 125 in roof span. One DQF does the work of a DPE pair — open the hold-fit card to see both arrangements in the same 767 tube.",
    dims: {
      width: DQF_DIMENSIONS.baseWidth,
      depth: DQF_DIMENSIONS.baseLength,
      height: DQF_DIMENSIONS.height,
      topWidth: DQF_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "dual-contour",
    taperDeg: (Math.atan2((DQF_DIMENSIONS.topWidth - DQF_DIMENSIONS.baseWidth) / 2, DQF_DIMENSIONS.height - DQF_DIMENSIONS.kneeHeight) * 180) / Math.PI,
    taperLabel: "WING ANGLE (EACH SIDE)",
    volumeLabel: "6.9 m³ · 245 ft³",
    sourceFile: "dqf.ts",
    aircraft: "767 · 787 lower deck",
    sectionProfile: dqfProfile,
    hold: { aircraft: "Boeing 767", deck: "lower", fuselageM: 5.03, abreast: 1, mode: "twin", base: 2.438, top: 3.175, height: 1.626, floorDrop: 1.7 },
    featureLabel: "767 full-width · twin-LD2 double contour",
    ratings: { tareKg: 127, maxGrossKg: 2449, payloadKg: 2322, volumeM3: 6.9 },
    specs: [
      { k: "Overall top width", v: "3.18 m", tone: "steel" },
      { k: "Wing angle", v: "13.5° each side", tone: "steel" },
      { k: "Certified volume", v: "6.9 m³ · 245 ft³" },
      { k: "Tare mass", v: "127 kg" },
      { k: "Max gross", v: "2449 kg", tone: "amber" },
      { k: "Net payload", v: "2322 kg" },
    ],
    build: (o) => createDQFContainer(o),
  },
  aqp: {
    id: "aqp",
    code: "AQP",
    name: "AQP · LD-4",
    family: "rectangular lower-deck container",
    blurb:
      "The rectangular sibling of the LD-8: identical 96 × 60.4 in footprint and 64 in height with vertical walls, completing the 767 lower-deck trio alongside the LD-2 half-width and the contoured LD-8. Certified 2438 × 1534 mm base, ≈ 5.5 m³ internal volume, 120 kg tare, 2449 kg max gross (EUAS / ACL Airshop sheets).",
    dims: {
      width: AQP_DIMENSIONS.baseWidth,
      depth: AQP_DIMENSIONS.baseLength,
      height: AQP_DIMENSIONS.height,
      topWidth: AQP_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    volumeLabel: "5.5 m³ · 195 ft³",
    sourceFile: "aqp.ts",
    aircraft: "767 · 777 · 787 lower deck",
    sectionProfile: aqpProfile,
    hold: { aircraft: "Boeing 767", deck: "lower", fuselageM: 5.03, abreast: 1, mode: "twin", base: 2.438, top: 2.438, height: 1.626, floorDrop: 1.7 },
    featureLabel: "767 lower deck · LD-8 footprint, vertical walls",
    ratings: { tareKg: 120, maxGrossKg: 2449, payloadKg: 2329, volumeM3: 5.5 },
    specs: [
      { k: "Section", v: "rectangular · vertical walls", tone: "steel" },
      { k: "Taper angle", v: "0.0° — straight walls", tone: "steel" },
      { k: "Certified volume", v: "5.5 m³ · 195 ft³" },
      { k: "Tare mass", v: "120 kg" },
      { k: "Max gross", v: "2449 kg", tone: "amber" },
      { k: "Net payload", v: "2329 kg" },
    ],
    build: (o) => createAQPContainer(o),
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
    aircraft: "A319 · A320 · A321 lower deck",
    sectionProfile: akhProfile,
    hold: { aircraft: "Airbus A320", deck: "lower", fuselageM: 3.95, abreast: 1, mode: "twin", base: 1.534, top: 2.438, height: 1.143, knee: 0.21, floorDrop: 1.2 },
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
    aircraft: "747 · 777 · 787 · A330 · A350 · A380 lower deck",
    sectionProfile: alfProfile,
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 1, mode: "twin", base: 3.175, top: 4.064, height: 1.626, floorDrop: 1.7 },
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
  alp: {
    id: "alp",
    code: "ALP",
    name: "ALP · LD-11",
    family: "full-width lower-deck container",
    blurb:
      "The LD-6 footprint with no contour at all: a plain rectangular 125 × 60.4 in box that cubes out perfectly and stacks freight to every corner. Compare it with the ALF to price the fuselage wedge — about 1.7 m³ of certified volume.",
    dims: {
      width: ALP_DIMENSIONS.baseWidth,
      depth: ALP_DIMENSIONS.baseLength,
      height: ALP_DIMENSIONS.height,
      topWidth: ALP_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    volumeLabel: "7.2 m³ · 253 ft³",
    sourceFile: "alp.ts",
    aircraft: "747 · 777 · 787 · DC-10 · MD-11 lower deck",
    sectionProfile: alpProfile,
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 1, mode: "twin", base: 3.175, top: 3.175, height: 1.626, floorDrop: 1.7 },
    featureLabel: "rectangular full-width · zero taper",
    ratings: { tareKg: 185, maxGrossKg: 3176, payloadKg: 2991, volumeM3: 7.2 },
    specs: [
      { k: "Section", v: "rectangular", tone: "steel" },
      { k: "Taper angle", v: "0.0° — no contour", tone: "steel" },
      { k: "Certified volume", v: "7.2 m³ · 253 ft³" },
      { k: "Tare mass", v: "185 kg" },
      { k: "Max gross", v: "3176 kg", tone: "amber" },
      { k: "Net payload", v: "2991 kg" },
    ],
    build: (o) => createALPContainer(o),
  },
  aap: {
    id: "aap",
    code: "AAP",
    name: "AAP · LD-9",
    family: "rectangular P1P-base container",
    blurb:
      "A rigid box on the 88 × 125 in P1P pallet base — the biggest-volume rigid lower-deck container: contour code P means fully rectangular, door on the 125 in side. Certified 3175 × 2235 mm base at 64 in height, ≈ 10.8 m³ AS 1825 volume, 270 kg tare, 6033 kg max gross (4626 kg operationally in lower holds; DSV / AviusULD / Nordisk sheets).",
    dims: {
      width: AAP_DIMENSIONS.baseWidth,
      depth: AAP_DIMENSIONS.baseLength,
      height: AAP_DIMENSIONS.height,
      topWidth: AAP_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    volumeLabel: "10.8 m³ · 381 ft³",
    sourceFile: "aap.ts",
    aircraft: "747 · 777 · A350 lower deck + main",
    sectionProfile: aapProfile,
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 2, mode: "single", base: 2.235, top: 2.235, height: 1.626, floorDrop: 1.7 },
    featureLabel: "88 × 125 in P1P base · contour code P",
    ratings: { tareKg: 270, maxGrossKg: 6033, payloadKg: 5763, volumeM3: 10.8 },
    specs: [
      { k: "Section", v: "rectangular · contour code P", tone: "steel" },
      { k: "Taper angle", v: "0.0° — straight walls", tone: "steel" },
      { k: "Certified volume", v: "10.8 m³ · 381 ft³" },
      { k: "Tare mass", v: "270 kg" },
      { k: "Max gross", v: "6033 kg", tone: "amber" },
      { k: "Net payload", v: "5763 kg" },
    ],
    build: (o) => createAAPContainer(o),
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
    aircraft: "Widebody lower deck (cold chain)",
    sectionProfile: rknProfile,
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 2, mode: "twin", base: 2.0, top: 2.0, height: 1.62, floorDrop: 1.7 },
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
    aircraft: "Widebody lower deck · freighter main deck (cold chain)",
    sectionProfile: rapProfile,
    hold: { aircraft: "Boeing 777", deck: "lower", fuselageM: 6.2, abreast: 1, mode: "twin", base: 3.18, top: 3.18, height: 1.62, floorDrop: 1.7 },
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
    aircraft: "747F · 777F main deck",
    sectionProfile: amaProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "twin", base: 2.438, top: 1.9, height: 2.438, knee: 1.86, floorDrop: 1.0 },
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
  amd: {
    id: "amd",
    code: "AMD",
    name: "AMD · M1H",
    family: "main-deck contoured container",
    blurb:
      "The standard 747 freighter main-deck ULD: 118 in tall on the M base, with an asymmetric contour-D section — full height on the centreline wall, a long slope down the fuselage side — so a side-by-side pair fills the 747 tube. Knee and roof break are nominal (unpublished).",
    dims: {
      width: AMD_DIMENSIONS.baseWidth,
      depth: AMD_DIMENSIONS.baseLength,
      height: AMD_DIMENSIONS.height,
      topWidth: AMD_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "contoured",
    volumeLabel: "21.2 m³ · 750 ft³",
    sourceFile: "amd.ts",
    aircraft: "747F · 747 Combi main deck · 777F centre",
    sectionProfile: amdProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "single", base: 2.438, top: 1.069, height: 2.997, knee: 2.16, floorDrop: 1.0 },
    featureLabel: "118 in contour-D · 747F main-deck standard",
    ratings: { tareKg: 370, maxGrossKg: 6804, payloadKg: 6434, volumeM3: 21.2 },
    specs: [
      { k: "Roof flat (centre side)", v: "1.07 m (nominal)", tone: "steel" },
      { k: "Contour", v: "D · asymmetric", tone: "steel" },
      { k: "Certified volume", v: "21.2 m³ · 750 ft³" },
      { k: "Tare mass", v: "370 kg" },
      { k: "Max gross", v: "6804 kg", tone: "amber" },
      { k: "Net payload", v: "6434 kg" },
    ],
    build: (o) => createAMDContainer(o),
  },
  aga: {
    id: "aga",
    code: "AGA",
    name: "AGA · M-2",
    family: "20-ft main-deck container",
    blurb:
      "The 20-ft main-deck box on a PGA footprint (96 × 238.5 in): two M-1 lengths in one rigid shell for 747F/Combi decks, 33.7 m³ under a 96 in roof. Roof chamfer break and 1.90 m flat are nominal — sized so the live geometric volume lands on the certified figure.",
    dims: {
      width: AGA_DIMENSIONS.baseWidth,
      depth: AGA_DIMENSIONS.baseLength,
      height: AGA_DIMENSIONS.height,
      topWidth: AGA_DIMENSIONS.topWidth,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: false,
    annotationKind: "roof-chamfer",
    taperDeg: (Math.atan2((AGA_DIMENSIONS.baseWidth - AGA_DIMENSIONS.topWidth) / 2, AGA_DIMENSIONS.height - AGA_DIMENSIONS.kneeHeight) * 180) / Math.PI,
    taperLabel: "ROOF CHAMFER",
    volumeLabel: "33.7 m³ · 1190 ft³",
    sourceFile: "aga.ts",
    aircraft: "747F · 747 Combi main deck · 777F centre",
    sectionProfile: agaProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "twin", base: 2.438, top: 1.9, height: 2.438, knee: 1.81, floorDrop: 1.0 },
    featureLabel: "20-ft main-deck box · PGA footprint · 11.3 t gross",
    ratings: { tareKg: 1000, maxGrossKg: 11340, payloadKg: 10340, volumeM3: 33.7 },
    specs: [
      { k: "Roof flat", v: "1.90 m (nominal)", tone: "steel" },
      { k: "Roof chamfer", v: "26.6° each side", tone: "steel" },
      { k: "Certified volume", v: "33.7 m³ · 1190 ft³" },
      { k: "Tare mass", v: "1000 kg" },
      { k: "Max gross", v: "11340 kg", tone: "amber" },
      { k: "Net payload", v: "10340 kg" },
    ],
    build: (o) => createAGAContainer(o),
  },
  pag: {
    id: "pag",
    code: "PAG",
    name: "PAG · P1P",
    family: "certified 88 × 125 in pallet",
    blurb:
      "The narrower of the two certified 125 in pallets: an 88 in deep aluminium base plate with seat tracks, built by the shared pallet engine. 3175 × 2235 mm base, 110 kg tare, 6033 kg max gross on the main deck (4626 kg lower hold). The AAP · LD-9 box sits on this exact base.",
    dims: {
      width: PAG_DIMENSIONS.width,
      depth: PAG_DIMENSIONS.depth,
      height: PAG_DIMENSIONS.thickness,
      topWidth: PAG_DIMENSIONS.width,
      contourHeight: PAG_DIMENSIONS.contourHeight,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: true,
    volumeLabel: "11.5 m³ netted contour",
    sourceFile: "pag.ts",
    aircraft: "Widebody main + lower decks",
    sectionProfile: pagProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "twin", base: 2.235, top: 2.235, height: 2.438, floorDrop: 1.0 },
    featureLabel: "88 × 125 in pallet · 62 mm seat-track pitch",
    ratings: { tareKg: 110, maxGrossKg: 6033, payloadKg: 5923, volumeM3: 11.5 },
    specs: [
      { k: "Section", v: "flat plate, 50 mm", tone: "steel" },
      { k: "Taper angle", v: "0.0° — flat", tone: "steel" },
      {
        k: "Cargo contour",
        v: `1.62 m · ${(PAG_DIMENSIONS.width * PAG_DIMENSIONS.depth * 1.62).toFixed(1)} m³`,
      },
      { k: "Seat tracks", v: "4 continuous, 62 mm pitch", tone: "amber" },
      { k: "Tare mass", v: "110 kg" },
      { k: "Max gross", v: "6033 kg", tone: "amber" },
    ],
    build: (o) => createPAGContainer(o),
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
    aircraft: "Widebody main + lower decks",
    sectionProfile: pmcProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "twin", base: 2.438, top: 2.438, height: 2.438, floorDrop: 1.0 },
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
  pga: {
    id: "pga",
    code: "PGA",
    name: "PGA · 20 ft",
    family: "certified 20 ft main-deck pallet",
    blurb:
      "The heavy hauler: a 20 ft (6058 × 2438 mm, NAS 3610 2G1P) main-deck pallet rated to 13608 kg — 30,000 lb — for vehicles, engines and outsize machinery on the 747F. Built by the shared pallet engine with a five-beam underside and the full 244 cm main-deck netted build height.",
    dims: {
      width: PGA_DIMENSIONS.width,
      depth: PGA_DIMENSIONS.depth,
      height: PGA_DIMENSIONS.thickness,
      topWidth: PGA_DIMENSIONS.width,
      contourHeight: PGA_DIMENSIONS.contourHeight,
    },
    contourOption: false,
    reeferOption: false,
    palletOption: true,
    volumeLabel: "36.0 m³ netted contour",
    sourceFile: "pga.ts",
    aircraft: "Boeing 747F main deck",
    sectionProfile: pgaProfile,
    hold: { aircraft: "Boeing 747F", deck: "main", fuselageM: 6.5, abreast: 2, mode: "twin", base: 2.438, top: 2.438, height: 2.438, floorDrop: 1.0 },
    featureLabel: "96 × 238.5 in pallet · 13.6 t rated",
    ratings: { tareKg: 541, maxGrossKg: 13608, payloadKg: 13067, volumeM3: 36.0 },
    specs: [
      { k: "Section", v: "flat plate, 50 mm", tone: "steel" },
      { k: "Taper angle", v: "0.0° — flat", tone: "steel" },
      {
        k: "Cargo contour",
        v: `2.44 m · ${(PGA_DIMENSIONS.width * PGA_DIMENSIONS.depth * 2.438).toFixed(1)} m³`,
      },
      { k: "Seat tracks", v: "4 continuous, 62 mm pitch", tone: "amber" },
      { k: "Tare mass", v: "541 kg" },
      { k: "Max gross", v: "13608 kg", tone: "amber" },
    ],
    build: (o) => createPGAContainer(o),
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
