import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { geometryOnlyExportScene } from "../src/three/geometryExport.ts";

const tolerance = 1e-5;

function synthetic() {
  const root = new THREE.Group();
  const anchor = new THREE.Group();
  anchor.position.set(0.5, 0, 0);
  root.add(anchor);

  const material = new THREE.MeshStandardMaterial();
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const instanced = new THREE.InstancedMesh(geo, material, 2);
  instanced.name = "Two different rivets";
  const matrix = new THREE.Matrix4();
  instanced.setMatrixAt(0, matrix.makeTranslation(1, 0.2, 0));
  instanced.setMatrixAt(1, matrix.makeTranslation(-2, 3, 4));
  anchor.add(instanced);

  const invisibleGroup = new THREE.Group();
  invisibleGroup.visible = false;
  const hidden = new THREE.Mesh(geo, material);
  hidden.position.set(100, 100, 100);
  invisibleGroup.add(hidden);
  root.add(invisibleGroup);
  return { root, instanced, geo, material };
}

function checkBounds(root: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(Math.abs(bounds.min.x + 1.55) < tolerance);
  assert.ok(Math.abs(bounds.max.x - 1.55) < tolerance);
  assert.ok(Math.abs(bounds.min.y - 0.15) < tolerance);
  assert.ok(Math.abs(bounds.max.y - 3.05) < tolerance);
  assert.ok(Math.abs(bounds.min.z + 0.05) < tolerance);
  assert.ok(Math.abs(bounds.max.z - 4.05) < tolerance);
}

test("geometry-only export places every instance in world coordinates without mutating the live model", () => {
  const { root, instanced, geo, material } = synthetic();
  const copy = geometryOnlyExportScene(root);
  checkBounds(copy);
  let regular = 0;
  let gpuInstances = 0;
  copy.traverse(obj => {
    if (obj instanceof THREE.InstancedMesh) gpuInstances++;
    else if (obj instanceof THREE.Mesh) {
      regular++;
      assert.equal(obj.geometry, geo, "geometry is shared, not re-tessellated");
      assert.equal(obj.material, material, "materials stay shared and unmodified");
    }
  });
  assert.equal(regular, 2);
  assert.equal(gpuInstances, 0);
  assert.equal(instanced.count, 2);
  assert.ok(instanced.parent, "source remains attached and renderable");
  assert.ok(root.children[1].visible === false, "source hidden variant stays untouched");
  assert.equal(root.children.length, 2);
  geo.dispose();
  material.dispose();
});

test("actual OBJ and binary STL agree on both translated instance positions", () => {
  const { root, geo, material } = synthetic();
  const prepared = geometryOnlyExportScene(root);
  const obj = new OBJExporter().parse(prepared);
  const verts = obj.split("\n").filter(line => line.startsWith("v ")).map(line =>
    line.split(/\s+/).slice(1, 4).map(Number));
  assert.ok(verts.length >= 16);
  const extrema = (axis: number) => [Math.min(...verts.map(v => v[axis])), Math.max(...verts.map(v => v[axis]))];
  assert.ok(Math.abs(extrema(0)[0] + 1.55) < tolerance);
  assert.ok(Math.abs(extrema(0)[1] - 1.55) < tolerance);
  assert.ok(Math.abs(extrema(1)[0] - 0.15) < tolerance);
  assert.ok(Math.abs(extrema(1)[1] - 3.05) < tolerance);

  const stl = new STLExporter().parse(prepared, { binary: true }) as DataView;
  const triangles = stl.getUint32(80, true);
  assert.equal(stl.byteLength, 84 + triangles * 50);
  const bb = new THREE.Box3();
  for (let i = 0; i < triangles; i++) {
    const p = 84 + i * 50;
    for (const offset of [12, 24, 36]) bb.expandByPoint(new THREE.Vector3(
      stl.getFloat32(p + offset, true),
      stl.getFloat32(p + offset + 4, true),
      stl.getFloat32(p + offset + 8, true),
    ));
  }
  assert.ok(Math.abs(bb.min.x + 1.55) < tolerance);
  assert.ok(Math.abs(bb.max.x - 1.55) < tolerance);
  assert.ok(Math.abs(bb.min.y - 0.15) < tolerance);
  assert.ok(Math.abs(bb.max.y - 3.05) < tolerance);
  assert.ok(Math.abs(bb.max.z - 4.05) < tolerance);
  geo.dispose();
  material.dispose();
});

test("geometry-only exports exclude ink labels, while GLB preview retains them", () => {
  const { root, geo, material } = synthetic();
  const visual = new THREE.Mesh(geo, material);
  visual.name = "Printed decal";
  visual.userData.visualOnlyDecal = true;
  root.add(visual);

  assert.equal(geometryOnlyExportScene(root).getObjectByName("Printed decal"), undefined);
  const rich = geometryOnlyExportScene(root, { keepVisualDecals: true });
  assert.ok(rich.getObjectByName("Printed decal"));
  assert.ok(root.getObjectByName("Printed decal"), "live scene never mutated");
  geo.dispose();
  material.dispose();
});

test("structural vertex bounds ignore hidden variants, decals and unused indexed vertices", () => {
  const {root, geo, material} = synthetic();
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute([0,0,0, 2,0,0, 0,1,0, 999,999,999],3));
  shape.setIndex([0,1,2]);
  const triangle = new THREE.Mesh(shape, material);
  triangle.position.set(0,0,0);
  triangle.rotation.z = Math.PI/4;
  root.add(triangle);
  const decal = new THREE.Mesh(geo, material);
  decal.position.set(500,500,500);
  decal.userData.visualOnlyDecal = true;
  root.add(decal);
  const bounds = structuralVertexBounds(root);
  const stl = new STLExporter().parse(geometryOnlyExportScene(root), {binary:true}) as DataView;
  const actual = new THREE.Box3();
  for(let i=0; i<stl.getUint32(80,true); i++){
    for(const offset of [12,24,36]){
      const at=84+i*50+offset;
      actual.expandByPoint(new THREE.Vector3(stl.getFloat32(at,true),stl.getFloat32(at+4,true),stl.getFloat32(at+8,true)));
    }
  }
  assert.ok(bounds.min.distanceTo(actual.min)<1e-5);
  assert.ok(bounds.max.distanceTo(actual.max)<1e-5);
  assert.ok(bounds.max.x<2 && bounds.max.z<5);
  assert.equal(root.children.length,4);
  assert.ok(decal.parent);
  shape.dispose();geo.dispose();material.dispose();
});

test("rotated instanced geometry uses actual vertices rather than rotated AABBs", () => {
  const root=new THREE.Group();
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,1,0],3));
  const mat=new THREE.MeshStandardMaterial();
  const mesh=new THREE.InstancedMesh(g,mat,2);
  mesh.setMatrixAt(0,new THREE.Matrix4().makeRotationZ(Math.PI/4));
  mesh.setMatrixAt(1,new THREE.Matrix4().makeRotationZ(-Math.PI/4).setPosition(4,0,0));
  root.add(mesh);
  const measured=structuralVertexBounds(root);
  assert.ok(Math.abs(measured.max.y-Math.SQRT2)<1e-6);
  assert.ok(Math.abs(measured.min.y+Math.SQRT2)<1e-6);
  assert.ok(Math.abs(measured.max.x-(4+Math.SQRT2))<1e-6);
  g.dispose();mat.dispose();
});
