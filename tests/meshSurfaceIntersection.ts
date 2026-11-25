import * as THREE from "three";

// A narrow-phase diagnostic for non-coplanar surface crossings. It does not
// detect complete containment, coplanar contact, or collisions between samples.
type Face = { points: THREE.Vector3[]; bounds: THREE.Box3 };
export function worldFaces(mesh: THREE.Mesh): Face[] {
  const positions = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : positions.count;
  const faces: Face[] = [];
  for (let i = 0; i + 2 < count; i += 3) {
    const points = [0, 1, 2].map(j => new THREE.Vector3()
      .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
      .applyMatrix4(mesh.matrixWorld));
    faces.push({ points, bounds: new THREE.Box3().setFromPoints(points) });
  }
  return faces;
}

export function hasSurfaceCrossing(a: Face[], b: Face[]): boolean {
  const ray = new THREE.Ray();
  const direction = new THREE.Vector3(), hit = new THREE.Vector3();
  function edgeHits(first: THREE.Vector3, last: THREE.Vector3, face: Face): boolean {
    direction.subVectors(last, first);
    const length = direction.length();
    if (length < 1e-9) return false;
    ray.origin.copy(first);
    ray.direction.copy(direction).divideScalar(length);
    const found = ray.intersectTriangle(face.points[0], face.points[1], face.points[2], false, hit);
    if (!found) return false;
    const distance = hit.distanceTo(first);
    return distance > 1e-6 && distance < length - 1e-6;
  }
  for (const first of a) {
    for (const second of b) {
      if (!first.bounds.intersectsBox(second.bounds)) continue;
      for (let i = 0; i < 3; i++) {
        if (edgeHits(first.points[i], first.points[(i + 1) % 3], second)
          || edgeHits(second.points[i], second.points[(i + 1) % 3], first)) return true;
      }
    }
  }
  return false;
}
