from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
PUBLIC = ROOT / "public"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> None:
    plants = load("plants.json")
    feature_index = load("featureIndex.json")
    glossary = load("glossary.json")
    checklist = load("captureChecklist.json")
    pending = load("pendingSamples.json")
    summary = load("catalogSummary.json")

    expected = {
        "recordCount": 290,
        "featureFieldCount": 62,
        "reverseIndexCount": 284,
        "glossaryCount": 36,
        "captureChecklistCount": 5,
        "referenceImageCount": 785,
        "localImageCount": 254,
        "matchedLocalImages": 215,
        "pendingLocalImages": 39,
        "localCoveredPlants": 65,
        "pendingNameCount": 14,
        "aliasCount": 22,
    }
    for key, value in expected.items():
        assert summary[key] == value, f"{key}: {summary[key]} != {value}"

    assert len(plants) == 290
    assert len(feature_index) == 284
    assert len(glossary) == 36
    assert len(checklist) == 5
    assert len(pending) == 39

    all_media = []
    for plant in plants:
        assert plant["id"].startswith("HBFC-")
        assert plant["names"]["chinese"]
        assert "profile" in plant
        assert plant["profile"]["introduction"] or plant["morphology"]["appearance"]
        assert plant["names"]["alias"] != "20"
        assert plant["sources"]["iplantQuery"] != "20"
        media = plant["media"]["localSamples"] + plant["media"]["iplantReferences"]
        all_media.extend(image["displayUrl"] if "displayUrl" in image else image["url"] for image in media)

    all_media.extend(image["displayUrl"] for image in pending)
    assert len(all_media) == len(set(all_media)), "媒体路径出现重复"
    for url in all_media:
        assert (PUBLIC / url.lstrip("/")).exists(), f"媒体缺失: {url}"

    derived_images = list((PUBLIC / "local-samples").rglob("*.webp"))
    assert len(derived_images) == 508
    for path in derived_images:
        with Image.open(path) as image:
            assert not image.getexif(), f"派生图片仍含 EXIF: {path.name}"

    public_text = "".join(path.read_text(encoding="utf-8") for path in DATA.glob("*.json"))
    for private_key in ["发送者ID", "图片消息ID", "标注消息ID", "messageId", "senderId", "gps"]:
        assert private_key not in public_text, f"公开数据包含隐私字段: {private_key}"

    huangjing = next(plant for plant in plants if plant["id"] == "HBFC-280")
    assert huangjing["names"]["latin"] == "Polygonatum sibiricum"
    assert huangjing["names"]["originalLatin"] == "Hemerocallis minor"
    assert next(plant for plant in plants if plant["id"] == "HBFC-282")["names"]["latin"] == "Hemerocallis minor"
    assert next(plant for plant in plants if plant["id"] == "HBFC-255")["names"]["latin"] == "Koeleria macrantha"

    additions = {plant["id"]: plant for plant in plants if plant["id"] >= "HBFC-287"}
    assert additions["HBFC-287"]["names"]["latin"] == "Hemerocallis citrina"
    assert additions["HBFC-288"]["names"]["latin"] == "Persicaria lapathifolia"
    assert additions["HBFC-289"]["names"]["latin"] == "Carex sp."
    assert additions["HBFC-290"]["names"]["latin"] == "Galium sp."
    assert additions["HBFC-289"]["quality"]["needsReview"]
    assert additions["HBFC-290"]["quality"]["needsReview"]
    assert summary["additionalImport"]["imageCount"] == 39

    print(json.dumps({"status": "ok", **expected}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
