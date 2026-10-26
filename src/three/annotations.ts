/**
 * annotations.ts — model-aware CAD dimension furniture drawn around the
 * active ULD. Every value comes from the selected model registry entry; no
 * family-specific dimension is baked into the drawing layer.
 */
import * as THREE from "three";
import { IN_PER_M } from "@/lib/units";

const AMBER = new THREE.Color("#ffb020");
const INK = new THREE.Color("#e8ecef");
const STEEL = new THREE.Color("#79b8c9");

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
  // roundRect is Safari 16+; older engines fall back to square corners.
  if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, c.width, c.height, 8);
  else ctx.rect(0, 0, c.width, c.height);
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
  /** Y plane the witness lines terminate on; defaults to the floor */
  witnessY?: number;
}

function metric(value: number) {
  return value < 0.1
    ? `${(value * 1000).toFixed(0)} mm`
    : `${value.toFixed(2)} m`;
}

function dimension(
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  text: string,
  opts: DimOptions = {},
) {
  const lineMat = new THREE.LineBasicMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.9,
  });
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();

  group.add(
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat),
  );

  // Arrow geometry scales down for thin dimensions such as the 50 mm pallet.
  const arrowLength = Math.min(0.05, Math.max(0.012, len * 0.18));
  const arrowRadius = Math.min(0.012, Math.max(0.0035, len * 0.05));
  const coneGeo = new THREE.ConeGeometry(arrowRadius, arrowLength, 10);
  for (const [p, sign] of [
    [a, 1],
    [b, -1],
  ] as [THREE.Vector3, number][]) {
    const cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: AMBER,
        transparent: true,
        opacity: 0.95,
      }),
    );
    cone.position.copy(p).addScaledVector(dir, sign * arrowLength * 0.52);
    cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().multiplyScalar(sign),
    );
    cone.userData.isAnnotation = true;
    group.add(cone);
  }

  // Witness lines project the measured span back to an actual model plane.
  const witnessY = opts.witnessY ?? 0.002;
  const drop = new THREE.LineDashedMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.35,
    dashSize: 0.03,
    gapSize: 0.025,
  });
  for (const p of [a, b]) {
    const target = p.clone().setY(witnessY);
    if (Math.abs(p.y - witnessY) > 0.01) {
      const l = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p, target]),
        drop,
      );
      l.computeLineDistances();
      group.add(l);
    }
  }

  // Every dimension carries its imperial equivalent for ramp crews who
  // work in inches (the PMC is even certified as 96 × 125 in).
  const inches = `${(len * IN_PER_M).toFixed(1)} in`;
  const spr = labelSprite(
    text,
    opts.sub
      ? `${opts.sub} · ${inches.toUpperCase()}`
      : `${(len * 1000).toFixed(0)} mm · ${inches}`,
  );
  spr.position
    .copy(a)
    .addScaledVector(dir, len / 2)
    .add(opts.labelOffset ?? new THREE.Vector3(0, 0.1, 0));
  group.add(spr);
  return len;
}

export interface AnnotationOptions {
  code: string;
  baseWidth: number;
  baseLength: number;
  height: number;
  topWidth: number;
  x0: number;
  /** true only when the AKE's fuselage contour is active */
  contour: boolean;
  kind: "contoured" | "cuboid" | "pallet";
  contourHeight?: number;
}

export interface AnnotationData {
  group: THREE.Group;
  envelope: THREE.LineSegments;
}

/** Builds the drawing set for the currently selected ULD envelope. */
export function createAnnotations(o: AnnotationOptions): AnnotationData {
  const { baseWidth: BW, baseLength: BL, height: H, topWidth: TW, x0 } = o;
  const group = new THREE.Group();
  group.name = `${o.code} Dimensions`;

  const pad = 0.42;
  const rightX = x0 + Math.max(BW, TW);
  const contourH = o.contourHeight ?? 0;
  const envelopeH = o.kind === "pallet" ? H + contourH : H;
  const showContour = o.kind === "contoured" && o.contour && TW > BW + 1e-6;

  // Base width — in front of the container.
  dimension(
    group,
    new THREE.Vector3(x0, 0.004, BL / 2 + pad),
    new THREE.Vector3(x0 + BW, 0.004, BL / 2 + pad),
    metric(BW),
    { sub: "BASE WIDTH", labelOffset: new THREE.Vector3(0, 0.09, 0.02) },
  );

  // Base length — to the right of the widest part of the section.
  dimension(
    group,
    new THREE.Vector3(rightX + pad * 0.8, 0.004, -BL / 2),
    new THREE.Vector3(rightX + pad * 0.8, 0.004, BL / 2),
    metric(BL),
    { sub: "BASE LENGTH", labelOffset: new THREE.Vector3(0.06, 0.09, 0) },
  );

  // Vertical dimensions differ for a thin pallet and a full container.
  if (o.kind === "pallet") {
    dimension(
      group,
      new THREE.Vector3(x0 - pad, 0, BL / 2 + 0.12),
      new THREE.Vector3(x0 - pad, H, BL / 2 + 0.12),
      metric(H),
      { sub: "DECK THICKNESS", labelOffset: new THREE.Vector3(-0.22, 0.01, 0) },
    );
    if (contourH > 0) {
      dimension(
        group,
        new THREE.Vector3(x0 - pad, H, -BL / 2 - 0.1),
        new THREE.Vector3(x0 - pad, H + contourH, -BL / 2 - 0.1),
        metric(contourH),
        {
          sub: "NETTED CONTOUR",
          labelOffset: new THREE.Vector3(-0.24, 0, 0),
          witnessY: H,
        },
      );
    }
  } else {
    dimension(
      group,
      new THREE.Vector3(x0 - pad, 0, BL / 2 + 0.12),
      new THREE.Vector3(x0 - pad, H, BL / 2 + 0.12),
      metric(H),
      { sub: "OVERALL HEIGHT", labelOffset: new THREE.Vector3(-0.16, 0, 0) },
    );
  }

  if (showContour) {
    dimension(
      group,
      new THREE.Vector3(x0, H + 0.3, 0),
      new THREE.Vector3(x0 + TW, H + 0.3, 0),
      metric(TW),
      {
        sub: "UPPER CONTOUR",
        labelOffset: new THREE.Vector3(0, 0.1, 0),
        witnessY: H,
      },
    );

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

    const angle = THREE.MathUtils.radToDeg(Math.atan2(TW - BW, H));
    const taperLabel = labelSprite(
      `${angle.toFixed(1)}\u00B0`,
      "CONTOUR TAPER",
    );
    taperLabel.position.set(x0 + BW + 0.3, H * 0.52, BL / 2 + 0.16);
    group.add(taperLabel);
  } else if (o.kind === "cuboid") {
    const vertical = labelSprite("0.0\u00B0", "VERTICAL WALLS");
    vertical.position.set(x0 - pad - 0.18, H * 0.58, -BL / 2 - 0.08);
    group.add(vertical);
  }

  // Certified / nominal build envelope box.
  const box = new THREE.Box3(
    new THREE.Vector3(x0, 0, -BL / 2),
    new THREE.Vector3(rightX, envelopeH, BL / 2),
  );
  const envelope = new THREE.Box3Helper(box, STEEL);
  (envelope.material as THREE.LineBasicMaterial).transparent = true;
  (envelope.material as THREE.LineBasicMaterial).opacity = 0.35;
  envelope.name = `${o.code} Envelope`;
  group.add(envelope);

  const id = labelSprite(
    o.code,
    o.kind === "pallet" ? "PALLET ENVELOPE" : "ULD ENVELOPE",
  );
  id.position.set(rightX - 0.2, envelopeH + 0.14, -BL / 2 - 0.14);
  group.add(id);

  group.traverse((obj) => {
    obj.userData.isAnnotation = true;
    if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).castShadow = false;
  });

  return { group, envelope };
}
