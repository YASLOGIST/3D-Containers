import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS, type ModelId } from "../src/three/models.ts";
import { structuralVertexBounds } from "../src/three/geometryExport.ts";
import { worldFaces, hasSurfaceCrossing } from "./meshSurfaceIntersection.ts";

test("12 non-reefer rigid models fold handles inside nominal depth and clear the leaf plane", () => {
  let checked = 0, samples = 0;
  const point = new THREE.Vector3(), inverse = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  for (const id of Object.keys(MODELS) as ModelId[]) {
    const spec = MODELS[id];
    if (spec.palletOption || id === "rkn" || id === "rap") continue;
    for (const detail of [true, false]) {
      const model = spec.build({contour:true,finish:"mill",detail,rivets:detail,
        doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
      try {
        const pivot = model.doorPivot!;
        const leaf = model.group.getObjectByName("Door leaf") as THREE.Mesh;
        leaf.geometry.computeBoundingBox();
        const face = leaf.geometry.boundingBox!.max.z;
        const handles: THREE.Mesh[] = [];
        pivot.traverse(o => {if(o instanceof THREE.Mesh && o.name==="Latch handle") handles.push(o);});
        assert.ok(handles.length > 0, id);
        const closed = structuralVertexBounds(model.group).getSize(point);
        assert.ok(Math.abs(closed.z - spec.dims.depth) < 0.000001, id + " depth");
        for (const pose of [...Array.from({length:21}, (_,i)=>.18*i/20), .25,.5,.75,1]) {
          model.setDoorOpen(pose);
          model.group.updateMatrixWorld(true);
          inverse.copy(pivot.matrixWorld).invert();
          for (const handle of handles) {
            matrix.multiplyMatrices(inverse,handle.matrixWorld);
            const position=handle.geometry.getAttribute("position");
            for(let j=0;j<position.count;j++){
              point.fromBufferAttribute(position,j).applyMatrix4(matrix);
              assert.ok(point.z-face>=0.003, id + " leaf plane clearance at " + pose);
            }
          }
          samples++;
        }
        checked++;
      }finally{model.dispose();}
    }
  }
  assert.equal(checked,24);
  assert.equal(samples,600);
});

test("compact latch levers introduce no sampled surface crossings relative to the previous placement", () => {
  let samples = 0;
  const names = new Set(["Latch hub","Cam latch rod","Rotating latch cam","Latch keeper","Door end frame","Hinge strap","Hinge pin","Door handle bar","Door leaf"]);
  for (const id of Object.keys(MODELS) as ModelId[]) {
    if (MODELS[id].palletOption || id === "rkn" || id === "rap") continue;
    const model = MODELS[id].build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
    try {
      const handles: THREE.Mesh[] = [], targets: THREE.Mesh[] = [];
      model.group.traverse(o => {if(o instanceof THREE.Mesh){if(o.name==="Latch handle")handles.push(o);else if(names.has(o.name))targets.push(o);}});
      const saved = handles.map(h=>({h,position:h.position.clone(),scale:h.scale.clone()}));
      const first=model.doorPivot!.children.find(o=>o.name==="Articulated cam latch spindle")!;
      const keepers=targets.filter(o=>o.name==="Latch keeper").slice(0,2);
      const firstX=first.position.x, keeperXs=keepers.map(o=>o.position.x);
      const results=[new Set<string>(),new Set<string>()];
      for(let version=0;version<2;version++){
        for(const {h,position,scale} of saved){
          h.position.copy(position);h.scale.copy(scale);
          if(version===0){h.position.x=.009;h.position.y+=.0225;h.position.z=.023;h.scale.y=1;}
        }
        if(id==="ake"){
          first.position.x=firstX-(version===0?.05:0);
          keepers.forEach((o,i)=>o.position.x=keeperXs[i]-(version===0?.05:0));
        }
        for(const pose of [...Array.from({length:13},(_,i)=>.18*i/12),.25,.5,.75,1]){
          model.setDoorOpen(pose);model.group.updateMatrixWorld(true);
          const candidates=targets.map((mesh,index)=>({mesh,index,box:new THREE.Box3().setFromObject(mesh),faces:undefined as ReturnType<typeof worldFaces>|undefined}));
          handles.forEach((h,hi)=>{
            const box=new THREE.Box3().setFromObject(h);let faces:ReturnType<typeof worldFaces>|undefined;
            for(const target of candidates){
              if(!box.intersectsBox(target.box))continue;
              if(hasSurfaceCrossing(faces??=worldFaces(h),target.faces??=worldFaces(target.mesh)))results[version].add([pose,hi,target.index,target.mesh.name].join("|"));
            }
          });
          if(version===1)samples++;
        }
      }
      for(const key of results[1])assert.ok(results[0].has(key),id+" added crossing "+key);
      assert.ok([...results[1]].every(key=>!key.endsWith("|Door leaf")&&!key.endsWith("|Hinge strap")&&!key.endsWith("|Rotating latch cam")),id+" unwanted lever crossing");
    }finally{model.dispose();}
  }
  assert.equal(samples,204);
});
