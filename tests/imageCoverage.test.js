import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const plants = JSON.parse(readFileSync(join(root, "public/data/plants.json"), "utf8"));
const lessons = JSON.parse(readFileSync(join(root, "public/data/confusionLessons.json"), "utf8"));
const fieldLessons = JSON.parse(readFileSync(join(root, "public/data/fieldLessons.json"), "utf8"));

test("every formal plant has a loadable local image path", () => {
  assert.equal(plants.length, 289);
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

test("curated names expose accepted names, aliases and traceable revisions", () => {
  const mangniu = plants.find((plant) => plant.id === "HBFC-117");
  assert.equal(mangniu.names.chinese, "牻牛儿苗");
  assert.match(mangniu.names.alias, /太阳花/);
  assert.match(mangniu.searchText, /糙牛儿苗/);
  assert.ok(mangniu.quality.revisions.some((revision) => revision.originalValue === "糙牛儿苗" && /^https:\/\//.test(revision.authorityUrl)));

  const jinlumei = plants.find((plant) => plant.id === "HBFC-071");
  assert.equal(jinlumei.names.latin, "Dasiphora fruticosa");
  assert.equal(jinlumei.taxonomy.genus, "金露梅属");
  assert.match(jinlumei.names.alias, /药王茶/);

  const weiju = plants.find((plant) => plant.id === "HBFC-220");
  assert.equal(weiju.names.chinese, "猬菊");
  assert.equal(weiju.taxonomy.genus, "猬菊属");
  assert.match(weiju.names.alias, /蝟菊/);
  assert.match(weiju.searchText, /蝟菊/);
});

test("teaching lessons only reference existing plants with images", () => {
  const ids = new Set(plants.map((plant) => plant.id));
  assert.equal(lessons.length, 8);
  for (const lesson of lessons) {
    assert.ok(lesson.plantIds.length >= 2);
    lesson.plantIds.forEach((id) => assert.ok(ids.has(id), `${lesson.id} references unknown ${id}`));
    assert.ok(lesson.sources.length >= 1, `${lesson.id} is missing sources`);
    assert.ok(lesson.quiz.answer >= 0 && lesson.quiz.answer < lesson.quiz.choices.length, `${lesson.id} has an invalid quiz answer`);
  }
  assert.equal(fieldLessons.length, 4);
  fieldLessons.forEach((lesson) => assert.equal(lesson.steps.length, 4));
});

test("2026-07-12 daily samples preserve matching and review boundaries", () => {
  const pending = JSON.parse(readFileSync(join(root, "public/data/pendingSamples.json"), "utf8"));
  const packageName = "植物平台导入包_20260712.zip";
  const matched = plants.flatMap((plant) => plant.media.localSamples).filter((sample) => sample.sourcePackage === packageName);
  const unmatched = pending.filter((sample) => sample.sourcePackage === packageName);
  assert.equal(matched.length, 37);
  assert.equal(unmatched.length, 9);
  assert.equal([...matched, ...unmatched].filter((sample) => sample.organLabel === "部位待复核").length, 4);
  assert.deepEqual([...new Set(unmatched.map((sample) => sample.submittedName))].sort(), ["毒芹", "豨莶", "长裂苦苣菜", "高山黄耆"].sort());
  const northChinaRhubarb = plants.find((plant) => plant.id === "HBFC-021");
  assert.match(northChinaRhubarb.names.alias, /波叶大黄/);
  assert.equal(northChinaRhubarb.media.localSamples.filter((sample) => sample.sourcePackage === packageName).length, 2);
});

test("reviewed provisional names resolve to accepted plant records", () => {
  assert.equal(plants.some((plant) => plant.id === "HBFC-289"), false);
  const fineSedge = plants.find((plant) => plant.id === "HBFC-268");
  assert.deepEqual(fineSedge.media.localSamples.map((sample) => sample.id).sort(), ["SAMPLE-0244", "SAMPLE-0245"]);
  assert.ok(fineSedge.media.localSamples.every((sample) => sample.plantId === "HBFC-268"));

  const cleavers = plants.find((plant) => plant.id === "HBFC-290");
  assert.equal(cleavers.names.chinese, "拉拉藤");
  assert.equal(cleavers.names.latin, "Galium spurium");
  assert.match(cleavers.names.alias, /猪殃秧/);
  assert.match(cleavers.searchText, /猪殃殃草/);
});

test("mobile image dialogs expose close, backdrop and escape paths", () => {
  const library = readFileSync(join(root, "src/views/LibraryView.jsx"), "utf8");
  const vision = readFileSync(join(root, "src/views/VisionView.jsx"), "utf8");
  const assistant = readFileSync(join(root, "src/views/AssistantView.jsx"), "utf8");
  for (const source of [library, vision, assistant]) {
    assert.match(source, /aria-label="关闭/);
    assert.match(source, /document\.body\.style\.overflow = "hidden"/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /onClick=\{\(\) => set(?:LightboxIndex\(null\)|SelectedUrl\(""\))\}/);
  }
});

test("library preserves user context and explains filtered-out selections", () => {
  const library = readFileSync(join(root, "src/views/LibraryView.jsx"), "utf8");
  assert.match(library, /sessionStorage\.setItem\(LIBRARY_STATE_KEY/);
  assert.match(library, /scrollTop/);
  assert.match(library, /当前查看不在筛选结果中/);
  assert.match(library, /原名校订/);
  assert.match(library, /正名、别称、拉丁名或特征/);
});

test("model health checks fail quickly without shortening image inference", () => {
  const gateway = readFileSync(join(root, "src/lib/modelGateway.js"), "utf8");
  assert.match(gateway, /fetchJson\(healthApiUrl, \{ method: "GET", cache: "no-store" \}, 8_000\)/);
  assert.match(gateway, /requestTimeoutMs = timeoutMs/);
});
