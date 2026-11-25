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
  return cachedTexture("ake:textile-weave:v2", () => {
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
    // Bound edges and stitch rows are part of the material UVs, so they
    // remain attached to the existing deforming surface.
    const binding = 8;
    ctx.fillStyle = "#9da6aa";
    ctx.fillRect(0, 0, binding, 512);
    ctx.fillRect(512 - binding, 0, binding, 512);
    ctx.fillRect(0, 0, 512, binding);
    ctx.fillRect(0, 512 - binding, 512, binding);
    for (const edge of [3, 508]) {
      for (let i = 10; i < 502; i += 5) {
        ctx.fillStyle = "rgba(34,44,48,.45)";
        ctx.fillRect(edge, i, 1, 3);
        ctx.fillRect(i, edge, 3, 1);
        ctx.fillStyle = "rgba(235,239,237,.48)";
        ctx.fillRect(edge + 1, i, 1, 2);
        ctx.fillRect(i, edge + 1, 2, 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.name = "AKE representative coated textile";
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
  });
}

/** Procedural woven webbing; illustrative rather than a measured OEM textile. */
function makeWebbingMap(): THREE.Texture {
  return cachedTexture("ake:webbing:v1", () => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 512;
    const ctx = c.getContext("2d")!;
    const rand = seededRandom(0x57a9);
    ctx.fillStyle = "#cbd0d2";
    ctx.fillRect(0, 0, 64, 512);
    for (let x = 0; x < 64; x += 3) {
      ctx.fillStyle = x % 2 ? "rgba(25,35,43,.20)" : "rgba(255,255,255,.25)";
      ctx.fillRect(x, 0, 1, 512);
    }
    for (let y = 0; y < 512; y += 3) {
      ctx.fillStyle = "rgba(30,40,48,.15)";
      ctx.fillRect(0, y, 64, 1);
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = "rgba(255,255,255,.13)";
      ctx.fillRect(rand() * 64, rand() * 512, 1, 2);
    }
    ctx.fillStyle = "rgba(22,30,38,.30)";
    ctx.fillRect(0, 0, 3, 512); ctx.fillRect(61, 0, 3, 512);
    for (let y = 4; y < 508; y += 8) {
      ctx.fillStyle = "rgba(244,248,250,.65)";
      ctx.fillRect(5, y, 1, 5); ctx.fillRect(58, y, 1, 5);
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    return texture;
  });
}

/**
 * Representative two-slot webbing fitting. The original 67 x 58 x 12 mm
 * envelope and existing attachment pose are retained. Slots reveal the
 * strap behind the fitting; this is not a threaded restraint or cam solver.
 */
export function makeWebbingBuckleGeometry(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  function chamferedRectangle(path: THREE.Path, width: number, height: number,
    cy: number, chamfer: number) {
    const x = width / 2, y = height / 2;
    path.moveTo(-x + chamfer, cy - y);
    path.lineTo(x - chamfer, cy - y);
    path.lineTo(x, cy - y + chamfer);
    path.lineTo(x, cy + y - chamfer);
    path.lineTo(x - chamfer, cy + y);
    path.lineTo(-x + chamfer, cy + y);
    path.lineTo(-x, cy + y - chamfer);
    path.lineTo(-x, cy - y + chamfer);
    path.closePath();
  }
  chamferedRectangle(outline, .065, .056, 0, .004);
  for (const y of [-.013, .013]) {
    const slot = new THREE.Path();
    chamferedRectangle(slot, .049, .014, y, .002);
    outline.holes.push(slot);
  }
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: .010, steps: 1, bevelEnabled: true, bevelThickness: .001,
    bevelSize: .001, bevelSegments: 1, curveSegments: 1,
  });
  geometry.translate(0, 0, -.005);
  geometry.computeBoundingBox();
  return geometry;
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
    color: "#39556b", metalness: 0, roughness: 0.83, side: THREE.DoubleSide,
    map: o.detailed ? makeWebbingMap() : null,
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
      // UVs use the undeformed material coordinates. Door motion only
      // updates positions and normals, preserving the woven pattern.
      const strapUV = new Float32Array((ROWS + 1) * 4);
      for (let j = 0; j <= ROWS; j++) {
        strapUV.set([0, j / ROWS, 1, j / ROWS], j * 4);
      }
      strapGeo.setAttribute("uv", new THREE.BufferAttribute(strapUV, 2));
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
    const fittingGeometry = makeWebbingBuckleGeometry();
    for (const u of [0.25, 0.75]) {
      const buckle = new THREE.Mesh(fittingGeometry, buckleMaterial);
      buckle.name = "AKE fabric strap buckle - representative two-slot fitting";
      buckle.castShadow = true;
      buckle.receiveShadow = true;
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
