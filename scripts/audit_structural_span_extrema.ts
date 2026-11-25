import "../tests/headlessCanvas.ts";
import {MODELS,type ModelId} from "../src/three/models.ts";
import {geometryOnlyExportScene,structuralVertexBounds} from "../src/three/geometryExport.ts";
import * as THREE from "three";
for(const id of Object.keys(MODELS) as ModelId[]){
 const spec=MODELS[id],m=spec.build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
 try{
 const scene=geometryOnlyExportScene(m.group);
 const extrema=Array.from({length:3},()=>({min:Infinity,max:-Infinity,minPart:"",maxPart:""}));
 const v=new THREE.Vector3();
 scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
 const p=o.geometry.getAttribute("position"),ix=o.geometry.getIndex();for(let j=0;j<(ix?ix.count:p.count);j++){
 v.fromBufferAttribute(p,ix?ix.getX(j):j).applyMatrix4(o.matrixWorld);
 for(let ax=0;ax<3;ax++){const n=v.getComponent(ax),e=extrema[ax];if(n<e.min){e.min=n;e.minPart=o.name;}if(n>e.max){e.max=n;e.maxPart=o.name;}}
 }
 });
 const size=structuralVertexBounds(m.group).getSize(v).toArray();
 const ref=[Math.max(spec.dims.width,spec.dims.topWidth),spec.palletOption?spec.dims.height+(spec.dims.contourHeight??0):spec.dims.height,spec.dims.depth];
 console.log(JSON.stringify({id,deltaMM:size.map((n,i)=>+(1000*(n-ref[i])).toFixed(3)),extrema:extrema.map(e=>[e.minPart,e.maxPart])}));
 }finally{m.dispose()}
}
