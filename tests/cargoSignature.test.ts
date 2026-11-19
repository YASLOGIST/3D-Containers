import test from "node:test";
import assert from "node:assert/strict";
import { computeCargoSignature, exportCargoSignatureCSV } from "../src/lib/cargoSignature.ts";
import { cargoCoreForModel, demoCargoForModel, planCargoForModel } from "../src/lib/cargoPlacement.ts";
import { MODELS } from "../src/three/models.ts";

test("CSV export is labeled not approved and enumerates the same accepted cargo and nine zones", () => {
  const plan = planCargoForModel("ake", demoCargoForModel("ake"));
  const sig = computeCargoSignature(plan, cargoCoreForModel("ake"));
  const csv = exportCargoSignatureCSV("AKE", plan, sig);
  const rows = csv.trim().split("\r\n");
  assert.ok(csv.includes("ULD_PREVIEW_ONLY_NOT_AIRCRAFT_LOADING_APPROVAL"));
  assert.equal(rows.length, 1 + 1 + plan.placed.length + 9 + 1);
  assert.ok(csv.includes('"MASS_CELL"'));
  assert.ok(csv.includes('"WEIGHTED_CENTROID"'));
});

test("the 3x3 mass field conserves the accepted carton mass for all 17 models", () => {
  for (const m of Object.values(MODELS)) {
    const core = cargoCoreForModel(m.id);
    const plan = planCargoForModel(m.id, demoCargoForModel(m.id));
    const signature = computeCargoSignature(plan, core);
    const sum = signature.cells.reduce((acc, c) => acc + c.kg, 0);
    assert.ok(Math.abs(sum - signature.totalKg) < 0.001, m.id);
    assert.ok(Math.abs(sum - plan.loadedKg) < 0.001, m.id);
    assert.equal(signature.cells.length, 9);
    assert.ok(signature.peakKgPerM2 >= 0);
    assert.ok(signature.centroid !== null);
    for (const c of signature.cells) assert.ok(c.kg >= 0 && Number.isFinite(c.kg));
  }
});

test("geometric-centre placement returns zero lateral and longitudinal offset", () => {
  const core = { minX: -1, minZ: -1, floorY: 0.1, widthM: 2, depthM: 2, heightM: 1.5 };
  const box = { id: "center", label: "center", widthM: 0.5, depthM: 0.5,
    heightM: 0.5, massKg: 50, x: 0, y: 0.35, z: 0 };
  const s = computeCargoSignature({ placed: [box] }, core);
  assert.equal(s.lateralOffsetPct, 0);
  assert.equal(s.longitudinalOffsetPct, 0);
  assert.equal(s.totalKg, 50);
  assert.ok(Math.abs(s.cells.reduce((n, c) => n + c.kg, 0) - 50) < 0.0001);
});

test("empty cargo has no fictitious centre of mass and all cells are empty", () => {
  const s = computeCargoSignature({ placed: [] }, cargoCoreForModel("ake"));
  assert.equal(s.centroid, null);
  assert.equal(s.peakKgPerM2, 0);
  assert.equal(s.totalKg, 0);
  assert.ok(s.cells.every(c => c.kg === 0));
});

test("increasing mass on one side shifts the weighted centre towards it", () => {
  const core = { minX: 0, minZ: 0, floorY: 0, widthM: 2, depthM: 2, heightM: 2 };
  const common = { widthM: 0.4, depthM: 0.4, heightM: 0.4, y: 0.2, z: 1 };
  const s = computeCargoSignature({ placed: [
    { ...common, id: "left", label: "left", x: 0.4, massKg: 10 },
    { ...common, id: "right", label: "right", x: 1.6, massKg: 90 },
  ]}, core);
  assert.ok(s.lateralOffsetPct > 0);
  assert.ok(Math.abs(s.longitudinalOffsetPct) < 1e-10);
  assert.ok(Math.abs(s.totalKg - 100) < 1e-10);
});
