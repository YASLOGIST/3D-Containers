import assert from "node:assert/strict";
import test from "node:test";
import { inspectorTopOffset } from "../src/lib/inspectorLayout.ts";

test("inspector clears wrapped and unwrapped toolbars, with room for zoom", () => {
  assert.equal(inspectorTopOffset(143.5, 0), 156);
  assert.equal(inspectorTopOffset(135, 0), 147);
  assert.equal(inspectorTopOffset(107.75, 0), 120);
  assert.equal(inspectorTopOffset(255, 100), 167);
  assert.ok(inspectorTopOffset(170, 10) > 170 - 10);
});

test("inspector never rises into its legacy toolbar overlap zone", () => {
  assert.equal(inspectorTopOffset(0, 0), 86);
  assert.equal(inspectorTopOffset(-1000, 0), 86);
  assert.equal(inspectorTopOffset(Number.NaN, 0), 160);
  assert.equal(inspectorTopOffset(120, Number.POSITIVE_INFINITY), 160);
});
