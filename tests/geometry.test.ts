import assert from "node:assert/strict";
import test from "node:test";

import { AKE_DIMENSIONS, contourProfile } from "../src/three/akeLD3.ts";
import { MODELS } from "../src/three/models.ts";
import { PMC_DIMENSIONS, pmcProfile } from "../src/three/pmc.ts";
import { offsetPolygon, type V2 } from "../src/three/primitives.ts";
import { RAP_DIMENSIONS, rapProfile } from "../src/three/rap.ts";
import { RKN_DIMENSIONS, rknProfile } from "../src/three/rkn.ts";
import { seededRandom } from "../src/three/textureSupport.ts";

const area = (pts: V2[]) =>
  pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

const isFinitePoint = (p: V2) => Number.isFinite(p.x) && Number.isFinite(p.y);

test("all generated cross-sections are finite, closed and counter-clockwise", () => {
  const profiles: V2[][] = [
    contourProfile(true),
    contourProfile(false),
    rknProfile(),
    rapProfile(),
    pmcProfile(),
  ];
  for (const profile of profiles) {
    assert.equal(profile.length, 4);
    assert.ok(profile.every(isFinitePoint));
    assert.ok(area(profile) > 0, "CCW polygons must have positive signed area");
  }
});

test("AKE contour changes only the upper width", () => {
  const contoured = contourProfile(true);
  const prismatic = contourProfile(false);
  assert.equal(contoured[2].x - contoured[0].x, AKE_DIMENSIONS.topWidth);
  assert.equal(prismatic[2].x - prismatic[0].x, AKE_DIMENSIONS.baseWidth);
  assert.equal(contoured[1].x - contoured[0].x, AKE_DIMENSIONS.baseWidth);
  assert.equal(contoured[3].y - contoured[0].y, AKE_DIMENSIONS.height - 0.09);
});

test("polygon inward offset is finite, non-inverting and area-reducing", () => {
  const original = contourProfile(true);
  const identity = offsetPolygon(original, 0);
  identity.forEach((p, i) => {
    assert.ok(Math.abs(p.x - original[i].x) < 1e-9);
    assert.ok(Math.abs(p.y - original[i].y) < 1e-9);
  });

  const inner = offsetPolygon(original, 0.032);
  assert.ok(inner.every(isFinitePoint));
  assert.ok(Math.abs(area(inner)) < Math.abs(area(original)));
  assert.ok(Math.abs(area(inner)) > 0);
});

test("model registry exposes consistent dimensions, ratings and controls", () => {
  const expected: Record<
    string,
    { width: number; depth: number; height: number }
  > = {
    ake: {
      width: AKE_DIMENSIONS.baseWidth,
      depth: AKE_DIMENSIONS.baseLength,
      height: AKE_DIMENSIONS.height,
    },
    rkn: {
      width: RKN_DIMENSIONS.width,
      depth: RKN_DIMENSIONS.depth,
      height: RKN_DIMENSIONS.height,
    },
    rap: {
      width: RAP_DIMENSIONS.width,
      depth: RAP_DIMENSIONS.depth,
      height: RAP_DIMENSIONS.height,
    },
    pmc: {
      width: PMC_DIMENSIONS.width,
      depth: PMC_DIMENSIONS.depth,
      height: PMC_DIMENSIONS.thickness,
    },
  };

  for (const [id, model] of Object.entries(MODELS)) {
    assert.deepEqual(
      {
        width: model.dims.width,
        depth: model.dims.depth,
        height: model.dims.height,
      },
      expected[id],
    );
    assert.equal(model.sourceFile.endsWith(".ts"), true);
    assert.ok(model.featureLabel.length > 4);
    assert.equal(
      model.ratings.payloadKg,
      model.ratings.maxGrossKg - model.ratings.tareKg,
    );
    assert.equal(!!model.setpointRange, model.reeferOption);
    if (model.setpointRange) {
      assert.ok(model.setpointRange.min < model.setpointRange.max);
      assert.ok(model.setpointRange.default >= model.setpointRange.min);
      assert.ok(model.setpointRange.default <= model.setpointRange.max);
    }
  }
});

test("seeded procedural noise is repeatable", () => {
  const a = seededRandom(0x5eed);
  const b = seededRandom(0x5eed);
  const av = Array.from({ length: 16 }, () => a());
  const bv = Array.from({ length: 16 }, () => b());
  assert.deepEqual(av, bv);
  assert.ok(av.every((v) => v >= 0 && v < 1));
});
