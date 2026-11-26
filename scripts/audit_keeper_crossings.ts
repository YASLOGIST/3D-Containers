import "../tests/headlessCanvas.ts";
import {MODELS,type ModelId} from "../src/three/models.ts";
import {worldFaces,hasSurfaceCrossing} from "../tests/meshSurfaceIntersection.ts";
import * as THREE from "three";

// Diagnostic only: samples actual mesh surface crossings, not forces,
// coplanar contact, containment or continuous collision detection.
const names=new Set(["Latch handle","Cam latch rod","Rotating latch cam","Latch hub"]);
for(const id of Object.keys(MODELS) as ModelId[]){
 if(MODELS[id].palletOption)continue;
 const model=MODELS[id].build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
 try{
  const keepers:THREE.Mesh[]=[], moving:THREE.Mesh[]=[];
  model.group.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   if(o.name==="Latch keeper")keepers.push(o);
   else if(names.has(o.name))moving.push(o);
  });
  if(!keepers.length||!moving.length)throw new Error(id+" missing latch meshes");
  for(const pose of [0,.045,.09,.135,.18,.25,.5,.75,1]){
   model.setDoorOpen(pose);
   model.group.updateMatrixWorld(true);
   const targets=moving.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh),faces:undefined as ReturnType<typeof worldFaces>|undefined}));
   const counts:Record<string,number>={};
   for(const k of keepers){
    const kb=new THREE.Box3().setFromObject(k);
    let kf:ReturnType<typeof worldFaces>|undefined;
    for(const h of targets){
     if(!kb.intersectsBox(h.box))continue;
     if(hasSurfaceCrossing(kf??=worldFaces(k),h.faces??=worldFaces(h.mesh)))counts[h.mesh.name]=(counts[h.mesh.name]??0)+1;
    }
   }
   console.log(JSON.stringify({id,pose,keepers:keepers.length,counts}));
  }
 }finally{model.dispose();}
}
