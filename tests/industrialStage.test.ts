import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {makeHangarBackdrop,makeParkingMark} from "../src/three/industrialStage.ts";
import {makeApronTexture} from "../src/three/textures.ts";

test("hangar uses bounded 2:1 panorama and cache-owned source",()=>{
 const a=makeHangarBackdrop(),b=makeHangarBackdrop(),mobile=makeHangarBackdrop(512);
 assert.equal(a.image.width,1024);assert.equal(a.image.height,512);
 assert.equal(mobile.image.width*mobile.image.height,512*256);
 assert.equal(a.mapping,THREE.EquirectangularReflectionMapping);
 assert.equal(a.colorSpace,THREE.SRGBColorSpace);
 assert.notEqual(a,b);assert.equal(a.image,b.image);
 a.dispose();b.dispose();mobile.dispose();
});
test("parking paint has independent clamped UVs and bounded texture resolution",()=>{
 const p=makeParkingMark(256),floor=makeApronTexture(512);
 assert.equal(p.image.width*p.image.height,256*256);
 assert.equal(p.wrapS,THREE.ClampToEdgeWrapping);
 assert.equal(floor.wrapS,THREE.RepeatWrapping);
 assert.equal(floor.image.width*floor.image.height,512*512);
 p.dispose();floor.dispose();
});
