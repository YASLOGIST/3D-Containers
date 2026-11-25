import assert from "node:assert/strict";
import test from "node:test";
import { ventilatedFanShroudGeometry } from "../src/three/primitives.ts";
import * as THREE from "three";

function edgeStats(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute("position");
  const edges = new Map<string, number>();
  const snap = (x: number) => String(Math.round(x * 1e7) / 1e7);
  let degenerates = 0;
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < pos.count; i += 3) {
    for (let j = 0; j < 3; j++) tri[j].fromBufferAttribute(pos, i + j);
    const cross = new THREE.Vector3().subVectors(tri[1], tri[0])
      .cross(new THREE.Vector3().subVectors(tri[2], tri[0]));
    if (cross.length() < 2e-10) degenerates++;
    const keys = tri.map(v => [snap(v.x), snap(v.y), snap(v.z)].join(","));
    for (const [a,b] of [[0,1],[1,2],[2,0]]) {
      const key = [keys[a],keys[b]].sort().join("|");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return {
    boundary: [...edges.values()].filter(x => x === 1).length,
    nonmanifold: [...edges.values()].filter(x => x > 2).length,
    degenerates,
  };
}

test("refrigeration fan shrouds form closed annular solids but preserve an air passage", () => {
  for (const [top,bottom,depth,segments] of [
    [0.17,0.19,0.03,28],
    [0.23,0.26,0.034,30],
  ]) {
    const g=ventilatedFanShroudGeometry(top,bottom,depth,segments);
    const expanded = g.getIndex() ? g.toNonIndexed() : g;
    const stats=edgeStats(expanded);
    assert.deepEqual(stats, {boundary:0,nonmanifold:0,degenerates:0});
    if (expanded !== g) expanded.dispose();
    const bounds = new THREE.Box3().setFromBufferAttribute(g.getAttribute("position"));
    assert.ok(Math.abs(bounds.max.y - depth/2) < 1e-6);
    assert.ok(Math.abs(bounds.min.y + depth/2) < 1e-6);
    assert.ok(bounds.max.x <= bottom + 1e-6);
    assert.ok(bounds.max.x >= bottom * Math.cos(Math.PI / segments) - 1e-6);
    assert.ok(top > 0.004 && bottom > 0.004, "airflow core must remain open");
    g.dispose();
  }
});

test("invalid fan wall or radii cannot collapse airflow", () => {
  assert.throws(() => ventilatedFanShroudGeometry(0.004,0.3,0.03,30));
  assert.throws(() => ventilatedFanShroudGeometry(0.2,0.3,0.03,3));
});
