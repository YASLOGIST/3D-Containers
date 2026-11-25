import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";
import { makeSpeckle } from "./textures";

const SIZE = 128;

/** Illustrative isotropic elastomer grain, not measured seal topography. */
export function makeGasketNormal(): THREE.Texture {
  return cachedTexture("gasket:normal:128", () => {
    const random = seededRandom(0x5ea1);
    const height = Float32Array.from({ length: SIZE * SIZE }, () => random());
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    const at = (x: number, y: number) =>
      height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * .28;
        const dy = (at(x, y + 1) - at(x, y - 1)) * .28;
        const length = Math.hypot(dx, dy, 1);
        const i = (y * SIZE + x) * 4;
        pixels[i] = Math.round(127.5 * (1 - dx / length));
        pixels[i + 1] = Math.round(127.5 * (1 - dy / length));
        pixels[i + 2] = Math.round(127.5 * (1 + 1 / length));
        pixels[i + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(pixels, SIZE, SIZE);
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12, 12);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  });
}

/** Created only for the existing gasket mesh; texture clones are model-owned. */
export function createDoorGasketMaterial(): THREE.MeshStandardMaterial {
  const map = makeSpeckle(512);
  map.repeat.set(4, 4);
  return new THREE.MeshStandardMaterial({
    name: "Door gasket elastomer",
    color: "#b8b9ba",
    metalness: 0,
    roughness: .88,
    map,
    normalMap: makeGasketNormal(),
    normalScale: new THREE.Vector2(.22, .22),
    envMapIntensity: .35,
    userData: { gasketSurface: true },
  });
}
