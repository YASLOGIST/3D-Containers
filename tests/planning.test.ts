import assert from "node:assert/strict";
import test from "node:test";

import { computePlan } from "../src/lib/planner.ts";
import { formatDistance, kgToLb, mToIn } from "../src/lib/units.ts";
import { MODELS } from "../src/three/models.ts";

const ake = MODELS.ake.ratings;

test("load planner reports a balanced in-limits load", () => {
  const plan = computePlan({ ...ake, cargoKg: 748, cargoM3: 2.15, divisor: 6000 });
  assert.equal(plan.status, "ok");
  assert.equal(plan.grossKg, ake.tareKg + 748);
  assert.ok(Math.abs(plan.payloadPct - 50) < 0.1);
  assert.ok(Math.abs(plan.volumePct - 50) < 0.1);
  assert.ok(plan.remainingKg > 0);
});

test("load planner flags overweight, over-volume and boundary loads", () => {
  const atLimit = computePlan({
    ...ake,
    cargoKg: ake.payloadKg,
    cargoM3: ake.volumeM3,
    divisor: 6000,
  });
  assert.equal(atLimit.status, "ok", "exactly at the limit is still legal");

  const heavy = computePlan({ ...ake, cargoKg: ake.payloadKg + 1, cargoM3: 1, divisor: 6000 });
  assert.equal(heavy.status, "overweight");
  assert.ok(heavy.remainingKg < 0);

  const bulky = computePlan({ ...ake, cargoKg: 10, cargoM3: ake.volumeM3 + 0.1, divisor: 6000 });
  assert.equal(bulky.status, "overvolume");

  const both = computePlan({
    ...ake,
    cargoKg: ake.payloadKg + 100,
    cargoM3: ake.volumeM3 + 1,
    divisor: 6000,
  });
  assert.equal(both.status, "both");

  const empty = computePlan({ ...ake, cargoKg: 0, cargoM3: 0, divisor: 6000 });
  assert.equal(empty.status, "empty");
  assert.equal(empty.densityKgM3, null);
});

test("volumetric weight follows the IATA divisor and drives chargeable weight", () => {
  // 1 m³ at divisor 6000 = 166.7 kg; light bulky freight pays volumetric.
  const light = computePlan({ ...ake, cargoKg: 50, cargoM3: 1, divisor: 6000 });
  assert.ok(Math.abs(light.volumetricKg - 1_000_000 / 6000) < 1e-6);
  assert.equal(light.chargeableKg, light.volumetricKg);
  assert.equal(light.limiting, "volume");

  const dense = computePlan({ ...ake, cargoKg: 1000, cargoM3: 1, divisor: 6000 });
  assert.equal(dense.chargeableKg, 1000);
  assert.equal(dense.limiting, "weight");

  const express = computePlan({ ...ake, cargoKg: 50, cargoM3: 1, divisor: 5000 });
  assert.ok(express.volumetricKg > light.volumetricKg);

  // Every registered family yields a finite plan at half load.
  for (const model of Object.values(MODELS)) {
    const p = computePlan({
      ...model.ratings,
      cargoKg: model.ratings.payloadKg / 2,
      cargoM3: model.ratings.volumeM3 / 2,
      divisor: 6000,
    });
    assert.ok(Number.isFinite(p.chargeableKg), model.id);
    assert.equal(p.status, "ok", model.id);
  }
});

test("distance formatting switches to millimetres below 100 mm", () => {
  assert.equal(formatDistance(1.524), "1.524 m · 60.00 in");
  assert.equal(formatDistance(0.05), "50 mm · 1.97 in");
  assert.ok(Math.abs(mToIn(1) - 39.3701) < 1e-9);
  assert.ok(Math.abs(kgToLb(100) - 220.462) < 1e-6);
});

test("gross rating remains binding if the stated payload is inconsistent", () => {
  const ratings = { tareKg: 100, maxGrossKg: 1000, payloadKg: 950, volumeM3: 5 };
  const atLimit = computePlan({ ...ratings, cargoKg: 900, cargoM3: 1, divisor: 6000 });
  assert.equal(atLimit.status, "ok");
  assert.equal(atLimit.payloadPct, 100);
  assert.equal(atLimit.remainingKg, 0);

  const over = computePlan({ ...ratings, cargoKg: 901, cargoM3: 1, divisor: 6000 });
  assert.equal(over.status, "overweight");
  assert.equal(over.remainingKg, -1);
  assert.equal(over.criticalDensityKgM3, 180);
});
