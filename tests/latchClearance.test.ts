import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS, type ModelId } from "../src/three/models.ts";
import { structuralVertexBounds } from "../src/three/geometryExport.ts";

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
