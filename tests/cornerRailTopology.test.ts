import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cornerRailSection } from "../src/three/primitives.ts";
import { akhProfile } from "../src/three/akh.ts";

const snap = (x: number) => (Math.round(x * 1e7) / 1e7).toString();

function boundaryEdges(geometry: THREE.BufferGeometry): { boundaries: number; nonmanifold: number; triangles: number } {
  const position = geometry.getAttribute("position");
  const edges = new Map<string, number>();
  for (let k = 0; k < position.count; k += 3) {
    const points = [0, 1, 2].map(d =>
      [position.getX(k + d), position.getY(k + d), position.getZ(k + d)].map(snap).join(","));
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
      const key = [points[i], points[j]].sort().join("|");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const values = [...edges.values()];
  return {
    boundaries: values.filter(n => n === 1).length,
    nonmanifold: values.filter(n => n > 2).length,
    triangles: position.count / 3,
  };
}

test("all six AKH corner extrusions have closed end caps, including the concave knees", () => {
  const profile = akhProfile();
  assert.equal(profile.length, 6);
  for (let i = 0; i < profile.length; i++) {
    const { shape } = cornerRailSection(
      profile[i],
      profile[(i - 1 + profile.length) % profile.length],
      profile[(i + 1) % profile.length],
      0.045, 0.013, 0.055,
    );
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.562, bevelEnabled: false, curveSegments: 8, steps: 1,
    });
    const topology = boundaryEdges(geo);
    assert.ok(topology.triangles > 0, "corner " + (i + 1) + " remains visible");
    assert.equal(topology.boundaries, 0, "corner " + (i + 1) + " end caps closed");
    assert.equal(topology.nonmanifold, 0, "corner " + (i + 1) + " no self-overlap");
    geo.dispose();
  }
});
