import assert from "node:assert/strict";
import test from "node:test";

import {
  FINISH_IDS,
  MODEL_IDS,
  decodeShareState,
  encodeShareState,
} from "../src/lib/state.ts";
import { DEFAULT_STATE, type ViewerState } from "../src/three/AKEViewer.ts";
import { MODELS } from "../src/three/models.ts";
import { FINISHES } from "../src/three/primitives.ts";

test("codec id lists stay in sync with the registries", () => {
  assert.deepEqual([...MODEL_IDS].sort(), Object.keys(MODELS).sort());
  assert.deepEqual([...FINISH_IDS].sort(), Object.keys(FINISHES).sort());
});

test("share state round-trips the full workbench configuration", () => {
  const state: ViewerState = {
    ...DEFAULT_STATE,
    model: "rap",
    finish: "graphite",
    contour: false,
    door: 0.5,
    explode: 0.25,
    setpoint: 4,
    projection: "ortho",
    section: true,
    sectionAxis: "z",
    sectionPos: 0.375,
    sectionFlip: true,
    compare: "ake",
  };
  const decoded = decodeShareState(`#${encodeShareState(state)}`);
  assert.deepEqual({ ...DEFAULT_STATE, ...decoded }, state);
});

test("decoder drops unknown values and clamps numbers field-by-field", () => {
  const decoded = decodeShareState(
    "#m=zzz&f=titanium&door=7&x=-2&sp=abc&proj=ortho&sec=1&ax=q&cmp=pmc",
  );
  assert.equal(decoded.model, undefined, "unknown model falls back to default");
  assert.equal(decoded.finish, "titanium");
  assert.equal(decoded.door, 1, "door clamps to full travel");
  assert.equal(decoded.explode, 0);
  assert.equal(decoded.setpoint, undefined, "non-numeric setpoint is ignored");
  assert.equal(decoded.projection, "ortho");
  assert.equal(decoded.section, true);
  assert.equal(decoded.sectionAxis, undefined);
  assert.equal(decoded.compare, "pmc");
});

test("decoder tolerates empty and malformed hashes", () => {
  assert.deepEqual(decodeShareState(""), {});
  assert.deepEqual(decodeShareState("#"), {});
  assert.deepEqual(decodeShareState("#%%%not-a-query%%%"), {});
  assert.deepEqual(decodeShareState("m=rkn&rf=0"), {
    model: "rkn",
    reefer: false,
  });
});
