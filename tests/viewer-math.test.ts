import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  projectedFeaturePixels,
  projectedOrthoFeaturePixels,
  orthoFitSizeFor,
  sectionPlaneFor,
} from "../src/three/AKEViewer.ts";

const box = new THREE.Box3(
  new THREE.Vector3(-1, 0, -0.75),
  new THREE.Vector3(1, 1.6, 0.75),
);

/** does a point survive clipping? (normal·p + constant >= 0) */
function kept(
  spec: ReturnType<typeof sectionPlaneFor>,
  p: THREE.Vector3,
) {
  return spec.normal.dot(p) + spec.constant >= -1e-9;
}

test("section plane keeps the min side by default, max side when flipped", () => {
  const cut = sectionPlaneFor(box, "x", 0.75, false); // plane at x = +0.5
  assert.ok(Math.abs(cut.point.x - 0.5) < 1e-9);
  assert.ok(Math.abs(cut.offset - 1.5) < 1e-9);
  assert.ok(Math.abs(cut.extent - 2) < 1e-9);
  assert.equal(kept(cut, new THREE.Vector3(-1, 0.8, 0)), true);
  assert.equal(kept(cut, new THREE.Vector3(0.5, 0.8, 0)), true, "on the plane");
  assert.equal(kept(cut, new THREE.Vector3(1, 0.8, 0)), false);

  const flipped = sectionPlaneFor(box, "x", 0.75, true);
  assert.equal(kept(flipped, new THREE.Vector3(1, 0.8, 0)), true);
  assert.equal(kept(flipped, new THREE.Vector3(-1, 0.8, 0)), false);
});

test("section plane honours every axis and clamps its position", () => {
  const roof = sectionPlaneFor(box, "y", 0.5, false); // plane at y = 0.8
  assert.ok(Math.abs(roof.point.y - 0.8) < 1e-9);
  assert.equal(kept(roof, new THREE.Vector3(0, 0.2, 0)), true);
  assert.equal(kept(roof, new THREE.Vector3(0, 1.6, 0)), false);

  const beyond = sectionPlaneFor(box, "z", 5, false); // clamps to max
  assert.ok(Math.abs(beyond.point.z - 0.75) < 1e-9);
  assert.equal(kept(beyond, new THREE.Vector3(0, 0, 0.7)), true);

  const before = sectionPlaneFor(box, "z", -2, false); // clamps to min
  assert.ok(Math.abs(before.point.z + 0.75) < 1e-9);
  assert.equal(before.offset, 0);
});

test("orthographic fit covers the sphere in both view axes", () => {
  // Landscape: height covers the diameter exactly (times margin).
  assert.ok(Math.abs(orthoFitSizeFor(1, 16 / 9, 1) - 2) < 1e-9);
  assert.ok(Math.abs(orthoFitSizeFor(1, 16 / 9, 1.18) - 2.36) < 1e-9);
  // Portrait: height must grow so the narrower width still covers it.
  const portrait = orthoFitSizeFor(1, 0.5, 1);
  assert.ok(Math.abs(portrait - 4) < 1e-9);
  assert.ok(portrait * 0.5 >= 2, "frustum width covers the diameter");
  // Degenerate aspects stay finite.
  assert.ok(Number.isFinite(orthoFitSizeFor(2, 0, 1)));
});

test("screen-space micro detail LOD is projection-consistent", () => {
  const close = projectedFeaturePixels(0.011, 1.5, 900, 40);
  const far = projectedFeaturePixels(0.011, 12, 900, 40);
  assert.ok(close > 1.2, "near heads become resolved");
  assert.ok(far < 1.2, "distant heads stay below pixel threshold");
  assert.ok(close > far);
  assert.equal(projectedFeaturePixels(0.011, 0, 900, 40), 0);
  assert.equal(projectedFeaturePixels(0.011, 1, 0, 40), 0);
  assert.ok(projectedOrthoFeaturePixels(0.011, 900, 3) > 1.2);
  assert.ok(projectedOrthoFeaturePixels(0.011, 900, 20) < 1.2);
  assert.equal(projectedOrthoFeaturePixels(0.011, 900, 0), 0);
});
