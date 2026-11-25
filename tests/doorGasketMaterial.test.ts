import "./headlessCanvas.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createDoorGasketMaterial, makeGasketNormal } from "../src/three/doorGasketMaterial.ts";
import { MODELS, type ModelId } from "../src/three/models.ts";

test("elastomer microfinish is deterministic, linear, bounded and clone-owned", () => {
  const a = makeGasketNormal(), b = makeGasketNormal();
  try {
    assert.notEqual(a, b);
    assert.equal(a.image, b.image);
    assert.equal(a.image.width, 128);
    assert.equal(a.image.height, 128);
    assert.equal(a.colorSpace, THREE.NoColorSpace);
    assert.equal(a.wrapS, THREE.RepeatWrapping);
    assert.equal(a.generateMipmaps, true);
    const pixels = a.image.data as Uint8Array;
    assert.equal(pixels.length, 128 * 128 * 4);
    let varies = false;
    for (let i = 0; i < pixels.length; i += 4) {
      assert.ok(pixels[i + 2] >= 245);
      assert.equal(pixels[i + 3], 255);
      if (pixels[i] !== pixels[0]) varies = true;
    }
    assert.ok(varies);
    a.repeat.set(1, 1);
    assert.equal(b.repeat.x, 12);
  } finally { a.dispose(); b.dispose(); }
});

test("gasket material uses dielectric roughness and independently owned maps", () => {
  const a = createDoorGasketMaterial(), b = createDoorGasketMaterial();
  try {
    assert.equal(a.metalness, 0);
    assert.ok(a.roughness >= .85);
    assert.equal(a.map!.colorSpace, THREE.SRGBColorSpace);
    assert.equal(a.normalMap!.colorSpace, THREE.NoColorSpace);
    assert.notEqual(a.normalMap, b.normalMap);
    assert.notEqual(a.map, b.map);
    assert.equal(a.normalMap!.image, b.normalMap!.image);
  } finally {
    for (const m of [a, b]) { m.map!.dispose(); m.normalMap!.dispose(); m.dispose(); }
  }
});

test("all rigid catalog models isolate elastomer finish to existing door gaskets", () => {
  const options = { contour: true, finish: "mill" as const, detail: true,
    rivets: true, doorOpen: 0, akeDoor: "rigid" as const, reefer: true, setpoint: -18, load: 0 };
  let rigid = 0;
  for (const id of Object.keys(MODELS) as ModelId[]) {
    const model = MODELS[id].build(options);
    try {
      let count = 0;
      model.group.traverse(o => {
        if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
        if (o.name === "Door gasket") {
          assert.equal(o.material.userData.gasketSurface, true, id);
          count++;
        } else assert.notEqual(o.material.userData.gasketSurface, true, id + ": " + o.name);
      });
      if (MODELS[id].palletOption) assert.equal(count, 0, id);
      else { assert.ok(count > 0, id); rigid++; }
    } finally { model.dispose(); }
  }
  assert.equal(rigid, 14);
});
