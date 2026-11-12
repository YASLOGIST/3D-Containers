import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { MODELS, type ModelId } from "../src/three/models.ts";
import type {
  FinishId,
  ViewerContainer,
  ViewerOptions,
} from "../src/three/primitives.ts";
import { makeBrushedMetal, makeInServicePatina } from "../src/three/textures.ts";

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
  akeDoor: "rigid",
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


test("AKE precision detailing is conditional, parented and envelope-safe", () => {
  const detailed = MODELS.ake.build({ ...options, detail: true, rivets: true });
  const simplified = MODELS.ake.build({ ...options, detail: false, rivets: false });
  const noFasteners = MODELS.ake.build({ ...options, detail: true, rivets: false });

  const names = (model: ViewerContainer) => {
    const found: string[] = [];
    model.group.traverse((o) => found.push(o.name));
    return found;
  };
  const fullNames = names(detailed);
  const lightNames = names(simplified);
  const withoutFasteners = names(noFasteners);

  assert.ok(fullNames.includes("AKE panel joint - raised seam"));
  assert.ok(fullNames.includes("AKE door pressed reinforcement channel"));
  assert.ok(fullNames.includes("AKE blind-end service cover"));
  assert.ok(fullNames.includes("Roller guide pad - aluminium retainer"));
  assert.ok(fullNames.includes("Roller guide pad - rubber contact insert"));
  assert.ok(fullNames.includes("AKE roller pad retaining fasteners"));
  assert.ok(fullNames.includes("AKE skin joint microfasteners"));
  const tiny = detailed.group.getObjectByName("AKE skin joint microfasteners")!;
  // Camera-only LOD leaves the original mesh visible for GLB export.
  assert.equal(tiny.layers.isEnabled(1), true);
  assert.equal(tiny.visible, true);
  assert.ok(fullNames.includes("AKE door captive screw heads"));
  assert.ok(!lightNames.includes("AKE panel joint - raised seam"));
  assert.ok(!withoutFasteners.includes("AKE skin joint microfasteners"));
  assert.ok(withoutFasteners.includes("AKE door pressed reinforcement channel"));
  assert.ok(detailed.stats.triangles > simplified.stats.triangles);

  const bb = bounds(detailed).box;
  // Precision details must not blow out the reference envelope.
  assert.ok(bb.min.x >= -1.02 && bb.max.x <= 1.02);
  assert.ok(bb.min.y >= -0.02 && bb.max.y <= 1.64);
  assert.ok(bb.min.z >= -0.80 && bb.max.z <= 0.80);

  const face = detailed.group.getObjectByName("AKE door pressed reinforcement channel");
  assert.ok(face);
  const before = face.getWorldPosition(new THREE.Vector3());
  detailed.setDoorOpen(0.5);
  detailed.group.updateMatrixWorld(true);
  const after = face.getWorldPosition(new THREE.Vector3());
  assert.ok(before.distanceTo(after) > 0.005, "detail must follow door rotation");

  detailed.dispose();
  simplified.dispose();
  noFasteners.dispose();
});

test("painted and bare-metal finishes have distinct physically meaningful maps", () => {
  const enamel = MODELS.ake.build({ ...options, finish: "airline" });
  const bare = MODELS.ake.build({ ...options, finish: "mill" });
  const painted = enamel.materials.shell;
  const metal = bare.materials.shell;

  assert.ok(painted.metalness <= 0.15, "paint is a dielectric, not polished aluminum");
  assert.ok(metal.metalness >= 0.95, "bare aluminum remains metallic");
  assert.ok(painted.roughness >= 0.35);
  assert.ok(metal.roughness >= 0.35);
  assert.notEqual(painted.normalMap?.image, metal.normalMap?.image);
  assert.notEqual(painted.roughnessMap?.image, metal.roughnessMap?.image);
  enamel.dispose();
  bare.dispose();
});


test("AKE flexible textile and metal closures preserve variants and valid motion", () => {
  const solid = MODELS.ake.build({ ...options, akeDoor: "rigid" });
  const soft = MODELS.ake.build({ ...options, akeDoor: "fabric" });
  const get = (m: ViewerContainer, name: string) => m.group.getObjectByName(name);
  const fabric = get(soft, "AKE tensioned coated textile curtain") as THREE.Mesh;
  const rigidLeaf = get(solid, "Door leaf") as THREE.Mesh;
  const hiddenLeaf = get(soft, "Door leaf") as THREE.Mesh;
  assert.ok(fabric);
  assert.ok(rigidLeaf);
  assert.equal(hiddenLeaf?.parent?.visible, false, "rigid door is hidden in fabric mode");
  assert.ok(soft.stats.triangles > 1000);
  const mesh = fabric.geometry as THREE.BufferGeometry;
  const arr = mesh.attributes.position as THREE.BufferAttribute;
  const yBefore = arr.getY(0);
  const zBefore = arr.getZ(0);
  soft.setDoorOpen(0.85);
  const yAfter = arr.getY(0);
  const zAfter = arr.getZ(0);
  assert.ok(yAfter > yBefore + 0.1, "fabric bottom edge lifts");
  assert.ok(Number.isFinite(zAfter));
  assert.ok(Math.abs(zAfter - zBefore) < 0.1);
  const world = bounds(soft).box;
  assert.ok(world.min.y > -0.04 && world.max.y < 1.65);
  assert.ok(world.min.z > -0.85 && world.max.z < 0.85);
  soft.setDoorOpen(1);
  assert.ok(Number.isFinite(mesh.boundingSphere?.radius));
  assert.equal(get(soft, "AKE fabric tension strap")?.visible, true);
  assert.equal(get(solid, "AKE tensioned coated textile curtain"), undefined);
  solid.dispose();
  soft.dispose();
});


test("service patina texture is cached by source, but clones remain independently disposable", () => {
  const first = makeInServicePatina(256);
  const second = makeInServicePatina(256);
  assert.notEqual(first, second);
  assert.equal(first.image, second.image);
  assert.ok(first.name.startsWith("uld-patina:service:"));
  assert.equal(first.colorSpace, THREE.SRGBColorSpace);
  first.dispose();
  second.dispose();
});
