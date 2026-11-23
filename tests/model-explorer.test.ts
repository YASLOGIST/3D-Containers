import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MODELS } from "../src/three/models.ts";
import {
  filterModelCatalog,
  formatModelReferenceBrief,
  MODEL_CATALOG_FILTERS,
} from "../src/lib/modelCatalog.ts";
import { ModelExplorer } from "../src/components/ModelExplorer.tsx";

test("the explorer covers all 17 real ULD registry records", () => {
  const ids = filterModelCatalog("");
  assert.equal(ids.length, 17);
  assert.deepEqual(ids.sort(), Object.keys(MODELS).sort());
  assert.equal(MODEL_CATALOG_FILTERS.length, 5);
});

test("catalogue search matches code, type, aircraft and multiple tokens", () => {
  assert.ok(filterModelCatalog("ake").includes("ake"));
  assert.ok(filterModelCatalog("LD-3").includes("ake"));
  assert.ok(filterModelCatalog("boeing 767").length > 0);
  assert.deepEqual(filterModelCatalog("not-an-existing-uld"), []);
  assert.deepEqual(filterModelCatalog("  AKE  "), ["ake"]);
  assert.ok(filterModelCatalog("a320").length > 0);
});

test("catalogue categories are derived only from the existing model registry", () => {
  for (const filter of MODEL_CATALOG_FILTERS) {
    for (const id of filterModelCatalog("", filter.id)) {
      const model = MODELS[id];
      if (filter.id === "lower") assert.equal(model.hold.deck, "lower");
      if (filter.id === "main") assert.equal(model.hold.deck, "main");
      if (filter.id === "pallet") assert.equal(model.palletOption, true);
      if (filter.id === "reefer") assert.equal(model.reeferOption, true);
    }
  }
  assert.ok(filterModelCatalog("", "pallet").length > 0);
  assert.ok(filterModelCatalog("", "reefer").length > 0);
  assert.ok(filterModelCatalog("", "lower").length > 0);
  assert.ok(filterModelCatalog("", "main").length > 0);
  assert.ok(filterModelCatalog("AKE", "pallet").length === 0);
});

test("technical brief repeats model-sourced figures without certifying them", () => {
  for (const model of Object.values(MODELS)) {
    const text = formatModelReferenceBrief(model);
    assert.ok(text.includes(model.name));
    assert.ok(text.includes(model.ratings.maxGrossKg + " kg"));
    assert.ok(text.includes(model.ratings.payloadKg + " kg"));
    assert.ok(text.includes(model.ratings.volumeM3.toFixed(2) + " m³"));
    assert.ok(text.includes(model.aircraft));
    assert.ok(text.includes("NOT an OEM-approved ULD specification"));
  }
  assert.match(formatModelReferenceBrief(MODELS.ake), /Base width: [\d.]+ m/);
});

test("reference explorer is accessible and surfaces matching specifications", () => {
  const html = renderToStaticMarkup(createElement(ModelExplorer, {
    activeModel: "ake",
    onClose: () => {},
    onInspect: () => {},
    onCompare: () => {},
  }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Search ULD models by code, family, or aircraft/);
  assert.match(html, /Model Explorer/);
  assert.match(html, /17 of 17 registry models/);
  assert.match(html, /Return to 3D model/);
  assert.match(html, /Copy specs/);
  assert.match(html, /Reference ratings/);
  assert.match(html, /not OEM certification/);
});

test("catalogue leaves current model unchanged until an explicit action", () => {
  const html = renderToStaticMarkup(createElement(ModelExplorer, {
    activeModel: "rkn",
    onClose: () => {},
    onInspect: () => {},
    onCompare: () => {},
  }));
  assert.match(html, /RKN/);
  assert.match(html, /On canvas/);
  assert.match(html, /Preview AKE/);
  assert.match(html, /Return to 3D model/);
});
