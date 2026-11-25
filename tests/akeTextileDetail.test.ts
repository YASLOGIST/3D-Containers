import "./headlessCanvas.ts";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MODELS } from "../src/three/models.ts";

test("AKE woven strap UVs remain stable across seven sampled curtain poses", () => {
  const built = MODELS.ake.build({
    contour: true, finish: "mill", detail: true, rivets: true,
    doorOpen: 0, akeDoor: "fabric", reefer: true, setpoint: -18, load: 0,
  });
  try {
    const straps: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    built.group.traverse(o => {
      if (o instanceof THREE.Mesh && o.name === "AKE fabric tension strap") straps.push(o);
    });
    assert.equal(straps.length, 2);
    const shared = straps[0].material.map!;
    assert.ok(shared);
    assert.equal(straps[1].material.map, shared);
    assert.equal(shared.image.width * shared.image.height, 64 * 512);
    assert.equal(shared.colorSpace, THREE.SRGBColorSpace);
    const cloth = built.group.getObjectByName("AKE tensioned coated textile curtain") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    assert.equal(cloth.material.map!.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(cloth.material.map!.wrapT, THREE.ClampToEdgeWrapping);
    const original = straps.map(s => Array.from(s.geometry.getAttribute("uv").array));
    for (const pose of [0, .09, .18, .25, .5, .75, 1]) {
      built.setDoorOpen(pose);
      for (const [i, s] of straps.entries()) {
        const uv = s.geometry.getAttribute("uv");
        const pos = s.geometry.getAttribute("position");
        assert.equal(uv.count, pos.count);
        assert.deepEqual(Array.from(uv.array), original[i]);
        assert.equal(uv.getX(0), 0);
        assert.equal(uv.getX(1), 1);
        assert.equal(uv.getY(0), 0);
        assert.equal(uv.getY(uv.count - 1), 1);
        assert.ok(Array.from(pos.array).every(Number.isFinite));
      }
    }
  } finally {
    built.dispose();
  }
});
