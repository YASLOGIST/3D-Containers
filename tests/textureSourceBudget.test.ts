import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { cachedTexture, textureSourceCount, textureSourceBytes, TEXTURE_SOURCE_BUDGET_BYTES, TEXTURE_SOURCE_MAX_ENTRIES } from "../src/three/textureSupport.ts";
import "./headlessCanvas.ts";

function canvasTexture(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return new THREE.CanvasTexture(c);
}

test("procedural source cache is bounded and eviction never mutates live clones", () => {
  const first = cachedTexture("old", () => canvasTexture(2048, 2048));
  const image = first.image;
  for (let i = 0; i < 12; i++) {
    const texture = cachedTexture("large:" + i, () => canvasTexture(2048, 2048));
    texture.dispose();
    assert.ok(textureSourceBytes() <= TEXTURE_SOURCE_BUDGET_BYTES);
  }
  const renewed = cachedTexture("old", () => canvasTexture(2048, 2048));
  assert.notEqual(renewed.image, image);
  assert.equal(first.image, image);
  assert.equal(first.image.width, 2048);
  const hit = cachedTexture("old", () => { throw new Error("cache miss"); });
  assert.equal(hit.image, renewed.image);
  assert.notEqual(hit, renewed);
  for (let i = 0; i < 90; i++) cachedTexture("small:" + i, () => canvasTexture(1, 1)).dispose();
  assert.ok(textureSourceCount() <= TEXTURE_SOURCE_MAX_ENTRIES);
  assert.ok(textureSourceBytes() <= TEXTURE_SOURCE_BUDGET_BYTES);
  first.dispose(); renewed.dispose(); hit.dispose();
});
