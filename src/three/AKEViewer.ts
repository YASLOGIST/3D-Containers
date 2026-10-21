/**
 * AKEViewer.ts — the runtime wrapper around the generator: renderer, lighting
 * rigs, orbit controls, exploded-view animation, hover picking, dimension
 * furniture and the mesh exporters.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

import type { Assembly, ViewerContainer } from "./primitives";
import type { FinishId } from "./primitives";
import { MODELS, reeferOf, type ModelId } from "./models";
import { createAnnotations } from "./annotations";
import { makeApronTexture, makeSkyTexture } from "./textures";

export type MoodId = "hangar" | "dusk" | "studio";

export interface ViewerState {
  /** which container family to generate */
  model: ModelId;
  finish: FinishId;
  contour: boolean;
  detail: boolean;
  rivets: boolean;
  door: number;
  explode: number;
  metalness: number;
  roughness: number;
  envIntensity: number;
  wireframe: boolean;
  dimensions: boolean;
  autoRotate: boolean;
  mood: MoodId;
  /** RKN only: power the refrigeration unit */
  reefer: boolean;
  /** RKN only: controller set point, °C */
  setpoint: number;
  /** PMC only: cargo-load contour above the base, 0..1 */
  load: number;
}

export const DEFAULT_STATE: ViewerState = {
  model: "ake",
  finish: "mill",
  contour: true,
  detail: true,
  rivets: true,
  door: 0,
  explode: 0,
  metalness: 1,
  roughness: 0.33,
  envIntensity: 1,
  wireframe: false,
  dimensions: true,
  autoRotate: true,
  mood: "hangar",
  reefer: true,
  setpoint: -18,
  load: 0.35,
};

interface Mood {
  sky: [string, string, string];
  bgIntensity: number;
  exposure: number;
  fog: string;
  floor: string;
  key: { color: string; intensity: number; pos: [number, number, number] };
  fill: { color: string; intensity: number };
  rim: { color: string; intensity: number };
  hemi: number;
  envFromSky: boolean;
}

const MOODS: Record<MoodId, Mood> = {
  hangar: {
    sky: ["#0e141b", "#1a222b", "#080a0d"],
    bgIntensity: 1.0,
    exposure: 1.05,
    fog: "#0b0e12",
    floor: "#2c3238",
    key: { color: "#ffffff", intensity: 3.1, pos: [4.2, 6.4, 3.2] },
    fill: { color: "#9fc4dd", intensity: 0.75 },
    rim: { color: "#ffb020", intensity: 2.4 },
    hemi: 0.45,
    envFromSky: false,
  },
  dusk: {
    sky: ["#1a1512", "#33241a", "#0a0806"],
    bgIntensity: 1.1,
    exposure: 1.18,
    fog: "#120d0a",
    floor: "#241d18",
    key: { color: "#ffd6a8", intensity: 1.5, pos: [-5, 3.4, 2.4] },
    fill: { color: "#5d7f96", intensity: 0.5 },
    rim: { color: "#ff8c2e", intensity: 3.4 },
    hemi: 0.28,
    envFromSky: true,
  },
  studio: {
    sky: ["#e6ebef", "#c3cbd2", "#8f979e"],
    bgIntensity: 1.0,
    exposure: 0.94,
    fog: "#aeb6bd",
    floor: "#9aa1a7",
    key: { color: "#ffffff", intensity: 2.4, pos: [3.4, 6.8, 4.2] },
    fill: { color: "#ffffff", intensity: 1.1 },
    rim: { color: "#ffd9a0", intensity: 1.2 },
    hemi: 0.7,
    envFromSky: false,
  },
};

export interface HoverInfo {
  part: string;
  assembly: string;
  assemblyId: string;
}

export interface PerfInfo {
  fps: number;
  triangles: number;
  calls: number;
}

export class AKEViewer {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private pmrem: THREE.PMREMGenerator;
  private roomEnv: THREE.Texture | null = null;
  private skyEnvs = new Map<MoodId, THREE.Texture>();
  private skyBgs = new Map<MoodId, THREE.Texture>();

  private key!: THREE.DirectionalLight;
  private fill!: THREE.DirectionalLight;
  private rim!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private interior!: THREE.PointLight;
  private floor!: THREE.Mesh;
  private floorMat!: THREE.MeshStandardMaterial;

  private modelRoot = new THREE.Group();
  private container: ViewerContainer | null = null;
  private annot: ReturnType<typeof createAnnotations> | null = null;
  private highlightBox: THREE.LineSegments;
  private highlightTag: THREE.Sprite | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-2, -2);
  private pointerActive = false;
  private hovered: HoverInfo | null = null;
  private highlighted: string | null = null;
  private highlightKey = "";

  private state: ViewerState;
  private raf = 0;
  private clock = new THREE.Clock();
  private frames = 0;
  private acc = 0;
  private elapsed = 0;
  private intro = 0;
  private disposed = false;
  private ro: ResizeObserver;

  constructor(
    host: HTMLElement,
    state: ViewerState,
    private cb: {
      onHover?: (h: HoverInfo | null) => void;
      onPerf?: (p: PerfInfo) => void;
      onBuild?: (c: ViewerContainer) => void;
    } = {},
  ) {
    this.host = host;
    this.state = { ...state };

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth || 800, host.clientHeight || 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, this.aspect(), 0.05, 120);
    this.camera.position.set(4.4, 2.9, 4.6);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.72, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.autoRotateSpeed = 0.55;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.buildLights();
    this.buildFloor();

    this.highlightBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: "#ffb020", transparent: true, opacity: 0.9 }),
    );
    this.highlightBox.visible = false;
    this.highlightBox.renderOrder = 998;
    this.highlightBox.userData.isAnnotation = true;
    this.scene.add(this.highlightBox);

    this.scene.add(this.modelRoot);
    this.rebuild();
    this.applyMood(this.state.mood, true);
    this.applyMaterialState();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    window.addEventListener("resize", this.resize);

    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerleave", this.onPointerLeave);

    this.intro = 1;
    this.camera.position.set(6.6, 4.6, 7.4);
    this.loop();
  }

  /* ---------------- scene furniture ---------------- */

  private aspect() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    return w / h;
  }

  private buildLights() {
    const m = MOODS.hangar;
    this.key = new THREE.DirectionalLight(m.key.color, m.key.intensity);
    this.key.position.set(...m.key.pos);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 24;
    const s = 3.2;
    this.key.shadow.camera.left = -s;
    this.key.shadow.camera.right = s;
    this.key.shadow.camera.top = s;
    this.key.shadow.camera.bottom = -s;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 3;
    this.scene.add(this.key, this.key.target);

    this.fill = new THREE.DirectionalLight(m.fill.color, m.fill.intensity);
    this.fill.position.set(-4.4, 2.6, -2.6);
    this.scene.add(this.fill);

    this.rim = new THREE.DirectionalLight(m.rim.color, m.rim.intensity);
    this.rim.position.set(-2.6, 2.1, -5.2);
    this.scene.add(this.rim);

    this.hemi = new THREE.HemisphereLight(0xbcd6ea, 0x2a2118, m.hemi);
    this.scene.add(this.hemi);

    this.interior = new THREE.PointLight(0xfff0d0, 0.5, 2.6, 2);
    this.interior.position.set(-0.3, 0.7, 0);
    this.scene.add(this.interior);
  }

  private buildFloor() {
    const tex = makeApronTexture(1024);
    tex.repeat.set(5, 5);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      color: new THREE.Color(MOODS.hangar.floor),
      roughness: 0.92,
      metalness: 0.06,
      envMapIntensity: 0.35,
    });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(18, 96), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  private applyMood(id: MoodId, initial = false) {
    const m = MOODS[id];
    this.renderer.toneMappingExposure = m.exposure;
    this.scene.fog = new THREE.Fog(new THREE.Color(m.fog), 9, 34);

    if (!this.skyBgs.has(id)) {
      this.skyBgs.set(id, makeSkyTexture(m.sky[0], m.sky[1], m.sky[2]));
    }
    const bg = this.skyBgs.get(id)!;
    this.scene.background = bg;
    this.scene.backgroundIntensity = m.bgIntensity;

    if (m.envFromSky) {
      if (!this.skyEnvs.has(id)) {
        this.skyEnvs.set(id, this.pmrem.fromEquirectangular(bg).texture);
      }
      this.scene.environment = this.skyEnvs.get(id)!;
    } else {
      if (!this.roomEnv) {
        const room = new RoomEnvironment();
        this.roomEnv = this.pmrem.fromScene(room, 0.035).texture;
        room.dispose();
      }
      this.scene.environment = this.roomEnv;
    }

    this.key.color.set(m.key.color);
    this.key.intensity = m.key.intensity;
    this.key.position.set(...m.key.pos);
    this.fill.color.set(m.fill.color);
    this.fill.intensity = m.fill.intensity;
    this.rim.color.set(m.rim.color);
    this.rim.intensity = m.rim.intensity;
    this.hemi.intensity = m.hemi;
    this.floorMat.color.set(m.floor);
    this.floorMat.needsUpdate = true;
    if (initial) this.renderer.toneMappingExposure = m.exposure;
  }

  /* ---------------- model lifecycle ---------------- */

  rebuild() {
    if (this.container) {
      this.modelRoot.remove(this.container.group);
      this.container.dispose();
      this.container = null;
    }
    if (this.annot) {
      this.scene.remove(this.annot.group);
      this.annot.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else if (mm) mm.dispose();
      });
      this.annot = null;
    }

    const spec = MODELS[this.state.model];
    this.container = spec.build({
      contour: this.state.contour,
      finish: this.state.finish,
      detail: this.state.detail,
      rivets: this.state.rivets,
      doorOpen: this.state.door,
      reefer: this.state.reefer,
      setpoint: this.state.setpoint,
      load: this.state.load,
    });
    this.modelRoot.add(this.container.group);
    this.applyMaterialState();
    this.applyExplode();

    const x0 = this.container.profile[0].x;
    this.annot = createAnnotations({
      baseWidth: spec.dims.width,
      baseLength: spec.dims.depth,
      height: spec.dims.height,
      topWidth: this.state.contour ? spec.dims.topWidth : spec.dims.width,
      x0,
    });
    this.annot.group.visible = this.state.dimensions;
    this.scene.add(this.annot.group);

    this.cb.onBuild?.(this.container);
  }

  private eachMaterial(fn: (m: THREE.Material) => void) {
    this.container?.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mm = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach(fn);
      else if (mm) fn(mm);
    });
  }

  private applyMaterialState() {
    if (!this.container) return;
    const c = this.container;
    c.setFinish(this.state.finish);
    this.eachMaterial((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if ("wireframe" in std) std.wireframe = this.state.wireframe;
      std.envMapIntensity =
        (std.userData.baseEnv ??= std.envMapIntensity ?? 1) * this.state.envIntensity;
    });
  }

  private applyExplode() {
    if (!this.container) return;
    const t = this.state.explode;
    const e = t * t * (3 - 2 * t); // smoothstep
    for (const a of this.container.assemblies) {
      a.group.position.copy(a.home).addScaledVector(a.explode, e);
    }
  }

  /* ---------------- state ---------------- */

  setState(patch: Partial<ViewerState>) {
    const prev = this.state;
    this.state = { ...this.state, ...patch };

    if (patch.mood && patch.mood !== prev.mood) this.applyMood(patch.mood);

    if (patch.model && patch.model !== prev.model) {
      this.rebuild();
      this.setSurface(this.state.metalness, this.state.roughness);
      return;
    }

    const structural =
      (patch.contour !== undefined && patch.contour !== prev.contour) ||
      (patch.detail !== undefined && patch.detail !== prev.detail) ||
      (patch.rivets !== undefined && patch.rivets !== prev.rivets);
    if (structural) {
      this.rebuild();
      this.setSurface(this.state.metalness, this.state.roughness);
      return;
    }

    if (patch.finish) this.container?.setFinish(patch.finish);
    if (patch.door !== undefined) this.container?.setDoorOpen(patch.door);
    if (patch.explode !== undefined) this.applyExplode();
    if (patch.dimensions !== undefined && this.annot) this.annot.group.visible = patch.dimensions;
    if (
      patch.wireframe !== undefined ||
      patch.envIntensity !== undefined ||
      patch.finish !== undefined
    ) {
      this.applyMaterialState();
    }
    if (patch.metalness !== undefined || patch.roughness !== undefined || patch.finish) {
      this.setSurface(this.state.metalness, this.state.roughness);
    }
    if (patch.reefer !== undefined) reeferOf(this.container)?.setReefer?.(patch.reefer);
    if (patch.setpoint !== undefined) reeferOf(this.container)?.setSetpoint?.(patch.setpoint);
    if (patch.load !== undefined) this.container?.setLoad?.(patch.load);
  }

  /** Live metalness / roughness trim on top of the selected finish. */
  setSurface(metalness: number, roughness: number) {
    if (!this.container) return;
    const f = this.container.materials.shell;
    f.metalness = THREE.MathUtils.clamp(metalness, 0, 1);
    f.roughness = THREE.MathUtils.clamp(roughness, 0.02, 1);
  }

  highlight(assemblyId: string | null) {
    this.highlighted = assemblyId;
    this.highlightKey = "";
    if (!assemblyId || !this.container) {
      this.highlightBox.visible = false;
      if (this.highlightTag) this.highlightTag.visible = false;
      return;
    }
    const a = this.container.assemblies.find((x) => x.id === assemblyId);
    if (!a) return;
    this.highlightBox.visible = true;
    this.frameAssemblyBox(a);
  }

  private frameAssemblyBox(a: Assembly) {
    const box = new THREE.Box3().setFromObject(a.group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.highlightBox.scale.copy(size).addScalar(0.012);
    this.highlightBox.position.copy(center);
    if (!this.highlightTag) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 96;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.highlightTag = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
      );
      this.highlightTag.scale.set(0.62, 0.12, 1);
      this.highlightTag.renderOrder = 999;
      this.highlightTag.userData.isAnnotation = true;
      this.scene.add(this.highlightTag);
    }
    const cv = (this.highlightTag.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "rgba(255,176,32,0.14)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#ffb020";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, cv.width - 4, cv.height - 4);
    ctx.fillStyle = "#ffd479";
    ctx.font = "600 40px 'Chakra Petch', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(a.label.toUpperCase(), 20, 50);
    (this.highlightTag.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    this.highlightTag.visible = true;
    this.highlightTag.position.set(center.x, box.max.y + 0.16, center.z);
  }

  focus(assemblyId: string | null) {
    if (!this.container) return;
    const target = new THREE.Vector3(0, 0.72, 0);
    let dist = 4.6;
    if (assemblyId) {
      const a = this.container.assemblies.find((x) => x.id === assemblyId);
      if (a) {
        const box = new THREE.Box3().setFromObject(a.group);
        box.getCenter(target);
        dist = Math.max(box.getSize(new THREE.Vector3()).length() * 1.5, 1.6);
      }
    }
    this.flyTo(target, dist);
  }

  private flyTo(target: THREE.Vector3, distance: number) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.tweenCam = {
      t: 0,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromPos: this.camera.position.clone(),
      toPos: target.clone().addScaledVector(dir, distance),
    };
  }
  private tweenCam: {
    t: number;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
  } | null = null;

  frameAll() {
    this.flyTo(new THREE.Vector3(0, 0.72, 0), 4.8);
  }

  setView(v: "front" | "top" | "contour" | "iso") {
    const t = new THREE.Vector3(0, 0.72, 0);
    const pos =
      v === "front"
        ? new THREE.Vector3(0.1, 0.85, 5.2)
        : v === "top"
          ? new THREE.Vector3(0.05, 6.2, 0.35)
          : v === "contour"
            ? new THREE.Vector3(5.1, 1.25, 0.25)
            : new THREE.Vector3(3.5, 2.3, 3.9);
    this.tweenCam = { t: 0, fromTarget: this.controls.target.clone(), toTarget: t, fromPos: this.camera.position.clone(), toPos: pos };
  }

  /* ---------------- picking ---------------- */

  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.pointerActive = true;
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
    this.setHover(null);
  };

  private setHover(h: HoverInfo | null) {
    if (h?.part === this.hovered?.part && h?.assemblyId === this.hovered?.assemblyId) return;
    this.hovered = h;
    this.renderer.domElement.style.cursor = h ? "crosshair" : "grab";
    this.cb.onHover?.(h);
  }

  private pick() {
    if (!this.container) return;
    if (!this.pointerActive) {
      this.setHover(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.container.group, true);
    const hit = hits.find((h) => h.object.visible && (h.object as THREE.Mesh).isMesh);
    if (!hit) {
      this.setHover(null);
      return;
    }
    let o: THREE.Object3D | null = hit.object;
    let assembly: Assembly | undefined;
    while (o) {
      assembly = this.container.assemblies.find((a) => a.group === o);
      if (assembly) break;
      o = o.parent;
    }
    this.setHover({
      part: (hit.object.userData.part as string) ?? hit.object.name ?? "Component",
      assembly: assembly?.label ?? "AKE / LD-3",
      assemblyId: assembly?.id ?? "",
    });
  }

  /* ---------------- loop ---------------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    if (this.intro > 0) {
      this.intro = Math.max(0, this.intro - dt / 1.9);
      const k = 1 - this.intro;
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(new THREE.Vector3(6.6, 4.6, 7.4), new THREE.Vector3(4.4, 2.9, 4.6), e);
    } else if (this.tweenCam) {
      this.tweenCam.t = Math.min(1, this.tweenCam.t + dt / 0.85);
      const e = 1 - Math.pow(1 - this.tweenCam.t, 3);
      this.controls.target.lerpVectors(this.tweenCam.fromTarget, this.tweenCam.toTarget, e);
      this.camera.position.lerpVectors(this.tweenCam.fromPos, this.tweenCam.toPos, e);
      if (this.tweenCam.t >= 1) this.tweenCam = null;
    }

    this.controls.autoRotate = this.state.autoRotate && this.intro === 0 && !this.tweenCam;
    this.controls.update();
    this.pick();
    this.container?.animate?.(this.elapsed, dt);

    const mat = this.highlightBox.material as THREE.LineBasicMaterial;
    if (this.highlightBox.visible) {
      mat.opacity = 0.55 + Math.sin(performance.now() * 0.005) * 0.35;
      const key = `${this.highlighted}|${this.state.explode.toFixed(2)}|${this.state.door.toFixed(2)}`;
      if (key !== this.highlightKey && this.highlighted && this.container) {
        this.highlightKey = key;
        const a = this.container.assemblies.find((x) => x.id === this.highlighted);
        if (a) this.frameAssemblyBox(a);
      }
    }

    this.renderer.render(this.scene, this.camera);

    this.frames++;
    this.acc += dt;
    if (this.acc > 0.5) {
      this.cb.onPerf?.({
        fps: Math.round(this.frames / this.acc),
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
      });
      this.frames = 0;
      this.acc = 0;
    }
  };

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  };

  /* ---------------- export ---------------- */

  private exportRoot() {
    return this.container?.group ?? new THREE.Group();
  }

  async exportGLB(): Promise<Blob> {
    const exporter = new GLTFExporter();
    const buf = (await exporter.parseAsync(this.exportRoot(), {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 1024,
    })) as ArrayBuffer;
    return new Blob([buf], { type: "model/gltf-binary" });
  }

  exportOBJ(): string {
    return new OBJExporter().parse(this.exportRoot());
  }

  exportSTL(): DataView {
    return new STLExporter().parse(this.exportRoot(), { binary: true }) as DataView;
  }

  /** Measured envelope of the generated solid. */
  measure() {
    const box = new THREE.Box3().setFromObject(this.exportRoot());
    const s = box.getSize(new THREE.Vector3());
    return { x: s.x, y: s.y, z: s.z, min: box.min, max: box.max };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("resize", this.resize);
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    this.container?.dispose();
    this.skyBgs.forEach((t) => t.dispose());
    this.skyEnvs.forEach((t) => t.dispose());
    this.roomEnv?.dispose();
    this.floor.geometry.dispose();
    this.floorMat.map?.dispose();
    this.floorMat.dispose();
    this.highlightBox.geometry.dispose();
    (this.highlightBox.material as THREE.Material).dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}
