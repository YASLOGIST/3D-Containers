import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseCartons, exportCartonDiagnosticsCSV } from "../src/lib/cargoDiagnostics.ts";
import { cargoCoreForModel, demoCargoForModel, planCargoForModel, type CargoItem } from "../src/lib/cargoPlacement.ts";
import { MODELS, type ModelId } from "../src/three/models.ts";

const item = (id: string, widthM = 0.4, massKg = 20): CargoItem => ({
  id, label: id, widthM, depthM: 0.4, heightM: 0.4, massKg,
});

test("every registered ULD demo has model-aware placed carton diagnostics", () => {
  for(const id of Object.keys(MODELS) as ModelId[]){
    const items = demoCargoForModel(id), plan = planCargoForModel(id, items);
    const report = diagnoseCartons(id, items, plan);
    assert.equal(report.total, 27, id);
    assert.equal(report.placed, 27, id);
    assert.equal(report.rejected, 0, id);
    assert.equal(report.operationallyApproved, false, id);
    for(const row of report.rows) {
      assert.equal(row.reason,"placed");
      assert.ok(row.centreM && row.centreM.x > 0 && row.centreM.y > 0 && row.centreM.z > 0);
      assert.ok(row.volumeM3 != null && row.volumeM3 > 0);
    }
  }
});

test("oversize description names exact exceeded core axes without claiming an OEM constraint", () => {
  const core=cargoCoreForModel("ake");
  const items=[item("big",core.widthM+0.2,20),item("ok")];
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  assert.equal(report.rows[0].reason,"oversize");
  assert.match(report.rows[0].explanation,/width.*>/);
  assert.match(report.rows[0].nextStep,/not validated/);
  assert.equal(report.rows[1].status,"placed");
});

test("overweight uses previously accepted cartons, not future or rejected mass", () => {
  const payload=MODELS.ake.ratings.payloadKg;
  const items=[item("accepted",0.4,20),item("too-heavy",0.4,payload),
    item("still-accepted",0.4,15)];
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  assert.equal(report.rows[1].reason,"overweight");
  assert.match(report.rows[1].explanation,/previously placed: 20.00 kg/);
  assert.match(report.rows[1].explanation,new RegExp((payload-20).toFixed(2)));
  assert.equal(report.rows[2].status,"placed");
});

test("invalid dimensions and mass do not produce misleading density", () => {
  const items=[item("invalid",NaN,-2)];
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  assert.equal(report.rows[0].reason,"invalid");
  assert.equal(report.rows[0].densityKgM3,null);
  assert.match(report.rows[0].explanation,/width, mass/);
});

test("no-space explanation never equates first-fit failure with physical impossibility", () => {
  const items=Array.from({length:30},(_,i)=>item(String(i)));
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  assert.ok(report.rows.some(r=>r.reason==="no-space"));
  assert.match(report.rows.find(r=>r.reason==="no-space")!.nextStep,/does not prove/);
});

test("over-40 carton preview limit is separate from no-space even if legacy planner uses no-space", () => {
  const items=Array.from({length:41},(_,i)=>item("C"+i,0.2,1));
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  assert.equal(report.total,41);
  assert.equal(report.rows.at(-1)?.reason,"preview-limit");
  assert.match(report.rows.at(-1)!.explanation,/did not attempt placement/);
});

test("CSV exports all rows, explicit non-certification limits, and neutralizes formula labels", () => {
  const items=[{...item("formula"),label:'=HYPERLINK("example","click")'}];
  const report=diagnoseCartons("ake",items,planCargoForModel("ake",items));
  const csv=exportCartonDiagnosticsCSV(report);
  assert.match(csv,/NOT CERTIFIED/);
  assert.match(csv,/'=HYPERLINK/);
  assert.match(csv,/""example""/);
  assert.equal(csv.split("\r\n").length>=5,true);
});

test("empty manifest produces an empty descriptive report, not load approval", () => {
  const report=diagnoseCartons("ake",[],planCargoForModel("ake",[]));
  assert.equal(report.total,0);
  assert.equal(report.operationallyApproved,false);
  assert.equal(report.rows.length,0);
});
