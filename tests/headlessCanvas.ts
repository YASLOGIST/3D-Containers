// Minimal deterministic canvas shim for procedural model QA only.
// Browser and GPU rendering tests still run separately.
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
