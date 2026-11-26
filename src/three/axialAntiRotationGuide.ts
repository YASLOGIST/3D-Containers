import * as THREE from "three";

/** Illustrative U-guide section: open toward the rotating sleeve, with a
 * continuous back and two side walls. The channel constrains the follower
 * tangentially while leaving an axial sliding path. Mount design is separate. */
export const AXIAL_GUIDE = Object.freeze({
  innerX:.0135, backX:.0195, outerX:.0225,
  halfGap:.0018, halfWidth:.004,
  length:.038, followerRadius:.001, followerLength:.010,
  followerCenterX:.012,
});
export function axialAntiRotationGuideGeometry() {
  const d=AXIAL_GUIDE, section=new THREE.Shape();
  section.moveTo(d.innerX,-d.halfWidth);
  section.lineTo(d.outerX,-d.halfWidth);
  section.lineTo(d.outerX,d.halfWidth);
  section.lineTo(d.innerX,d.halfWidth);
  section.lineTo(d.innerX,d.halfGap);
  section.lineTo(d.backX,d.halfGap);
  section.lineTo(d.backX,-d.halfGap);
  section.lineTo(d.innerX,-d.halfGap);
  section.closePath();
  const g=new THREE.ExtrudeGeometry(section,{depth:d.length,bevelEnabled:false,steps:1});
  g.rotateX(-Math.PI/2);
  g.translate(0,-d.length/2,0);
  g.computeBoundingBox();
  return g;
}
