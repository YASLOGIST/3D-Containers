import test from "node:test";
import assert from "node:assert/strict";
import {
  AKE_CARGO_CORE,
  planAKECargo,
  type CargoItem,
} from "../src/lib/cargoPlacement.ts";

const box = (id: string, widthM = 0.4, depthM = 0.4, heightM = 0.4,
  massKg = 20): CargoItem => ({
  id, label: id, widthM, depthM, heightM, massKg,
});

test("single carton fits the conservative AKE core in world coordinates", () => {
  const p = planAKECargo([box("A")]);
  assert.equal(p.placed.length, 1);
  assert.equal(p.rejected.length, 0);
  assert.equal(p.loadedKg, 20);
  assert.equal(p.placed[0].y, AKE_CARGO_CORE.floorY + 0.2);
  assert.ok(p.placed[0].x > AKE_CARGO_CORE.minX);
});

test("placement never intersects another carton or the conservative core", () => {
  const p = planAKECargo(Array.from({ length: 30 }, (_, i) => box(String(i))));
  assert.equal(p.placed.length, 27);
  assert.equal(p.rejected.length, 3);
  for (let i = 0; i < p.placed.length; i++) {
    const a = p.placed[i];
    assert.ok(a.x - a.widthM / 2 >= AKE_CARGO_CORE.minX - 1e-6);
    assert.ok(a.x + a.widthM / 2 <= AKE_CARGO_CORE.minX + AKE_CARGO_CORE.widthM + 1e-6);
    assert.ok(a.y - a.heightM / 2 >= AKE_CARGO_CORE.floorY - 1e-6);
    assert.ok(a.y + a.heightM / 2 <= AKE_CARGO_CORE.floorY + AKE_CARGO_CORE.heightM + 1e-6);
    for (const b of p.placed.slice(i + 1)) {
      const ox = Math.abs(a.x - b.x) < (a.widthM + b.widthM) / 2 - 1e-6;
      const oy = Math.abs(a.y - b.y) < (a.heightM + b.heightM) / 2 - 1e-6;
      const oz = Math.abs(a.z - b.z) < (a.depthM + b.depthM) / 2 - 1e-6;
      assert.equal(ox && oy && oz, false);
    }
  }
});

test("oversize, invalid and overweight cartons are rejected without hidden mass", () => {
  const p = planAKECargo([
    box("too wide", 1.3),
    box("bad", -0.2),
    box("heavy", 0.4, 0.4, 0.4, 1600),
    box("safe", 0.4, 0.4, 0.4, 20),
  ]);
  assert.deepEqual(p.rejected.map(x => x.reason), ["oversize", "invalid", "overweight"]);
  assert.equal(p.loadedKg, 20);
  assert.equal(p.placed.length, 1);
});

test("placement is deterministic, order-aware and limited to 40 previews", () => {
  const items = Array.from({ length: 41 }, (_, i) => box(String(i), 0.2, 0.2, 0.2, 1));
  assert.deepEqual(planAKECargo(items), planAKECargo(items));
  assert.equal(planAKECargo(items).placed.length + planAKECargo(items).rejected.length, 41);
  assert.equal(planAKECargo(items).rejected.at(-1)?.reason, "no-space");
});
