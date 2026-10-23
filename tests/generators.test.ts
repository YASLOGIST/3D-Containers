import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { MODELS, type ModelId } from "../src/three/models.ts";
import type {
  FinishId,
  ViewerContainer,
  ViewerOptions,
} from "../src/three/primitives.ts";
import { makeBrushedMetal } from "../src/three/textures.ts";

type FakeCanvas = {
  width: number;
  height: number;
  getContext: (type: string) => CanvasRenderingContext2D;
};

const gradient = { addColorStop() {} };

function fakeContext(canvas: FakeCanvas): CanvasRenderingContext2D {
  return {
    canvas,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (text: string) => ({ width: text.length * 20 }) as TextMetrics,
    createImageData: (w: number, h: number) =>
      ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }) as ImageData,
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4).fill(128),
      }) as ImageData,
    putImageData() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    rect() {},
    roundRect() {},
    arc() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    fill() {},
    stroke() {},
    fillText() {},
    strokeText() {},
    save() {},
    restore() {},
    clip() {},
    setLineDash() {},
    translate() {},
    rotate() {},
    scale() {},
  } as unknown as CanvasRenderingContext2D;
}

const fakeDocument = {
  createElement(tag: string) {
    if (tag !== "canvas") throw new Error(`Unexpected element: ${tag}`);
    const canvas: FakeCanvas = {
      width: 1,
      height: 1,
      getContext: () => fakeContext(canvas),
    };
    return canvas;
  },
  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag);
  },
};

Object.defineProperty(globalThis, "document", {
  value: fakeDocument,
  configurable: true,
});

const options: ViewerOptions = {
  contour: true,
  finish: "mill" as FinishId,
  detail: true,
  rivets: true,
  doorOpen: 0,
  reefer: true,
  setpoint: -18,
  load: 0.35,
};

function bounds(container: ViewerContainer) {
  const box = new THREE.Box3().setFromObject(container.group);
  const size = box.getSize(new THREE.Vector3());
  return { box, size };
}

test("every registered generator builds finite, non-empty geometry", () => {
  for (const id of Object.keys(MODELS) as ModelId[]) {
    const model = MODELS[id];
    const container = model.build(options);
    const { box, size } = bounds(container);

    assert.equal(box.isEmpty(), false, `${id} produced an empty scene`);
    assert.equal(container.group.children.length > 0, true);
    assert.ok(
      container.assemblies.length >= 4,
      `${id} assembly registry is incomplete`,
    );
    assert.ok(container.stats.meshes > 0);
    assert.ok(container.stats.triangles > 0);
    assert.ok([size.x, size.y, size.z].every(Number.isFinite));
    const envelopeWidth = Math.max(model.dims.width, model.dims.topWidth);
    assert.ok(
      size.x <= envelopeWidth + 0.25,
      `${id} X ${size.x.toFixed(3)} exceeds ${envelopeWidth.toFixed(3)} m`,
    );
    assert.ok(
      size.z <= model.dims.depth + 0.25,
      `${id} Z ${size.z.toFixed(3)} exceeds ${model.dims.depth.toFixed(3)} m`,
    );
    if (!model.palletOption) {
      assert.ok(
        size.y <= model.dims.height + 0.15,
        `${id} Y ${size.y.toFixed(3)} exceeds ${model.dims.height.toFixed(3)} m`,
      );
    }

    container.setFinish("graphite" as FinishId);
    container.setDoorOpen(1);
    container.setLoad?.(0.8);
    assert.doesNotThrow(() => container.dispose());
  }
});

test("expensive brushed-metal artwork is rasterised once per key", () => {
  const start = performance.now();
  const first = makeBrushedMetal(256, 0.75);
  const firstRasterMs = performance.now() - start;

  const secondStart = performance.now();
  const second = makeBrushedMetal(256, 0.75);
  const secondCloneMs = performance.now() - secondStart;

  assert.notEqual(first.roughnessMap, second.roughnessMap);
  assert.equal(first.roughnessMap.image, second.roughnessMap.image);
  assert.ok(
    secondCloneMs < Math.max(firstRasterMs * 0.5, 0.25),
    `clone ${secondCloneMs.toFixed(2)}ms should beat raster ${firstRasterMs.toFixed(2)}ms`,
  );

  first.roughnessMap.dispose();
  first.normalMap.dispose();
  second.roughnessMap.dispose();
  second.normalMap.dispose();
});

test("rebuilding a generator yields stable triangle counts", () => {
  const first = MODELS.rap.build(options);
  const firstTriangles = first.stats.triangles;
  first.dispose();

  const second = MODELS.rap.build(options);
  assert.equal(second.stats.triangles, firstTriangles);
  second.dispose();
});
