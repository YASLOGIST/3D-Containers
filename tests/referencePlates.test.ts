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
     assert.equal(map.userData.plateLayout,4,id);
     assert.equal(map.userData.projectCredit,"Ahmed Yasser Ali",id);
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

test("project credit is drawn once as small regular text, not an owner field",()=>{
 const original=document.createElement;
 const calls:{text:string;font:string;x:number;y:number;maxWidth?:number}[]=[];
 document.createElement=((tag:string)=>{
  const canvas=original.call(document,tag) as HTMLCanvasElement;
  const originalContext=canvas.getContext.bind(canvas);
  canvas.getContext=((type:string)=>{
   const ctx=originalContext(type as "2d")!;
   ctx.fillText=(text,x,y,maxWidth)=>{calls.push({text,font:ctx.font,x,y,maxWidth});};
   return ctx;
  }) as typeof canvas.getContext;
  return canvas;
 }) as typeof document.createElement;
 let texture:THREE.Texture|undefined;
 try{
  texture=makeIdPlate({width:.37,height:.19,id:"CREDIT-QA",carrier:"YL",serial:"CREDIT-QA-1",tareKg:92,maxGrossKg:1588,volumeM3:4.3});
  const credit=calls.filter(c=>c.text==="Ahmed Yasser Ali");
  assert.equal(credit.length,1);
  assert.match(credit[0].font,/^400 18px /);
  assert.equal(credit[0].x,370);
  assert.ok(credit[0].x+(credit[0].maxWidth??0)<735);
  for (const label of ["ULD IDENTIFICATION","OWNER CODE","TARE WEIGHT","MAX GROSS WEIGHT","MAX PAYLOAD","INTERNAL VOLUME","MODEL REFERENCE","ENGINEERING REFERENCE"]) {
   assert.equal(calls.filter(c=>c.text===label).length,1,label);
  }
  for (const old of ["DEMO PLATE","OWNER REF","TARE REF","GROSS REF","PAYLOAD REF","VOLUME REF","DEMO SERIAL","REFERENCE ONLY / NOT FOR LOADING"]) {
   assert.equal(calls.some(c=>c.text===old),false,old);
  }
  const title=calls.find(c=>c.text==="ULD IDENTIFICATION")!;
  assert.ok(title.x+(title.maxWidth??0)<=965);
  assert.match(title.font,/^700 18px /);
 }finally{document.createElement=original;texture?.dispose();}
});
