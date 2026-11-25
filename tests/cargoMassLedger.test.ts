import test from "node:test";
import assert from "node:assert/strict";
import { cargoMassLedger } from "../src/lib/cargoMassLedger.ts";
import { planCargoForModel, type CargoPlacement, type CargoCore } from "../src/lib/cargoPlacement.ts";
const core:CargoCore={minX:0,minZ:0,floorY:0,widthM:2,depthM:2,heightM:2};
const base:CargoPlacement={id:"base",label:"base",x:0.5,y:0.25,z:0.5,widthM:1,depthM:1,heightM:0.5,massKg:10};
const top:CargoPlacement={...base,id:"top",label:"top",y:0.75,massKg:30};
test("stack mass attribution is conserved and centroid is mass-weighted",()=>{
  const ledger=cargoMassLedger([top,base],core);
  assert.equal(ledger.valid,true);
  assert.equal(ledger.totalKg,40);
  assert.equal(ledger.allocatedKg,40);
  assert.equal(ledger.centroidAboveCoreFloorM,0.625);
  assert.equal(ledger.floorBaseCount,1);
  assert.equal(ledger.supportedAboveCount,1);
  assert.equal(ledger.maxStackMassKg,40);
});
test("ledger fails closed for unsupported, overlapping, duplicated and invalid cartons",()=>{
  for(const boxes of [[top],[base,{...top,y:0.4}],[base,base],[{...base,x:99}],[{...base,massKg:NaN}]]){
    assert.equal(cargoMassLedger(boxes,core).valid,false);
  }
  assert.equal(cargoMassLedger([],core).centroidAboveCoreFloorM,null);
});
test("invalid or excessive payload overrides cannot bypass the registry reference",()=>{
  const item={...base,massKg:2000,widthM:0.4,heightM:0.4,depthM:0.4};
  for(const cap of [5000,NaN,Infinity,-10])assert.equal(planCargoForModel("ake",[item],true,cap).placed.length,0);
  assert.equal(planCargoForModel("ake",[{...item,massKg:50}],true,40).placed.length,0);
});
