/**
 * textures.ts — every map in this scene is generated at runtime on a 2D canvas.
 * No image assets are fetched: brushed-metal roughness/normal, ULD placards,
 * barcodes and the cargo-apron floor are all procedural.
 */
import * as THREE from "three";
import { cachedTexture, seededRandom } from "./textureSupport";

function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ */
/* Brushed metal                                                       */
/* ------------------------------------------------------------------ */

const brushedSources = new Map<
  string,
  { roughnessMap: THREE.Texture; normalMap: THREE.Texture }
>();

/**
 * Directional (anisotropic-looking) brushing: horizontal streaks are baked into
 * a height field, then Sobel-converted into a tangent-space normal map. The
 * expensive 1024² pair is rasterised once and cloned per material instance.
 */
export function makeBrushedMetal(size = 1024, strength = 1) {
  const key = `brushed:${size}:${strength}`;
  let pair = brushedSources.get(key);
  if (!pair) {
    const rand = seededRandom(0xa11ce ^ size ^ Math.round(strength * 1000));
    const { ctx } = canvas2d(size, size);

    // Fine rolling marks rather than thick, full-width grooves.
    // The height source is separate from the calibrated roughness map:
    // darker height values must not automatically become polished metal.
    ctx.fillStyle = "#b9b9b9";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 6; i++) {
      const y = rand() * size;
      const len = (3 + rand() * 90) * size / 1024;
      const x = rand() * size;
      const v = rand() < 0.5 ? 90 : 235;
      ctx.strokeStyle = "rgba("+v+","+v+","+v+","+(0.05+rand()*0.13)+")";
      ctx.lineWidth = 0.55 + rand()*0.75;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (rand() - 0.5)*0.6);
      ctx.stroke();
    }

    // --- derive a normal map from the same height field -----------------
    const src = ctx.getImageData(0, 0, size, size).data;
    const { c: nc, ctx: nctx } = canvas2d(size, size);
    const out = nctx.createImageData(size, size);
    const at = (x: number, y: number) =>
      src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 2.6 * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 5.5 * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
        out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        out.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
        out.data[i + 3] = 255;
      }
    }
    nctx.putImageData(out, 0, 0);

    const { c: rc, ctx: rctx } = canvas2d(size, size);
    // Map multiplier stays near one; the finish slider controls the
    // nominal roughness. Low-frequency rolling variation is restrained.
    rctx.fillStyle = "#ebebeb";
    rctx.fillRect(0, 0, size, size);
    for (let i=0; i<60; i++) {
      const x=rand()*size, y=rand()*size, radius=size*(0.035+rand()*0.16);
      const g=rctx.createRadialGradient(x,y,0,x,y,radius);
      g.addColorStop(0, rand()<.5?"rgba(155,155,155,.055)":"rgba(255,255,255,.05)");
      g.addColorStop(1,"rgba(235,235,235,0)");
      rctx.fillStyle=g; rctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    pair = { roughnessMap: toTexture(rc), normalMap: toTexture(nc) };
    brushedSources.set(key, pair);
  }

  const roughnessMap = pair.roughnessMap.clone();
  const normalMap = pair.normalMap.clone();
  roughnessMap.needsUpdate = true;
  normalMap.needsUpdate = true;
  return { roughnessMap, normalMap };
}

/* ------------------------------------------------------------------ */
/* Painted sheet / subtle orange-peel microfinish                      */
/* ------------------------------------------------------------------ */

const coatedSources = new Map<string, {
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
}>();

/**
 * Painted ULD panels are dielectric coatings, not bare metal.
 * The repeatable shallow grain gives a diffuse orange-peel response without
 * loading image assets or adding geometry. The 1024px source is cached.
 */
export function makeCoatedPanel(size = 1024) {
  const key = "coated:" + size;
  let pair = coatedSources.get(key);
  if (!pair) {
    const rand = seededRandom(0xc0a7ed ^ size);
    const { c, ctx } = canvas2d(size, size);
    ctx.fillStyle = "#d5d5d5";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < size * 6; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const dark = rand() < 0.5;
      ctx.fillStyle = dark
        ? "rgba(28,28,28,0.10)"
        : "rgba(255,255,255,0.13)";
      const d = 0.6 + rand() * 2;
      ctx.fillRect(x, y, d, d);
    }

    const src = ctx.getImageData(0, 0, size, size).data;
    const { c: nc, ctx: nctx } = canvas2d(size, size);
    const out = nctx.createImageData(size, size);
    const at = (x: number, y: number) =>
      src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 0.7;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 0.7;
        const mag = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        out.data[i] = ((-dx / mag) * 0.5 + 0.5) * 255;
        out.data[i + 1] = ((-dy / mag) * 0.5 + 0.5) * 255;
        out.data[i + 2] = (1 / mag) * 0.5 * 255 + 127;
        out.data[i + 3] = 255;
      }
    }
    nctx.putImageData(out, 0, 0);
    pair = { roughnessMap: toTexture(c), normalMap: toTexture(nc) };
    coatedSources.set(key, pair);
  }
  const roughnessMap = pair.roughnessMap.clone();
  const normalMap = pair.normalMap.clone();
  roughnessMap.needsUpdate = true;
  normalMap.needsUpdate = true;
  return { roughnessMap, normalMap };
}

/* ------------------------------------------------------------------ */
/* Controlled in-service panel patina                                  */
/* ------------------------------------------------------------------ */

/**
 * A very subdued albedo-modulation map: scuff marks and drag traces break up
 * unrealistic perfect uniformity. Because no real serial/usage history is
 * known, this is an optional ART DIRECTED appearance, not defect evidence.
 * Close inspection uses shallow surface geometry and the existing PBR normals.
 */
export function makeInServicePatina(size = 1024): THREE.Texture {
  return cachedTexture(`uld-patina:service:${size}`, () => {
    const rand = seededRandom(0x4f574e ^ size);
    const { c, ctx } = canvas2d(size, size);
    ctx.fillStyle = "#f8f8f7";
    ctx.fillRect(0, 0, size, size);

    // Sparse handling haze and oxidation-like tonal variation. These are
    // cosmetic procedural cues, not evidence of real corrosion or defects.
    for (let i=0;i<22;i++) {
      const x=rand()*size,y=rand()*size,r=size*(.025+rand()*.095);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,"rgba(99,104,109,.026)");
      g.addColorStop(1,"rgba(99,104,109,0)");
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
    }

    // Grouped contact marks rather than full-field isotropic random dirt.
    for (let cluster = 0; cluster < 32; cluster++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const radius = (10 + rand() * 32) * size / 1024;
      for (let dot = 0; dot < 28; dot++) {
        const dx = (rand() - 0.5) * radius * 2;
        const dy = (rand() - 0.5) * radius;
        const x = cx + dx;
        const y = cy + dy;
        const alpha = (0.02 + rand() * 0.045).toFixed(3);
        ctx.fillStyle = `rgba(42,46,48,${alpha})`;
        ctx.fillRect(x, y, 1.2 + rand() * 5, 0.6 + rand() * 2);
      }
    }

    // Horizontal brushed handling scratches: fine marks, never theatrical
    // broad black streaks. Bright hairlines suggest freshly abraded metal.
    for (let i = 0; i < 125; i++) {
      const x = rand() * size, y = rand() * size;
      const length = (4 + rand() * 92) * size / 1024;
      const light = rand() > 0.52;
      ctx.strokeStyle = light
        ? `rgba(255,255,255,${(0.15 + rand() * 0.32).toFixed(3)})`
        : `rgba(44,46,50,${(0.025 + rand() * 0.06).toFixed(3)})`;
      ctx.lineWidth = 0.5 + rand() * 0.75;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y + (rand() - 0.5) * 1.4);
      ctx.stroke();
    }
    const map = toTexture(c, true);
    map.repeat.set(1.65, 1.65);
    return map;
  });
}

/* ------------------------------------------------------------------ */
/* Stencils, plates and placards                                       */
/* ------------------------------------------------------------------ */

export interface PlacardOptions {
  width: number;
  height: number;
  id: string;
  carrier: string;
  serial: string;
  tareKg: number;
  maxGrossKg: number;
  volumeM3: number;
}

/** Representative identification plate. No certificate or scannable identity is implied. */
export function makeIdPlate(o: PlacardOptions) {
  const key = `id-plate:v3:${JSON.stringify(o)}`;
  return cachedTexture(key, () => {
    const rand=seededRandom(0x1d91a7e);
    const W=1536,H=Math.round(W*o.height/o.width);
    const {c,ctx}=canvas2d(W,H);
    ctx.scale(W/1024,H/540);
    const metal=ctx.createLinearGradient(0,0,0,540);
    metal.addColorStop(0,"#e1e5e7");metal.addColorStop(.48,"#c4cbd0");
    metal.addColorStop(1,"#a7b0b7");
    ctx.fillStyle=metal;ctx.fillRect(0,0,1024,540);
    for(let i=0;i<650;i++){
      const x=rand()*1024,y=rand()*540;
      ctx.strokeStyle=rand()<.55?"rgba(255,255,255,.12)":"rgba(40,50,56,.045)";
      ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(Math.min(1024,x+15+rand()*180),y);ctx.stroke();
    }
    ctx.strokeStyle="#66737b";ctx.lineWidth=2;ctx.strokeRect(12,12,1000,516);
    ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=1;ctx.strokeRect(15,15,994,510);
    // Painted representation of four fastener heads, not additional geometry.
    for(const [x,y] of [[29,29],[995,29],[29,511],[995,511]]){
      const g=ctx.createRadialGradient(x-3,y-3,1,x,y,10);
      g.addColorStop(0,"#ecf0f1");g.addColorStop(.65,"#859198");g.addColorStop(1,"#48535a");
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#515e64";ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();
    }
    ctx.textBaseline="top";
    const label=(t:string,x:number,y:number,w:number)=> {
      ctx.font='600 24px "IBM Plex Mono", monospace';ctx.fillStyle="#35434c";ctx.fillText(t,x,y,w);
    };
    const value=(t:string,x:number,y:number,w:number)=> {
      ctx.font='700 42px "IBM Plex Mono", monospace';ctx.fillStyle="#17232a";ctx.fillText(t,x,y,w);
    };
    label("YASLOGIST / ULD360",52,29,300);
    // Discreet project credit, separate from the owner and reference data.
    ctx.font='400 18px "IBM Plex Mono", monospace';ctx.fillStyle="#35434c";
    ctx.fillText("Ahmed Yasser Ali",370,33,330);
    ctx.fillStyle="#263640";ctx.fillRect(735,27,230,46);
    ctx.font='700 26px "IBM Plex Mono", monospace';ctx.fillStyle="#f1f5f6";
    ctx.fillText("DEMO PLATE",753,36,194);
    ctx.font='700 76px "Chakra Petch", sans-serif';ctx.fillStyle="#14232b";
    ctx.fillText(o.id,52,76,660);
    label("OWNER REF",755,89,205);value(o.carrier,755,115,205);
    ctx.strokeStyle="#738089";ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(52,169);ctx.lineTo(972,169);ctx.stroke();
    const kg=(n:number)=>`${n.toLocaleString("en-US")} kg`;
    const rows=[["TARE REF",kg(o.tareKg)],["GROSS REF",kg(o.maxGrossKg)],
      ["PAYLOAD REF",kg(o.maxGrossKg-o.tareKg)],["VOLUME REF",`${o.volumeM3.toFixed(1)} m³`]];
    rows.forEach(([k,v],i)=>{
      const x=52+(i%2)*470,y=185+Math.floor(i/2)*100;
      label(k,x,y,440);value(v,x,y+30,440);
    });
    ctx.strokeStyle="#738089";ctx.beginPath();ctx.moveTo(52,382);ctx.lineTo(972,382);ctx.stroke();
    label("DEMO SERIAL",52,393,300);
    ctx.font='700 31px "IBM Plex Mono", monospace';ctx.fillStyle="#17232a";
    ctx.fillText(o.serial,52,427,920);
    ctx.fillStyle="#34434b";ctx.fillRect(52,475,920,35);
    ctx.font='700 23px "IBM Plex Mono", monospace';ctx.fillStyle="#f4f6f7";
    ctx.fillText("REFERENCE ONLY / NOT FOR LOADING",67,480,890);
    const t=toTexture(c,true);
    t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    t.userData={referenceOnly:true,scannableIdentity:false,plateLayout:3,projectCredit:"Ahmed Yasser Ali"};
    return t;
  });
}

/** Large livery decal for the blind end: type code, contour diagram, handling marks. */
export interface LiveryOptions {
  code: string;
  type: string;
  tag: string;
  /** dimension note beneath the section diagram */
  profileLabel: string;
  /** geometry of the small section diagram */
  section: "contour" | "cuboid";
}

export function makeLivery(opts: LiveryOptions) {
  const key = `livery:${JSON.stringify(opts)}`;
  return cachedTexture(key, () => {
    const W = 1024;
    const H = 824;
    const { c, ctx } = canvas2d(W, H);
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "#f2f4f5";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 300px "Chakra Petch", sans-serif`;
    ctx.fillText(opts.code, 64, 330);

    ctx.fillStyle = "#ffb020";
    ctx.fillRect(66, 372, 300, 16);

    ctx.fillStyle = "#dfe4e7";
    ctx.font = `600 62px "Chakra Petch", sans-serif`;
    ctx.fillText(opts.type, 66, 462);

    ctx.fillStyle = "rgba(226,230,233,0.72)";
    ctx.font = `500 34px "IBM Plex Mono", monospace`;
    ctx.fillText(opts.tag, 66, 520);

    // profile diagram
    ctx.strokeStyle = "rgba(255,176,32,0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(700, 700);
    ctx.lineTo(940, 700);
    ctx.lineTo(940, 470);
    if (opts.section === "contour") {
      ctx.lineTo(790, 470);
    } else {
      ctx.lineTo(700, 470);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,176,32,0.14)";
    ctx.fill();
    ctx.fillStyle = "rgba(232,236,239,0.8)";
    ctx.font = `500 26px "IBM Plex Mono", monospace`;
    ctx.fillText(opts.profileLabel, 700, 738);

    // forklift arrows
    ctx.fillStyle = "rgba(232,236,239,0.5)";
    ctx.font = `600 40px "Chakra Petch", sans-serif`;
    ctx.fillText("\u25C0  FORK  POCKETS  \u25BC", 66, 640);

    return toTexture(c, true);
  });
}

/** Small handling stencil ("PULL", arrows, orientation marks). */
export function makeStencil(
  text: string,
  accent = "#ffb020",
  w = 512,
  h = 160,
) {
  const key = `stencil:${text}:${accent}:${w}:${h}`;
  return cachedTexture(key, () => {
    const { c, ctx } = canvas2d(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.floor(h * 0.46)}px "Chakra Petch", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 4);
    return toTexture(c, true);
  });
}

/** Rubber door-gasket / dark fitting material map: speckled matte black. */
export function makeSpeckle(size = 512) {
  const key = `speckle:${size}`;
  return cachedTexture(key, () => {
    const rand = seededRandom(0x5ec1e);
    const { c, ctx } = canvas2d(size, size);
    ctx.fillStyle = "#34383b";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 26000; i++) {
      const v = rand() * 60;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},${0.25 + rand() * 0.4})`;
      ctx.fillRect(rand() * size, rand() * size, 1.6, 1.6);
    }
    return toTexture(c, true);
  });
}

/* ------------------------------------------------------------------ */
/* Refrigeration (RKN) unit furniture                                  */
/* ------------------------------------------------------------------ */

export interface PanelTexture {
  /** full fascia: composite paint, bezel, keypad, LCD well */
  texture: THREE.CanvasTexture;
  /** transparent overlay holding only the glowing LCD digits */
  lcd: THREE.CanvasTexture;
  /** repaint the digital readout — the viewer calls this from the UI */
  setSetpoint(celsius: number): void;
  /** reflect controller power in the panel artwork */
  setActive(on: boolean): void;
  dispose(): void;
}

/**
 * Flat front control panel of a reefer unit: dark composite fascia, membrane
 * keypad, cold-chain badge, status LEDs and a backlit LCD readout that can be
 * repainted live via setSetpoint().
 */
export interface ReeferPanelOptions {
  code: string;
  designation: string;
  tempRange: string;
  minC: number;
  maxC: number;
  defaultC: number;
  serial: string;
}

/**
 * Model-specific climate-control fascia. The readout is marked SIMULATED: it
 * represents the UI set point, not measured return-air telemetry.
 */
export function makeReeferPanel(o: ReeferPanelOptions): PanelTexture {
  const W = 1024;
  const H = 512;
  const { c, ctx } = canvas2d(W, H); // fascia
  const { c: lc, ctx: lctx } = canvas2d(W, H); // glow overlay
  const noiseSeed = [...o.code].reduce(
    (n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0,
    0xc11a7e,
  );

  // LCD well, shared by both canvases so the overlay lands exactly on it
  const LX = 44;
  const LY = 44;
  const LW = 420;
  const LH = 150;

  let current = THREE.MathUtils.clamp(o.defaultC, o.minC, o.maxC);
  let active = true;

  /** Digits painted on the fascia and again as a glow layer. */
  const drawReadout = (t: CanvasRenderingContext2D) => {
    t.textAlign = "left";
    t.textBaseline = "top";
    t.fillStyle = active ? "rgba(150,240,215,0.75)" : "rgba(110,135,130,0.55)";
    t.font = "500 24px 'IBM Plex Mono', monospace";
    t.fillText("SET POINT", LX + 18, LY + 14);
    t.fillStyle = active ? "#7ff2d6" : "#58746d";
    t.font = "600 82px 'IBM Plex Mono', monospace";
    t.fillText(`${current.toFixed(1)}\u00B0C`, LX + 16, LY + 42);
    t.fillStyle = active ? "rgba(127,242,214,0.6)" : "rgba(100,125,120,0.45)";
    t.font = "500 22px 'IBM Plex Mono', monospace";
    t.fillText("MODE  SIMULATED", LX + 18, LY + 112);
  };

  const paintLcd = () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(LX - 6, LY - 6, LW + 12, LH + 12);
    ctx.clip();
    const lcd = ctx.createLinearGradient(0, LY, 0, LY + LH);
    lcd.addColorStop(0, "#0a1c1a");
    lcd.addColorStop(1, "#06120f");
    ctx.fillStyle = lcd;
    ctx.fillRect(LX, LY, LW, LH);
    ctx.strokeStyle = "#0d2422";
    ctx.lineWidth = 6;
    ctx.strokeRect(LX, LY, LW, LH);
    ctx.fillStyle = "rgba(120,255,220,0.06)";
    for (let y = LY + 2; y < LY + LH - 2; y += 4)
      ctx.fillRect(LX + 2, y, LW - 4, 1);
    drawReadout(ctx);
    ctx.restore();
  };

  const paintStaticFascia = () => {
    const rand = seededRandom(noiseSeed);
    // fascia: dark composite with a satin sheen
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#333b41");
    g.addColorStop(0.42, "#252c32");
    g.addColorStop(0.44, "#22282e");
    g.addColorStop(1, "#171c21");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // fine speckle — moulded plastic, not metal
    for (let i = 0; i < 9000; i++) {
      const v = rand() * 46;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 7},${0.12 + rand() * 0.3})`;
      ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
    }

    // brushed stainless bezel
    const bez = ctx.createLinearGradient(0, 0, 0, H);
    bez.addColorStop(0, "#cfd6dc");
    bez.addColorStop(0.5, "#98a1a9");
    bez.addColorStop(1, "#7d868e");
    ctx.strokeStyle = bez;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // membrane keypad
    const keys = ["SET", "▼", "▲", "MODE", "DEF", "ENT"];
    const kw = 72;
    const kh = 60;
    const kx = 44;
    const ky = 240;
    keys.forEach((k, i) => {
      const x = kx + i * (kw + 10);
      const kg = ctx.createLinearGradient(0, ky, 0, ky + kh);
      kg.addColorStop(0, "#3d464e");
      kg.addColorStop(1, "#232a30");
      ctx.fillStyle = kg;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(x, ky, kw, kh, 6);
      else ctx.rect(x, ky, kw, kh);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#cfd8de";
      ctx.font = "500 20px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(k, x + kw / 2, ky + kh / 2 + 1);
    });

    // status LEDs reflect controller power, not fictional sensor data
    const leds: [string, string, boolean][] = [
      ["PWR", "#6fbf8f", active],
      ["COOL", "#79b8c9", active],
      ["DEFR", "#ffb020", false],
      ["ALRM", "#e2513c", false],
    ];
    let ly2 = ky + kh + 26;
    leds.forEach(([label, color, on]) => {
      ctx.beginPath();
      ctx.arc(56, ly2, 9, 0, Math.PI * 2);
      ctx.fillStyle = on ? color : "#2b333a";
      ctx.fill();
      if (on) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(56, ly2, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = on ? "#dbe2e7" : "#6b757d";
      ctx.font = "500 20px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 78, ly2 + 1);
      ly2 += 30;
    });

    // right column: model identity and controller range
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(232,236,239,0.85)";
    ctx.font = "700 58px 'Chakra Petch', sans-serif";
    ctx.fillText(o.code, 620, 120);
    ctx.fillStyle = "#ffb020";
    ctx.fillRect(620, 136, 210, 8);
    ctx.fillStyle = "rgba(232,236,239,0.6)";
    ctx.font = "500 22px 'IBM Plex Mono', monospace";
    ctx.fillText(o.designation, 620, 176);
    ctx.fillText(o.tempRange, 620, 208);

    ctx.fillStyle = "rgba(232,236,239,0.5)";
    ctx.font = "500 20px 'IBM Plex Mono', monospace";
    ctx.fillText("GEOMETRY LAB", 620, 250);
    ctx.fillText("CONTROLLER SIM", 620, 278);
    ctx.fillText(`RANGE ${o.minC}\u00B0C … +${o.maxC}\u00B0C`, 620, 306);

    // recessed identification plate — deliberately unbranded
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(610, 336, 380, 132);
    ctx.fillStyle = "rgba(232,236,239,0.32)";
    ctx.font = "600 34px 'Chakra Petch', sans-serif";
    ctx.fillText("CLIMATE CONTROL", 632, 386);
    ctx.fillText("PROCEDURAL UNIT", 632, 424);
    ctx.fillStyle = "rgba(232,236,239,0.2)";
    ctx.font = "500 20px 'IBM Plex Mono', monospace";
    ctx.fillText(`SER  ${o.serial}`, 632, 452);

    paintLcd();
  };

  /** Glow overlay: transparent everywhere except the LCD well. */
  const paintOverlay = () => {
    lctx.clearRect(0, 0, W, H);
    if (!active) return;
    const bloom = lctx.createRadialGradient(
      LX + LW / 2,
      LY + LH / 2,
      6,
      LX + LW / 2,
      LY + LH / 2,
      LH * 0.9,
    );
    bloom.addColorStop(0, "rgba(120,255,220,0.30)");
    bloom.addColorStop(1, "rgba(120,255,220,0)");
    lctx.fillStyle = bloom;
    lctx.fillRect(LX, LY, LW, LH);
    lctx.shadowColor = "rgba(120,255,220,0.9)";
    lctx.shadowBlur = 18;
    drawReadout(lctx);
    lctx.shadowBlur = 0;
  };

  paintStaticFascia();
  paintOverlay();

  const texture = toTexture(c, true);
  const lcdTexture = toTexture(lc, true);
  texture.needsUpdate = true;
  lcdTexture.needsUpdate = true;

  return {
    texture,
    lcd: lcdTexture,
    setSetpoint(celsius: number) {
      const next = THREE.MathUtils.clamp(celsius, o.minC, o.maxC);
      if (Math.abs(next - current) < 0.05) return;
      current = next;
      paintLcd();
      paintOverlay();
      texture.needsUpdate = true;
      lcdTexture.needsUpdate = true;
    },
    setActive(on: boolean) {
      if (active === on) return;
      active = on;
      paintStaticFascia();
      paintOverlay();
      texture.needsUpdate = true;
      lcdTexture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      lcdTexture.dispose();
    },
  };
}

/** Condenser intake louvres for the reefer unit. */
export function makeCondenserGrille(size = 1024) {
  const key = `grille:${size}`;
  return cachedTexture(key, () => {
    const { c, ctx } = canvas2d(size, size / 2);
    const w = size;
    const h = size / 2;

    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, "#3a4249");
    body.addColorStop(1, "#20262c");
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, w, h);

    // horizontal louvre fins with shading
    const fin = 26;
    for (let y = 8; y < h - 8; y += fin) {
      ctx.fillStyle = "#14181c";
      ctx.fillRect(10, y, w - 20, fin * 0.42);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(10, y, w - 20, 3);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(10, y + fin * 0.42, w - 20, 4);
    }

    // amber service stripe + rivet line
    ctx.fillStyle = "rgba(255,176,32,0.85)";
    ctx.fillRect(0, 0, w, 7);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    for (let x = 26; x < w; x += 34) {
      ctx.beginPath();
      ctx.arc(x, h - 12, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    return toTexture(c, true);
  });
}

/* ------------------------------------------------------------------ */
/* RAP insulated panels + PMC pallet furniture                         */
/* ------------------------------------------------------------------ */

/**
 * Heavy-duty insulated sandwich panel for the large RAP reefer: a pale alloy
 * skin (so the selected finish still tints through), dense foam-core speckle,
 * and pressed seams on a 4 × 4 grid with a highlight along each joint.
 */
export function makeInsulatedPanel(size = 1024) {
  const key = `insulated-panel:${size}`;
  return cachedTexture(key, () => {
    const rand = seededRandom(0x1a7e5);
    const { c, ctx } = canvas2d(size, size);

    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#c9ced4");
    g.addColorStop(0.5, "#b7bdc4");
    g.addColorStop(1, "#a8b0b7");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // foam core — denser and warmer than bare brushed sheet
    for (let i = 0; i < 26000; i++) {
      const v = 90 + rand() * 90;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.08 + rand() * 0.3})`;
      ctx.fillRect(rand() * size, rand() * size, 1.6, 1.6);
    }

    // long brushing, as rolled sheet
    for (let i = 0; i < 320; i++) {
      const y = rand() * size;
      ctx.strokeStyle = `rgba(255,255,255,${rand() * 0.07})`;
      ctx.lineWidth = 1 + rand() * 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (rand() - 0.5) * 2.5);
      ctx.stroke();
    }

    // pressed panel seams on a 4 × 4 grid
    for (let i = 1; i < 4; i++) {
      const p = (size * i) / 4;
      ctx.strokeStyle = "rgba(18,24,30,0.5)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p + 3, 0);
      ctx.lineTo(p + 3, size);
      ctx.moveTo(0, p + 3);
      ctx.lineTo(size, p + 3);
      ctx.stroke();
    }

    // each panel bows very slightly (insulated skins are never dead flat)
    for (let ix = 0; ix < 4; ix++) {
      for (let iy = 0; iy < 4; iy++) {
        const cx = size * (ix + 0.5) * 0.25;
        const cy = size * (iy + 0.5) * 0.25;
        const r = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.2);
        r.addColorStop(0, "rgba(255,255,255,0.05)");
        r.addColorStop(1, "rgba(0,0,0,0.06)");
        ctx.fillStyle = r;
        ctx.fillRect(
          size * ix * 0.25,
          size * iy * 0.25,
          size * 0.25,
          size * 0.25,
        );
      }
    }

    return toTexture(c, true);
  });
}

/**
 * Continuous aircraft-style seat track: dark anodised rail with a repeating
 * stud-slot pattern. One canvas covers one metre of rail, so texture.repeat.x
 * gives a slot pitch of ~62 mm.
 */
export function makeSeatTrack(len = 2048) {
  const key = `seat-track:${len}`;
  return cachedTexture(key, () => {
    const w = len;
    const h = 128;
    const { c, ctx } = canvas2d(w, h);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#4d555d");
    g.addColorStop(0.3, "#353c43");
    g.addColorStop(0.75, "#232930");
    g.addColorStop(1, "#171c21");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, 0, w, 3);

    // 16 stud slots per metre
    const pitch = w / 16;
    for (let i = 0; i < 16; i++) {
      const x = i * pitch + pitch * 0.5;
      ctx.fillStyle = "#0b0e11";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function")
        ctx.roundRect(x - pitch * 0.26, h * 0.3, pitch * 0.52, h * 0.44, 3);
      else ctx.rect(x - pitch * 0.26, h * 0.3, pitch * 0.52, h * 0.44);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x - pitch * 0.26, h * 0.3, pitch * 0.52, 1.5);
    }

    // mounting rivets between the slots
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 16; i++) {
      const x = i * pitch + pitch * 0.5;
      ctx.beginPath();
      ctx.arc(x, h * 0.88, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    return toTexture(c, true);
  });
}

/**
 * Cargo-net / contour mesh for the PMC load outline: a transparent grid used
 * as both colour map and alpha map on the optional translucent load block.
 */
export function makeCargoNetTexture(cells = 18) {
  const key = `cargo-net:${cells}`;
  return cachedTexture(key, () => {
    const S = 512;
    const { c, ctx } = canvas2d(S, S);
    ctx.clearRect(0, 0, S, S);

    const step = S / cells;
    ctx.strokeStyle = "rgba(226,232,238,0.5)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= cells; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, S);
      ctx.moveTo(0, p);
      ctx.lineTo(S, p);
      ctx.stroke();
    }
    // heavier border threads
    ctx.strokeStyle = "rgba(255,176,32,0.55)";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, S, S);

    return toTexture(c, true);
  });
}

/* ------------------------------------------------------------------ */
/* Cargo apron floor                                                   */
/* ------------------------------------------------------------------ */

export function makeApronTexture(size = 1024) {
  const key = `apron:${size}`;
  return cachedTexture(key, () => {
    const rand = seededRandom(0xa9017);
    const { c, ctx } = canvas2d(size, size);
    ctx.fillStyle = "#777a79";
    ctx.fillRect(0, 0, size, size);

    // Fine aggregate and broad low-contrast trowel variation; world-scale
    // painted markings are handled separately so they never tile.
    for (let i=0;i<100;i++) {
      const x=rand()*size,y=rand()*size,r=size*(.025+rand()*.11);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,rand()<.5?"rgba(28,33,35,.075)":"rgba(213,216,207,.08)");
      g.addColorStop(1,"rgba(119,122,121,0)");
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<size*18;i++){
      const x=rand()*size,y=rand()*size,r=.45+rand()*1.7;
      ctx.fillStyle=rand()<.55?"rgba(32,38,39,.14)":"rgba(221,223,215,.16)";
      ctx.fillRect(x,y,r,r*.8);
    }
    // Thin inset expansion joints, scaled with the raster resolution.
    ctx.strokeStyle="rgba(36,40,41,.43)";ctx.lineWidth=Math.max(1,size/512);
    for(const n of [0,size/2,size]){
      ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,size);
      ctx.moveTo(0,n);ctx.lineTo(size,n);ctx.stroke();
    }

    return toTexture(c, true);
  });
}

/** Vertical gradient sky dome (equirect) used for background + reflections. */
export function makeSkyTexture(top: string, mid: string, bottom: string) {
  const key = `sky:${top}:${mid}:${bottom}`;
  return cachedTexture(key, () => {
    const W = 64;
    const H = 512;
    const { c, ctx } = canvas2d(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.48, mid);
    g.addColorStop(0.52, mid);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft overhead softbox so metals get a readable highlight
    const r = ctx.createRadialGradient(
      W * 0.5,
      H * 0.22,
      2,
      W * 0.5,
      H * 0.22,
      H * 0.3,
    );
    r.addColorStop(0, "rgba(255,255,255,0.85)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.needsUpdate = true;
    return t;
  });
}
