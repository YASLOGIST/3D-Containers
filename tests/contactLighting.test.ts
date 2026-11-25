import test from "node:test";
import assert from "node:assert/strict";
import {contactFootprint,makeContactTexture,inspectionFill} from "../src/three/contactLighting.ts";

test("ground contact follows the base rather than wider upper contour",()=>{
  assert.deepEqual(contactFootprint([{x:-1,y:0},{x:.5,y:0},{x:1,y:1},{x:-1,y:1}],1.56),
    {centerX:-.25,width:1.5,depth:1.56});
  assert.equal(contactFootprint([],1),null);
});
test("contact texture fades to transparent at perimeter",()=>{
  const t=makeContactTexture(128);
  const a=t.image.data;
  assert.equal(a[3],0);
  assert.equal(a[(64*128+64)*4+3],255);
  assert.equal(a[(127*128+64)*4+3],0);
  t.dispose();
});
test("inspection fill only increases after door release and is absent on pallets",()=>{
  assert.equal(inspectionFill(0,false,false,false),0);
  assert.equal(inspectionFill(.18,false,false,false),0);
  assert.ok(inspectionFill(.5,false,false,false)>0);
  assert.ok(inspectionFill(1,false,false,false)>inspectionFill(.5,false,false,false));
  assert.equal(inspectionFill(1,true,true,false),0);
  assert.equal(inspectionFill(0,true,false,false),1.35);
});
