import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecSheet } from "../src/components/Panels.tsx";
import { MODELS } from "../src/three/models.ts";

function render(model: typeof MODELS.ake, cargoKg: string, cargoM3: string, measured: { x: number; y: number; z: number } | null = null) {
  return renderToStaticMarkup(createElement(SpecSheet, {
    model,
    stats: null,
    measured,
    cargoScenario: { cargoKg, cargoM3, divisor: "6000" },
    setCargoScenario: () => {},
  }));
}

test("planner shows the same precise shipment against different models", () => {
  const ake = render(MODELS.ake, "1400.25", "4.25");
  const dpe = render(MODELS.dpe, "1400.25", "4.25");
  assert.match(ake, /value="1400\.25"/);
  assert.match(dpe, /value="1400\.25"/);
  assert.match(ake, /WITHIN LISTED WEIGHT/);
  assert.match(dpe, /OVERWEIGHT AND OVER VOLUME/);
});

test("invalid cargo hides calculated results rather than reporting a safe load", () => {
  const html = render(MODELS.ake, "", "1");
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /ENTER VALID CARGO MASS AND VOLUME/);
  assert.doesNotMatch(html, /WITHIN LISTED WEIGHT/);
  assert.doesNotMatch(html, /Gross \(tare \+ cargo\)/);
});


test("span check uses unrounded measurements and does not claim contour certification", () => {
  const { dims } = MODELS.ake;
  const envelope = { x: Math.max(dims.width, dims.topWidth), y: dims.height, z: dims.depth };
  const within = render(MODELS.ake, "0", "0", { ...envelope, x: envelope.x + 0.00099 });
  const beyond = render(MODELS.ake, "0", "0", { ...envelope, x: envelope.x + 0.00101 });
  assert.match(within, /WITHIN 1 MM/);
  assert.match(beyond, /SPAN EXCEEDS 1 MM/);
  assert.match(beyond, /\+1\.01/);
  assert.match(within, /does not check position, contour clearance or certify/);
  assert.doesNotMatch(within, /INSCRIBED/);
  assert.match(render(MODELS.ake, "0", "0"), /Overall span check/);
});
