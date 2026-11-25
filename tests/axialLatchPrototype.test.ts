import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {buildAKEAxialLatchPrototype} from "../src/three/axialLatchPrototype.ts";
import {geometryOnlyExportScene,structuralVertexBounds} from "../src/three/geometryExport.ts";
import {worldFaces,hasSurfaceCrossing} from "./meshSurfaceIntersection.ts";

const poses=[0,.0225,.045,.0675,.09,.1125,.135,.1575,.18,.19,.2,.225,.25,.3,.375,.5,.75,1];
function crossing(a:THREE.Mesh,b:THREE.Mesh){
 return new THREE.Box3().setFromObject(a).intersectsBox(new THREE.Box3().setFromObject(b))&&hasSurfaceCrossing(worldFaces(a),worldFaces(b));
}
test("AKE axial research assembly has real guide bores and retracts before swing",()=>{
 for(const detail of [true,false]){
 const a=buildAKEAxialLatchPrototype(detail);
 try{
  assert.equal(a.guides.length,2);assert.equal(a.pins.length,4);assert.equal(a.receivers.length,4);
  assert.ok(a.originalKeepers.every(k=>!k.visible));
  assert.equal(geometryOnlyExportScene(a.model.group).getObjectByName("Latch keeper"),undefined);
  const pivot=a.model.doorPivot!;
  for(const mesh of [...a.guides,...a.receivers]){
    const p=mesh.geometry.getAttribute("position");let min=Infinity;
    for(let i=0;i<p.count;i++)min=Math.min(min,Math.hypot(p.getX(i),p.getZ(i)));
    assert.ok(Math.abs(min-.009)<1e-6,"9mm open bore");
  }
  for(const p of poses){
    a.setDoorOpen(p);a.model.group.updateMatrixWorld(true);
    if(p<=.18)assert.equal(Math.abs(pivot.rotation.y),0);
    if(p>=.18)for(const pin of a.pins)assert.ok(Math.abs(pin.mesh.position.y-pin.closedY-pin.direction*.030)<1e-9);
  }
  a.setDoorOpen(0);
  assert.ok(a.pins.every(p=>Math.abs(p.mesh.position.y-p.closedY)<1e-9));
  assert.ok(Math.abs(structuralVertexBounds(a.model.group).getSize(new THREE.Vector3()).z-1.56)<1e-6);
 }finally{a.model.dispose();}
 }
});
test("AKE prototype clears selected moving and fixed mesh surfaces at 18 sampled poses",()=>{
 const a=buildAKEAxialLatchPrototype();
 try{
 const pivot=a.model.doorPivot!,pins=a.pins.map(p=>p.mesh);
 const fixed:THREE.Mesh[]=[],moving:THREE.Mesh[]=[];
 a.model.group.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||!o.visible||o.userData.visualOnlyDecal||a.receivers.includes(o)||pins.includes(o))return;
  let p:THREE.Object3D|null=o;while(p&&p!==pivot)p=p.parent;
  if(p===pivot)moving.push(o);else fixed.push(o);
 });
 for(const pose of poses){
  a.setDoorOpen(pose);a.model.group.updateMatrixWorld(true);
  for(const [left,right] of [[pins,moving],[pins,fixed],[a.receivers,moving],[pins,a.receivers],[a.guides,moving.filter(o=>o.name==="Door stiffener"||o.name==="Door leaf")]] as const)
   for(const x of left)for(const y of right)if(x!==y)
    assert.equal(crossing(x,y),false,pose+" "+x.name+" / "+y.name);
 }
 // The proposed receiver/frame mounting interface remains outside this gate.
 }finally{a.model.dispose();}
});
