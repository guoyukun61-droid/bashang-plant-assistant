from __future__ import annotations

import io
import json
import os
import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_PATH = Path(os.getenv("BASHANG_DAILY_PACKAGE", ROOT / "source-data" / "植物平台导入包_每日样本.zip"))
DATA_DIR = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "local-samples"
PACKAGE_NAME = PACKAGE_PATH.name

NAME_TO_PLANT_ID = {
    "薄荷": "HBFC-168",
    "刺儿菜": "HBFC-223",
    "旋覆花": "HBFC-200",
    "天仙子": "HBFC-171",
    "荞麦": "HBFC-017",
    "独行菜": "HBFC-052",
    "北柴胡": "HBFC-140",
    "野火球": "HBFC-116",
    "田葛缕子": "HBFC-141",
    "马蔺": "HBFC-283",
    # iPlant records 波叶大黄 as a common name/synonym of the existing 华北大黄 record.
    "波叶大黄": "HBFC-021",
}


def load_json(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def write_json(name: str, value: Any) -> None:
    (DATA_DIR / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def flatten_text(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value] if value else []
    if isinstance(value, dict):
        return [text for child in value.values() for text in flatten_text(child)]
    if isinstance(value, list):
        return [text for child in value for text in flatten_text(child)]
    return []


def refresh_search_text(plant: dict[str, Any]) -> None:
    source = {key: value for key, value in plant.items() if key != "searchText"}
    plant["searchText"] = " ".join(dict.fromkeys(flatten_text(source))).lower()


def save_webp(source: bytes, target: Path, max_size: int, quality: int) -> None:
    with Image.open(io.BytesIO(source)) as opened:
        image = ImageOps.exif_transpose(opened)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=quality, method=6, exif=b"")


def next_sample_serial(plants: list[dict[str, Any]], pending: list[dict[str, Any]]) -> int:
    identifiers = [sample["id"] for plant in plants for sample in plant["media"]["localSamples"]]
    identifiers.extend(sample["id"] for sample in pending)
    numbers = [int(match.group()) for item in identifiers if (match := re.search(r"\d+", item))]
    return max(numbers, default=0) + 1


def package_date() -> str:
    match = re.search(r"(20\d{2})(\d{2})(\d{2})", PACKAGE_NAME)
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}" if match else "日期未标注"


def recompute_summary(summary: dict[str, Any], plants: list[dict[str, Any]], pending: list[dict[str, Any]], import_record: dict[str, Any]) -> None:
    matched = [sample for plant in plants for sample in plant["media"]["localSamples"]]
    history = summary.setdefault("importHistory", [])
    previous = summary.get("additionalImport")
    if previous and not any(item.get("package") == previous.get("package") for item in history):
        history.append(previous)
    history = [item for item in history if item.get("package") != PACKAGE_NAME]
    history.append(import_record)
    summary.update({
        "localImageCount": len(matched) + len(pending),
        "matchedLocalImages": len(matched),
        "pendingLocalImages": len(pending),
        "localCoveredPlants": sum(bool(plant["media"]["localSamples"]) for plant in plants),
        "pendingNameCount": len({sample["submittedName"] for sample in pending}),
        "aliasCount": sum(bool(plant["names"]["alias"]) for plant in plants),
        "dataVersion": f"V2.1-{package_date()}",
        "additionalImport": import_record,
        "importHistory": history,
    })


def main() -> None:
    if not PACKAGE_PATH.exists():
        raise FileNotFoundError(PACKAGE_PATH)

    plants = load_json("plants.json")
    pending = load_json("pendingSamples.json")
    summary = load_json("catalogSummary.json")
    plants_by_id = {plant["id"]: plant for plant in plants}
    existing_samples = [sample for plant in plants for sample in plant["media"]["localSamples"]] + pending
    if any(sample.get("sourcePackage") == PACKAGE_NAME for sample in existing_samples):
        print(json.dumps({"status": "already-imported", "package": PACKAGE_NAME}, ensure_ascii=False))
        return

    aliases = [part for part in re.split(r"[、,，;/；]", plants_by_id["HBFC-021"]["names"].get("alias", "")) if part]
    if "波叶大黄" not in aliases:
        aliases.append("波叶大黄")
        plants_by_id["HBFC-021"]["names"]["alias"] = "、".join(aliases)

    with zipfile.ZipFile(PACKAGE_PATH) as package:
        metadata_name = next(name for name in package.namelist() if name.lower().endswith(".json"))
        metadata = json.loads(package.read(metadata_name).decode("utf-8"))
        sample_serial = next_sample_serial(plants, pending)
        matched_count = 0
        pending_count = 0
        part_review_count = 0
        for offset, item in enumerate(metadata):
            sample_id = f"SAMPLE-{sample_serial + offset:04d}"
            file_name = f"S{sample_serial + offset:04d}.webp"
            source_path = item["relative_path"].replace("\\", "/")
            source_bytes = package.read(source_path)
            save_webp(source_bytes, IMAGE_DIR / "display" / file_name, 1600, 84)
            save_webp(source_bytes, IMAGE_DIR / "thumb" / file_name, 560, 78)

            plant_id = NAME_TO_PLANT_ID.get(item["plant"], "")
            part_pending = item.get("part") == "部位待复核"
            if part_pending:
                part_review_count += 1
            if plant_id:
                review_status = "部位待复核" if part_pending else "已挂接"
                matched_count += 1
            else:
                review_status = "名称与部位待复核" if part_pending else "名称待复核"
                pending_count += 1
            sample = {
                "id": sample_id,
                "plantId": plant_id,
                "submittedName": item["plant"],
                "organLabel": item.get("part") or "未标注",
                "matched": bool(plant_id),
                "reviewStatus": review_status,
                "displayUrl": f"/local-samples/display/{file_name}",
                "thumbnailUrl": f"/local-samples/thumb/{file_name}",
                "submittedAt": item["time"],
                "timeMeaning": "提交时间",
                "sourceType": "实习群每日样本",
                "sourcePackage": PACKAGE_NAME,
                "sourceFile": item["filename"],
            }
            if plant_id:
                plants_by_id[plant_id]["media"]["localSamples"].append(sample)
            else:
                pending.append(sample)

    for plant in plants:
        refresh_search_text(plant)

    import_record = {
        "package": PACKAGE_NAME,
        "date": package_date(),
        "imageCount": len(metadata),
        "submittedNameCount": len({item["plant"] for item in metadata}),
        "matchedImageCount": matched_count,
        "pendingImageCount": pending_count,
        "partReviewCount": part_review_count,
        "newRecordCount": 0,
        "provisionalRecordCount": 0,
        "pendingNames": sorted({item["plant"] for item in metadata if item["plant"] not in NAME_TO_PLANT_ID}),
        "organCounts": dict(Counter(item.get("part") or "未标注" for item in metadata)),
    }
    recompute_summary(summary, plants, pending, import_record)
    write_json("plants.json", plants)
    write_json("pendingSamples.json", pending)
    write_json("catalogSummary.json", summary)
    print(json.dumps({"status": "ok", **import_record, "summary": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
