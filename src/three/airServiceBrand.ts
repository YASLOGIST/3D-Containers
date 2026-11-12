/**
 * Optional airline-service identity plate for visual inspection.
 * Never replaces operational ULD serial / tare / gross labels or warnings.
 *
 * The two original user supplied marks are retained under assets/branding/air;
 * the optimized artwork is passed in from the web UI, without loading assets
 * in Node-based geometry tests.
 */
import * as THREE from "three";
import type { ViewerContainer } from "./primitives";

export function addAirCargoOperatorMark(
  container: ViewerContainer,
  monogramUrl: string | undefined,
): boolean {
  if (!monogramUrl || typeof Image === "undefined") return false;
  const visibleInTree = (object: THREE.Object3D | null): boolean => {
    let node = object;
    while (node) {
      if (!node.visible) return false;
      node = node.parent;
    }
    return true;
  };
  const pivot = container.doorPivot ?? null;
  const rigidDoorVisible = !!pivot && visibleInTree(pivot);
  const blind = container.assemblies.find((a) => a.id === "blind")?.group;
  // For a flexible AKE closure, never attach a rigid placard to the folding
  // textile or to the intentionally hidden metal-door geometry.
  const parent = rigidDoorVisible ? pivot : blind;
  const surface = rigidDoorVisible
    ? pivot!.getObjectByName("Door leaf") as THREE.Mesh | undefined
    : blind?.getObjectByName("Blind end panel") as THREE.Mesh | undefined;
  if (!parent || !surface?.geometry) return false;
  surface.geometry.computeBoundingBox();
  const box = surface.geometry.boundingBox;
  if (!box) return false;
  const spanX = box.max.x - box.min.x;
  const spanY = box.max.y - box.min.y;
  if (spanX < 0.3 || spanY < 0.3) return false;

  const size = Math.min(0.14, spanX * 0.12, spanY * 0.15);
  const cx = box.min.x + spanX * (rigidDoorVisible ? 0.35 : 0.78);
  const cy = box.min.y + spanY * 0.20;
  const z = rigidDoorVisible ? box.max.z + 0.005 : box.min.z - 0.005;
  const rotationY = rigidDoorVisible ? 0 : Math.PI;

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.24, size * 1.10),
    new THREE.MeshStandardMaterial({
      color: "#ecf3f6",
      metalness: 0.06,
      roughness: 0.62,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  base.name = "Air Cargo operator mark - protective placard";
  base.position.set(cx, cy, z);
  base.rotation.y = rotationY;
  base.castShadow = false;
  parent.add(base);

  const map = new THREE.TextureLoader().load(monogramUrl);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const artwork = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 1.06, size * 0.91),
    new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    }),
  );
  artwork.name = "Air Cargo Aviation monogram - user supplied";
  artwork.position.set(cx, cy, z + (rigidDoorVisible ? 0.0012 : -0.0012));
  artwork.rotation.y = rotationY;
  artwork.castShadow = false;
  parent.add(artwork);
  return true;
}
