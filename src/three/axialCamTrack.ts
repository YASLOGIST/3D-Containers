import * as THREE from "three";

/** Research-only rotary-to-linear cam. 60° rotation produces 30 mm stroke.
 * Opposite handedness mirrors the two existing latch spindles.
 * No force, friction, contact solver or anti-rotation guide is implied. */
export const CAM_TRAVEL = .030;
export const CAM_ANGLE = Math.PI/3;
export function camStroke(rotation:number, hand:1|-1) {
  const angle=Number.isFinite(rotation)?rotation*hand:0;
  return CAM_TRAVEL*Math.max(0,Math.min(1,angle/CAM_ANGLE));
}

/** Closed cylindrical wall with two real through-slots, not a texture.
 * Slot centres follow the axial follower path at each angular station.
 * Circumferential extensions let the follower clear the ends of its travel. */
export function axialCamSleeve(half:number, lower:number, upper:number, hand:1|-1) {
  const n=120, margin=Math.PI/12, clearance=.0045;
  const outer=.012,inner=.009;
  const theta=(i:number)=>-Math.PI/2+2*Math.PI*i/n;
  const rows=(i:number)=>{
    // Wrap the terminal angular station onto its starting station so the seam is identical.
    const stroke=camStroke(theta(i%n),hand);
    return [-half,lower+stroke-clearance,lower+stroke+clearance,
      upper-stroke-clearance,upper-stroke+clearance,half];
  };
  if(!(rows(0)[1]>-half&&rows(0)[4]<half&&lower+CAM_TRAVEL+clearance<upper-CAM_TRAVEL-clearance))
    throw new RangeError("Cam slot outside sleeve");
  const active=(i:number,j:number)=>{
    if(j!==1&&j!==3)return true;
    const angle=hand*theta((i+n)%n+.5);
    return angle < -margin || angle > CAM_ANGLE+margin;
  };
  const p:number[]=[];
  type V=[number,number,number];
  const v=(i:number,j:number,r:number):V=>{
    const t=theta(i%n);
    return [r*Math.cos(t),rows(i)[j],r*Math.sin(t)];
  };
  const quad=(a:V,b:V,c:V,d:V)=>p.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<n;i++)for(let j=0;j<5;j++){
    if(!active(i,j))continue;
    const a=v(i,j,outer),b=v(i+1,j,outer),c=v(i+1,j+1,outer),d=v(i,j+1,outer);
    const A=v(i,j,inner),B=v(i+1,j,inner),C=v(i+1,j+1,inner),D=v(i,j+1,inner);
    quad(a,d,c,b);quad(A,B,C,D);
    if(j===0||!active(i,j-1))quad(a,b,B,A);
    if(j===4||!active(i,j+1))quad(d,D,C,c);
    if(!active(i-1,j))quad(a,A,D,d);
    if(!active(i+1,j))quad(b,c,C,B);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
