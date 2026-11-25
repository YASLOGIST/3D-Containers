/**
 * Illustrative base hardware geometry. Not a reconstruction of an OEM
 * aircraft restraint interface. All lengths are nominal model metres.
 */
import * as THREE from "three";

export type BaseAperture = { x: number; z: number; radius: number };

/** Closed, bevelled horizontal plate with actual through-apertures.
 * Shape Y maps to negative world Z. Local Y is centred on the plate.
 */
export function makeAKEBasePlate(
  width: number, depth: number, height: number, corner: number,
  apertures: readonly BaseAperture[] = [], clippedCorners = false,
): THREE.BufferGeometry {
  const bevel = .002;
  const x = width / 2 - bevel, z = depth / 2 - bevel;
  const c = corner - bevel;
  const outline = new THREE.Shape();
  outline.moveTo(-x+c,-z);
  outline.lineTo(x-c,-z);
  if (clippedCorners) outline.lineTo(x,-z+c);
  else outline.quadraticCurveTo(x,-z,x,-z+c);
  outline.lineTo(x,z-c);
  if (clippedCorners) outline.lineTo(x-c,z);
  else outline.quadraticCurveTo(x,z,x-c,z);
  outline.lineTo(-x+c,z);
  if (clippedCorners) outline.lineTo(-x,z-c);
  else outline.quadraticCurveTo(-x,z,-x,z-c);
  outline.lineTo(-x,-z+c);
  if (clippedCorners) outline.lineTo(-x+c,-z);
  else outline.quadraticCurveTo(-x,-z,-x+c,-z);
  outline.closePath();
  for (const a of apertures) {
    const hole = new THREE.Path();
    hole.absarc(a.x,-a.z,a.radius,0,2*Math.PI,true);
    outline.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(outline,{
    depth:height-2*bevel,bevelEnabled:true,bevelThickness:bevel,
    bevelSize:bevel,bevelSegments:1,curveSegments:12,steps:1,
  });
  geo.translate(0,0,-(height-2*bevel)/2);
  geo.rotateX(-Math.PI/2);
  geo.computeBoundingBox();
  return geo;
}

export function akeBaseApertureCentres(width: number, depth: number): BaseAperture[] {
  const result: BaseAperture[]=[];
  for(const x of [-width/2+.1,width/2-.1])
    for(const z of [-depth/2+.1,depth/2-.1])
      result.push({x,z,radius:.048});
  return result;
}
