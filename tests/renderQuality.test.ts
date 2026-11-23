import assert from "node:assert/strict";
import test from "node:test";
import {
  PIXEL_BUDGET,
  pixelRatioForViewport,
  stepAdaptiveResolution,
  type ResolutionAdaptation,
} from "../src/lib/renderQuality.ts";

const gpuPixels = (w: number, h: number, dpr: number) => w * h * dpr * dpr;
const init = (): ResolutionAdaptation => ({scale: 1, lowFpsSeconds: 0, recoveredSeconds: 0});

test("touch-first high-density tablet stays within mobile render pixel budget", () => {
  const ratio = pixelRatioForViewport(1024, 1366, 2, true);
  assert.ok(ratio >= 1 && ratio < 1.1);
  assert.ok(gpuPixels(1024, 1366, ratio) <= PIXEL_BUDGET.touch + 1);
  assert.equal(pixelRatioForViewport(390, 844, 3, true), 2);
});

test("retina desktop caps pixels while ordinary DPR1 viewports remain native", () => {
  const ratio = pixelRatioForViewport(1440, 900, 2, false);
  assert.ok(ratio > 1 && ratio < 2);
  assert.ok(gpuPixels(1440, 900, ratio) <= PIXEL_BUDGET.desktop + 1);
  assert.equal(pixelRatioForViewport(1280, 720, 1, false), 1);
});

test("4K CSS viewport can render below DPR1 to avoid GPU overload", () => {
  const ratio = pixelRatioForViewport(3840, 2160, 1, false);
  assert.ok(ratio < 1 && ratio >= 0.55);
  assert.ok(gpuPixels(3840, 2160, ratio) <= PIXEL_BUDGET.desktop + 1);
});

test("pixel ratio computation rejects invalid dimensions and nonfinite DPR", () => {
  for (const ratio of [
    pixelRatioForViewport(0, 0, NaN, false),
    pixelRatioForViewport(Infinity, -2, -1, true),
  ]) {
    assert.ok(Number.isFinite(ratio));
    assert.ok(ratio > 0);
    assert.ok(ratio <= 2);
  }
});

test("low active FPS triggers limited degradation with hysteresis", () => {
  let state = init();
  state = stepAdaptiveResolution(state, 30, 1,);
  assert.equal(state.scale, 1, "no quality oscillation after only one sample");
  state = stepAdaptiveResolution(state, 30, 0.6);
  assert.equal(state.scale, 0.85);
  for (let i = 0; i < 16; i++) state = stepAdaptiveResolution(state, 30, 0.6);
  assert.equal(state.scale, 0.65, "quality floor preserves useful visual fidelity");
  assert.equal(stepAdaptiveResolution(state, 48, 1).scale, 0.65);
});

test("quality recovers slowly and never overshoots baseline", () => {
  let state: ResolutionAdaptation = {scale: 0.65, lowFpsSeconds: 0, recoveredSeconds: 0};
  for (let i = 0; i < 8; i++) state = stepAdaptiveResolution(state, 60, 1);
  assert.equal(state.scale, 0.65);
  state = stepAdaptiveResolution(state, 60, 0.1);
  assert.equal(state.scale, 0.75);
  for (let i = 0; i < 36; i++) state = stepAdaptiveResolution(state, 60, 1);
  assert.equal(state.scale, 1);
  assert.equal(stepAdaptiveResolution(state, 60, 9).scale, 1);
});

test("invalid FPS samples are ignored", () => {
  const state = {scale: 0.85, lowFpsSeconds: 0.4, recoveredSeconds: 0.2};
  assert.deepEqual(stepAdaptiveResolution(state, Infinity, 0.6), state);
  assert.deepEqual(stepAdaptiveResolution(state, 20, -1), state);
});
