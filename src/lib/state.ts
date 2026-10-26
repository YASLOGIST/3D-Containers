/**
 * state.ts — shareable URL codec for the workbench.
 *
 * The full viewer configuration (model, finish, kinematics, inspection
 * tools) round-trips through the URL hash so a link reproduces an exact
 * inspection setup on another machine. Decoding is defensive: unknown
 * models, out-of-range numbers and malformed hashes fall back to the
 * caller's defaults field-by-field instead of failing the whole parse.
 */
import type { ViewerState } from "@/three/AKEViewer";
import type { ModelId } from "@/three/models";
import type { FinishId } from "@/three/primitives";

export const MODEL_IDS: ModelId[] = ["ake", "rkn", "rap", "pmc"];
export const FINISH_IDS: FinishId[] = [
  "mill",
  "graphite",
  "cargo",
  "airline",
  "titanium",
];
const MOOD_IDS = ["hangar", "dusk", "studio"] as const;
const PROJECTION_IDS = ["persp", "ortho"] as const;
const SECTION_AXES = ["x", "y", "z"] as const;
const COMPARE_IDS = ["none", ...MODEL_IDS] as const;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const b01 = (v: boolean) => (v ? "1" : "0");

export function encodeShareState(s: ViewerState): string {
  const p = new URLSearchParams();
  p.set("m", s.model);
  p.set("f", s.finish);
  p.set("c", b01(s.contour));
  p.set("d", b01(s.detail));
  p.set("r", b01(s.rivets));
  p.set("door", String(r3(s.door)));
  p.set("x", String(r3(s.explode)));
  p.set("met", String(r3(s.metalness)));
  p.set("rgh", String(r3(s.roughness)));
  p.set("env", String(r3(s.envIntensity)));
  p.set("wf", b01(s.wireframe));
  p.set("dim", b01(s.dimensions));
  p.set("rot", b01(s.autoRotate));
  p.set("mood", s.mood);
  p.set("rf", b01(s.reefer));
  p.set("sp", String(Math.round(s.setpoint * 10) / 10));
  p.set("load", String(r3(s.load)));
  p.set("proj", s.projection);
  p.set("sec", b01(s.section));
  p.set("ax", s.sectionAxis);
  p.set("spos", String(r3(s.sectionPos)));
  p.set("flp", b01(s.sectionFlip));
  p.set("cmp", s.compare);
  return p.toString();
}

function oneOf<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | undefined {
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

function bool01(raw: string | null): boolean | undefined {
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}

function numIn(raw: string | null, min: number, max: number) {
  if (raw === null || raw.trim() === "") return undefined;
  const v = Number(raw);
  if (!Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, v));
}

export function decodeShareState(hash: string): Partial<ViewerState> {
  const clean = hash.replace(/^[#?]+/, "");
  if (!clean) return {};
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(clean);
  } catch {
    return {};
  }
  const get = (k: string) => p.get(k);
  const out: Partial<ViewerState> = {};

  const model = oneOf<ModelId>(get("m"), MODEL_IDS);
  if (model) out.model = model;
  const finish = oneOf<FinishId>(get("f"), FINISH_IDS);
  if (finish) out.finish = finish;
  const mood = oneOf(get("mood"), MOOD_IDS);
  if (mood) out.mood = mood;
  const projection = oneOf(get("proj"), PROJECTION_IDS);
  if (projection) out.projection = projection;
  const sectionAxis = oneOf(get("ax"), SECTION_AXES);
  if (sectionAxis) out.sectionAxis = sectionAxis;
  const compare = oneOf(get("cmp"), COMPARE_IDS);
  if (compare) out.compare = compare;

  const bools: [keyof ViewerState, string][] = [
    ["contour", "c"],
    ["detail", "d"],
    ["rivets", "r"],
    ["wireframe", "wf"],
    ["dimensions", "dim"],
    ["autoRotate", "rot"],
    ["reefer", "rf"],
    ["section", "sec"],
    ["sectionFlip", "flp"],
  ];
  for (const [field, key] of bools) {
    const v = bool01(get(key));
    if (v !== undefined) (out as Record<string, unknown>)[field] = v;
  }

  const nums: [keyof ViewerState, string, number, number][] = [
    ["door", "door", 0, 1],
    ["explode", "x", 0, 1],
    ["metalness", "met", 0, 1],
    ["roughness", "rgh", 0.02, 1],
    ["envIntensity", "env", 0, 2.2],
    ["setpoint", "sp", -30, 35],
    ["load", "load", 0, 1],
    ["sectionPos", "spos", 0, 1],
  ];
  for (const [field, key, min, max] of nums) {
    const v = numIn(get(key), min, max);
    if (v !== undefined) (out as Record<string, unknown>)[field] = v;
  }
  return out;
}
