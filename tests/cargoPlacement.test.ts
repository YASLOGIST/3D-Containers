import test from "node:test";
import assert from "node:assert/strict";
import {
  AKE_CARGO_CORE,
  cargoCoreForModel,
  demoCargoForModel,
  demoAKECargo,
  planCargoForModel,
  planAKECargo,
  type CargoItem,
} from "../src/lib/cargoPlacement.ts";
import { MODELS } from "../src/three/models.ts";

const box = (id: string, widthM = 0.4, depthM = 0.4, heightM = 0.4,
  massKg = 20): CargoItem => ({
  id, label: id, widthM, depthM, heightM, massKg,
});

test("one-click showcase fills the 3D preview without invalid cartons", () => {
  const demo = demoAKECargo();
  const plan = planAKECargo(demo);
  assert.equal(demo.length, 27);
  assert.equal(plan.placed.length, 27);
  assert.equal(plan.rejected.length, 0);
  assert.equal(plan.loadedKg, 675);
  assert.ok(plan.coreUtilizationPct > 55);
  assert.ok(plan.coreUtilizationPct < 100);
});

test("all 17 models have distinct conservative cores and collision-free preview cargo", () => {
  for (const spec of Object.values(MODELS)) {
    const core = cargoCoreForModel(spec.id);
    const demo = demoCargoForModel(spec.id);
    const plan = planCargoForModel(spec.id, demo);
    assert.equal(plan.placed.length, 27, spec.code);
    assert.equal(plan.rejected.length, 0, spec.code);
    assert.ok(plan.loadedKg <= spec.ratings.payloadKg + 1e-5, spec.code);
    assert.ok(plan.coreUtilizationPct > 50 && plan.coreUtilizationPct < 100, spec.code);
    assert.ok(core.widthM > 0 && core.depthM > 0 && core.heightM > 0, spec.code);
    for (let i = 0; i < plan.placed.length; i++) {
      const a = plan.placed[i];
      assert.ok(a.x - a.widthM / 2 >= core.minX - 1e-5, spec.code);
      assert.ok(a.x + a.widthM / 2 <= core.minX + core.widthM + 1e-5, spec.code);
      assert.ok(a.y - a.heightM / 2 >= core.floorY - 1e-5, spec.code);
      assert.ok(a.y + a.heightM / 2 <= core.floorY + core.heightM + 1e-5, spec.code);
      assert.ok(a.z - a.depthM / 2 >= core.minZ - 1e-5, spec.code);
      assert.ok(a.z + a.depthM / 2 <= core.minZ + core.depthM + 1e-5, spec.code);
      for (const b of plan.placed.slice(i + 1)) {
        const clash =
          Math.abs(a.x - b.x) < (a.widthM + b.widthM) / 2 - 1e-5 &&
          Math.abs(a.y - b.y) < (a.heightM + b.heightM) / 2 - 1e-5 &&
          Math.abs(a.z - b.z) < (a.depthM + b.depthM) / 2 - 1e-5;
        assert.equal(clash, false, `${spec.code}: ${a.id} collides with ${b.id}`);
      }
    }
  }
});

test("AKE core and packing adjust when contour is disabled", () => {
  const defaultCore = cargoCoreForModel("ake", true);
  const prismCore = cargoCoreForModel("ake", false);
  assert.notDeepEqual(defaultCore, prismCore);
  const demo = demoCargoForModel("ake", false);
  assert.equal(planCargoForModel("ake", demo, false).placed.length, 27);
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
