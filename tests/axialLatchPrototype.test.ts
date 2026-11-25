import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {buildAKEAxialLatchPrototype} from "../src/three/axialLatchPrototype.ts";
import {geometryOnlyExportScene,structuralVertexBounds} from "../src/three/geometryExport.ts";
import {worldFaces,hasSurfaceCrossing} from "./meshSurfaceIntersection.ts";
import {rigidDoorPose} from "../src/three/doorKinematics.ts";

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

test("receivers sit against the flat frame land without sampled crossings",()=>{
 const a=buildAKEAxialLatchPrototype();
 const frame=a.model.group.getObjectByName("Door end frame") as THREE.Mesh;
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 try{
  a.model.group.updateMatrixWorld(true);
  const probe=new THREE.Mesh(frame.geometry,material);
  probe.matrixWorld.copy(frame.matrixWorld);
  const ray=new THREE.Raycaster();
  let count=0;
  for(const [i,r] of a.receivers.entries()){
   const center=r.getWorldPosition(new THREE.Vector3()),top=i%2===1;
   assert.equal(crossing(r,frame),false,"receiver/frame surface crossing");
   for(const radius of [.009,.012,.015])for(let n=0;n<32;n++){
    const theta=n*Math.PI/16;
    ray.set(new THREE.Vector3(center.x+radius*Math.cos(theta),top?1.4:.3,center.z+radius*Math.sin(theta)),new THREE.Vector3(0,top?1:-1,0));
    const hit=ray.intersectObject(probe,false)[0];
    assert.ok(hit,"missing frame land");
    const face=center.y+(top?1:-1)*.0015;
    const gap=(face-hit.point.y)*(top?-1:1);
    assert.ok(gap>=0&&gap<.000002,"illustrative numerical separation");
    count++;
   }
  }
  assert.equal(count,384);
 }finally{material.dispose();a.model.dispose();}
});

test("bolt engagement and guide overlap are maintained through reverse motion and direct model calls",()=>{
 const a=buildAKEAxialLatchPrototype();
 try{
  const v=new THREE.Vector3();
  for(const progress of [...poses,...poses.slice().reverse(),.18,0,.5,0]){
   a.model.setDoorOpen(progress);
   a.model.group.updateMatrixWorld(true);
   for(const [i,pin] of a.pins.entries()){
    const guide=a.guides[Math.floor(i/2)],receiver=a.receivers[i];
    const gb=new THREE.Box3().setFromObject(guide),pb=new THREE.Box3().setFromObject(pin.mesh),rb=new THREE.Box3().setFromObject(receiver);
    const overlap=Math.min(gb.max.y,pb.max.y)-Math.max(gb.min.y,pb.min.y);
    assert.ok(overlap>=.0079,"minimum 8 mm nominal guide overlap");
    const expected=pin.closedY+pin.direction*.03*(1-rigidDoorPose(progress,0).engagement);
    assert.ok(Math.abs(pin.mesh.position.y-expected)<1e-10);
    if(progress===0){
     const engage=Math.min(rb.max.y,pb.max.y)-Math.max(rb.min.y,pb.min.y);
     assert.ok(engage>=.0019&&engage<=.0021,"nominal 2 mm insertion");
     const p=pin.mesh.getWorldPosition(v),r=receiver.getWorldPosition(new THREE.Vector3());
     assert.ok(Math.hypot(p.x-r.x,p.z-r.z)<1e-9);
    }
    if(progress>=.18){
     const gap=i%2===0?pb.min.y-rb.max.y:rb.min.y-pb.max.y;
     assert.ok(gap>.026,"released before hinge sweep");
    }
   }
  }
 }finally{a.model.dispose();}
});
