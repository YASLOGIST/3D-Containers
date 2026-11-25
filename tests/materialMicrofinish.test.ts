import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {createBaseMaterials} from "../src/three/primitives.ts";

test("metal hardware shares a small microfinish and rubber remains dielectric",()=>{
  const m=createBaseMaterials("mill");
  assert.equal(m.alloy.normalMap,m.steel.normalMap);
  assert.equal(m.alloy.roughnessMap,m.rivet.roughnessMap);
  assert.equal(m.alloy.normalMap!.image.width,256);
  assert.equal(m.alloy.normalMap!.colorSpace,THREE.NoColorSpace);
  assert.equal(m.dark.metalness,0);
  assert.equal(m.dark.map!.colorSpace,THREE.SRGBColorSpace);
  assert.ok(m.dark.roughness>.85);
  assert.notEqual(m.shell.normalMap,m.alloy.normalMap);
});
test("painted and blasted skins use isotropic grain instead of rolling lines",()=>{
  const bare=createBaseMaterials("mill");
  const paint=createBaseMaterials("cargo");
  const blast=createBaseMaterials("titanium");
  assert.notEqual(bare.shell.normalMap!.image,paint.shell.normalMap!.image);
  assert.equal(paint.shell.normalMap!.image,blast.shell.normalMap!.image);
  assert.ok(paint.shell.metalness<.1);
});
