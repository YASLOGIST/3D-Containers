import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS } from "../src/three/models.ts";
import { makeIdPlate } from "../src/three/textures.ts";

test("all 17 model plate textures are bounded, explicitly illustrative and non-scannable",()=>{
 let count=0;
 for(const [id,model] of Object.entries(MODELS)){
  const b=model.build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
  try{
   let plates=0;
   b.group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    for(const mat of Array.isArray(o.material)?o.material:[o.material]){
     const map=(mat as THREE.MeshStandardMaterial).map;
     if(!map?.name.startsWith("id-plate:"))continue;
     plates++;
     assert.equal(map.userData.referenceOnly,true,id);
     assert.equal(map.userData.scannableIdentity,false,id);
     assert.equal(map.userData.plateLayout,2,id);
     assert.equal(map.image.width,1536,id);
     assert.ok(map.image.height>0&&map.image.height<=1536,id);
     assert.equal(map.wrapS,THREE.ClampToEdgeWrapping);
     assert.equal(map.wrapT,THREE.ClampToEdgeWrapping);
    }
   });
   assert.ok(plates>0,id);count++;
  }finally{b.dispose()}
 }
 assert.equal(count,17);
});
test("plate texture consumers share source raster but own independent texture handles",()=>{
 const o={width:.36,height:.19,id:"AKE DEMO",carrier:"YL",serial:"DEMO-1",tareKg:92,maxGrossKg:1588,volumeM3:4.3};
 const a=makeIdPlate(o),b=makeIdPlate(o);
 assert.notEqual(a,b);assert.equal(a.image,b.image);assert.equal(a.image.height,Math.round(1536*.19/.36));
 a.dispose();b.dispose();
});
