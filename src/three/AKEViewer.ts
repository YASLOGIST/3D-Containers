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
import { formatDistance } from "@/lib/units";

const reducedMotionPreferred = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type MoodId = "hangar" | "dusk" | "studio";
export type ProjectionId = "persp" | "ortho";
export type SectionAxis = "x" | "y" | "z";

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
  /** perspective or true-scale orthographic engineering projection */
  projection: ProjectionId;
  /** cross-section clipping plane enabled (view-only; exports stay whole) */
  section: boolean;
  sectionAxis: SectionAxis;
  /** plane position normalised 0..1 across the model's axis extent */
  sectionPos: number;
  /** keep the opposite side of the section plane */
  sectionFlip: boolean;
  /** certified envelope of another family, overlaid base-centre aligned */
  compare: ModelId | "none";
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
  autoRotate: !reducedMotionPreferred(),
  mood: "hangar",
  reefer: true,
  setpoint: -18,
  load: 0.35,
  projection: "persp",
  section: false,
  sectionAxis: "x",
  sectionPos: 0.5,
  sectionFlip: false,
  compare: "none",
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

export interface MeasureInfo {
  /** points placed so far (0, 1 or 2) */
  points: number;
  /** straight-line distance in metres once both points exist */
  distance: number | null;
  /** per-axis deltas in metres once both points exist */
  dx: number;
  dy: number;
  dz: number;
}

export interface SectionInfo {
  axis: SectionAxis;
  /** plane offset from the model's minimum along the axis, metres */
  offset: number;
  /** full model extent along the axis, metres */
  extent: number;
}

export class AKEViewer {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  /** world-space frustum height (m) driving the orthographic camera */
  private orthoSize = 4;
  private homeOrthoSize = 4;
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
  private reducedMotion = false;
  private baseDpr = 1;
  private dprScale = 1;
  private lowFpsTime = 0;
  private recoveredTime = 0;
  private pickTimer = 0;
  private homeTarget = new THREE.Vector3(0, 0.72, 0);
  private homeCamera = new THREE.Vector3(4.4, 2.9, 4.6);
  private introFrom = new THREE.Vector3();
  private readonly introTo = new THREE.Vector3();
  private ro: ResizeObserver;
  /** shadow maps re-render only when light-receiving geometry actually moves */
  private shadowDirty = true;

  /* inspection tools: section plane, measure, compare envelope */
  private sectionPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private sectionHelper: THREE.Group | null = null;
  /** bounds cache so dragging the section slider avoids a full traversal */
  private sectionBoxCache: THREE.Box3 | null = null;
  private measureMode = false;
  private measurePoints: THREE.Vector3[] = [];
  private measureGroup = new THREE.Group();
  private pointerDownAt: { x: number; y: number; t: number } | null = null;
  private compareGroup: THREE.Group | null = null;

  /** whichever camera the current projection selects */
  private get camera() {
    return this.state.projection === "ortho" ? this.ortho : this.persp;
  }

  constructor(
    host: HTMLElement,
    state: ViewerState,
    private cb: {
      onHover?: (h: HoverInfo | null) => void;
      onPerf?: (p: PerfInfo) => void;
      onBuild?: (c: ViewerContainer) => void;
      onError?: (message: string | null) => void;
      onMeasure?: (m: MeasureInfo) => void;
      onSection?: (s: SectionInfo) => void;
    } = {},
  ) {
    this.host = host;
    this.state = { ...state };
    this.reducedMotion = reducedMotionPreferred();
    this.baseDpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.baseDpr);
    this.renderer.setSize(host.clientWidth || 800, host.clientHeight || 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Light-space shadows do not depend on the camera: re-render them only
    // when geometry or lights move, not on every orbit frame.
    this.renderer.shadowMap.autoUpdate = false;
    // Section cuts clip container materials locally so the floor and the
    // dimension furniture are never sliced.
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("role", "application");
    host.appendChild(this.renderer.domElement);

    this.persp = new THREE.PerspectiveCamera(38, this.aspect(), 0.05, 120);
    this.persp.position.set(4.4, 2.9, 4.6);
    this.ortho = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 200);
    this.ortho.position.copy(this.persp.position);
    this.updateOrthoFrustum();

    this.controls = this.makeControls(
      this.camera,
      new THREE.Vector3(0, 0.72, 0),
    );

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.buildLights();
    this.buildFloor();

    this.highlightBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({
        color: "#ffb020",
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.highlightBox.visible = false;
    this.highlightBox.renderOrder = 998;
    this.highlightBox.userData.isAnnotation = true;
    this.scene.add(this.highlightBox);

    this.buildSectionHelper();
    this.measureGroup.userData.isAnnotation = true;
    this.scene.add(this.measureGroup);
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
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("webglcontextlost", this.onContextLost);
    el.addEventListener("webglcontextrestored", this.onContextRestored);

    this.updateHomePose();
    this.introTo.copy(this.homeCamera);
    this.introFrom
      .copy(this.homeCamera)
      .sub(this.homeTarget)
      .multiplyScalar(1.34)
      .add(this.homeTarget)
      .add(new THREE.Vector3(0, 0.24, 0));
    // The dolly-in intro is a perspective move; an orthographic start
    // (e.g. from a shared link) opens already framed.
    this.intro =
      this.reducedMotion || this.state.projection === "ortho" ? 0 : 1;
    if (this.state.projection === "ortho") {
      this.orthoSize = this.homeOrthoSize;
      this.updateOrthoFrustum();
    }
    this.controls.target.copy(this.homeTarget);
    this.camera.position.copy(this.intro > 0 ? this.introFrom : this.introTo);
    this.otherCamera().position.copy(this.camera.position);
    this.updateCanvasLabel();
    this.loop();
  }

  /* ---------------- scene furniture ---------------- */

  private aspect() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    return w / h;
  }

  private otherCamera() {
    return this.state.projection === "ortho" ? this.persp : this.ortho;
  }

  private makeControls(
    camera: THREE.Camera,
    target: THREE.Vector3,
  ): OrbitControls {
    const c = new OrbitControls(camera, this.renderer.domElement);
    c.target.copy(target);
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.minDistance = 1.4;
    c.maxDistance = 18;
    c.minZoom = 0.35;
    c.maxZoom = 9;
    c.maxPolarAngle = Math.PI * 0.495;
    c.autoRotateSpeed = 0.55;
    c.listenToKeyEvents(this.renderer.domElement);
    return c;
  }

  /** Rebuild the orthographic frustum from orthoSize, preserving zoom. */
  private updateOrthoFrustum() {
    const aspect = this.aspect();
    const h = this.orthoSize / 2;
    this.ortho.left = -h * aspect;
    this.ortho.right = h * aspect;
    this.ortho.top = h;
    this.ortho.bottom = -h;
    this.ortho.updateProjectionMatrix();
  }

  /** Frustum height that fits a bounding box in orthographic projection. */
  private orthoFitSize(box: THREE.Box3, margin = 1.18) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const aspect = Math.max(this.aspect(), 0.1);
    // Height must cover the diameter vertically AND horizontally.
    return (sphere.radius * 2 * margin) / Math.min(1, aspect);
  }

  /**
   * Swap the active camera, preserving view direction and target. Called
   * from setState BEFORE the state merge flips the `camera` getter.
   */
  private switchProjection(next: ProjectionId) {
    const oldCam = this.camera;
    const target = this.controls.target.clone();
    const dir = oldCam.position.clone().sub(target);
    if (dir.lengthSq() < 1e-8) dir.set(0.62, 0.42, 0.78);
    dir.normalize();
    // dispose() does not detach the key listener; without this every
    // projection switch would leave a handler panning the idle camera.
    this.controls.stopListenToKeyEvents();
    this.controls.dispose();
    this.state = { ...this.state, projection: next };
    const cam = this.camera;
    const box = this.modelBox();
    if (next === "ortho") {
      this.orthoSize = this.orthoFitSize(box, 1.18);
      this.ortho.zoom = 1;
      this.updateOrthoFrustum();
      // Distance is irrelevant to ortho size, but keep the camera inside
      // the fog-free range (< 9 m) so the model is not washed out.
      cam.position.copy(target).addScaledVector(dir, 8);
    } else {
      cam.position
        .copy(target)
        .addScaledVector(dir, this.fitDistance(box, 1.18));
    }
    this.tweenCam = null;
    this.intro = 0;
    this.controls = this.makeControls(cam, target);
    cam.lookAt(target);
  }

  private markShadowsDirty() {
    this.shadowDirty = true;
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
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 96),
      this.floorMat,
    );
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
    this.markShadowsDirty();
  }

  /* ---------------- model lifecycle ---------------- */

  rebuild(refitCamera = false) {
    this.highlight(null);
    if (this.container) {
      this.modelRoot.remove(this.container.group);
      this.container.dispose();
      this.container = null;
    }
    this.disposeAnnotations();

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
    // Fresh geometry invalidates any placed measurement; the section plane
    // and compare envelope re-derive from the new model's bounds.
    this.clearMeasurePoints();
    this.sectionBoxCache = null;
    this.updateSection(true);
    this.rebuildCompare();
    this.markShadowsDirty();

    const x0 = this.container.profile[0].x;
    this.annot = createAnnotations({
      code: spec.code,
      baseWidth: spec.dims.width,
      baseLength: spec.dims.depth,
      height: spec.dims.height,
      topWidth:
        spec.contourOption && this.state.contour
          ? spec.dims.topWidth
          : spec.dims.width,
      contourHeight: spec.dims.contourHeight,
      x0,
      contour: spec.contourOption && this.state.contour,
      kind: spec.palletOption
        ? "pallet"
        : spec.contourOption
          ? "contoured"
          : "cuboid",
    });
    this.annot.group.visible = this.state.dimensions;
    this.scene.add(this.annot.group);

    this.updateCanvasLabel();
    this.updateHomePose();
    if (refitCamera)
      this.flyToPose(this.homeTarget, this.homeCamera, 0.85, this.homeOrthoSize);
    this.cb.onBuild?.(this.container);
  }

  private disposeAnnotations() {
    if (!this.annot) return;
    this.scene.remove(this.annot.group);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.annot.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry);
      const line = obj as THREE.Line;
      if (line.isLine && line.geometry) geometries.add(line.geometry);
      const mm = (obj as THREE.Mesh).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (Array.isArray(mm)) mm.forEach((m) => materials.add(m));
      else if (mm) materials.add(mm);
    });
    materials.forEach((material) => {
      const rec = material as unknown as Record<string, unknown>;
      for (const key of ["map", "alphaMap"]) {
        const value = rec[key];
        if (value instanceof THREE.Texture) textures.add(value);
      }
      material.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    this.annot = null;
  }

  private updateCanvasLabel() {
    const spec = MODELS[this.state.model];
    this.renderer.domElement.setAttribute(
      "aria-label",
      `${spec.name} interactive 3D model. Drag to orbit, scroll to zoom, or focus the canvas and use arrow keys to pan.`,
    );
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
        (std.userData.baseEnv ??= std.envMapIntensity ?? 1) *
        this.state.envIntensity;
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

  /* ---------------- inspection tools ---------------- */

  private buildSectionHelper() {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: "#ffb020",
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({
        color: "#ffb020",
        transparent: true,
        opacity: 0.55,
      }),
    );
    fill.renderOrder = 997;
    edge.renderOrder = 997;
    g.add(fill, edge);
    g.visible = false;
    g.userData.isAnnotation = true;
    this.sectionHelper = g;
    this.scene.add(g);
  }

  /**
   * Position the clipping plane from the live model bounds and (re)bind it
   * to container materials. `rebind` is required after a rebuild because the
   * generator mints fresh materials. The cut is view-only: exporters read
   * geometry, not material clipping state, so meshes stay whole.
   */
  private updateSection(rebind = false) {
    const on = this.state.section && !!this.container;
    if (this.sectionHelper) this.sectionHelper.visible = on;
    if (!this.container) return;

    if (rebind) {
      const planes = on ? [this.sectionPlane] : null;
      const seen = new Set<THREE.Material>();
      this.container.group.traverse((o) => {
        const mm = (o as THREE.Mesh).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        const list = Array.isArray(mm) ? mm : mm ? [mm] : [];
        for (const m of list) {
          if (seen.has(m)) continue;
          seen.add(m);
          m.clippingPlanes = planes;
          (m as THREE.MeshStandardMaterial).clipShadows = true;
          m.needsUpdate = true;
        }
      });
    }
    if (!on) return;

    const box = (this.sectionBoxCache ??= this.modelBox());
    const axis = this.state.sectionAxis;
    const min = box.min[axis];
    const max = box.max[axis];
    const pos = THREE.MathUtils.lerp(min, max, this.state.sectionPos);
    // Default keeps the min side of the axis; flip keeps the max side.
    const sign = this.state.sectionFlip ? 1 : -1;
    const normal = new THREE.Vector3(
      axis === "x" ? sign : 0,
      axis === "y" ? sign : 0,
      axis === "z" ? sign : 0,
    );
    const onPlane = box.getCenter(new THREE.Vector3());
    onPlane[axis] = pos;
    this.sectionPlane.normal.copy(normal);
    this.sectionPlane.constant = -normal.dot(onPlane);

    if (this.sectionHelper) {
      const size = box.getSize(new THREE.Vector3());
      const [su, sv] =
        axis === "x"
          ? [size.z, size.y]
          : axis === "y"
            ? [size.x, size.z]
            : [size.x, size.y];
      this.sectionHelper.position.copy(onPlane);
      this.sectionHelper.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(
          axis === "x" ? 1 : 0,
          axis === "y" ? 1 : 0,
          axis === "z" ? 1 : 0,
        ),
      );
      this.sectionHelper.scale.set(su * 1.06 + 0.04, sv * 1.06 + 0.04, 1);
    }
    this.cb.onSection?.({ axis, offset: pos - min, extent: max - min });
  }

  /** Fresh-canvas text sprite for click-rate tools (measure, compare). */
  private textSprite(
    text: string,
    colors: { fg: string; border: string; bg: string } = {
      fg: "#ffd479",
      border: "#ffb020",
      bg: "rgba(10,12,15,0.85)",
    },
  ) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d")!;
    const font = "600 34px 'Chakra Petch', sans-serif";
    ctx.font = font;
    c.width = Math.ceil(ctx.measureText(text).width) + 40;
    c.height = 64;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
    ctx.font = font;
    ctx.fillStyle = colors.fg;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 20, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
    );
    const h = 0.085;
    spr.scale.set(h * (c.width / c.height), h, 1);
    spr.renderOrder = 1000;
    spr.userData.isAnnotation = true;
    return spr;
  }

  setMeasureMode(on: boolean) {
    this.measureMode = on;
    if (on) this.setHover(null);
    this.renderer.domElement.style.cursor = on ? "crosshair" : "grab";
    if (!on) this.clearMeasurePoints();
  }

  clearMeasure() {
    this.clearMeasurePoints();
  }

  private clearMeasurePoints() {
    this.measurePoints = [];
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    this.measureGroup.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const mm = (o as THREE.Mesh).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (Array.isArray(mm)) mm.forEach((m) => mats.add(m));
      else if (mm) mats.add(mm);
    });
    mats.forEach((m) => {
      const map = (m as THREE.SpriteMaterial).map;
      if (map instanceof THREE.Texture) texs.add(map);
      m.dispose();
    });
    geos.forEach((g) => g.dispose());
    texs.forEach((t) => t.dispose());
    this.measureGroup.clear();
    this.cb.onMeasure?.({ points: 0, distance: null, dx: 0, dy: 0, dz: 0 });
  }

  private rebuildMeasureVisuals() {
    // Preserve points, drop previous sprites/markers.
    const pts = this.measurePoints;
    const previous = [...this.measureGroup.children];
    previous.forEach((child) => {
      this.measureGroup.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mm = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((m) => {
          (m as THREE.SpriteMaterial).map?.dispose();
          m.dispose();
        });
      });
    });
    const markerGeo = new THREE.SphereGeometry(0.013, 16, 12);
    const markerMat = new THREE.MeshBasicMaterial({
      color: "#ffb020",
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    for (const p of pts) {
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(p);
      marker.renderOrder = 1000;
      this.measureGroup.add(marker);
    }
    if (pts.length === 2) {
      const [a, b] = pts;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({
          color: "#ffb020",
          depthTest: false,
          transparent: true,
          opacity: 0.9,
        }),
      );
      line.renderOrder = 999;
      this.measureGroup.add(line);
      const tag = this.textSprite(formatDistance(a.distanceTo(b)));
      tag.position.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.09, 0));
      this.measureGroup.add(tag);
    }
    const [a, b] = pts;
    this.cb.onMeasure?.({
      points: pts.length,
      distance: pts.length === 2 ? a.distanceTo(b) : null,
      dx: pts.length === 2 ? Math.abs(b.x - a.x) : 0,
      dy: pts.length === 2 ? Math.abs(b.y - a.y) : 0,
      dz: pts.length === 2 ? Math.abs(b.z - a.z) : 0,
    });
  }

  /**
   * First ray hit the user can actually see: raycasting ignores material
   * clipping, so while a section cut is active, hits on the removed side
   * of the plane must not register.
   */
  private firstVisibleHit(hits: THREE.Intersection[]) {
    return hits.find(
      (h) =>
        h.object.visible &&
        (h.object as THREE.Mesh).isMesh &&
        (!this.state.section ||
          this.sectionPlane.distanceToPoint(h.point) >= -1e-4),
    );
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDownAt;
    this.pointerDownAt = null;
    if (!this.measureMode || !down || !this.container) return;
    // A click places a point; an orbit drag must not.
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 6 || performance.now() - down.t > 600) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.container.group, true);
    const hit = this.firstVisibleHit(hits);
    if (!hit) return;
    if (this.measurePoints.length >= 2) this.measurePoints = [];
    this.measurePoints = [...this.measurePoints, hit.point.clone()];
    this.rebuildMeasureVisuals();
  };

  /** Certified-envelope overlay of another family, base-centre aligned. */
  private rebuildCompare() {
    if (this.compareGroup) {
      this.scene.remove(this.compareGroup);
      this.compareGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mm = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((m) => {
          (m as THREE.SpriteMaterial).map?.dispose();
          m.dispose();
        });
      });
      this.compareGroup = null;
    }
    const id = this.state.compare;
    if (id === "none" || id === this.state.model || !this.container) return;
    const spec = MODELS[id];
    const active = this.modelBox().getCenter(new THREE.Vector3());
    const w = Math.max(spec.dims.width, spec.dims.topWidth);
    const h = spec.palletOption
      ? spec.dims.height + (spec.dims.contourHeight ?? 0)
      : spec.dims.height;
    const d = spec.dims.depth;
    const group = new THREE.Group();
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineDashedMaterial({
        color: "#79b8c9",
        dashSize: 0.07,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.85,
      }),
    );
    edges.computeLineDistances();
    edges.position.set(active.x, h / 2, active.z);
    edges.userData.isAnnotation = true;
    group.add(edges);
    const tag = this.textSprite(
      `${spec.code} ${w.toFixed(2)}×${d.toFixed(2)}×${h.toFixed(2)} M`,
      {
        fg: "#b9e2ec",
        border: "#79b8c9",
        bg: "rgba(8,14,17,0.85)",
      },
    );
    tag.position.set(active.x + w / 2 - 0.1, h + 0.12, active.z - d / 2);
    group.add(tag);
    this.compareGroup = group;
    this.scene.add(group);
  }

  /** Current viewport as a PNG (rendered fresh, no drawing-buffer retention). */
  async snapshotPNG(): Promise<Blob> {
    if (this.shadowDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve, reject) => {
      this.renderer.domElement.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("snapshot unavailable")),
        "image/png",
      );
    });
  }

  /* ---------------- state ---------------- */

  setState(patch: Partial<ViewerState>) {
    const prev = this.state;
    // The camera getter follows state.projection, so swap cameras while
    // the old one is still active, then merge the rest of the patch.
    if (patch.projection && patch.projection !== prev.projection) {
      this.switchProjection(patch.projection);
    }
    this.state = { ...this.state, ...patch };

    if (patch.mood && patch.mood !== prev.mood) this.applyMood(patch.mood);

    if (patch.model && patch.model !== prev.model) {
      this.rebuild(true);
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

    // Anything that moves geometry invalidates placed measure points and
    // the shadow map; the section plane re-derives from the new bounds.
    const moved =
      patch.door !== undefined ||
      patch.explode !== undefined ||
      patch.load !== undefined ||
      patch.reefer !== undefined;
    if (moved) {
      this.clearMeasurePoints();
      this.markShadowsDirty();
      this.sectionBoxCache = null;
    }

    if (patch.finish) this.container?.setFinish(patch.finish);
    if (patch.door !== undefined) this.container?.setDoorOpen(patch.door);
    if (patch.explode !== undefined) this.applyExplode();
    if (patch.dimensions !== undefined && this.annot)
      this.annot.group.visible = patch.dimensions;
    if (
      patch.wireframe !== undefined ||
      patch.envIntensity !== undefined ||
      patch.finish !== undefined
    ) {
      this.applyMaterialState();
    }
    if (
      patch.metalness !== undefined ||
      patch.roughness !== undefined ||
      patch.finish
    ) {
      this.setSurface(this.state.metalness, this.state.roughness);
    }
    if (patch.reefer !== undefined)
      reeferOf(this.container)?.setReefer?.(patch.reefer);
    if (patch.setpoint !== undefined)
      reeferOf(this.container)?.setSetpoint?.(patch.setpoint);
    if (patch.load !== undefined) this.container?.setLoad?.(patch.load);

    if (patch.section !== undefined && patch.section !== prev.section) {
      this.updateSection(true);
      this.markShadowsDirty();
    } else if (
      patch.sectionAxis !== undefined ||
      patch.sectionPos !== undefined ||
      patch.sectionFlip !== undefined ||
      moved
    ) {
      this.updateSection(false);
    }
    if (patch.compare !== undefined && patch.compare !== prev.compare) {
      this.rebuildCompare();
    }
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
        new THREE.SpriteMaterial({
          map: tex,
          depthTest: false,
          transparent: true,
        }),
      );
      this.highlightTag.scale.set(0.62, 0.12, 1);
      this.highlightTag.renderOrder = 999;
      this.highlightTag.userData.isAnnotation = true;
      this.scene.add(this.highlightTag);
    }
    const cv = (this.highlightTag.material as THREE.SpriteMaterial).map!
      .image as HTMLCanvasElement;
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
    (this.highlightTag.material as THREE.SpriteMaterial).map!.needsUpdate =
      true;
    this.highlightTag.visible = true;
    this.highlightTag.position.set(center.x, box.max.y + 0.16, center.z);
  }

  private tweenCam: {
    t: number;
    duration: number;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromSize: number;
    toSize: number;
  } | null = null;

  /** Bounds of the active generated model, not the dimension furniture. */
  private modelBox() {
    const fallback = new THREE.Box3(
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 1.6, 1),
    );
    if (!this.container) return fallback;
    const box = new THREE.Box3().setFromObject(this.container.group);
    return box.isEmpty() ? fallback : box;
  }

  /** Perspective distance that fits a bounding sphere in both view axes. */
  private fitDistance(box: THREE.Box3, margin = 1.1) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(this.persp.fov);
    const horizontalFov =
      2 *
      Math.atan(Math.tan(verticalFov / 2) * Math.max(this.persp.aspect, 0.1));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = (sphere.radius / Math.sin(limitingFov / 2)) * margin;
    return THREE.MathUtils.clamp(
      distance,
      this.controls.minDistance + 0.05,
      this.controls.maxDistance - 0.05,
    );
  }

  private currentDirection() {
    const dir = this.camera.position.clone().sub(this.controls.target);
    return dir.lengthSq() > 1e-8
      ? dir.normalize()
      : new THREE.Vector3(0.62, 0.42, 0.78).normalize();
  }

  /** Recompute the home pose whenever the generated envelope changes. */
  private updateHomePose() {
    const box = this.modelBox();
    const target = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(0.62, 0.42, 0.78).normalize();
    this.homeTarget.copy(target);
    this.homeCamera
      .copy(target)
      .addScaledVector(dir, this.fitDistance(box, 1.18));
    this.homeOrthoSize = this.orthoFitSize(box, 1.18);
  }

  private flyToPose(
    target: THREE.Vector3,
    position: THREE.Vector3,
    duration = 0.85,
    orthoSize?: number,
  ) {
    const toSize = orthoSize ?? this.orthoSize / Math.max(this.ortho.zoom, 1e-4);
    if (duration <= 0 || this.reducedMotion) {
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      if (this.state.projection === "ortho" && orthoSize !== undefined) {
        this.orthoSize = toSize;
        this.ortho.zoom = 1;
        this.updateOrthoFrustum();
      }
      this.tweenCam = null;
      return;
    }
    // Normalise any user zoom into orthoSize so the tween owns framing.
    const fromSize = this.orthoSize / Math.max(this.ortho.zoom, 1e-4);
    if (this.state.projection === "ortho") {
      this.orthoSize = fromSize;
      this.ortho.zoom = 1;
      this.updateOrthoFrustum();
      // In ortho, move along the view ray to the parking distance (clear
      // of the geometry, inside the fog-free range) mid-flight.
      const dir = position.clone().sub(target).normalize();
      position = target.clone().addScaledVector(dir, 8);
    }
    this.tweenCam = {
      t: 0,
      duration,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromSize,
      toSize,
    };
  }

  focus(assemblyId: string | null) {
    if (!assemblyId) {
      this.frameAll();
      return;
    }
    const assembly = this.container?.assemblies.find(
      (a) => a.id === assemblyId,
    );
    if (!assembly) return;
    const box = new THREE.Box3().setFromObject(assembly.group);
    if (box.isEmpty()) return;
    const target = box.getCenter(new THREE.Vector3());
    const dir = this.currentDirection();
    const position = target
      .clone()
      .addScaledVector(dir, this.fitDistance(box, 1.42));
    this.flyToPose(target, position, 0.85, this.orthoFitSize(box, 1.42));
  }

  frameAll() {
    const box = this.modelBox();
    const target = box.getCenter(new THREE.Vector3());
    const dir = this.currentDirection();
    const position = target
      .clone()
      .addScaledVector(dir, this.fitDistance(box, 1.18));
    this.flyToPose(target, position, 0.85, this.orthoFitSize(box, 1.18));
  }

  setView(view: "front" | "top" | "contour" | "iso") {
    const box = this.modelBox();
    const target = box.getCenter(new THREE.Vector3());
    const dir =
      view === "front"
        ? new THREE.Vector3(0.02, 0.06, 1)
        : view === "top"
          ? new THREE.Vector3(0.02, 1, 0.06)
          : view === "contour"
            ? new THREE.Vector3(1, 0.08, 0.04)
            : new THREE.Vector3(0.62, 0.42, 0.78);
    dir.normalize();
    const position = target
      .clone()
      .addScaledVector(dir, this.fitDistance(box, 1.18));
    this.flyToPose(target, position, 0.85, this.orthoFitSize(box, 1.18));
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.cb.onError?.(
      "WebGL context lost — waiting for the browser to restore it",
    );
  };

  private onContextRestored = () => {
    // PMREM outputs are context-owned; regenerate them after driver recovery.
    this.skyEnvs.forEach((texture) => texture.dispose());
    this.skyEnvs.clear();
    this.roomEnv?.dispose();
    this.roomEnv = null;
    this.applyMood(this.state.mood);
    this.applyMaterialState();
    this.updateSection(true);
    this.markShadowsDirty();
    this.cb.onError?.(null);
  };

  /* ---------------- picking ---------------- */

  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.pointerActive = true;
    this.pickTimer = 0;
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
    this.setHover(null);
  };

  private setHover(h: HoverInfo | null) {
    if (
      h?.part === this.hovered?.part &&
      h?.assemblyId === this.hovered?.assemblyId
    )
      return;
    this.hovered = h;
    this.renderer.domElement.style.cursor = h ? "crosshair" : "grab";
    this.cb.onHover?.(h);
  }

  private pick() {
    if (!this.container) return;
    if (this.measureMode) {
      this.setHover(null);
      return;
    }
    if (!this.pointerActive) {
      this.setHover(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.container.group, true);
    const hit = this.firstVisibleHit(hits);
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
      part:
        (hit.object.userData.part as string) ?? hit.object.name ?? "Component",
      assembly: assembly?.label ?? MODELS[this.state.model].name,
      assemblyId: assembly?.id ?? "",
    });
  }

  /* ---------------- loop ---------------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    // Hidden tabs pause rAF in most browsers; guard the rest explicitly so
    // an occluded window burns no GPU time and the clock cannot jump.
    if (document.hidden) {
      this.clock.getDelta();
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    if (this.intro > 0) {
      this.intro = Math.max(0, this.intro - dt / 1.9);
      const k = 1 - this.intro;
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.introFrom, this.introTo, e);
    } else if (this.tweenCam) {
      this.tweenCam.t = Math.min(
        1,
        this.tweenCam.t + dt / this.tweenCam.duration,
      );
      const e = 1 - Math.pow(1 - this.tweenCam.t, 3);
      this.controls.target.lerpVectors(
        this.tweenCam.fromTarget,
        this.tweenCam.toTarget,
        e,
      );
      this.camera.position.lerpVectors(
        this.tweenCam.fromPos,
        this.tweenCam.toPos,
        e,
      );
      if (this.state.projection === "ortho") {
        this.orthoSize = THREE.MathUtils.lerp(
          this.tweenCam.fromSize,
          this.tweenCam.toSize,
          e,
        );
        this.updateOrthoFrustum();
      }
      if (this.tweenCam.t >= 1) this.tweenCam = null;
    }

    this.controls.autoRotate =
      this.state.autoRotate &&
      !this.reducedMotion &&
      this.intro === 0 &&
      !this.tweenCam;
    this.controls.update();

    // Picking is bounded to ~20 Hz; it is unnecessary work at display rate.
    this.pickTimer -= dt;
    if (this.pointerActive && this.pickTimer <= 0) {
      this.pick();
      this.pickTimer = 0.05;
    }
    if (!this.reducedMotion) this.container?.animate?.(this.elapsed, dt);

    const mat = this.highlightBox.material as THREE.LineBasicMaterial;
    if (this.highlightBox.visible) {
      mat.opacity = 0.55 + Math.sin(performance.now() * 0.005) * 0.35;
      const key = `${this.highlighted}|${this.state.explode.toFixed(2)}|${this.state.door.toFixed(2)}`;
      if (key !== this.highlightKey && this.highlighted && this.container) {
        this.highlightKey = key;
        const a = this.container.assemblies.find(
          (x) => x.id === this.highlighted,
        );
        if (a) this.frameAssemblyBox(a);
      }
    }

    if (this.shadowDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    this.renderer.render(this.scene, this.camera);

    this.frames++;
    this.acc += dt;
    if (this.acc > 0.5) {
      const fps = Math.round(this.frames / this.acc);
      this.cb.onPerf?.({
        fps,
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
      });
      this.adaptResolution(fps, this.acc);
      this.frames = 0;
      this.acc = 0;
    }
  };

  /** Deliberately hysteretic DPR control: stable quality, no visible hunting. */
  private adaptResolution(fps: number, sampleSeconds: number) {
    if (document.hidden || this.baseDpr <= 1) return;
    if (fps < 42) {
      this.lowFpsTime += sampleSeconds;
      this.recoveredTime = 0;
    } else if (fps > 55) {
      this.recoveredTime += sampleSeconds;
      this.lowFpsTime = 0;
    } else {
      this.lowFpsTime = 0;
      this.recoveredTime = 0;
    }

    if (this.lowFpsTime > 1.5 && this.dprScale > 0.65) {
      this.dprScale = Math.max(0.65, this.dprScale - 0.15);
      this.lowFpsTime = 0;
      this.resize();
    } else if (this.recoveredTime > 8 && this.dprScale < 1) {
      this.dprScale = Math.min(1, this.dprScale + 0.1);
      this.recoveredTime = 0;
      this.resize();
    }
  }

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.updateOrthoFrustum();
    this.renderer.setPixelRatio(this.baseDpr * this.dprScale);
    this.renderer.setSize(w, h, false);
    // Fit distances depend on aspect (portrait phones especially); refresh
    // the home pose without yanking the user's current camera.
    this.updateHomePose();
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
    return new STLExporter().parse(this.exportRoot(), {
      binary: true,
    }) as DataView;
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
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("webglcontextlost", this.onContextLost);
    el.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.controls.stopListenToKeyEvents();
    this.controls.dispose();
    this.container?.dispose();
    this.disposeAnnotations();
    this.clearMeasurePoints();
    this.state = { ...this.state, compare: "none" };
    this.rebuildCompare();
    if (this.sectionHelper) {
      this.sectionHelper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mm = mesh.material as THREE.Material | undefined;
        mm?.dispose();
      });
      this.scene.remove(this.sectionHelper);
      this.sectionHelper = null;
    }
    this.skyBgs.forEach((t) => t.dispose());
    this.skyEnvs.forEach((t) => t.dispose());
    this.roomEnv?.dispose();
    this.floor.geometry.dispose();
    this.floorMat.map?.dispose();
    this.floorMat.dispose();
    this.highlightBox.geometry.dispose();
    (this.highlightBox.material as THREE.Material).dispose();
    if (this.highlightTag) {
      (this.highlightTag.material as THREE.SpriteMaterial).map?.dispose();
      (this.highlightTag.material as THREE.Material).dispose();
    }
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}
