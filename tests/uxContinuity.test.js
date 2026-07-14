import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("joint identification keeps its complete draft in IndexedDB", () => {
  const view = read("../src/views/AssistantView.jsx");
  const store = read("../src/lib/jointDraftStore.js");
  assert.match(view, /loadJointDraft/);
  assert.match(view, /saveJointDraft/);
  assert.match(store, /entry\.file/);
  assert.match(store, /modelResult/);
  assert.match(store, /conditions/);
});

test("BioCLIP candidates resolve local catalog images", () => {
  const assistant = read("../src/views/AssistantView.jsx");
  const vision = read("../src/views/VisionView.jsx");
  assert.match(assistant, /candidateImage\(plant\)/);
  assert.match(vision, /plantImage\(plant\)/);
  assert.match(assistant, /candidate\.plantId/);
  assert.match(vision, /candidate\.plantId/);
});

test("sample review queue supports decisions and batch handling", () => {
  const view = read("../src/views/VisionView.jsx");
  assert.match(view, /标记为已确认前，请先关联一条正式植物记录/);
  assert.match(view, /应用到同名样本/);
  assert.match(view, /updatePendingIdentification/);
  assert.match(view, /exportReviewFile/);
});

test("PowerShell BioCLIP client accepts ecological constraints", () => {
  const cli = read("../model_service/interactive_cli.py");
  for (const flag of ["--query", "--habitat", "--climate", "--month", "--life-form", "--region"]) {
    assert.match(cli, new RegExp(flag));
  }
});
