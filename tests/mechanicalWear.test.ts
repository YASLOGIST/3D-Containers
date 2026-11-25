import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {applyMechanicalWear} from "../src/three/mechanicalWear.ts";
import {MODELS,type ModelId} from "../src/three/models.ts";

test("mechanical wear is service-only, bounded, idempotent and clone-owned",()=>{
 for(const kind of ["bearing","contact","casting"]){
  const a=new THREE.MeshStandardMaterial({userData:{mechanicalSurface:kind}});
  const b=a.clone();
  applyMechanicalWear(a,false);assert.equal(a.map,null);
  applyMechanicalWear(a,true);applyMechanicalWear(b,true);
  const t=a.map!;
  assert.equal(t.image.width*t.image.height,256*(kind==="casting"?256:128));
  assert.equal(t.colorSpace,THREE.SRGBColorSpace);
  assert.notEqual(t,b.map);assert.equal(t.image,b.map!.image);
  applyMechanicalWear(a,true);assert.equal(a.map,t);
  let disposed=0;t.addEventListener("dispose",()=>disposed++);
  applyMechanicalWear(a,false);assert.equal(a.map,null);assert.equal(disposed,1);
  assert.ok(b.map);applyMechanicalWear(b,false);
  a.dispose();b.dispose();
 }
});
test("all 14 rigid models localize wear to hinges and latch contact parts",()=>{
 const options={contour:true,finish:"mill" as const,detail:true,rivets:true,doorOpen:0,akeDoor:"rigid" as const,reefer:true,setpoint:-18,load:0};
 let models=0;
 for(const id of Object.keys(MODELS) as ModelId[]){
  const b=MODELS[id].build(options);
  try{
   let bearing=0,contact=0;
   b.group.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return;
    const kind=o.material.userData.mechanicalSurface;
    if(["Hinge pin","Hinge knuckle"].includes(o.name)){
     assert.equal(kind,"bearing",id);bearing++;
    }else if(["Latch hub","Latch keeper","Rotating latch cam"].includes(o.name)){
     assert.equal(kind,"contact",id);contact++;
    }else if(id==="ake"&&o.name==="Corner casting"){
     assert.equal(kind,"casting");
     const uv=o.geometry.getAttribute("uv"),p=o.geometry.getAttribute("position");
     assert.equal(uv.count,p.count);
     for(let i=0;i<uv.count;i++){
      assert.ok(Math.abs(uv.getX(i)-(.5+p.getX(i)/.18))<1e-6);
      assert.ok(Math.abs(uv.getY(i)-(.5+p.getZ(i)/.18))<1e-6);
     }
    }else assert.equal(kind,undefined,id+": "+o.name);
   });
   if(MODELS[id].palletOption)assert.equal(bearing+contact,0,id);
   else{assert.ok(bearing>0&&contact>0,id);models++}
  }finally{b.dispose()}
 }
 assert.equal(models,14);
});
