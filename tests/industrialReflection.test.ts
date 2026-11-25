import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {makeIndustrialReflectionScene} from "../src/three/industrialReflection.ts";

test("industrial reflection rig has independent extended emissive sources and releases resources",()=>{
  const a=makeIndustrialReflectionScene(),b=makeIndustrialReflectionScene();
  const meshes=a.scene.children as THREE.Mesh<THREE.BoxGeometry,THREE.MeshLambertMaterial>[];
  assert.equal(meshes.length,9);
  const strips=meshes.filter(m=>m.name==="Ceiling strip");
  assert.equal(strips.length,3);
  assert.ok(strips.every(m=>m.scale.z>m.scale.x*8&&m.material.emissiveIntensity>1));
  assert.ok(meshes.every(m=>m.geometry===meshes[0].geometry));
  assert.notEqual(meshes[0].geometry,(b.scene.children[0] as THREE.Mesh).geometry);
  let materials=0,geometry=0;
  meshes.forEach(m=>m.material.addEventListener("dispose",()=>materials++));
  meshes[0].geometry.addEventListener("dispose",()=>geometry++);
  a.dispose();
  assert.equal(materials,9);assert.equal(geometry,1);assert.equal(a.scene.children.length,0);
  assert.equal(b.scene.children.length,9);b.dispose();
});
