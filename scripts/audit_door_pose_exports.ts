/**
 * Reproduce the door-pose STL audit without a browser. Uses the actual
 * generator and production exporter, not a substitute mesh.
 *
 * node --import tsx scripts/audit_door_pose_exports.ts /tmp/new-audit-dir
 * python3 scripts/verify_stl_topology.py /tmp/new-audit-dir/*.stl
 *
 * Rigid and fabric specimens are intentionally separate: textile sheets
 * are surface meshes, not closed solids.
 */
import "../tests/headlessCanvas.ts";
import { MODELS, type ModelId } from "../src/three/models.ts";
import { geometryOnlyExportScene } from "../src/three/geometryExport.ts";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ViewerOptions } from "../src/three/primitives.ts";

const output = process.argv[2];
if (!output) throw new Error("Provide a new output directory");
const dir = resolve(output);
mkdirSync(dir); // Refuse to overwrite or mix a previous audit.
const options: ViewerOptions = {
  contour: true, finish: "mill", detail: true, rivets: true, doorOpen: 0,
  akeDoor: "rigid", reefer: true, setpoint: -18, load: 0,
};
const rigidPoses = [0, 0.09, 0.18, 0.25, 0.5, 0.75, 1];
function specimen(id: ModelId, detail: boolean, fabric: boolean, poses: number[]) {
  const container = MODELS[id].build({
    ...options, detail, rivets: detail, akeDoor: fabric ? "fabric" : "rigid",
  });
  try {
    for (const pose of poses) {
      container.setDoorOpen(pose);
      const stl = new STLExporter().parse(geometryOnlyExportScene(container.group), {
        binary: true,
      }) as DataView;
      const name = [id, ...(fabric ? ["fabric"] : []), detail ? "full" : "minimal", pose].join("-");
      writeFileSync(join(dir, name + ".stl"), Buffer.from(stl.buffer, stl.byteOffset, stl.byteLength));
      console.log(JSON.stringify({ name, triangles: stl.getUint32(80, true) }));
    }
  } finally {
    container.dispose();
  }
}
for (const id of Object.keys(MODELS) as ModelId[]) {
  if (MODELS[id].palletOption) continue;
  for (const detail of [true, false]) specimen(id, detail, false, rigidPoses);
}
for (const detail of [true, false]) specimen("ake", detail, true, [0, 0.5, 1]);
