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
    lessons = load("confusionLessons.json")
    field_lessons = load("fieldLessons.json")
    supplemental = load("supplementalImageManifest.json")

    expected = {
        "recordCount": 290,
        "featureFieldCount": 62,
        "reverseIndexCount": 284,
        "glossaryCount": 36,
        "captureChecklistCount": 5,
        "referenceImageCount": 804,
        "localImageCount": 300,
        "matchedLocalImages": 252,
        "pendingLocalImages": 48,
        "localCoveredPlants": 76,
        "pendingNameCount": 18,
        "aliasCount": 28,
        "genusCount": 183,
    }
    for key, value in expected.items():
        assert summary[key] == value, f"{key}: {summary[key]} != {value}"

    assert len(plants) == 290
    assert len(feature_index) == 284
    assert len(glossary) == 36
    assert len(checklist) == 5
    assert len(pending) == 48
    assert len(lessons) == 8
    assert len(field_lessons) == 4
    assert len(supplemental) == 19
    assert summary["plantsWithImages"] == 290

    all_media = []
    for plant in plants:
        assert plant["id"].startswith("HBFC-")
        assert plant["names"]["chinese"]
        assert "profile" in plant
        assert plant["profile"]["introduction"] or plant["morphology"]["appearance"]
        assert plant["names"]["alias"] != "20"
        assert plant["sources"]["iplantQuery"] != "20"
        media = plant["media"]["localSamples"] + plant["media"]["iplantReferences"]
        assert media, f"植物缺少图片: {plant['id']} {plant['names']['chinese']}"
        all_media.extend(image["displayUrl"] if "displayUrl" in image else image["url"] for image in media)

    all_media.extend(image["displayUrl"] for image in pending)
    assert len(all_media) == len(set(all_media)), "媒体路径出现重复"
    for url in all_media:
        path = PUBLIC / url.lstrip("/")
        assert path.exists(), f"媒体缺失: {url}"
        with Image.open(path) as image:
            image.verify()

    derived_images = list((PUBLIC / "local-samples").rglob("*.webp"))
    assert len(derived_images) == 600
    for path in derived_images:
        with Image.open(path) as image:
            assert not image.getexif(), f"派生图片仍含 EXIF: {path.name}"
    for path in (PUBLIC / "plant-images" / "supplemental").glob("*.webp"):
        with Image.open(path) as image:
            assert not image.getexif(), f"补充参考图仍含 EXIF: {path.name}"

    public_text = "".join(path.read_text(encoding="utf-8") for path in DATA.glob("*.json"))
    for private_key in ["发送者ID", "图片消息ID", "标注消息ID", "messageId", "senderId", "gps"]:
        assert private_key not in public_text, f"公开数据包含隐私字段: {private_key}"

    huangjing = next(plant for plant in plants if plant["id"] == "HBFC-280")
    assert huangjing["names"]["latin"] == "Polygonatum sibiricum"
    assert huangjing["names"]["originalLatin"] == "Hemerocallis minor"
    assert "Polygonatum" not in huangjing["sources"]["iplantUrl"] or "0AFDB1D075A2CECC" in huangjing["sources"]["iplantUrl"]
    assert next(plant for plant in plants if plant["id"] == "HBFC-282")["names"]["latin"] == "Hemerocallis minor"

    mangniu = next(plant for plant in plants if plant["id"] == "HBFC-117")
    assert mangniu["names"]["chinese"] == "牻牛儿苗"
    assert mangniu["names"]["originalChinese"] == "糙牛儿苗"
    assert "太阳花" in mangniu["names"]["alias"]
    assert "糙牛儿苗" in mangniu["searchText"]

    jinlumei = next(plant for plant in plants if plant["id"] == "HBFC-071")
    assert jinlumei["names"]["latin"] == "Dasiphora fruticosa"
    assert jinlumei["taxonomy"]["genus"] == "金露梅属"
    assert "药王茶" in jinlumei["names"]["alias"]
    assert "Potentilla fruticosa".lower() in jinlumei["searchText"]

    assert summary["dataVersion"] == "V2.2-2026-07-13"
    assert summary["nameCuration"]["correctedRecordCount"] == 5
    assert next(plant for plant in plants if plant["id"] == "HBFC-255")["names"]["latin"] == "Koeleria macrantha"
    assert "漏芦" in next(plant for plant in plants if plant["id"] == "HBFC-226")["names"]["alias"]

    additions = {plant["id"]: plant for plant in plants if plant["id"] >= "HBFC-287"}
    assert additions["HBFC-287"]["names"]["latin"] == "Hemerocallis citrina"
    assert additions["HBFC-288"]["names"]["latin"] == "Persicaria lapathifolia"
    assert additions["HBFC-289"]["names"]["latin"] == "Carex sp."
    assert additions["HBFC-290"]["names"]["latin"] == "Galium sp."
    assert additions["HBFC-289"]["quality"]["needsReview"]
    assert additions["HBFC-290"]["quality"]["needsReview"]
    assert summary["additionalImport"]["imageCount"] == 46
    assert summary["additionalImport"]["matchedImageCount"] == 37
    assert summary["additionalImport"]["pendingImageCount"] == 9
    assert summary["additionalImport"]["partReviewCount"] == 4
    assert summary["additionalImport"]["pendingNames"] == ["毒芹", "豨莶", "长裂苦苣菜", "高山黄耆"]
    assert any(item["package"] == "植物平台导入包_20260711.zip" for item in summary["importHistory"])
    assert "波叶大黄" in next(plant for plant in plants if plant["id"] == "HBFC-021")["names"]["alias"]

    print(json.dumps({"status": "ok", **expected}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
