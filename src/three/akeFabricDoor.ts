/**
 * Representative AKE flexible curtain door, not a manufacturer-specific
 * certified assembly. Real AKEs can use fabric/Xpress or solid door options.
 * The sheet is a contoured, double-sided, dynamically pleated mesh whose lower
 * edge rises in an accordion fold. It is never an aircraft restraint model.
 */
import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";
import { box, type V2 } from "./primitives";

const COLS = 26;
const ROWS = 34;
const TAU = Math.PI * 2;

function makeTextileMap(): THREE.Texture {
  return cachedTexture("ake:textile-weave:v1", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    const rnd = seededRandom(0xa1ce2026);
    ctx.fillStyle = "#c3c6c7";
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 4) {
      ctx.fillStyle = "rgba(48,56,62,0.10)";
      ctx.fillRect(0, y, 512, 1);
    }
    for (let x = 0; x < 512; x += 4) {
      ctx.fillStyle = "rgba(238,242,243,0.11)";
      ctx.fillRect(x, 0, 1, 512);
    }
    for (let i = 0; i < 1200; i++) {
      const x = rnd() * 512, y = rnd() * 512;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(40,46,53,0.05)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, y, 1 + rnd() * 3, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.name = "AKE representative coated textile";
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.1, 1.6);
    tex.anisotropy = 8;
    return tex;
  });
}

export interface FabricDoorOptions {
  profile: readonly V2[];
  openingBottom: number;
  openingTop: number;
  inset: number;
  frontZ: number;
  open: number;
  detailed: boolean;
}

export interface FabricDoor {
  group: THREE.Group;
  setOpen: (open: number) => void;
}

export function createAKEFabricDoor(o: FabricDoorOptions): FabricDoor {
  const group = new THREE.Group();
  group.name = "AKE fabric curtain - representative";
  const bottom = o.openingBottom;
  const top = o.openingTop;
  const spanY = top - bottom;
  const xLeft = o.profile[0].x + o.inset;
  const xRightAt = (y: number) => {
    const t = THREE.MathUtils.clamp((y - o.profile[1].y) /
      (o.profile[2].y - o.profile[1].y), 0, 1);
    return THREE.MathUtils.lerp(o.profile[1].x, o.profile[2].x, t) - o.inset;
  };
  const clothMaterial = new THREE.MeshStandardMaterial({
    color: "#d0d5d7", metalness: 0, roughness: 0.91,
    map: makeTextileMap(), side: THREE.DoubleSide,
  });
  const strapMaterial = new THREE.MeshStandardMaterial({
    color: "#29435b", metalness: 0, roughness: 0.83, side: THREE.DoubleSide,
  });
  const hemMaterial = new THREE.MeshStandardMaterial({
    color: "#818a92", metalness: 0, roughness: 0.75, side: THREE.DoubleSide,
  });
  const buckleMaterial = new THREE.MeshStandardMaterial({
    color: "#a2a9ad", metalness: 0.75, roughness: 0.36,
  });

  const positions = new Float32Array((ROWS + 1) * (COLS + 1) * 3);
  const uvs = new Float32Array((ROWS + 1) * (COLS + 1) * 2);
  const indices: number[] = [];
  for (let iy = 0; iy <= ROWS; iy++) {
    for (let ix = 0; ix <= COLS; ix++) {
      const i = iy * (COLS + 1) + ix;
      uvs[2 * i] = ix / COLS;
      uvs[2 * i + 1] = iy / ROWS;
      if (ix < COLS && iy < ROWS) {
        indices.push(i, i + 1, i + COLS + 1,
          i + 1, i + COLS + 2, i + COLS + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const cloth = new THREE.Mesh(geo, clothMaterial);
  cloth.name = "AKE tensioned coated textile curtain";
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  group.add(cloth);

  // A separate sewn lower hem rises with the cloth rather than remaining
  // suspended in the original opening.
  const hem = box(hemMaterial, o.profile[1].x - o.profile[0].x - 2 * o.inset,
    0.025, 0.006, "AKE fabric lower bound hem", 0.003);
  group.add(hem);

  const straps: { mesh: THREE.Mesh; u: number; width: number }[] = [];
  if (o.detailed) {
    for (const u of [0.25, 0.75]) {
      const strapGeo = new THREE.BufferGeometry();
      const coords = new Float32Array((ROWS + 1) * 2 * 3);
      const faces: number[] = [];
      for (let j = 0; j < ROWS; j++) {
        const a = j * 2;
        faces.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      strapGeo.setAttribute("position", new THREE.BufferAttribute(coords, 3).setUsage(THREE.DynamicDrawUsage));
      strapGeo.setIndex(faces);
      const mesh = new THREE.Mesh(strapGeo, strapMaterial);
      mesh.name = "AKE fabric tension strap";
      mesh.castShadow = true;
      group.add(mesh);
      straps.push({ mesh, u, width: 0.045 });
    }
  }

  const buckles: THREE.Mesh[] = [];
  if (o.detailed) {
    for (const u of [0.25, 0.75]) {
      const buckle = box(buckleMaterial, 0.067, 0.058, 0.012,
        "AKE fabric strap cam buckle - illustration", 0.01);
      group.add(buckle);
      buckle.userData.u = u;
      buckles.push(buckle);
    }
  }

  /** A geometry-preserving pleat; no random per-frame motion or cloth solver. */
  const foldedPoint = (u: number, v: number, open: number, out: THREE.Vector3) => {
    const originalY = bottom + v * spanY;
    const y = top - (1 - v) * spanY * (1 - open * 0.975);
    const left = xLeft;
    const right = xRightAt(originalY);
    const width = Math.max(0.1, right - left);
    const x = left + width * u;
    const sideEase = Math.sin(u * Math.PI);
    // Small longitudinal fabric creases, then deeper stacked folds at opening.
    const ripples = 0.006 * Math.sin(u * TAU * 3.2 + v * 1.8)
      + (0.006 + 0.055 * open) * Math.sin(v * TAU * 7);
    const z = o.frontZ + sideEase * ripples;
    return out.set(x, y, z);
  };
  const point = new THREE.Vector3();
  const setOpen = (progress: number) => {
    const open = THREE.MathUtils.clamp(progress, 0, 1);
    for (let iy = 0; iy <= ROWS; iy++) {
      const v = iy / ROWS;
      for (let ix = 0; ix <= COLS; ix++) {
        foldedPoint(ix / COLS, v, open, point);
        point.toArray(positions, 3 * (iy * (COLS + 1) + ix));
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();

    const closedWidth = xRightAt(bottom) - xLeft;
    const currentY = top - spanY * (1 - open * 0.975);
    hem.position.set(xLeft + closedWidth / 2, currentY, o.frontZ + 0.004);
    hem.scale.x = 1;
    for (const { mesh, u, width } of straps) {
      const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j <= ROWS; j++) {
        const v = j / ROWS;
        for (const [k, offset] of [-width / 2, width / 2].entries()) {
          foldedPoint(u, v, open, point);
          point.x += offset;
          point.z += 0.008;
          attr.setXYZ(j * 2 + k, point.x, point.y, point.z);
        }
      }
      attr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
      mesh.geometry.computeBoundingBox();
    }
    for (const b of buckles) {
      foldedPoint(b.userData.u as number, 0.24, open, point);
      b.position.copy(point).add(new THREE.Vector3(0, 0, 0.014));
    }
  };
  setOpen(o.open);
  return { group, setOpen };
}
