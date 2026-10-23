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
 * Canvas sources are retained for the lifetime of the page and cloned for each
 * consumer. Clones own their GPU lifecycle and can be disposed by generators;
 * the source canvas never needs to be rasterised a second time.
 */
const sources = new Map<string, THREE.Texture>();

export function cachedTexture(
  key: string,
  create: () => THREE.Texture,
): THREE.Texture {
  let source = sources.get(key);
  if (!source) {
    source = create();
    source.name = `procedural-source:${key}`;
    sources.set(key, source);
  }
  const clone = source.clone();
  clone.name = key;
  clone.needsUpdate = true;
  return clone;
}

/** Number of unique procedural source canvases retained by the cache. */
export function textureSourceCount() {
  return sources.size;
}
