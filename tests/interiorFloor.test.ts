import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS } from "../src/three/models.ts";
import { applyFloorWear } from "../src/three/floorWear.ts";
import { applyInteriorFloorGroups } from "../src/three/interiorFloor.ts";

test("all 14 enclosed hulls isolate exactly the two existing interior floor triangles",()=>{
 let count=0;
 for(const [id,model] of Object.entries(MODELS)){
  if(model.palletOption)continue;
  const built=model.build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:1,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
  try{
   const hull=built.group.children.flatMap(o=>o.children).find(o=>o.name.startsWith("Hull —")&&o.name.includes("tube")) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial[]>;
   assert.ok(hull,id);
   assert.ok(Array.isArray(hull.material),id);
   assert.equal(hull.material.length,2);
   const g=hull.geometry,p=g.getAttribute("position"),n=g.getAttribute("normal"),uv=g.getAttribute("uv");
   const floor=g.groups.filter(x=>x.materialIndex===1);
   assert.equal(floor.reduce((a,x)=>a+x.count,0),6,id);
   let cursor=0;
   for(const x of g.groups){assert.equal(x.start,cursor);cursor+=x.count;}
   assert.equal(cursor,p.count);
   const y=id==="rap"?.197:.137;
   for(const x of floor)for(let j=x.start;j<x.start+x.count;j++){
    assert.ok(Math.abs(p.getY(j)-y)<1e-6,id);
    assert.ok(n.getY(j)>.9999,id);
    assert.ok(uv.getX(j)>=0&&uv.getX(j)<=1&&uv.getY(j)>=0&&uv.getY(j)<=1,id);
   }
   const before=Array.from(p.array),normals=Array.from(n.array);
   assert.equal(applyInteriorFloorGroups(g,y),2);
   assert.deepEqual(Array.from(p.array),before);
   assert.deepEqual(Array.from(n.array),normals);
   const mat=hull.material[1];
   assert.equal(mat.userData.wearSurface,"interior");
   applyFloorWear(mat,true);
   assert.equal(mat.map!.image.width*mat.map!.image.height,512*512);
   applyFloorWear(mat,false);assert.equal(mat.map,null);
   count++;
  }finally{built.dispose();}
 }
 assert.equal(count,14);
});
