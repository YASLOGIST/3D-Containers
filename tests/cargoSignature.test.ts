import test from "node:test";
import assert from "node:assert/strict";
import { computeCargoSignature, exportCargoSignatureCSV, getCargoZoneBreakdown } from "../src/lib/cargoSignature.ts";
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

test("zone contributors exactly reconcile with existing mass map for all models", () => {
  for (const m of Object.values(MODELS)) {
    const core = cargoCoreForModel(m.id);
    const plan = planCargoForModel(m.id, demoCargoForModel(m.id));
    const signature = computeCargoSignature(plan, core);
    for (const cell of signature.cells) {
      const b = getCargoZoneBreakdown(plan, core, cell.row, cell.column);
      assert.ok(Math.abs(b.projectedKg - cell.kg) < 1e-7, m.id + " zone " + cell.row + cell.column);
      assert.ok(Math.abs(b.projectedKgPerM2 - cell.kgPerM2) < 1e-7, m.id);
      assert.ok(Math.abs(b.contributors.reduce((a, c) => a + c.projectedKg, 0) - cell.kg) < 1e-7);
      assert.ok(b.contributors.every(c => c.projectedKg > 0 && c.sharePct > 0 && c.sharePct <= 100));
      if (b.projectedKg > 0) assert.ok(Math.abs(b.contributors.reduce((a,c)=>a+c.sharePct,0)-100)<1e-7);
    }
  }
});

test("overlap splits one carton exactly across neighboring zones without double counting", () => {
  const core = { minX: 0, minZ: 0, floorY: 0, widthM: 3, depthM: 3, heightM: 2 };
  const box = {id:"cross", label:"cross", widthM:1, depthM:0.4, heightM:0.4, massKg:50, x:1, y:0.2, z:0.5};
  const left = getCargoZoneBreakdown({placed:[box]}, core, 0, 0);
  const right = getCargoZoneBreakdown({placed:[box]}, core, 0, 1);
  assert.equal(left.projectedKg, 25);
  assert.equal(right.projectedKg, 25);
  assert.equal(getCargoZoneBreakdown({placed:[box]}, core, 2, 2).projectedKg, 0);
});

test("stacked cartons are counted without presenting projections as floor loads", () => {
  const core = { minX: 0, minZ: 0, floorY: 0, widthM: 3, depthM: 3, heightM: 2 };
  const base = {widthM:0.4,depthM:0.4,heightM:0.4,x:1.5,z:1.5};
  const zone = getCargoZoneBreakdown({placed:[
    {...base,id:"base",label:"base",massKg:20,y:0.2},
    {...base,id:"top",label:"top",massKg:60,y:0.6},
  ]},core,1,1);
  assert.equal(zone.projectedKg,80);
  assert.equal(zone.contributors.length,2);
  assert.equal(zone.contributors[0].id,"top");
  assert.equal(zone.contributors[0].verticalLayer,"above-preview-floor");
  assert.equal(zone.contributors[1].verticalLayer,"preview-floor");
  assert.equal(zone.contributors[0].sharePct,75);
  assert.equal(zone.contributors[1].sharePct,25);
});

test("invalid or nonoverlapping cargo does not create fictitious zone contributors", () => {
  const core = { minX: 0, minZ: 0, floorY: 0, widthM: 3, depthM: 3, heightM: 2 };
  const valid={id:"good",label:"good",massKg:20,widthM:0.5,depthM:0.5,heightM:0.5,x:0.4,y:0.25,z:0.4};
  const invalid={...valid,id:"invalid",massKg:NaN};
  const b=getCargoZoneBreakdown({placed:[valid,invalid]},core,0,0);
  assert.equal(b.contributors.length,1);
  assert.equal(b.projectedKg,20);
  assert.equal(getCargoZoneBreakdown({placed:[]},core,1,1).contributors.length,0);
});
