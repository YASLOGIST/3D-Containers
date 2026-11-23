import * as THREE from "three";

/**
 * OBJ/STL exporters only walk ordinary Mesh geometry and do not expand
 * InstancedMesh per-instance transforms. Build a non-mutating scene copy and
 * materialize those instances for these geometry-only exchange formats.
 *
 * The cloned subtree shares geometries/materials read-only with the viewer.
 * Do not dispose the clones' shared resources.
 */
export function geometryOnlyExportScene(source: THREE.Group): THREE.Group {
  const output = source.clone(true);
  output.updateMatrixWorld(true);

  const filterAndExpand = (parent: THREE.Object3D) => {
    for (const child of [...parent.children]) {
      // OBJ and STL do not honor Object3D.visible or ancestors' visibility.
      // GLB already uses onlyVisible; match that contract for active variants.
      if (!child.visible) {
        parent.remove(child);
        continue;
      }
      if (!(child instanceof THREE.InstancedMesh)) {
        filterAndExpand(child);
        continue;
      }

      const expanded = new THREE.Group();
      expanded.name = child.name;
      expanded.matrixAutoUpdate = false;
      expanded.matrix.copy(child.matrix);

      const instanceMatrix = new THREE.Matrix4();
      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, instanceMatrix);
        const mesh = new THREE.Mesh(child.geometry, child.material);
        mesh.name = child.name + " instance " + (i + 1);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(instanceMatrix);
        expanded.add(mesh);
      }
      parent.add(expanded);
      parent.remove(child);
    }
  };

  filterAndExpand(output);
  output.updateMatrixWorld(true);
  return output;
}
