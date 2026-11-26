import "../tests/headlessCanvas.ts";
import {MODELS} from "../src/three/models.ts";
import {worldFaces,hasSurfaceCrossing} from "../tests/meshSurfaceIntersection.ts";
import * as THREE from "three";
const m=MODELS.ake.build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
const fixed:THREE.Mesh[]=[],moving:THREE.Mesh[]=[];
m.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==="Latch keeper")fixed.push(o);});
m.doorPivot!.traverse(o=>{if(o instanceof THREE.Mesh&&["Door leaf","Latch handle","Cam latch rod","Rotating latch cam","Latch hub","Door stiffener","Hinge strap","Door gasket"].includes(o.name))moving.push(o);});
const poses=[0,.045,.09,.135,.18,.205,.25,.375,.5,.75,1];
const geo=new THREE.BoxGeometry(1,1,1);const mat=new THREE.MeshStandardMaterial();
const cache=[];
try{
 for(const pose of poses){m.setDoorOpen(pose);m.group.updateMatrixWorld(true);cache.push(moving.map(mesh=>({mesh,b:new THREE.Box3().setFromObject(mesh),faces:worldFaces(mesh)})));}
 for(const gap of [.065,.08,.10])for(const depth of [.012,.02,.03])for(const zOffset of [.0,.008,.016]){
 let hits=0;const by:Record<string,number>={};let maxZ=-Infinity;
 for(const keeper of fixed){
  keeper.updateWorldMatrix(true,false);const p=keeper.getWorldPosition(new THREE.Vector3());const lower=p.y<.5;const baseY=lower?.145:1.565;const topY=lower?.22:1.49;const width=gap+.012;
  const boxes=[{x:0,y:baseY,z:p.z-zOffset,w:width,h:.012,d:depth},{x:-(gap+.006)/2,y:(baseY+topY)/2,z:p.z-zOffset,w:.006,h:Math.abs(topY-baseY)-.014,d:depth},{x:(gap+.006)/2,y:(baseY+topY)/2,z:p.z-zOffset,w:.006,h:Math.abs(topY-baseY)-.014,d:depth}];
  for(const b of boxes){const o=new THREE.Mesh(geo,mat);o.position.set(p.x+b.x,b.y,b.z);o.scale.set(b.w,b.h,b.d);o.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(o);maxZ=Math.max(maxZ,bb.max.z);let faces:ReturnType<typeof worldFaces>|undefined;
   for(const pose of cache)for(const t of pose){if(!bb.intersectsBox(t.b))continue;if(hasSurfaceCrossing(faces??=worldFaces(o),t.faces)){hits++;by[t.mesh.name]=(by[t.mesh.name]??0)+1;}}
  }
 }
 console.log(JSON.stringify({gapMM:gap*1000,depthMM:depth*1000,zOffsetMM:zOffset*1000,hits,by,maxZMM:maxZ*1000}));
 }
}finally{geo.dispose();mat.dispose();m.dispose();}
