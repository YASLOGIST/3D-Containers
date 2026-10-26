import assert from "node:assert/strict";
import test from "node:test";

import { AKE_DIMENSIONS, contourProfile } from "../src/three/akeLD3.ts";
import { AKC_DIMENSIONS, akcProfile } from "../src/three/akc.ts";
import { DPE_DIMENSIONS, dpeProfile } from "../src/three/dpe.ts";
import { AKH_DIMENSIONS, akhProfile } from "../src/three/akh.ts";
import { ALF_DIMENSIONS, alfProfile } from "../src/three/alf.ts";
import { ALP_DIMENSIONS, alpProfile } from "../src/three/alp.ts";
import { AMA_DIMENSIONS, amaProfile } from "../src/three/ama.ts";
import { AMD_DIMENSIONS, amdProfile } from "../src/three/amd.ts";
import { AGA_DIMENSIONS, agaProfile } from "../src/three/aga.ts";
import { DQF_DIMENSIONS, dqfProfile } from "../src/three/dqf.ts";
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
    akc: {
      width: AKC_DIMENSIONS.baseWidth,
      depth: AKC_DIMENSIONS.baseLength,
      height: AKC_DIMENSIONS.height,
    },
    dpe: {
      width: DPE_DIMENSIONS.baseWidth,
      depth: DPE_DIMENSIONS.baseLength,
      height: DPE_DIMENSIONS.height,
    },
    dqf: {
      width: DQF_DIMENSIONS.baseWidth,
      depth: DQF_DIMENSIONS.baseLength,
      height: DQF_DIMENSIONS.height,
    },
    akh: {
      width: AKH_DIMENSIONS.baseWidth,
      depth: AKH_DIMENSIONS.baseLength,
      height: AKH_DIMENSIONS.height,
    },
    alf: {
      width: ALF_DIMENSIONS.baseWidth,
      depth: ALF_DIMENSIONS.baseLength,
      height: ALF_DIMENSIONS.height,
    },
    alp: {
      width: ALP_DIMENSIONS.baseWidth,
      depth: ALP_DIMENSIONS.baseLength,
      height: ALP_DIMENSIONS.height,
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
    ama: {
      width: AMA_DIMENSIONS.baseWidth,
      depth: AMA_DIMENSIONS.baseLength,
      height: AMA_DIMENSIONS.height,
    },
    amd: {
      width: AMD_DIMENSIONS.baseWidth,
      depth: AMD_DIMENSIONS.baseLength,
      height: AMD_DIMENSIONS.height,
    },
    aga: {
      width: AGA_DIMENSIONS.baseWidth,
      depth: AGA_DIMENSIONS.baseLength,
      height: AGA_DIMENSIONS.height,
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
    assert.ok(model.aircraft.length > 4, `${id} needs an aircraft-fit line`);
    const section = model.sectionProfile();
    assert.ok(section.length >= 4 && section.every(isFinitePoint), `${id} section preview profile`);
    assert.ok(area(section) > 0, `${id} section profile must be CCW`);
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

test("symmetric fleet sections (AKH/ALF/AMA) are CCW, mirrored and envelope-exact", () => {
  const cases = [
    { profile: akhProfile(), dims: AKH_DIMENSIONS, points: 6 },
    { profile: alfProfile(), dims: ALF_DIMENSIONS, points: 4 },
    { profile: alpProfile(), dims: ALP_DIMENSIONS, points: 4 },
    { profile: dqfProfile(), dims: DQF_DIMENSIONS, points: 4 },
    { profile: amaProfile(), dims: AMA_DIMENSIONS, points: 6 },
    { profile: agaProfile(), dims: AGA_DIMENSIONS, points: 6 },
  ];
  for (const { profile, dims, points } of cases) {
    assert.equal(profile.length, points);
    assert.ok(profile.every(isFinitePoint));
    assert.ok(area(profile) > 0, "CCW polygons must have positive signed area");

    // bilateral symmetry about x = 0: every vertex has a mirrored twin
    for (const p of profile) {
      assert.ok(
        profile.some((q) => Math.abs(q.x + p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9),
        `vertex (${p.x}, ${p.y}) needs a mirror twin`,
      );
    }

    // envelope extents match the certified dimensions
    const xs = profile.map((p) => p.x);
    const topXs = profile.filter((p) => Math.abs(p.y - dims.height) < 1e-9).map((p) => p.x);
    const baseXs = profile.filter((p) => Math.abs(p.y - 0.09) < 1e-9).map((p) => p.x);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - Math.max(dims.baseWidth, dims.topWidth)) < 1e-9);
    assert.ok(Math.abs(Math.max(...topXs) - Math.min(...topXs) - dims.topWidth) < 1e-9);
    assert.ok(Math.abs(Math.max(...baseXs) - Math.min(...baseXs) - dims.baseWidth) < 1e-9);
    assert.ok(Math.abs(Math.max(...profile.map((p) => p.y)) - dims.height) < 1e-9);

    // the shared offset kernel must stay finite and area-reducing on hexagons
    const inner = offsetPolygon(profile, 0.047);
    assert.ok(inner.every(isFinitePoint));
    assert.ok(Math.abs(area(inner)) < Math.abs(area(profile)));
    assert.ok(Math.abs(area(inner)) > 0);
  }
});

test("single-slope sections (AKC/LD1, DPE/LD2) are CCW right trapezoids on the certified envelope", () => {
  const cases = [
    { profile: akcProfile(), dims: AKC_DIMENSIONS },
    { profile: dpeProfile(), dims: DPE_DIMENSIONS },
  ];
  for (const { profile, dims } of cases) {
    assert.equal(profile.length, 4);
    assert.ok(profile.every(isFinitePoint));
    assert.ok(area(profile) > 0, "CCW polygons must have positive signed area");
    // AKE convention: vertical centreline wall on −X at −topWidth/2
    assert.ok(Math.abs(profile[0].x - -dims.topWidth / 2) < 1e-9);
    assert.ok(Math.abs(profile[3].x - profile[0].x) < 1e-9, "left wall must be vertical");
    assert.ok(Math.abs(profile[1].x - profile[0].x - dims.baseWidth) < 1e-9);
    assert.ok(Math.abs(profile[2].x - profile[0].x - dims.topWidth) < 1e-9);
    assert.ok(profile[2].x > profile[1].x, "contour leans out on +X only");
    assert.ok(Math.abs(profile[3].y - dims.height) < 1e-9);
    const inner = offsetPolygon(profile, 0.047);
    assert.ok(inner.every(isFinitePoint));
    assert.ok(Math.abs(area(inner)) < Math.abs(area(profile)));
    assert.ok(Math.abs(area(inner)) > 0);
  }
});

test("AMD contour-D section is a CCW asymmetric pentagon, tall on the centreline side", () => {
  const p = amdProfile();
  const d = AMD_DIMENSIONS;
  assert.equal(p.length, 5);
  assert.ok(p.every(isFinitePoint));
  assert.ok(area(p) > 0);
  assert.ok(Math.abs(p[2].x - d.baseWidth / 2) < 1e-9, "centreline wall at +baseWidth/2");
  assert.ok(Math.abs(p[2].y - d.height) < 1e-9, "centreline wall runs full height");
  assert.ok(Math.abs(p[3].x - d.roofBreakX) < 1e-9 && Math.abs(p[3].y - d.height) < 1e-9);
  assert.ok(Math.abs(p[4].x + d.baseWidth / 2) < 1e-9 && Math.abs(p[4].y - d.kneeHeight) < 1e-9);
  assert.ok(Math.abs(d.topWidth - (d.baseWidth / 2 - d.roofBreakX)) < 1e-9, "topWidth = roof flat");
  const inner = offsetPolygon(p, 0.047);
  assert.ok(inner.every(isFinitePoint) && Math.abs(area(inner)) < Math.abs(area(p)) && Math.abs(area(inner)) > 0);
});

test("hold-fit schematic data keeps every unit inside its fuselage circle", () => {
  const GAP = 0.05;
  for (const [id, model] of Object.entries(MODELS)) {
    const h = model.hold;
    const R = h.fuselageM / 2;
    const single = (mirror: boolean): [number, number][] => {
      const pts: [number, number][] = [[0, 0], [h.base, 0]];
      if (h.knee) pts.push([h.base, h.knee]);
      pts.push([h.top, h.height], [0, h.height]);
      return pts.map(([x, y]): [number, number] => [mirror ? -(GAP / 2 + x) : GAP / 2 + x, y]);
    };
    const twin = (cx: number): [number, number][] => {
      const pts: [number, number][] = [[-h.base / 2, 0], [h.base / 2, 0]];
      if (h.knee) pts.push([h.base / 2, h.knee]);
      pts.push([h.top / 2, h.height], [-h.top / 2, h.height]);
      if (h.knee) pts.push([-h.base / 2, h.knee]);
      return pts.map(([x, y]): [number, number] => [cx + x, y]);
    };
    const units =
      h.mode === "single"
        ? h.abreast === 2
          ? [single(true), single(false)]
          : [single(false)]
        : h.abreast === 2
          ? [twin(-(h.base / 2 + GAP / 2)), twin(h.base / 2 + GAP / 2)]
          : [twin(0)];
    assert.ok(h.floorDrop < R, `${id}: cargo floor must cut the fuselage circle`);
    for (const unit of units) {
      for (const [x, y] of unit) {
        assert.ok(y >= -1e-9, `${id}: section point below hold floor`);
        const d = Math.hypot(x, y - h.floorDrop);
        assert.ok(d <= R + 0.02, `${id}: point (${x.toFixed(2)}, ${y.toFixed(2)}) escapes Ø${h.fuselageM} fuselage (d=${d.toFixed(2)})`);
      }
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
