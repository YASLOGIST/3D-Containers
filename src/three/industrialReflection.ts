import * as THREE from "three";

/**
 * Offscreen illustrative industrial light rig for a prefiltered reflection
 * probe. No geometry or lights from this scene enter the viewer or exports.
 * Values are art-directed linear radiance, not measured photometry.
 */
export function makeIndustrialReflectionScene(): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.Material[] = [];
  function panel(name: string, position: [number,number,number],
    scale: [number,number,number], color: string, intensity: number,
    side: THREE.Side = THREE.FrontSide) {
    const material = new THREE.MeshLambertMaterial({
      color: 0x000000, emissive: new THREE.Color(color),
      emissiveIntensity: intensity, side,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(box, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    scene.add(mesh);
    return mesh;
  }
  panel("Indirect industrial enclosure", [0, 4.8, 0], [24, 20, 26], "#a3b5c4", .72, THREE.BackSide);
  panel("Diffuse concrete bounce", [0, -2.8, 0], [23, .12, 25], "#aba69b", .52);
  // Large soft area fixtures: elongated ceiling sources yield controlled
  // bands on the roof and narrow highlights on rounded extrusions.
  for (const x of [-6, 0, 6]) {
    panel("Ceiling strip", [x, 7.5, -1], [1.35, .13, 14], "#e9f2ff", 5.5);
  }
  // Broad cool window banks and neutral front bounce keep labels readable.
  for (const z of [-5, 5]) {
    panel("Clerestory bank", [-10, 3.4, z], [.14, 2.1, 6.8], "#c8def2", 3.8);
  }
  panel("Front broad softbox", [-2.2, 2.9, 10], [9.2, 5.2, .15], "#e9edf0", 2.8);
  panel("Warm loading-bay edge", [10, 2.4, -3.3], [.15, 4.8, 8.2], "#ffdfb9", 2.5);
  return { scene, dispose() {
    box.dispose();
    for (const material of materials) material.dispose();
    scene.clear();
  }};
}
