import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assistantEngine } from "../src/lib/assistantEngine.js";
import { visionPipeline } from "../src/lib/visionPipeline.js";

const knowledgeBase = {
  plants: JSON.parse(fs.readFileSync(new URL("../public/data/plants.json", import.meta.url))),
  featureIndex: JSON.parse(fs.readFileSync(new URL("../public/data/featureIndex.json", import.meta.url))),
};

test("structured feature queries return explainable candidates", () => {
  const scenarios = [
    "黄色 头状花序 舌状花",
    "湿地 禾本科",
    "紫色 球状花",
    "轮生叶 蒴果",
  ];
  scenarios.forEach((query) => {
    const result = assistantEngine(query, knowledgeBase);
    assert.equal(result.mode, "identification");
    assert.ok(result.features.length > 0, query);
    assert.ok(result.candidates.length > 0, query);
    assert.ok(result.candidates[0].supportFeatures.length > 0, query);
    assert.ok(result.candidates[0].nextObservation, query);
    assert.ok(result.candidates[0].sources.length > 0, query);
  });
});

test("wetland grass query keeps Poaceae candidates", () => {
  const result = assistantEngine("湿地 禾本科", knowledgeBase);
  assert.ok(result.candidates.some((candidate) => candidate.plant.taxonomy.family === "禾本科"));
});

test("name queries return every matching local record", () => {
  const expected = knowledgeBase.plants.filter((plant) => plant.searchText.includes("委陵菜")).length;
  const result = assistantEngine("委陵菜", knowledgeBase);
  assert.ok(expected > 6);
  assert.equal(result.candidates.length, expected);
});

test("common aliases and corrected historical names remain searchable", () => {
  const commonName = assistantEngine("太阳花", knowledgeBase);
  assert.equal(commonName.candidates[0].plant.id, "HBFC-117");
  assert.equal(commonName.candidates[0].plant.names.chinese, "牻牛儿苗");

  const historicalTypo = assistantEngine("糙牛儿苗", knowledgeBase);
  assert.equal(historicalTypo.candidates[0].plant.id, "HBFC-117");

  const medicineTea = assistantEngine("药王茶", knowledgeBase);
  assert.equal(medicineTea.candidates[0].plant.id, "HBFC-071");
});

test("comparison query preserves two official records", () => {
  const result = assistantEngine("帮我区分问荆和节节草", knowledgeBase);
  assert.equal(result.mode, "comparison");
  assert.deepEqual(result.plants.map((plant) => plant.names.chinese), ["问荆", "节节草"]);
  assert.ok(result.rows.length >= 4);
});

test("vision pipeline never fabricates species candidates", async () => {
  const files = [
    { name: "whole.jpg", type: "image/jpeg", size: 900_000 },
    { name: "leaf.png", type: "image/png", size: 500_000 },
  ];
  const result = await visionPipeline(files, ["全株", "叶"]);
  assert.equal(result.status, "待复核");
  assert.deepEqual(result.candidates, []);
  assert.match(result.conclusion, /未运行/);
  assert.ok(result.missingParts.includes("花"));
});
