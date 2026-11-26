import "../tests/headlessCanvas.ts";
import {MODELS} from "../src/three/models.ts";
import {worldFaces,hasSurfaceCrossing} from "../tests/meshSurfaceIntersection.ts";
import * as THREE from "three";

const m=MODELS.ake.build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
const pivot=m.doorPivot!;
const originalKeepers:THREE.Mesh[]=[], fixed:THREE.Mesh[]=[], moving:THREE.Mesh[]=[];
m.group.traverse(o=>{
 if(!(o instanceof THREE.Mesh))return;
 if(o.name==="Latch keeper")originalKeepers.push(o);
 if(["Door end frame","Hinge strap","Hinge pin","Corner extrusion 1","Corner extrusion 2","Corner extrusion 3","Corner extrusion 4","Skid frame"].includes(o.name)&&!o.parent?.userData.visualOnlyDecal){
 let p:THREE.Object3D|null=o;
 while(p&&p!==pivot)p=p.parent;
 if(p!==pivot)fixed.push(o);
 }
});
pivot.traverse(o=>{if(o instanceof THREE.Mesh&&["Door leaf","Latch handle","Cam latch rod","Rotating latch cam","Latch hub","Door stiffener","Hinge strap","Door gasket"].includes(o.name))moving.push(o);});
const material=new THREE.MeshStandardMaterial();
const testGroup=new THREE.Group();m.group.add(testGroup);
const pins:THREE.Mesh[]=[], rings:THREE.Mesh[]=[];
const ringShape=new THREE.Shape();
ringShape.absarc(0,0,.024,0,2*Math.PI,false);
const hole=new THREE.Path();hole.absarc(0,0,.009,0,2*Math.PI,true);ringShape.holes.push(hole);
const ringGeo=new THREE.ExtrudeGeometry(ringShape,{depth:.003,bevelEnabled:false,curveSegments:20});
ringGeo.rotateX(-Math.PI/2);ringGeo.translate(0,-.0015,0);
const pinGeo=new THREE.CylinderGeometry(.007,.007,.032,24);
const rods=pivot.children.filter(o=>o.name==="Articulated cam latch spindle");
const pos=(o:THREE.Object3D)=>o.getWorldPosition(new THREE.Vector3());
const closedY:number[]=[];
try{
 m.setDoorOpen(0);m.group.updateMatrixWorld(true);
 for(const s of rods){
 const p=pos(s);
 for(const top of [false,true]){
 const ring=new THREE.Mesh(ringGeo,material);ring.name="prototype frame receiver";
 ring.position.set(p.x,top?1.5435:.1665,p.z);testGroup.add(ring);rings.push(ring);
 const pin=new THREE.Mesh(pinGeo,material);pin.name="prototype axial bolt";
 const center=top?1.528:.182;closedY.push(center);
 pivot.add(pin);pin.position.copy(pivot.worldToLocal(new THREE.Vector3(p.x,center,p.z)));pins.push(pin);
 }
 }
 const poseSamples=[0,.0225,.045,.0675,.09,.1125,.135,.1575,.18,.19,.2,.225,.25,.3,.375,.5,.75,1];
 function count(a:THREE.Mesh[],b:THREE.Mesh[]){
 const counts:Record<string,number>={};
 const items=b.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh),faces:undefined as ReturnType<typeof worldFaces>|undefined}));
 for(const h of a){const box=new THREE.Box3().setFromObject(h);let faces:ReturnType<typeof worldFaces>|undefined;
 for(const t of items){if(!box.intersectsBox(t.box))continue;if(hasSurfaceCrossing(faces??=worldFaces(h),t.faces??=worldFaces(t.mesh)))counts[h.name+" / "+t.mesh.name]=(counts[h.name+" / "+t.mesh.name]??0)+1;}}
 return counts;
 }
 for(const pose of poseSamples){
 m.setDoorOpen(pose);const u=Math.min(1,pose/.18),s=u*u*(3-2*u);
 pins.forEach((p,i)=>p.position.y=closedY[i]+(i%2===0?1:-1)*.030*s);
 m.group.updateMatrixWorld(true);
 console.log(JSON.stringify({pose,receiverMoving:count(rings,moving),receiverPin:count(rings,pins),pinFixed:count(pins,fixed),pinLeaf:count(pins,moving.filter(o=>o.name==="Door leaf")),receiverFrame:count(rings,fixed)}));
 }
}finally{ringGeo.dispose();pinGeo.dispose();material.dispose();m.dispose();}
