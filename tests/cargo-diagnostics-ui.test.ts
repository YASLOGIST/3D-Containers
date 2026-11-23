import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CargoLab } from "../src/components/CargoLab.tsx";
import { planCargoForModel, type CargoItem } from "../src/lib/cargoPlacement.ts";

const examples: CargoItem[] = [
  { id: "placed", label: "Placed carton", widthM: 0.4, depthM: 0.4, heightM: 0.4, massKg: 20 },
  { id: "oversize", label: "Too wide", widthM: 5, depthM: 0.4, heightM: 0.4, massKg: 15 },
];
test("cargo panel exposes per-carton explanations, filters and CSV export", () => {
  const html = renderToStaticMarkup(createElement(CargoLab, {
    items: examples, plan: planCargoForModel("ake", examples),
    onChange: () => {}, model: "ake", contour: true,
    onLoadDemo: () => {}, onOpenDoor: () => {},
    selectedCartonId: null, onSelectCarton: () => {},
  }));
  assert.match(html, /Carton diagnostics/);
  assert.match(html, /Not placed \(1\)/);
  assert.match(html, /Placed \(1\)/);
  assert.match(html, /export CSV/);
  assert.match(html, /Why not placed/);
  assert.match(html, /Outside conservative preview core/);
  assert.match(html, /Not aircraft station coordinates/);
  assert.match(html, /No OEM or aircraft loading approval/);
  assert.match(html, /Highlight Placed carton in 3D/);
  assert.doesNotMatch(html, /Highlight Too wide in 3D/);
});

test("focused placed carton is clearly selectable and the selection can be cleared", () => {
  const html = renderToStaticMarkup(createElement(CargoLab, {
    items: examples, plan: planCargoForModel("ake", examples),
    onChange: () => {}, model: "ake", contour: true,
    onLoadDemo: () => {}, onOpenDoor: () => {},
    selectedCartonId: "placed", onSelectCarton: () => {},
  }));
  assert.match(html, /Clear focus/);
  assert.match(html, /aria-pressed="true"/);
  assert.ok(html.includes("border-[#76ddf1]"));
  assert.doesNotMatch(html, /Highlight Too wide in 3D/);
});
