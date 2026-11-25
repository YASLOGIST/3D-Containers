import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS } from "../src/three/models.ts";
import { AKE_DIMENSIONS, contourProfile } from "../src/three/akeLD3.ts";
import { akeBaseApertureCentres, makeAKEBasePlate } from "../src/three/akeBaseApertures.ts";

test("AKE plate components have closed edge topology and original envelopes",()=>{
 const {baseWidth:w,baseLength:d}=AKE_DIMENSIONS;
 const specs=[
   {w:w-.04,d:d-.04,h:.09,g:makeAKEBasePlate(w-.04,d-.04,.09,.012,akeBaseApertureCentres(w,d))},
   {w:.18,d:.18,h:.096,g:makeAKEBasePlate(.18,.18,.096,.022,[{x:0,z:0,radius:.038}])},
   {w:w-.16,d:d-.2,h:.012,g:makeAKEBasePlate(w-.16,d-.2,.012,.105,[],true)}
 ];
 for(const s of specs)try{
   const size=s.g.boundingBox!.getSize(new THREE.Vector3());
   for(const [actual,expected] of [[size.x,s.w],[size.y,s.h],[size.z,s.d]])assert.ok(Math.abs(actual-expected)<.0001);
   const p=s.g.getAttribute("position"),edges=new Map<string,number>();
   for(let k=0;k<p.count;k+=3){
     const points=[0,1,2].map(j=>[p.getX(k+j),p.getY(k+j),p.getZ(k+j)].map(x=>Math.round(x*1e7)).join(","));
     for(const [i,j] of [[0,1],[1,2],[2,0]]){
       const key=[points[i],points[j]].sort().join("|");
       edges.set(key,(edges.get(key)??0)+1);
     }
   }
   assert.ok(edges.size>0);
   assert.ok([...edges.values()].every(v=>v===2),"closed component");
 }finally{s.g.dispose()}
});

test("four AKE underside apertures remain clear through the complete lower assembly",()=>{
 for(const contour of [true,false]){
  const m=MODELS.ake.build({contour,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
  try{
   m.group.updateMatrixWorld(true);
   const {baseWidth:w,baseLength:d}=AKE_DIMENSIONS;
   const cx=contourProfile(contour)[0].x+w/2;
   const targets:THREE.Mesh[]=[];
   m.group.traverse(o=>{if(o instanceof THREE.Mesh && !o.userData.visualOnlyDecal)targets.push(o)});
   assert.equal(targets.filter(o=>o.name==="Corner casting").length,4);
   assert.equal(targets.filter(o=>o.name==="Casting bore").length,0);
   for(const a of akeBaseApertureCentres(w,d)){
    for(const [dx,dz] of [[0,0],[.025,0],[-.025,0],[0,.025],[0,-.025]]){
     const ray=new THREE.Raycaster(new THREE.Vector3(cx+a.x+dx,-.05,a.z+dz),new THREE.Vector3(0,1,0),0,.145);
     const hit=ray.intersectObjects(targets,false);
     assert.equal(hit.length,0,"clear aperture "+JSON.stringify({contour,a,dx,dz,hit:hit.map(h=>h.object.name)}));
    }
    const rimRay=new THREE.Raycaster(new THREE.Vector3(cx+a.x+.06,-.05,a.z),new THREE.Vector3(0,1,0),0,.145);
    assert.ok(rimRay.intersectObjects(targets,false).some(h=>h.object.name==="Corner casting"));
   }
  }finally{m.dispose()}
 }
});
