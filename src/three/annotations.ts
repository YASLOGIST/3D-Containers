/**
 * annotations.ts — CAD-style dimension furniture drawn around the container.
 * Every element is real 3-D geometry (lines, cones, sprites) so the drawing
 * tracks the orbit camera instead of being a flat 2-D overlay.
 */
import * as THREE from "three";

const AMBER = new THREE.Color("#ffb020");
const INK = new THREE.Color("#e8ecef");

function labelSprite(text: string, sub?: string) {
  const pad = 26;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const main = "600 46px 'IBM Plex Mono', monospace";
  const subFont = "500 26px 'IBM Plex Mono', monospace";
  ctx.font = main;
  const wMain = ctx.measureText(text).width;
  ctx.font = subFont;
  const wSub = sub ? ctx.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(wMain, wSub) + pad * 2);
  c.height = sub ? 108 : 74;

  ctx.fillStyle = "rgba(10,12,15,0.82)";
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,176,32,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = main;
  ctx.fillStyle = "#ffd479";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, sub ? 34 : c.height / 2);
  if (sub) {
    ctx.font = subFont;
    ctx.fillStyle = "rgba(232,236,239,0.72)";
    ctx.fillText(sub, pad, 76);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  const scale = 0.0011;
  spr.scale.set(c.width * scale, c.height * scale, 1);
  spr.renderOrder = 999;
  spr.userData.isAnnotation = true;
  return spr;
}

interface DimOptions {
  /** offset of the label from the line midpoint */
  labelOffset?: THREE.Vector3;
  sub?: string;
}

function dimension(
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  text: string,
  opts: DimOptions = {},
) {
  const lineMat = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9 });
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();

  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat));

  // arrow heads
  const coneGeo = new THREE.ConeGeometry(0.012, 0.05, 10);
  for (const [p, sign] of [
    [a, 1],
    [b, -1],
  ] as [THREE.Vector3, number][]) {
    const cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.95 }),
    );
    cone.position.copy(p).addScaledVector(dir, sign * 0.026);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().multiplyScalar(sign));
    cone.userData.isAnnotation = true;
    group.add(cone);
  }

  // witness lines back to the solid
  const drop = new THREE.LineDashedMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.35,
    dashSize: 0.03,
    gapSize: 0.025,
  });
  for (const p of [a, b]) {
    const target = p.clone().setY(0.002);
    if (Math.abs(p.y) > 0.01) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, target]), drop);
      l.computeLineDistances();
      group.add(l);
    }
  }

  const spr = labelSprite(text, opts.sub ?? `${(len * 1000).toFixed(0)} mm`);
  spr.position
    .copy(a)
    .addScaledVector(dir, len / 2)
    .add(opts.labelOffset ?? new THREE.Vector3(0, 0.1, 0));
  group.add(spr);
  return len;
}

export interface AnnotationData {
  group: THREE.Group;
  envelope: THREE.LineSegments;
}

/** Builds the full drawing set for the LD-3 envelope. */
export function createAnnotations(dims: {
  baseWidth: number;
  baseLength: number;
  height: number;
  topWidth: number;
  x0: number;
}): AnnotationData {
  const { baseWidth: BW, baseLength: BL, height: H, topWidth: TW, x0 } = dims;
  const group = new THREE.Group();
  group.name = "Dimensions";

  const pad = 0.42;

  // base width — front of the container
  dimension(
    group,
    new THREE.Vector3(x0, 0.004, BL / 2 + pad),
    new THREE.Vector3(x0 + BW, 0.004, BL / 2 + pad),
    "1.53 m",
    { sub: "BASE WIDTH", labelOffset: new THREE.Vector3(0, 0.09, 0.02) },
  );

  // base length — right of the container
  dimension(
    group,
    new THREE.Vector3(x0 + TW + pad * 0.8, 0.004, -BL / 2),
    new THREE.Vector3(x0 + TW + pad * 0.8, 0.004, BL / 2),
    "1.56 m",
    { sub: "BASE LENGTH", labelOffset: new THREE.Vector3(0.06, 0.09, 0) },
  );

  // overall height — left of the container
  dimension(
    group,
    new THREE.Vector3(x0 - pad, 0, BL / 2 + 0.12),
    new THREE.Vector3(x0 - pad, H, BL / 2 + 0.12),
    "1.62 m",
    { sub: "HEIGHT", labelOffset: new THREE.Vector3(-0.16, 0, 0) },
  );

  // upper contour — above the container
  dimension(
    group,
    new THREE.Vector3(x0, H + 0.3, 0),
    new THREE.Vector3(x0 + TW, H + 0.3, 0),
    "2.01 m",
    { sub: "UPPER CONTOUR", labelOffset: new THREE.Vector3(0, 0.1, 0) },
  );

  // taper witness line from the base corner to the top corner
  const taper = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0 + BW, 0.004, BL / 2 + 0.16),
      new THREE.Vector3(x0 + TW, H, BL / 2 + 0.16),
    ]),
    new THREE.LineDashedMaterial({
      color: INK,
      transparent: true,
      opacity: 0.3,
      dashSize: 0.05,
      gapSize: 0.04,
    }),
  );
  taper.computeLineDistances();
  group.add(taper);
  const taperLabel = labelSprite("16.5\u00B0", "CONTOUR TAPER");
  taperLabel.position.set(x0 + BW + 0.3, H * 0.52, BL / 2 + 0.16);
  group.add(taperLabel);

  // certified envelope box (dashed)
  const box = new THREE.Box3(
    new THREE.Vector3(x0, 0, -BL / 2),
    new THREE.Vector3(x0 + TW, H, BL / 2),
  );
  const envelope = new THREE.Box3Helper(box, new THREE.Color("#79b8c9"));
  (envelope.material as THREE.LineBasicMaterial).transparent = true;
  (envelope.material as THREE.LineBasicMaterial).opacity = 0.35;
  envelope.name = "Envelope";
  group.add(envelope);

  group.traverse((o) => {
    o.userData.isAnnotation = true;
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false;
  });

  return { group, envelope };
}
