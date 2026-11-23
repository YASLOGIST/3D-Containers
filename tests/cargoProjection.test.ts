import assert from "node:assert/strict";
import test from "node:test";
import { projectedCartonMetrics } from "../src/lib/cargoProjection.ts";

const carton = {widthM:0.4,depthM:0.5,heightM:0.2,massKg:30,y:0.1};
test("projected mass index is nominal mass over plan rectangle, not floor pressure",()=>{
  const report=projectedCartonMetrics(carton,0);
  assert.ok(Math.abs((report.planAreaM2 ?? 0)-0.2)<1e-12);
  assert.ok(Math.abs((report.arealMassIndexKgM2 ?? 0)-150)<1e-12);
  assert.equal(report.baseAboveFloorM,0);
  assert.equal(report.layer,"preview-floor");
});
test("elevated preview layer is explicitly distinguished despite identical horizontal mass index",()=>{
  const elevated=projectedCartonMetrics({...carton,y:0.7},0);
  assert.equal(elevated.layer,"above-preview-floor");
  assert.ok(Math.abs((elevated.baseAboveFloorM??0)-0.6)<1e-12);
  assert.equal(elevated.arealMassIndexKgM2,150);
});
test("floating-point floor tolerance and invalid geometry cannot create fabricated loads",()=>{
  assert.equal(projectedCartonMetrics({...carton,y:0.1-1e-6},0).layer,"preview-floor");
  assert.equal(projectedCartonMetrics({...carton,widthM:0},0).arealMassIndexKgM2,null);
  assert.equal(projectedCartonMetrics({...carton,massKg:NaN},0).layer,"unknown");
  assert.equal(projectedCartonMetrics({...carton,widthM:1e308,depthM:1e308},0).planAreaM2,null);
  assert.equal(projectedCartonMetrics({...carton,y:-10},0).layer,"unknown");
  assert.equal(projectedCartonMetrics({...carton,y:Infinity},0).baseAboveFloorM,null);
});
test("the footprint estimate is independent of carton height, not a pressure limit",()=>{
  const a=projectedCartonMetrics(carton,0);
  const b=projectedCartonMetrics({...carton,heightM:0.4,y:0.2},0);
  assert.equal(a.planAreaM2,b.planAreaM2);
  assert.equal(a.arealMassIndexKgM2,b.arealMassIndexKgM2);
});
