import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";

export type MechanicalSurface = "bearing" | "contact" | "casting";

/** Cosmetic contact traces on existing parts, not a measured wear model. */
export function makeMechanicalWear(kind: MechanicalSurface): THREE.Texture {
  return cachedTexture("mechanical-wear:"+kind,()=>{
    const c=document.createElement("canvas");c.width=256;c.height=kind==="casting"?256:128;
    const ctx=c.getContext("2d")!;
    const w=c.width,h=c.height;
    const rand=seededRandom(kind==="bearing"?0x1eaf:kind==="casting"?0xc451:0xc0a7);
    ctx.fillStyle="#f6f6f5";ctx.fillRect(0,0,w,h);
    if(kind==="bearing"){
      // Cylinder UV: horizontal traces wrap around the pin; narrow
      // axial end bands hint at contact with the adjacent knuckles.
      for(const y of [h*.14,h*.86]){
        const g=ctx.createLinearGradient(0,y-9,0,y+9);
        g.addColorStop(0,"rgba(57,61,65,0)");
        g.addColorStop(.48,"rgba(57,61,65,.19)");
        g.addColorStop(.62,"rgba(255,255,255,.7)");
        g.addColorStop(1,"rgba(57,61,65,0)");
        ctx.fillStyle=g;ctx.fillRect(0,y-9,w,18);
      }
      for(let i=0;i<140;i++){
        const x=rand()*w,y=(rand()<.5?.14:.86)*h+(rand()-.5)*13;
        ctx.fillStyle=rand()<.5?"rgba(52,56,59,.12)":"rgba(255,255,255,.34)";
        ctx.fillRect(x,y,3+rand()*28,.6);
      }
    }else if(kind==="casting"){
      // Local XZ projection: the bore radius is 38 mm in the existing
      // 180 mm fitting, placing the contact band at roughly 54 px.
      const centre=w/2, radius=w*.038/.18;
      const g=ctx.createRadialGradient(centre,centre,radius-5,centre,centre,radius+15);
      g.addColorStop(0,"rgba(75,78,79,.14)");
      g.addColorStop(.23,"rgba(255,255,255,.58)");
      g.addColorStop(.5,"rgba(90,92,91,.10)");
      g.addColorStop(1,"rgba(90,92,91,0)");
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<180;i++){
        const a=rand()*Math.PI*2,r=radius+rand()*13;
        const x=centre+Math.cos(a)*r,y=centre+Math.sin(a)*r;
        const len=2+rand()*6;
        ctx.strokeStyle=rand()<.55?"rgba(64,67,68,.17)":"rgba(255,255,255,.43)";
        ctx.lineWidth=.55+rand()*.6;
        ctx.beginPath();ctx.moveTo(x,y);
        ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();
      }
    }else{
      // Short crossing traces and edge polish, restricted to cam/keeper
      // and hub meshes rather than spreading dirt to the panel or rails.
      const g=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.5);
      g.addColorStop(0,"rgba(60,63,64,.10)");
      g.addColorStop(1,"rgba(60,63,64,0)");
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<170;i++){
        const x=w*(.2+rand()*.6),y=h*(.18+rand()*.64);
        const len=4+rand()*22,dy=(rand()-.5)*12;
        ctx.strokeStyle=rand()<.6?"rgba(69,69,65,.13)":"rgba(255,255,255,.37)";
        ctx.lineWidth=.65+rand()*.65;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len,y+dy);ctx.stroke();
      }
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
    return t;
  });
}

export function applyMechanicalWear(material: THREE.MeshStandardMaterial, service: boolean) {
  const kind=material.userData.mechanicalSurface as MechanicalSurface|undefined;
  if(kind!=="bearing"&&kind!=="contact"&&kind!=="casting")return;
  if(service&&!material.map){
    material.map=makeMechanicalWear(kind);material.needsUpdate=true;
  }else if(!service&&material.map){
    material.map.dispose();material.map=null;material.needsUpdate=true;
  }
}
