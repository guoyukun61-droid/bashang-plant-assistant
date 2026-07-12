from __future__ import annotations

import io
import json
import os
import re
import zipfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_PATH = Path(os.getenv("BASHANG_ADDITIONAL_PACKAGE", ROOT / "source-data" / "植物平台导入包.zip"))
DATA_DIR = ROOT / "public" / "data"
IMAGE_DIR = ROOT / "public" / "local-samples"
PACKAGE_NAME = PACKAGE_PATH.name

NAME_TO_PLANT_ID = {
    "线叶花旗杆": "HBFC-057",
    "酸模叶蓼": "HBFC-288",
    "鳞叶龙胆": "HBFC-151",
    "猪殃殃草": "HBFC-290",
    "朝阳芨芨草": "HBFC-258",
    "黄花葱": "HBFC-275",
    "二色补血草": "HBFC-150",
    "苔草": "HBFC-289",
    "猬菊": "HBFC-220",
    "披针叶野决明": "HBFC-115",
    "火绒草": "HBFC-197",
    "野亚麻": "HBFC-125",
    "黄花菜": "HBFC-287",
    "星毛委陵菜": "HBFC-081",
}


def load_json(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def write_json(name: str, value: Any) -> None:
    (DATA_DIR / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def empty_flower(**values: str) -> dict[str, str]:
    fields = [
        "color", "inflorescence", "corollaShape", "symmetry", "sexuality",
        "tepalCount", "size", "season", "description",
    ]
    return {field: values.get(field, "") for field in fields}


def empty_fruit(**values: str) -> dict[str, str]:
    fields = ["type", "shape", "color", "size", "season", "seed", "description"]
    return {field: values.get(field, "") for field in fields}


def empty_stem(**values: str) -> dict[str, str]:
    fields = [
        "texture", "posture", "branching", "structure", "color", "surface",
        "height", "description",
    ]
    return {field: values.get(field, "") for field in fields}


def empty_leaf(**values: str) -> dict[str, str]:
    fields = [
        "arrangement", "arrangementDetail", "type", "compoundType", "shape",
        "margin", "apex", "base", "venation", "texture", "surface", "petiole",
        "stipuleSheath", "size", "description",
    ]
    return {field: values.get(field, "") for field in fields}


def new_record(
    serial: int,
    chinese: str,
    latin: str,
    family: str,
    family_latin: str,
    genus: str,
    genus_latin: str,
    life_form: str,
    habitat: str,
    introduction: str,
    quick_method: str,
    key_combination: str,
    iplant_url: str,
    morphology: dict[str, Any],
    *,
    alias: str = "",
    provisional: bool = False,
) -> dict[str, Any]:
    plant_id = f"HBFC-{serial:03d}"
    review_note = (
        "群聊标签仅达到属级，保留 sp. 记录；需依据花果、小穗或分果等结构由教师定种。"
        if provisional else
        "由 2026-07-11 补充样本建立，名称与分类信息已按 iPlant 定向核对。"
    )
    record = {
        "id": plant_id,
        "legacyId": f"P{serial:03d}",
        "serial": serial,
        "names": {
            "chinese": chinese,
            "alias": alias,
            "latin": latin,
            "originalChinese": "",
            "originalLatin": "",
        },
        "taxonomy": {
            "family": family,
            "familyLatin": family_latin,
            "genus": genus,
            "genusLatin": genus_latin,
        },
        "ecology": {"lifeForm": life_form, "habitat": habitat},
        "profile": {
            "introduction": introduction,
            "habitatNote": habitat,
            "sourceIntroduction": quick_method,
        },
        "morphology": morphology,
        "identification": {
            "quickMethod": quick_method,
            "keyCombination": key_combination,
            "suggestedParts": ["全株", "生境", "花或花序", "叶与茎连接处", "果实"],
            "steps": [
                f"记录整体：{introduction}",
                f"核对组合：{key_combination}",
                f"确认特征：{quick_method}",
            ],
        },
        "media": {
            "localSamples": [],
            "iplantReferences": [],
            "status": {"whole": "已拍", "flower": "待核对", "fruit": "未拍", "leaf": "待核对", "stem": "待核对"},
        },
        "quality": {
            "completeness": 0.2 if provisional else 0.52,
            "needsReview": True,
            "reviewFlags": [review_note],
            "revisions": [{
                "field": "record",
                "originalValue": chinese.replace("（未定种）", ""),
                "acceptedValue": latin,
                "reviewStatus": "属级待定种" if provisional else "补充记录待教师复核",
                "authorityUrl": iplant_url,
                "note": review_note,
            }],
        },
        "sources": {
            "workbook": PACKAGE_NAME,
            "metadataSheet": "图片信息_平台导入.json",
            "iplantUrl": iplant_url,
            "iplantQuery": latin,
        },
    }
    refresh_search_text(record)
    return record


def additional_records() -> list[dict[str, Any]]:
    return [
        new_record(
            287, "黄花菜", "Hemerocallis citrina", "百合科", "Liliaceae", "萱草属", "Hemerocallis",
            "多年生草本", "山坡、山谷、荒地、林缘及湿润草地。",
            "多年生草本，肉质根常具纺锤状膨大；叶线形，花葶通常分枝，花被淡黄色。",
            "根近肉质并具膨大部；花被淡黄色，花被筒较长；蒴果钝三棱状椭圆形。",
            "淡黄色花 + 线形叶 + 肉质膨大根 + 蒴果",
            "https://www.iplant.cn/info/Hemerocallis%20citrina",
            {
                "appearance": "多年生草本，肉质根常具纺锤状膨大；叶线形，花葶通常分枝，花被淡黄色。",
                "flower": empty_flower(color="淡黄色", inflorescence="螺旋状聚伞花序组成圆锥花序", corollaShape="漏斗状", tepalCount="6", season="5-9月", description="花葶通常稍长于叶并有分枝；花被淡黄色，花被筒长3-5厘米，裂片较长。"),
                "fruit": empty_fruit(type="蒴果", shape="钝三棱状椭圆形", season="5-9月", seed="种子黑色、有棱", description="蒴果钝三棱状椭圆形，种子黑色并具棱。"),
                "stem": empty_stem(texture="草质", posture="直立", structure="花葶上部分枝", height="可达1米", description="花葶直立，通常稍长于叶，上部有分枝。"),
                "leaf": empty_leaf(arrangement="基生", type="单叶", shape="线形", margin="全缘", size="长0.5-1.3米，宽0.5-2.5厘米", description="叶7-20枚基生，线形或带形。"),
                "root": "根近肉质，中下部常具纺锤状膨大。",
            },
            alias="金针菜、柠檬萱草、金针花",
        ),
        new_record(
            288, "酸模叶蓼", "Persicaria lapathifolia", "蓼科", "Polygonaceae", "蓼属", "Persicaria",
            "一年生草本", "湿地、河滩、沟边、田边及水边扰动生境。",
            "一年生草本，茎节膨大；叶披针形，常有黑褐色新月斑；密集穗状花序组成圆锥状。",
            "观察叶面新月形斑、平截托叶鞘和具腺体的花序梗；瘦果宽卵形而扁平。",
            "膨大茎节 + 披针形斑叶 + 平截托叶鞘 + 穗状花序",
            "https://www.iplant.cn/bk/1E9A7504AFCBB486",
            {
                "appearance": "一年生草本，茎直立分枝且节部膨大；叶披针形，密集穗状花序组成圆锥状。",
                "flower": empty_flower(color="淡红色或白色", inflorescence="穗状花序组成圆锥状", tepalCount="4或5", season="6-8月", description="数个穗状花序组成圆锥状，花序梗具腺体；花被淡红色或白色。"),
                "fruit": empty_fruit(type="瘦果", shape="宽卵形、扁平", color="黑褐色", size="长2-3毫米", season="7-9月", description="瘦果宽卵形而扁平，黑褐色，包于宿存花被内。"),
                "stem": empty_stem(texture="草质", posture="直立", branching="分枝", structure="节部膨大", height="可达90厘米", description="茎直立、分枝，节部明显膨大。"),
                "leaf": empty_leaf(arrangement="互生", type="单叶", shape="披针形或宽披针形", apex="渐尖或尖", base="楔形", stipuleSheath="托叶鞘顶端平截", description="叶披针形或宽披针形，上面常具黑褐色新月形斑点，托叶鞘顶端平截。"),
                "root": "",
            },
            alias="大马蓼",
        ),
        new_record(
            289, "苔草（未定种）", "Carex sp.", "莎草科", "Cyperaceae", "苔草属", "Carex",
            "多年生草本", "湿草甸、沼泽、河岸及林下湿润地。",
            "莎草科苔草属植物，叶狭长，花组成小穗；当前照片标签不足以确定到种。",
            "定种需补拍雌雄小穗排列、雌花鳞片、果囊、喙口和柱头数。",
            "狭长叶 + 小穗 + 果囊；物种待复核",
            "https://www.iplant.cn/info/Carex",
            {
                "appearance": "莎草科苔草属草本，叶狭长，花组成小穗；当前记录未定种。",
                "flower": empty_flower(inflorescence="小穗", description="需补拍雌雄小穗的数量、排列及鳞片结构。"),
                "fruit": empty_fruit(type="小坚果包于果囊", description="需观察果囊形状、脉、毛被、喙及喙口。"),
                "stem": empty_stem(texture="草质", posture="直立", structure="秆常三棱形", description="秆形态需结合横切面与基部叶鞘复核。"),
                "leaf": empty_leaf(type="单叶", shape="线形", description="叶狭长；需记录叶宽、叶鞘颜色和基部纤维。"),
                "root": "根状茎特征待补充。",
            },
            alias="薹草",
            provisional=True,
        ),
        new_record(
            290, "猪殃殃草（未定种）", "Galium sp.", "茜草科", "Rubiaceae", "拉拉藤属", "Galium",
            "草本", "草地、林缘、灌丛、沟边及山坡。",
            "拉拉藤属草本，茎通常四棱，叶轮生，花小；当前俗名标签不足以确定到种。",
            "定种需核对轮生叶片数、叶脉、茎棱倒刺、花冠裂片数及果实是否具钩毛。",
            "四棱茎 + 轮生叶 + 小型花；物种待复核",
            "https://www.iplant.cn/info/Galium",
            {
                "appearance": "拉拉藤属草本，茎通常四棱，叶轮生，花小；当前记录未定种。",
                "flower": empty_flower(inflorescence="聚伞花序", corollaShape="辐状", description="花小，通常为聚伞花序；需补拍花冠裂片。"),
                "fruit": empty_fruit(type="分果", description="需观察分果表面是光滑、具瘤还是具钩毛。"),
                "stem": empty_stem(texture="草质", structure="常四棱", description="需记录茎棱是否具有倒向小刺。"),
                "leaf": empty_leaf(arrangement="轮生", type="单叶", description="需记录每轮叶片数、叶形、叶脉和叶缘毛被。"),
                "root": "",
            },
            alias="猪殃殃",
            provisional=True,
        ),
    ]


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
    ids = [
        sample["id"]
        for plant in plants
        for sample in plant["media"]["localSamples"]
    ] + [sample["id"] for sample in pending]
    numbers = [int(match.group()) for item in ids if (match := re.search(r"\d+", item))]
    return max(numbers, default=0) + 1


def recompute_summary(
    summary: dict[str, Any], plants: list[dict[str, Any]], pending: list[dict[str, Any]]
) -> dict[str, Any]:
    matched_samples = [
        sample for plant in plants for sample in plant["media"]["localSamples"]
    ]
    all_samples = matched_samples + pending
    summary.update({
        "recordCount": len(plants),
        "localImageCount": len(all_samples),
        "matchedLocalImages": len(matched_samples),
        "pendingLocalImages": len(pending),
        "localCoveredPlants": sum(bool(plant["media"]["localSamples"]) for plant in plants),
        "pendingNameCount": len({sample["submittedName"] for sample in pending}),
        "aliasCount": sum(bool(plant["names"]["alias"]) for plant in plants),
        "familyCount": len({plant["taxonomy"]["family"] for plant in plants if plant["taxonomy"]["family"]}),
        "genusCount": len({plant["taxonomy"]["genus"] for plant in plants if plant["taxonomy"]["genus"]}),
        "averageCompleteness": round(sum(plant["quality"]["completeness"] for plant in plants) / len(plants), 3),
        "dataVersion": "V2.1-2026-07-11",
        "additionalImport": {
            "package": PACKAGE_NAME,
            "imageCount": 39,
            "submittedNameCount": 14,
            "newRecordCount": 4,
            "provisionalRecordCount": 2,
        },
    })
    return summary


def main() -> None:
    if not PACKAGE_PATH.exists():
        raise FileNotFoundError(PACKAGE_PATH)

    plants = load_json("plants.json")
    pending = load_json("pendingSamples.json")
    summary = load_json("catalogSummary.json")
    plants_by_id = {plant["id"]: plant for plant in plants}

    if any(
        sample.get("sourcePackage") == PACKAGE_NAME
        for plant in plants
        for sample in plant["media"]["localSamples"]
    ):
        print(json.dumps({"status": "already-imported", "package": PACKAGE_NAME}, ensure_ascii=False))
        return

    for record in additional_records():
        if record["id"] not in plants_by_id:
            plants.append(record)
            plants_by_id[record["id"]] = record

    aliases = plants_by_id["HBFC-220"]["names"]["alias"]
    if "猬菊" not in aliases:
        plants_by_id["HBFC-220"]["names"]["alias"] = "、".join(filter(None, [aliases, "猬菊"]))
    refresh_search_text(plants_by_id["HBFC-220"])

    sample_serial = next_sample_serial(plants, pending)
    with zipfile.ZipFile(PACKAGE_PATH) as package:
        metadata = json.loads(package.read("图片信息_平台导入.json").decode("utf-8"))
        for offset, item in enumerate(metadata):
            plant_id = NAME_TO_PLANT_ID[item["plant"]]
            sample_id = f"SAMPLE-{sample_serial + offset:04d}"
            file_name = f"S{sample_serial + offset:04d}.webp"
            source_path = item["relative_path"].replace("\\", "/")
            source_bytes = package.read(source_path)
            save_webp(source_bytes, IMAGE_DIR / "display" / file_name, 1600, 84)
            save_webp(source_bytes, IMAGE_DIR / "thumb" / file_name, 560, 78)
            provisional = plants_by_id[plant_id]["names"]["latin"].endswith("sp.")
            sample = {
                "id": sample_id,
                "plantId": plant_id,
                "submittedName": item["plant"],
                "organLabel": item["part"] or "未标注",
                "matched": True,
                "reviewStatus": "待定种复核" if provisional else "已挂接",
                "displayUrl": f"/local-samples/display/{file_name}",
                "thumbnailUrl": f"/local-samples/thumb/{file_name}",
                "submittedAt": item["time"],
                "timeMeaning": "提交时间",
                "sourceType": "实习群补充样本",
                "sourcePackage": PACKAGE_NAME,
                "sourceFile": item["filename"],
            }
            plants_by_id[plant_id]["media"]["localSamples"].append(sample)

    for plant in plants:
        refresh_search_text(plant)
    plants.sort(key=lambda plant: plant["serial"])
    summary = recompute_summary(summary, plants, pending)

    write_json("plants.json", plants)
    write_json("pendingSamples.json", pending)
    write_json("catalogSummary.json", summary)
    print(json.dumps({"status": "ok", **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
