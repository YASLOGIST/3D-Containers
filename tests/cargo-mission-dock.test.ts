import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CargoMissionDock } from "../src/components/CargoMissionDock.tsx";
import { demoCargoForModel, planCargoForModel } from "../src/lib/cargoPlacement.ts";

const cargo = demoCargoForModel("ake");
const plan = planCargoForModel("ake", cargo);
const callbacks = {
  onStart: () => {},
  onAnalyze: () => {},
  onInspect: () => {},
  onClear: () => {},
};

function render(active: boolean, ready: boolean) {
  return renderToStaticMarkup(createElement(CargoMissionDock, {
    active,
    ready,
    modelCode: "AKE",
    plan,
    itemCount: active ? cargo.length : 0,
    ...callbacks,
  }));
}

test("ULD360 dock offers loading before a cargo preview exists", () => {
  const html = render(false, true);
  assert.match(html, /▶ LOAD 3D/);
  assert.match(html, /Load 3D cargo preview/);
  assert.match(html, /Load sample cargo to explore/);
  assert.doesNotMatch(html, /◇ ANALYZE/);
  assert.doesNotMatch(html, /Reload demo cargo/);
  assert.match(html, /Edit the cargo manifest/);
});

test("ULD360 dock exposes analysis, reload, editing, and clearing after preview", () => {
  const html = render(true, true);
  assert.match(html, /◇ ANALYZE/);
  assert.match(html, /Inspect cargo mass distribution/);
  assert.match(html, /Reload demo cargo/);
  assert.match(html, /Edit the cargo manifest/);
  assert.match(html, /Clear cargo preview/);
  assert.match(html, /27\/27 placed/);
  assert.match(html, /675 kg/);
  assert.doesNotMatch(html, /▶ LOAD 3D/);
});

test("ULD360 dock cannot launch actions before the viewer is ready", () => {
  const html = render(false, false);
  assert.match(html, /Preparing 3D viewer/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /◇ ANALYZE/);
});
