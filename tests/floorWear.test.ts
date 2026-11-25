import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { makeFloorWear,applyFloorWear } from "../src/three/floorWear.ts";
import { MODELS, type ModelId } from "../src/three/models.ts";

test("service-only handling map lifecycle and bounded source raster",()=>{
  const material=new THREE.MeshStandardMaterial({userData:{wearSurface:"strip"}});
  applyFloorWear(material,false);assert.equal(material.map,null);
  applyFloorWear(material,true);const t=material.map!;
  assert.equal(t.image.width*t.image.height,512*128);
  assert.equal(t.colorSpace,THREE.SRGBColorSpace);
  applyFloorWear(material,true);assert.equal(material.map,t);
  let disposed=false;t.addEventListener("dispose",()=>{disposed=true});
  applyFloorWear(material,false);assert.ok(disposed);assert.equal(material.map,null);
  const deck=makeFloorWear("deck");
  assert.equal(deck.image.width*deck.image.height,512*512);
  deck.dispose();material.dispose();
});
test("existing strips and pallet decks use specific handling materials in all 17 models",()=>{
 const opts={contour:true,finish:"mill" as const,detail:true,rivets:true,doorOpen:1,akeDoor:"rigid" as const,reefer:true,setpoint:-18,load:0};
 for(const id of Object.keys(MODELS) as ModelId[]){
  const b=MODELS[id].build(opts);
  try{
   let count=0;
   b.group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const m=o.material as THREE.MeshStandardMaterial;
    if(o.name==="Floor wear strip"||o.name==="Pallet base plate"){
     count++;assert.equal(m.userData.wearSurface,MODELS[id].palletOption?"deck":"strip",id);
     assert.notEqual(m,b.materials.hullInner);
    }
    if(o.name==="Deck stiffening rib")assert.equal(m.userData.wearSurface,undefined);
   });
   assert.ok(count>0,id);
  }finally{b.dispose()}
 }
});
