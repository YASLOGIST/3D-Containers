import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";

export type WearSurface = "strip" | "deck";

/** Art-directed surface modulation on existing handling parts only.
 * No physical wear depth, damage diagnosis, traction or load rating. */
export function makeFloorWear(surface: WearSurface): THREE.Texture {
  return cachedTexture("handling-wear:"+surface,()=>{
    const c=document.createElement("canvas");
    c.width=512;c.height=surface==="strip"?128:512;
    const ctx=c.getContext("2d")!;
    const w=c.width,h=c.height;
    const rand=seededRandom(surface==="strip"?0x64abf:0xa44e7);
    ctx.fillStyle="#f5f5f3";ctx.fillRect(0,0,w,h);
    // Soft, elongated handling haze rather than a repeated woodgrain.
    for(let i=0;i<28;i++){
      const x=rand()*w,y=rand()*h,r=8+rand()*42;
      ctx.save();ctx.translate(x,y);ctx.scale(1,surface==="strip" ? .35 : .65);
      const g=ctx.createRadialGradient(0,0,0,0,0,r);
      g.addColorStop(0,"rgba(66,68,67,.055)");
      g.addColorStop(1,"rgba(66,68,67,0)");
      ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
    }
    // Short slide marks, mostly parallel to handling direction. Different
    // orientations for the transverse strips and large pallet surface.
    for(let i=0;i<(surface==="strip"?420:820);i++){
      const x=rand()*w,y=rand()*h;
      const len=2+rand()*(surface==="strip"?38:64);
      const angle=(surface==="strip"?0:Math.PI/2)+(rand()-.5)*.23;
      ctx.strokeStyle=rand()<.55?"rgba(65,66,65,.12)":"rgba(255,255,255,.26)";
      ctx.lineWidth=.45+rand()*.8;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*len,y+Math.sin(angle)*len);ctx.stroke();
    }
    if(surface==="strip"){
      // A thin light abrasion band on each strip edge, not embossed grooves.
      ctx.fillStyle="rgba(255,255,255,.38)";
      ctx.fillRect(0,2,w,2);ctx.fillRect(0,h-4,w,2);
    }
    const t=new THREE.CanvasTexture(c);
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;
    return t;
  });
}

/** The viewer rebuilds on condition changes; also handle repeated application
 * and explicit reset without creating disposable texture clones repeatedly. */
export function applyFloorWear(material: THREE.MeshStandardMaterial, service: boolean) {
  const surface=material.userData.wearSurface as WearSurface|undefined;
  if(surface!=="strip"&&surface!=="deck")return;
  if(service&&!material.map){
    material.map=makeFloorWear(surface);
    material.needsUpdate=true;
  }else if(!service&&material.map){
    material.map.dispose();
    material.map=null;
    material.needsUpdate=true;
  }
}
