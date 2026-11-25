import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { MODELS, type ModelId } from "../src/three/models.ts";
import { cargoCoreForModel, demoCargoForModel, planCargoForModel } from "../src/lib/cargoPlacement.ts";
import { cargoMassLedger } from "../src/lib/cargoMassLedger.ts";

test("all 17 demo manifests avoid selected model mesh surfaces in the closed pose", () => {
  for(const id of Object.keys(MODELS) as ModelId[]){
    const built=MODELS[id].build({contour:true,finish:"mill",detail:true,rivets:true,doorOpen:0,akeDoor:"rigid",reefer:true,setpoint:-18,load:0});
    try{
      built.group.updateMatrixWorld(true);
      const plan=planCargoForModel(id,demoCargoForModel(id));
      const ledger=cargoMassLedger(plan.placed,cargoCoreForModel(id));
      assert.equal(plan.placed.length,27,id);
      assert.ok(ledger.valid,id);
      assert.ok(Math.abs(ledger.allocatedKg-plan.loadedKg)<1e-6,id);
      const cartons=plan.placed.map(p=>({id:p.id,box:new THREE.Box3(
        new THREE.Vector3(p.x-p.widthM/2,p.y-p.heightM/2,p.z-p.depthM/2),
        new THREE.Vector3(p.x+p.widthM/2,p.y+p.heightM/2,p.z+p.depthM/2)
      ).expandByScalar(-0.0001)}));
      built.group.traverse(obj=>{
        if(!(obj instanceof THREE.Mesh)||obj instanceof THREE.InstancedMesh||obj.userData.visualOnlyDecal)return;
        for(let p:THREE.Object3D|null=obj;p;p=p.parent)if(!p.visible)return;
        // The pallet load contour is an optional visual envelope, not a physical obstacle.
        if(obj.name==="Cargo load contour")return;
        const bounds=new THREE.Box3().setFromObject(obj);
        const nearby=cartons.filter(x=>x.box.intersectsBox(bounds));if(!nearby.length)return;
        const a=obj.geometry.getAttribute("position"),idx=obj.geometry.getIndex();
        const triangle=new THREE.Triangle();
        const v=[triangle.a,triangle.b,triangle.c];
        for(let i=0;i+2<(idx?idx.count:a.count);i+=3){
          for(let k=0;k<3;k++)v[k].fromBufferAttribute(a,idx?idx.getX(i+k):i+k).applyMatrix4(obj.matrixWorld);
          for(const q of nearby)assert.equal(q.box.intersectsTriangle(triangle),false,id+": "+q.id+" crosses "+obj.name);
        }
      });
    }finally{built.dispose()}
  }
});
