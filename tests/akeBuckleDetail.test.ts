import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWebbingBuckleGeometry } from "../src/three/akeFabricDoor.ts";

test("two-slot buckle has closed edges, open strap apertures and original envelope", () => {
  const geometry = makeWebbingBuckleGeometry();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  try {
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    for (const [actual, expected] of [[size.x, .067], [size.y, .058], [size.z, .012]]) {
      assert.ok(Math.abs(actual - expected) < 0.0001, "fitting envelope");
    }
    const pos = geometry.getAttribute("position");
    const edges = new Map<string, number>();
    for (let k = 0; k < pos.count; k += 3) {
      const pts = [0,1,2].map(i => [pos.getX(k+i), pos.getY(k+i), pos.getZ(k+i)]
        .map(v => Math.round(v * 1e7)).join(","));
      for (const [a,b] of [[0,1],[1,2],[2,0]]) {
        const key = [pts[a], pts[b]].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(edges.size > 0);
    assert.ok([...edges.values()].every(n => n === 2), "closed manifold edges");
    const buckle = new THREE.Mesh(geometry, material);
    buckle.updateMatrixWorld(true);
    const ray = (x: number,y: number) => new THREE.Raycaster(
      new THREE.Vector3(x,y,1), new THREE.Vector3(0,0,-1)).intersectObject(buckle);
    for (const y of [-.013, .013]) {
      for (const x of [-.022, 0, .022]) assert.equal(ray(x,y).length, 0, "clear strap slot");
    }
    assert.ok(ray(0,0).length > 0, "central bridge remains solid");
    assert.ok(ray(.031,0).length > 0, "side frame remains solid");
  } finally {
    geometry.dispose();
    material.dispose();
  }
});
