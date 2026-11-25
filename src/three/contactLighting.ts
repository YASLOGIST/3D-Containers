import * as THREE from "three";
import type { V2 } from "./primitives";

export const CONTACT_PADDING_M = 0.14;

/** Base footprint, not the wider upper fuselage contour. */
export function contactFootprint(profile: readonly V2[], depth: number) {
  const lowest = Math.min(...profile.map(p => p.y));
  const base = profile.filter(p => Math.abs(p.y-lowest)<1e-6);
  const left = Math.min(...base.map(p=>p.x)), right = Math.max(...base.map(p=>p.x));
  if (!Number.isFinite(left+right+depth) || right<=left || depth<=0) return null;
  return { centerX:(left+right)/2, width:right-left, depth };
}

/** Soft, rectangular grounding cue, not a light-space ray-traced shadow. */
export function makeContactTexture(size=128) {
  const bytes = new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=Math.abs((x+.5)/size*2-1),v=Math.abs((y+.5)/size*2-1);
    const edge=Math.max(u,v);
    const fade=1-THREE.MathUtils.smoothstep(edge,.68,.99);
    bytes[(y*size+x)*4+3]=Math.round(255*fade);
  }
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  texture.name="Illustrative soft contact shadow";
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

/** Inspection fill follows actual displayed opening; no light on pallets
 * or behind a closed rigid door. This is not a simulated installed lamp. */
export function inspectionFill(door: number, section: boolean, pallet: boolean, fabric: boolean) {
  if(pallet)return 0;
  if(section)return .65;
  return .65*THREE.MathUtils.smoothstep(door,fabric ? .04 : .18,.78);
}
