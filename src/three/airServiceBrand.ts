import * as THREE from "three";
import type { ModelId } from "./models";
import type { FinishId, ViewerContainer } from "./primitives";

export const AIR_MARK_NAME = "YASLOGIST Air Cargo & Aviation - surface print";
const ARTWORK_ASPECT = 954 / 1024;
const INK_OFFSET = 0.0005;

type DoorField = {
  x: number;
  y: number;
  width: number;
};

// Metres in the leaf's local frame. Each field fits the entire lockup,
// including its lettering, inside one uninterrupted panel bay.
const DOOR_FIELDS: Partial<Record<ModelId, DoorField>> = {
  ake: { x: 1.085, y: 1.285, width: 0.37 },
  akc: { x: 0.707, y: 0.875, width: 0.49 },
  dpe: { x: 0.515, y: 0.875, width: 0.31 },
  dqf: { x: 1.473, y: 0.885, width: 0.55 },
  aqp: { x: 1.128, y: 0.885, width: 0.55 },
  akh: { x: 0.435, y: 0.73, width: 0.24 },
  alf: { x: 1.912, y: 0.885, width: 0.56 },
  alp: { x: 1.497, y: 0.885, width: 0.56 },
  aap: { x: 1.497, y: 0.885, width: 0.56 },
  rkn: { x: 0.342, y: 0.97, width: 0.30 },
  // Between the bezel and the next pressed seam in the insulated skin.
  rap: { x: 2.632, y: 0.875, width: 0.195 },
  ama: { x: 1.497, y: 1.39, width: 0.68 },
  amd: { x: 1.128, y: 1.85, width: 0.65 },
  aga: { x: 1.128, y: 1.39, width: 0.65 },
};

function addPrint(
  surface: THREE.Mesh,
  url: string,
  finish: FinishId,
  width: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
) {
  const map = new THREE.TextureLoader().load(url);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const lightInk = finish === "graphite" || finish === "airline";
  const material = new THREE.MeshStandardMaterial({
    map,
    color: lightInk ? "#e9f2fa" : "#0a2742",
    metalness: 0,
    roughness: 0.76,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(width, width * ARTWORK_ASPECT), material);
  mark.name = AIR_MARK_NAME;
  // Pointer inspection should identify the physical panel under the ink.
  mark.raycast = () => {};
  mark.position.copy(position);
  mark.rotation.copy(rotation);
  surface.add(mark);
}

export function addAirCargoOperatorMark(
  container: ViewerContainer,
  model: ModelId,
  finish: FinishId,
  url: string | undefined,
): boolean {
  if (!url || typeof Image === "undefined") return false;

  const field = DOOR_FIELDS[model];
  const pivot = container.doorPivot;
  const leaf = pivot?.getObjectByName("Door leaf") as THREE.Mesh | undefined;
  if (field && leaf && pivot?.visible) {
    leaf.geometry.computeBoundingBox();
    const z = leaf.geometry.boundingBox!.max.z + INK_OFFSET;
    addPrint(leaf, url, finish, field.width, new THREE.Vector3(field.x, field.y, z), new THREE.Euler());
    return true;
  }

  // With the fabric closure, the fixed rear bay beside the existing livery
  // has room for the whole print and remains planar while the curtain folds.
  if (model === "ake") {
    const panel = container.group.getObjectByName("Blind end panel") as THREE.Mesh | undefined;
    if (!panel) return false;
    panel.geometry.computeBoundingBox();
    const z = panel.geometry.boundingBox!.min.z - INK_OFFSET;
    addPrint(panel, url, finish, 0.31, new THREE.Vector3(0.557, 1.20, z), new THREE.Euler(0, Math.PI, 0));
    return true;
  }

  const deck = container.group.getObjectByName("Pallet base plate") as THREE.Mesh | undefined;
  if (!deck) return false;
  deck.geometry.computeBoundingBox();
  const box = deck.geometry.boundingBox!;
  const width = Math.min(0.66, (box.max.z - box.min.z) * 0.25);
  // The front half of the deck remains clear of the ID and weight stencils.
  addPrint(
    deck, url, finish, width,
    new THREE.Vector3(0, box.max.y + INK_OFFSET, box.max.z * 0.43),
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  return true;
}
