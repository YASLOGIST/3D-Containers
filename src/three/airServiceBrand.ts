/**
 * Optional aviation-service identity decal.
 * Leaves the operational ULD serial, weight and warning markings unobscured.
 * Original supplied logo assets remain untouched.
 */
import * as THREE from "three";
import type { ViewerContainer } from "./primitives";

function attachTransparentMark(
  parent: THREE.Object3D,
  monogramUrl: string,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): THREE.Mesh {
  const texture = new THREE.TextureLoader().load(monogramUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.025,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  mark.name = "Air Cargo Aviation monogram - transparent applied decal";
  mark.position.set(x, y, z);
  mark.rotation.y = rotationY;
  mark.castShadow = false;
  mark.renderOrder = 2;
  parent.add(mark);
  return mark;
}

/**
 * Adds the mark to a clear region of each family's fixed door or blind panel.
 * Rigid doors carry it through their hinge motion. The flexible AKE curtain
 * uses the fixed blind end to avoid a rigid, floating-looking badge on fabric.
 * Flat pallets receive a small decal on the open deck, away from data stencils.
 */
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
  const door = rigidDoorVisible
    ? pivot!.getObjectByName("Door leaf") as THREE.Mesh | undefined
    : undefined;

  if (door?.geometry) {
    door.geometry.computeBoundingBox();
    const box = door.geometry.boundingBox;
    if (!box) return false;
    const spanX = box.max.x - box.min.x;
    const spanY = box.max.y - box.min.y;
    if (spanX < 0.45 || spanY < 0.55) return false;

    // Clear lower-left panel: above pull hardware, below the data plate, and
    // inside the perimeter rails. This avoids the central latch hardware.
    const width = THREE.MathUtils.clamp(spanX * 0.19, 0.20, 0.52);
    const height = width * (643 / 768);
    const x = box.min.x + spanX * 0.19;
    const y = box.min.y + spanY * 0.69;
    attachTransparentMark(pivot!, monogramUrl, width, height, x, y, box.max.z + 0.004);
    return true;
  }

  // AKE fabric-door mode intentionally hides the metal door. Use its stationary
  // blind-end skin so the artwork stays crisp and never bends with the curtain.
  const blindPanel = blind?.getObjectByName("Blind end panel") as THREE.Mesh | undefined;
  if (blind && blindPanel?.geometry) {
    blindPanel.geometry.computeBoundingBox();
    const box = blindPanel.geometry.boundingBox;
    if (!box) return false;
    const spanX = box.max.x - box.min.x;
    const spanY = box.max.y - box.min.y;
    if (spanX < 0.45 || spanY < 0.55) return false;
    const width = THREE.MathUtils.clamp(spanX * 0.19, 0.20, 0.52);
    const height = width * (643 / 768);
    attachTransparentMark(
      blind,
      monogramUrl,
      width,
      height,
      box.min.x + spanX * 0.19,
      box.min.y + spanY * 0.69,
      box.min.z - 0.004,
      Math.PI,
    );
    return true;
  }

  // Pallets have no upright closure. Put the logo on a clean rear-deck field,
  // well clear of the ID and load-limit stencils and away from the edge rails.
  const deck = container.group.getObjectByName("Pallet base plate") as THREE.Mesh | undefined;
  if (deck?.geometry) {
    deck.geometry.computeBoundingBox();
    const box = deck.geometry.boundingBox;
    if (!box) return false;
    const spanX = box.max.x - box.min.x;
    const spanZ = box.max.z - box.min.z;
    const width = THREE.MathUtils.clamp(Math.min(spanX, spanZ) * 0.16, 0.28, 0.38);
    const height = width * (643 / 768);
    const x = box.min.x + spanX * 0.62;
    const z = box.min.z + spanZ * 0.42;
    const mark = attachTransparentMark(
      deck,
      monogramUrl,
      width,
      height,
      x,
      box.max.y + 0.0015,
      z,
    );
    mark.rotation.x = -Math.PI / 2;
    return true;
  }
  return false;
}
