import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";

/** Low-contrast illustrative distant hangar panorama, not a real site or HDRI. */
export function makeHangarBackdrop(width=1024): THREE.Texture {
  return cachedTexture("hangar-backdrop:"+width,()=>{
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=width/2;
    const ctx=canvas.getContext("2d")!,w=canvas.width,h=canvas.height;
    const gradient=ctx.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,"#10171e");
    gradient.addColorStop(.24,"#17212a");
    gradient.addColorStop(.48,"#26323a");
    gradient.addColorStop(.53,"#252b2d");
    gradient.addColorStop(.68,"#15191c");
    gradient.addColorStop(1,"#0a1015");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    // Periodic architectural bays, with the same seam at both ends.
    const bay=w/8, wallTop=h*.31, sill=h*.515;
    for(let i=0;i<8;i++){
      const x=i*bay;
      ctx.fillStyle=i%2?"#252f37":"#222c34";
      ctx.fillRect(x,wallTop,bay,sill-wallTop);
      ctx.fillStyle="#151e25";ctx.fillRect(x,wallTop,bay*.035,sill-wallTop);
      ctx.fillStyle="#39434a";ctx.fillRect(x+bay*.035,wallTop,bay*.018,sill-wallTop);
      // Translucent clerestory panes, dark industrial mullions.
      const y=h*.425,wh=h*.033,wx=x+bay*.15,ww=bay*.70;
      ctx.fillStyle="#182229";ctx.fillRect(wx-2,y-2,ww+4,wh+4);
      const glass=ctx.createLinearGradient(0,y,0,y+wh);
      glass.addColorStop(0,"#52626c");glass.addColorStop(1,"#35454f");
      ctx.fillStyle=glass;ctx.fillRect(wx,y,ww,wh);
      ctx.fillStyle="#1c2932";
      for(let j=1;j<4;j++)ctx.fillRect(wx+ww*j/4,y,Math.max(1,w/1024),wh);
      // Closed sectional door in alternating bays.
      if(i%2===0){
        const dx=x+bay*.24,dy=h*.469,dw=bay*.52,dh=sill-dy;
        ctx.fillStyle="#1b242b";ctx.fillRect(dx-2,dy-2,dw+4,dh+2);
        ctx.fillStyle="#2d373e";ctx.fillRect(dx,dy,dw,dh);
        ctx.fillStyle="rgba(8,13,18,.28)";
        for(let j=1;j<7;j++)ctx.fillRect(dx,dy+j*dh/7,dw,1);
      }
      // Ceiling ribs recede toward the wall line.
      ctx.strokeStyle="rgba(8,13,19,.36)";ctx.lineWidth=Math.max(1,w/512);
      ctx.beginPath();ctx.moveTo(x,h*.10);ctx.lineTo(x+bay*.48,wallTop);ctx.stroke();
      const lx=x+bay*.52,ly=h*.205,r=bay*.18;
      const glow=ctx.createRadialGradient(lx,ly,0,lx,ly,r);
      glow.addColorStop(0,"rgba(194,213,222,.20)");
      glow.addColorStop(1,"rgba(194,213,222,0)");
      ctx.fillStyle=glow;ctx.fillRect(lx-r,ly-r,r*2,r*2);
      ctx.fillStyle="#89959b";ctx.fillRect(lx-bay*.11,ly,bay*.22,Math.max(1,h*.003));
    }
    ctx.fillStyle="#151d23";ctx.fillRect(0,sill,w,Math.max(1,h*.006));
    const t=new THREE.CanvasTexture(canvas);
    t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;
    return t;
  });
}

/** Single scene-space parking perimeter, independent of repeating concrete. */
export function makeParkingMark(size=512): THREE.Texture {
  return cachedTexture("single-parking-mark:"+size,()=>{
    const c=document.createElement("canvas");c.width=c.height=size;
    const ctx=c.getContext("2d")!,rand=seededRandom(0x2209a);
    const edge=size*.08,span=size-2*edge,thick=size*.009;
    ctx.strokeStyle="rgba(206,155,63,.72)";ctx.lineWidth=thick;
    ctx.setLineDash([size*.065,size*.035]);
    ctx.strokeRect(edge,edge,span,span);ctx.setLineDash([]);
    // Restrained chips affect the paint only, not the slab.
    for(let i=0;i<240;i++){
      const p=edge+rand()*span,offset=(rand()-.5)*thick;
      const side=i%4,x=side<2?p:edge+(side===3?span:0)+offset;
      const y=side>=2?p:edge+(side===1?span:0)+offset;
      ctx.clearRect(x,y,Math.max(1,rand()*thick),Math.max(1,rand()*thick*.6));
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;return t;
  });
}
