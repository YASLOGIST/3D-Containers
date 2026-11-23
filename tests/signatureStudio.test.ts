import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignatureStudio } from "../src/components/SignatureStudio.tsx";
import { cargoCoreForModel, demoCargoForModel, planCargoForModel } from "../src/lib/cargoPlacement.ts";
import { computeCargoSignature } from "../src/lib/cargoSignature.ts";
import type { ViewerState } from "../src/three/AKEViewer.ts";

test("mass signature uses nine accessible zone buttons, with no false certification text", () => {
  const plan = planCargoForModel("ake", demoCargoForModel("ake"));
  const signature = computeCargoSignature(plan, cargoCoreForModel("ake"));
  const state = { contour: true, mood: "studio", surfaceCondition: "factory" } as ViewerState;
  const html = renderToStaticMarkup(createElement(SignatureStudio, {
    model: "ake", state, plan, signature,
    fieldVisible: true, activePreset: "field",
    onPreset: () => {}, onFieldVisible: () => {},
    onPatch: () => {}, onExport: () => {}, onInspectCarton: () => {},
  }));
  assert.match(html, /Inspect nine projected mass zones/);
  assert.equal((html.match(/aria-label="Inspect zone row /g) || []).length, 9);
  assert.match(html, /plan-view projection, not floor pressure/);
  assert.doesNotMatch(html, /Selected mass zone breakdown/);
});
