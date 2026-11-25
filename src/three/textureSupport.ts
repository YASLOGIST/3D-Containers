import type * as THREE from "three";

/**
 * Deterministic random stream for procedural artwork. A stable seed keeps a
 * rebuilt model visually identical, which matters in a geometry inspection
 * tool where surface noise should not be mistaken for a geometry change.
 */
export function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bounded LRU of procedural source canvases. The byte budget estimates raw
 * RGBA backing storage, not GPU or total browser memory. Live clones retain
 * their own source references after eviction; never resize shared canvases.
 */
export const TEXTURE_SOURCE_BUDGET_BYTES = 48 * 1024 * 1024;
export const TEXTURE_SOURCE_MAX_ENTRIES = 64;
const sources = new Map<string, { texture: THREE.Texture; bytes: number }>();
let sourceBytes = 0;

function estimatedBytes(texture: THREE.Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  const bytes = width * height * 4;
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

export function cachedTexture(
  key: string,
  create: () => THREE.Texture,
): THREE.Texture {
  let entry = sources.get(key);
  if (entry) {
    sources.delete(key);
    sources.set(key, entry);
  } else {
    const texture = create();
    texture.name = `procedural-source:${key}`;
    entry = { texture, bytes: estimatedBytes(texture) };
    if (entry.bytes <= TEXTURE_SOURCE_BUDGET_BYTES) {
      while (sources.size >= TEXTURE_SOURCE_MAX_ENTRIES ||
             sourceBytes + entry.bytes > TEXTURE_SOURCE_BUDGET_BYTES) {
        const oldest = sources.entries().next().value;
        if (!oldest) break;
        const [oldKey, old] = oldest;
        sources.delete(oldKey);
        sourceBytes -= old.bytes;
        old.texture.dispose();
      }
      sources.set(key, entry);
      sourceBytes += entry.bytes;
    }
  }
  const clone = entry.texture.clone();
  clone.name = key;
  clone.needsUpdate = true;
  return clone;
}

export function textureSourceCount() {
  return sources.size;
}

export function textureSourceBytes() {
  return sourceBytes;
}
