/** Procedural illustrative kraft cartons. One atlas and one instanced mesh. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { seededRandom } from "./textureSupport";

const TILE = 256;
const ATLAS = TILE * 2;
type Face = "side" | "top" | "front" | "bottom";
const FACES: Face[] = ["side", "top", "front", "bottom"];

/** Shared albedo only: same texel budget as the old 1024×256 atlas. */
export function makeCartonAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ATLAS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas 2D context unavailable");
  for (const [index, face] of FACES.entries()) {
    const rand = seededRandom(0xcafec0de + index * 131);
    ctx.save();
    ctx.translate((index % 2) * TILE, Math.floor(index / 2) * TILE);
    ctx.beginPath(); ctx.rect(0, 0, TILE, TILE); ctx.clip();

    const paper = ctx.createLinearGradient(0, 0, TILE, TILE);
    paper.addColorStop(0, "#d5b487");
    paper.addColorStop(0.52, "#bc935e");
    paper.addColorStop(1, "#c8a16e");
    ctx.fillStyle = paper; ctx.fillRect(0, 0, TILE, TILE);
    // Random short cellulose fibres, not a periodic woodgrain pattern.
    for (let i = 0; i < 3200; i++) {
      const x = rand()*TILE, y = rand()*TILE;
      ctx.fillStyle = rand() < 0.53 ? "rgba(66,39,19,.085)" : "rgba(255,242,210,.12)";
      ctx.fillRect(x, y, 0.4+rand()*4, 0.4+rand()*0.8);
    }
    // Faint score lines and compressed edge fibres.
    for (const edge of [0, TILE-12]) {
      const g=ctx.createLinearGradient(edge, 0, edge+12, 0);
      g.addColorStop(0, edge===0?"rgba(57,33,14,.24)":"rgba(57,33,14,0)");
      g.addColorStop(1, edge===0?"rgba(57,33,14,0)":"rgba(57,33,14,.24)");
      ctx.fillStyle=g; ctx.fillRect(edge,0,12,TILE);
    }
    ctx.fillStyle="rgba(71,43,22,.16)"; ctx.fillRect(0,TILE-5,TILE,5);
    ctx.fillStyle="rgba(252,222,177,.19)"; ctx.fillRect(0,3,TILE,2);
    if (face === "top" || face === "bottom") {
      // Regular slotted-carton closure: two major flaps meet at a single
      // centre seam; reinforced tape runs along the joint, not a fake cross.
      ctx.fillStyle="rgba(54,29,13,.6)";ctx.fillRect(0,127,TILE,2);
      ctx.strokeStyle="rgba(75,47,24,.3)";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(4,TILE);
      ctx.moveTo(TILE-4,0);ctx.lineTo(TILE-4,TILE);ctx.stroke();
      const tape=ctx.createLinearGradient(0,109,0,147);
      tape.addColorStop(0,"#aa844f");tape.addColorStop(.08,"#c3a16a");
      tape.addColorStop(.5,"#d8bb85");tape.addColorStop(.92,"#bea06c");
      tape.addColorStop(1,"#997546");
      ctx.fillStyle=tape;ctx.fillRect(0,109,TILE,38);
      for(let i=0;i<120;i++){
        ctx.fillStyle="rgba(100,75,43,.11)";ctx.fillRect(rand()*TILE,113+rand()*30,2+rand()*6,.7);
      }
      ctx.fillStyle="rgba(255,235,191,.25)";ctx.fillRect(0,111,TILE,1);
      if(face==="bottom"){
        for(let i=0;i<30;i++){
          ctx.fillStyle="rgba(67,48,29,.08)";ctx.fillRect(rand()*TILE,rand()*TILE,12+rand()*24,1.5);
        }
      }
    } else {
      // Subtle paper join and a short tape return over the top seam.
      ctx.fillStyle="rgba(72,42,20,.15)";ctx.fillRect(6,0,2,TILE);
      ctx.fillStyle="rgba(221,191,142,.68)";ctx.fillRect(109,0,38,24);
      if (face==="front") {
        ctx.save();ctx.translate(25,104);ctx.rotate(-0.018);
        ctx.fillStyle="rgba(56,35,16,.2)";ctx.fillRect(2,3,188,112);
        ctx.fillStyle="#e9e4d7";ctx.fillRect(0,0,188,112);
        ctx.strokeStyle="#bdb5a4";ctx.lineWidth=1;ctx.strokeRect(1,1,186,110);
        ctx.fillStyle="#34424a";ctx.font="700 20px system-ui, sans-serif";ctx.fillText("YASLOGIST",10,25);
        ctx.font="11px monospace";ctx.fillText("ULD360 / SAMPLE",10,41);
        ctx.fillStyle="#6b665a";ctx.fillText("ILLUSTRATIVE LABEL",10,55);
        ctx.fillStyle="#41454a";
        // Decorative barcode-like lines only, deliberately not an identifier.
        let x=12;
        for(let i=0;i<35;i++){const w=i%5===0?3:1.2;ctx.fillRect(x,65,w,26);x+=w+2.7;}
        ctx.font="9px monospace";ctx.fillText("DEMO - NOT SCANNABLE",10,104);
        ctx.restore();
      } else {
        ctx.strokeStyle="rgba(53,43,31,.52)";ctx.lineWidth=1.5;
        ctx.strokeRect(24,166,47,38);
        ctx.beginPath();ctx.moveTo(34,191);ctx.lineTo(60,191);ctx.moveTo(34,180);ctx.lineTo(60,180);ctx.stroke();
        ctx.fillStyle="rgba(54,47,36,.62)";ctx.font="12px monospace";ctx.fillText("YL / SAMPLE",81,188);
      }
    }
    ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.name="Carton kraft / paper tape / sample label atlas";
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

/** A shallow rounded 1-unit envelope: 108 triangles, still one material/draw.
 * Rounded edges are inside the nominal AABB used by the cargo planner. */
export function makeCartonGeometry(): RoundedBoxGeometry {
  const geo=new RoundedBoxGeometry(1,1,1,1,0.012);
  const uv=geo.getAttribute("uv") as THREE.BufferAttribute;
  const perFace=uv.count/6;
  const faceTiles=[0,0,1,3,2,0];
  for(let i=0;i<uv.count;i++){
    const tile=faceTiles[Math.floor(i/perFace)];
    const u=Math.min(1,Math.max(0,uv.getX(i)));
    const v=Math.min(1,Math.max(0,uv.getY(i)));
    // Canvas origin is top-left, texture V origin bottom-left.
    uv.setXY(i,((tile%2)*TILE+3+u*(TILE-6))/ATLAS,
      ((1-Math.floor(tile/2))*TILE+3+v*(TILE-6))/ATLAS);
  }
  uv.needsUpdate=true;
  geo.clearGroups();
  geo.computeBoundingBox();
  return geo;
}
