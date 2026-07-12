import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const plants = JSON.parse(readFileSync(join(root, "public/data/plants.json"), "utf8"));
const lessons = JSON.parse(readFileSync(join(root, "public/data/confusionLessons.json"), "utf8"));

test("every formal plant has a loadable local image path", () => {
  assert.equal(plants.length, 290);
  for (const plant of plants) {
    const media = [...plant.media.localSamples, ...plant.media.iplantReferences];
    assert.ok(media.length > 0, `${plant.id} ${plant.names.chinese} has no image`);
    for (const item of media) {
      const url = item.displayUrl || item.url;
      assert.ok(existsSync(join(root, "public", url.replace(/^\//, ""))), `${plant.id} missing ${url}`);
    }
  }
});

test("祁州漏芦 is searchable by 漏芦 and has traceable supplemental media", () => {
  const plant = plants.find((item) => item.id === "HBFC-226");
  assert.match(plant.names.alias, /漏芦/);
  assert.match(plant.searchText, /漏芦/);
  const reference = plant.media.iplantReferences.find((item) => item.id === "SUPPLEMENT-HBFC-226");
  assert.ok(reference);
  assert.match(reference.sourceUrl, /^https:\/\//);
  assert.match(reference.license, /creativecommons\.org/);
});

test("teaching lessons only reference existing plants with images", () => {
  const ids = new Set(plants.map((plant) => plant.id));
  assert.equal(lessons.length, 7);
  for (const lesson of lessons) {
    assert.ok(lesson.plantIds.length >= 2);
    lesson.plantIds.forEach((id) => assert.ok(ids.has(id), `${lesson.id} references unknown ${id}`));
  }
});

test("mobile image dialogs expose close, backdrop and escape paths", () => {
  const library = readFileSync(join(root, "src/views/LibraryView.jsx"), "utf8");
  const vision = readFileSync(join(root, "src/views/VisionView.jsx"), "utf8");
  for (const source of [library, vision]) {
    assert.match(source, /aria-label="关闭/);
    assert.match(source, /document\.body\.style\.overflow = "hidden"/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /onClick=\{\(\) => set(?:LightboxIndex\(null\)|SelectedUrl\(""\))\}/);
  }
});
