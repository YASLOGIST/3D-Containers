/**
 * textures.ts — every map in this scene is generated at runtime on a 2D canvas.
 * No image assets are fetched: brushed-metal roughness/normal, ULD placards,
 * barcodes and the cargo-apron floor are all procedural.
 */
import * as THREE from "three";

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
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ */
/* Brushed metal                                                       */
/* ------------------------------------------------------------------ */

/**
 * Directional (anisotropic-looking) brushing: horizontal streaks are baked into
 * a height field, then Sobel-converted into a tangent-space normal map.
 */
export function makeBrushedMetal(size = 1024, strength = 1) {
  const { c, ctx } = canvas2d(size, size);

  // base grey (mid roughness)
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(0, 0, size, size);

  // coarse grain
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * size;
    const len = 40 + Math.random() * size * 0.8;
    const x = Math.random() * size - len * 0.5;
    const v = 120 + Math.floor(Math.random() * 90);
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.05 + Math.random() * 0.14})`;
    ctx.lineWidth = Math.random() < 0.85 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.4);
    ctx.stroke();
  }

  // long sweeping passes
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * size;
    const v = Math.random() < 0.5 ? 60 : 190;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.05)`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }

  const roughness = toTexture(c);

  // --- derive a normal map from the same height field -------------------
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

  return { roughnessMap: roughness, normalMap: toTexture(nc) };
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
}

/** Data plate riveted beside the door: ULD id, weights, volume, barcode. */
export function makeIdPlate(o: PlacardOptions) {
  const W = 1024;
  const H = Math.round((W * o.height) / o.width);
  const { c, ctx } = canvas2d(W, H);
  const s = W / 1024;

  const plate = ctx.createLinearGradient(0, 0, 0, H);
  plate.addColorStop(0, "#cfd4d8");
  plate.addColorStop(0.5, "#aeb4ba");
  plate.addColorStop(1, "#9aa1a8");
  ctx.fillStyle = plate;
  ctx.fillRect(0, 0, W, H);

  // brushed streaks on the plate
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * H;
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, y);
    ctx.lineTo(Math.random() * W, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#4a5158";
  ctx.lineWidth = 3 * s;
  ctx.strokeRect(10 * s, 10 * s, W - 20 * s, H - 20 * s);

  // rivets
  ctx.fillStyle = "#6d757c";
  for (const [rx, ry] of [
    [30, 30],
    [W - 30, 30],
    [30, H - 30],
    [W - 30, H - 30],
  ]) {
    ctx.beginPath();
    ctx.arc(rx * s, ry * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1b1f23";
  ctx.textBaseline = "top";
  ctx.font = `700 ${74 * s}px "Chakra Petch", sans-serif`;
  ctx.fillText(o.id, 56 * s, 52 * s);
  ctx.font = `500 ${34 * s}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = "#333a40";
  ctx.fillText(o.carrier, 56 * s + ctx.measureText(o.id).width * 0 + 330 * s, 74 * s);

  const rows: [string, string][] = [
    ["TARE", "92 KG"],
    ["MAX GROSS", "1588 KG"],
    ["NET PAYLOAD", "1496 KG"],
    ["VOLUME", "4.3 M\u00B3"],
  ];
  ctx.font = `500 ${30 * s}px "IBM Plex Mono", monospace`;
  rows.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 56 * s + col * 470 * s;
    const y = 168 * s + row * 62 * s;
    ctx.fillStyle = "#5c646b";
    ctx.fillText(k, x, y);
    ctx.fillStyle = "#14181b";
    ctx.font = `600 ${34 * s}px "IBM Plex Mono", monospace`;
    ctx.fillText(v, x + 250 * s, y - 2 * s);
    ctx.font = `500 ${30 * s}px "IBM Plex Mono", monospace`;
  });

  drawBarcode(ctx, 56 * s, H - 132 * s, 560 * s, 86 * s, o.serial);
  ctx.fillStyle = "#22282c";
  ctx.font = `500 ${26 * s}px "IBM Plex Mono", monospace`;
  ctx.fillText(o.serial, 640 * s, H - 104 * s);
  ctx.fillText("IATA ULD / AS1811", 640 * s, H - 68 * s);

  return toTexture(c, true);
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
  ctx.fillStyle = "#e9ecee";
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = "#101315";
  let cx = x;
  while (cx < x + w - 4) {
    const bw = 1 + Math.floor(rnd() * 4) * 1.6;
    ctx.fillRect(cx, y, bw, h);
    cx += bw + 1 + rnd() * 4;
  }
}

/** Large livery decal for the blind end: type code, contour diagram, handling marks. */
export function makeLivery(opts: { code: string; type: string; tag: string }) {
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
  ctx.lineTo(790, 470);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,176,32,0.14)";
  ctx.fill();
  ctx.fillStyle = "rgba(232,236,239,0.8)";
  ctx.font = `500 26px "IBM Plex Mono", monospace`;
  ctx.fillText("1.53 / 2.01 M", 700, 738);

  // forklift arrows
  ctx.fillStyle = "rgba(232,236,239,0.5)";
  ctx.font = `600 40px "Chakra Petch", sans-serif`;
  ctx.fillText("\u25C0  FORK  POCKETS  \u25BC", 66, 640);

  return toTexture(c, true);
}

/** Small handling stencil ("PULL", arrows, orientation marks). */
export function makeStencil(text: string, accent = "#ffb020", w = 512, h = 160) {
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
}

/** Rubber door-gasket / dark fitting material map: speckled matte black. */
export function makeSpeckle(size = 512) {
  const { c, ctx } = canvas2d(size, size);
  ctx.fillStyle = "#191c1f";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26000; i++) {
    const v = Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},${0.25 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
  }
  return toTexture(c, true);
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
  dispose(): void;
}

/**
 * Flat front control panel of a reefer unit: dark composite fascia, membrane
 * keypad, cold-chain badge, status LEDs and a backlit LCD readout that can be
 * repainted live via setSetpoint().
 */
export function makeReeferPanel(): PanelTexture {
  const W = 1024;
  const H = 512;
  const { c, ctx } = canvas2d(W, H); // fascia
  const { c: lc, ctx: lctx } = canvas2d(W, H); // glow overlay

  // LCD well, shared by both canvases so the overlay lands exactly on it
  const LX = 44;
  const LY = 44;
  const LW = 420;
  const LH = 150;

  /** The digits themselves — painted on the fascia and again as a glow layer. */
  const drawReadout = (t: CanvasRenderingContext2D) => {
    t.textBaseline = "top";
    t.fillStyle = "rgba(150,240,215,0.75)";
    t.font = "500 24px 'IBM Plex Mono', monospace";
    t.fillText("SET POINT", LX + 18, LY + 14);
    t.fillStyle = "#7ff2d6";
    t.font = "600 82px 'IBM Plex Mono', monospace";
    t.fillText(`${current.toFixed(1)}\u00B0C`, LX + 16, LY + 42);
    t.fillStyle = "rgba(127,242,214,0.6)";
    t.font = "500 22px 'IBM Plex Mono', monospace";
    t.fillText("RETURN  -19.4\u00B0C", LX + 18, LY + 112);
  };

  const paintFascia = () => {
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
      const v = Math.random() * 46;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 7},${0.12 + Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }

    // brushed stainless bezel around the panel
    const bez = ctx.createLinearGradient(0, 0, 0, H);
    bez.addColorStop(0, "#cfd6dc");
    bez.addColorStop(0.5, "#98a1a9");
    bez.addColorStop(1, "#7d868e");
    ctx.strokeStyle = bez;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // ---- LCD readout -------------------------------------------------
    const lx = LX;
    const ly = LY;
    const lw = LW;
    const lh = LH;
    const lcd = ctx.createLinearGradient(0, ly, 0, ly + lh);
    lcd.addColorStop(0, "#0a1c1a");
    lcd.addColorStop(1, "#06120f");
    ctx.fillStyle = lcd;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = "#0d2422";
    ctx.lineWidth = 6;
    ctx.strokeRect(lx, ly, lw, lh);

    ctx.fillStyle = "rgba(120,255,220,0.06)";
    for (let y = ly + 2; y < ly + lh - 2; y += 4) ctx.fillRect(lx + 2, y, lw - 4, 1);
    drawReadout(ctx);

    // ---- membrane keypad ---------------------------------------------
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
      ctx.roundRect(x, ky, kw, kh, 6);
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

    // ---- status LEDs -------------------------------------------------
    const leds: [string, string, boolean][] = [
      ["PWR", "#6fbf8f", true],
      ["COOL", "#79b8c9", true],
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

    // ---- right column: cold-chain badge + rating ----------------------
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(232,236,239,0.85)";
    ctx.font = "700 58px 'Chakra Petch', sans-serif";
    ctx.fillText("RKN", 620, 120);
    ctx.fillStyle = "#ffb020";
    ctx.fillRect(620, 136, 210, 8);
    ctx.fillStyle = "rgba(232,236,239,0.6)";
    ctx.font = "500 22px 'IBM Plex Mono', monospace";
    ctx.fillText("LD-9 · REEFER", 620, 176);
    ctx.fillText("-25°C … +25°C", 620, 208);

    ctx.fillStyle = "rgba(232,236,239,0.5)";
    ctx.font = "500 20px 'IBM Plex Mono', monospace";
    ctx.fillText("CE / ATEX", 620, 250);
    ctx.fillText("POWER 400V 3Ø", 620, 278);
    ctx.fillText("MODEL CR-2.5", 620, 306);

    // recessed brand plate
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(610, 336, 380, 132);
    ctx.fillStyle = "rgba(232,236,239,0.32)";
    ctx.font = "600 34px 'Chakra Petch', sans-serif";
    ctx.fillText("THERMOKING", 632, 386);
    ctx.fillText("CARRIER TRANSICOLD", 632, 424);
    ctx.fillStyle = "rgba(232,236,239,0.2)";
    ctx.font = "500 20px 'IBM Plex Mono', monospace";
    ctx.fillText("SER  RKN-4127-07", 632, 452);
  };

  /** glow overlay: transparent everywhere except the LCD well */
  const paintOverlay = () => {
    lctx.clearRect(0, 0, W, H);
    // soft bloom behind the digits
    const bloom = lctx.createRadialGradient(LX + LW / 2, LY + LH / 2, 6, LX + LW / 2, LY + LH / 2, LH * 0.9);
    bloom.addColorStop(0, "rgba(120,255,220,0.30)");
    bloom.addColorStop(1, "rgba(120,255,220,0)");
    lctx.fillStyle = bloom;
    lctx.fillRect(LX, LY, LW, LH);
    lctx.shadowColor = "rgba(120,255,220,0.9)";
    lctx.shadowBlur = 18;
    drawReadout(lctx);
    lctx.shadowBlur = 0;
  };

  let current = -18;
  paintFascia();
  paintOverlay();

  const texture = toTexture(c, true);
  const lcdTexture = toTexture(lc, true);
  texture.needsUpdate = true;
  lcdTexture.needsUpdate = true;

  return {
    texture,
    lcd: lcdTexture,
    setSetpoint(celsius: number) {
      const next = THREE.MathUtils.clamp(celsius, -30, 30);
      if (Math.abs(next - current) < 0.05) return;
      current = next;
      paintFascia();
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
  const { c, ctx } = canvas2d(size, size);

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#c9ced4");
  g.addColorStop(0.5, "#b7bdc4");
  g.addColorStop(1, "#a8b0b7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // foam core — denser and warmer than bare brushed sheet
  for (let i = 0; i < 26000; i++) {
    const v = 90 + Math.random() * 90;
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.08 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
  }

  // long brushing, as rolled sheet
  for (let i = 0; i < 320; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
    ctx.lineWidth = 1 + Math.random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 2.5);
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
      ctx.fillRect(size * ix * 0.25, size * iy * 0.25, size * 0.25, size * 0.25);
    }
  }

  return toTexture(c, true);
}

/**
 * Continuous aircraft-style seat track: dark anodised rail with a repeating
 * stud-slot pattern. One canvas covers one metre of rail, so texture.repeat.x
 * gives a slot pitch of ~62 mm.
 */
export function makeSeatTrack(len = 2048) {
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
    ctx.roundRect(x - pitch * 0.26, h * 0.3, pitch * 0.52, h * 0.44, 3);
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
}

/**
 * Cargo-net / contour mesh for the PMC load outline: a transparent grid used
 * as both colour map and alpha map on the optional translucent load block.
 */
export function makeCargoNetTexture(cells = 18) {
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
}

/* ------------------------------------------------------------------ */
/* Cargo apron floor                                                   */
/* ------------------------------------------------------------------ */

export function makeApronTexture(size = 1024) {
  const { c, ctx } = canvas2d(size, size);
  ctx.fillStyle = "#181b1e";
  ctx.fillRect(0, 0, size, size);

  // concrete mottling
  for (let i = 0; i < 9000; i++) {
    const v = 20 + Math.random() * 44;
    ctx.fillStyle = `rgba(${v},${v + 3},${v + 6},${0.15 + Math.random() * 0.4})`;
    const r = 1 + Math.random() * 22;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // slab joints
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 5;
  for (const p of [0, size / 2]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // painted ULD parking box
  ctx.strokeStyle = "rgba(255,176,32,0.5)";
  ctx.lineWidth = 14;
  ctx.setLineDash([70, 46]);
  ctx.strokeRect(size * 0.12, size * 0.12, size * 0.76, size * 0.76);
  ctx.setLineDash([]);

  return toTexture(c, true);
}

/** Vertical gradient sky dome (equirect) used for background + reflections. */
export function makeSkyTexture(top: string, mid: string, bottom: string) {
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
  const r = ctx.createRadialGradient(W * 0.5, H * 0.22, 2, W * 0.5, H * 0.22, H * 0.3);
  r.addColorStop(0, "rgba(255,255,255,0.85)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.needsUpdate = true;
  return t;
}
