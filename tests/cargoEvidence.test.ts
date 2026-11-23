import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assessCargoEvidence } from "../src/lib/cargoEvidence.ts";
import { CargoEvidencePanel } from "../src/components/CargoEvidencePanel.tsx";
import { demoCargoForModel, planCargoForModel, type CargoItem } from "../src/lib/cargoPlacement.ts";
import { MODELS, type ModelId } from "../src/three/models.ts";

const item = (id: string, massKg: number, widthM = 0.4): CargoItem => ({
  id, label:id, widthM, depthM:0.4, heightM:0.4, massKg,
});
const find = (report: ReturnType<typeof assessCargoEvidence>, id: string) => {
  const check = report.checks.find(c => c.id === id);
  assert.ok(check, `Missing check ${id}`);
  return check;
};

test("empty manifest cannot be shown as a successful load or approved flight", () => {
  const plan = planCargoForModel("ake", []);
  const report = assessCargoEvidence("ake", [], plan);
  assert.equal(report.operationallyApproved, false);
  assert.equal(report.requestedMassKg, 0);
  assert.equal(find(report, "nominal-payload").status, "not-run");
  assert.equal(find(report, "preview-placement").status, "not-run");
  assert.equal(report.checks.filter(c => c.status === "not-verified").length, 4);
});

test("all 17 model demos are classified as preview-only and never certified", () => {
  for (const model of Object.keys(MODELS) as ModelId[]) {
    const sample = demoCargoForModel(model);
    const plan = planCargoForModel(model, sample);
    const report = assessCargoEvidence(model, sample, plan);
    assert.equal(report.operationallyApproved, false);
    assert.equal(find(report, "preview-placement").status, "preview-placed");
    assert.equal(find(report, "nominal-payload").status, "within-reference");
    assert.equal(report.placedCartons, 27);
    assert.ok(report.checks.some(c => c.status === "not-verified"));
    assert.ok(report.checks.filter(c => c.status === "not-verified").length >= 4);
  }
});

test("requested mass uses ALL submissions, not only accepted mass", () => {
  const payload = MODELS.ake.ratings.payloadKg;
  const items = [item("over", payload + 100), item("accepted", 20)];
  const report = assessCargoEvidence("ake", items, planCargoForModel("ake", items));
  assert.equal(report.requestedMassKg, payload + 120);
  assert.equal(report.acceptedMassKg, 20);
  assert.equal(find(report, "nominal-payload").status, "exceeds-reference");
  assert.equal(find(report, "preview-placement").status, "preview-rejected");
  assert.equal(report.operationallyApproved, false);
});

test("rejected oversize cartons keep preview result rejected", () => {
  const items = [item("oversize", 15, 99), item("small", 10)];
  const report = assessCargoEvidence("ake", items, planCargoForModel("ake", items));
  assert.equal(find(report, "nominal-payload").status, "within-reference");
  assert.equal(find(report, "preview-placement").status, "preview-rejected");
  assert.equal(report.rejectedCartons, 1);
});

test("invalid or non-finite submitted mass cannot produce a reference pass", () => {
  for (const mass of [-2, 0, Number.POSITIVE_INFINITY, Number.NaN]) {
    const items = [item("bad", mass), item("good", 20)];
    const report = assessCargoEvidence("ake", items, planCargoForModel("ake", items));
    assert.equal(report.requestedMassKg, null);
    assert.equal(find(report, "nominal-payload").status, "not-evaluated");
    assert.equal(find(report, "preview-placement").status, "preview-rejected");
  }
});

test("refrigerated models expose missing thermal evidence explicitly", () => {
  const reefer = (Object.keys(MODELS) as ModelId[]).find(m => MODELS[m].reeferOption);
  assert.ok(reefer);
  const report = assessCargoEvidence(reefer, demoCargoForModel(reefer), planCargoForModel(reefer, demoCargoForModel(reefer)));
  assert.equal(find(report, "temperature").status, "not-verified");
  assert.ok(find(report, "temperature").evidence.includes("thermal"));
});

test("evidence component clearly labels unverified limits and never claims approval", () => {
  const items = demoCargoForModel("ake"), plan = planCargoForModel("ake", items);
  const html = renderToStaticMarkup(createElement(CargoEvidencePanel, {
    report: assessCargoEvidence("ake", items, plan),
  }));
  assert.match(html, /NOT CERTIFIED/);
  assert.match(html, /NOT VERIFIED/);
  assert.match(html, /675\.0 kg requested/);
  assert.match(html, /View checks and evidence/);
  assert.match(html, /floor/);
  assert.doesNotMatch(html, /APPROVED FOR FLIGHT|CERTIFIED LOAD PLAN/);
});
