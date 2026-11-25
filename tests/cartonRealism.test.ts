import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { makeCartonAtlas, makeCartonGeometry } from "../src/three/cartonRealism.ts";

test("rounded cargo visual mesh preserves nominal unit envelope and atlas boundaries",()=>{
  const geometry=makeCartonGeometry();
  try{
    assert.deepEqual(geometry.boundingBox!.min.toArray(),[-.5,-.5,-.5]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(),[.5,.5,.5]);
    const uv=geometry.getAttribute("uv");
    assert.equal(uv.count/3,108);
    assert.equal(geometry.groups.length,0);
    for(let i=0;i<uv.count;i++){
      const u=uv.getX(i),v=uv.getY(i);
      assert.ok(Number.isFinite(u)&&Number.isFinite(v));
      assert.ok(u>0&&u<1&&v>0&&v<1);
      assert.ok(Math.abs(u-.5)>.005&&Math.abs(v-.5)>.005);
    }
  }finally{geometry.dispose()}
});
test("carton atlas retains the same total texture pixel budget",()=>{
  const texture=makeCartonAtlas();
  assert.equal(texture.image.width*texture.image.height,1024*256);
  assert.equal(texture.anisotropy,4);
  texture.dispose();
});
