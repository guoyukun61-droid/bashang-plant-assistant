import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLANTS_PATH = ROOT / "public" / "data" / "plants.json"
SUMMARY_PATH = ROOT / "public" / "data" / "catalogSummary.json"
FEATURE_INDEX_PATH = ROOT / "public" / "data" / "featureIndex.json"


CURATIONS = {
    "HBFC-003": {
        "chinese": "樟子松",
        "aliases": ["海拉尔松"],
        "authorityUrl": "https://www.iplant.cn/bk/20E368650BA35994",
        "note": "移除原名录中的星号标记，并补充 iPlant 收录的常见别称。",
    },
    "HBFC-071": {
        "latin": "Dasiphora fruticosa",
        "genus": "金露梅属",
        "genusLatin": "Dasiphora",
        "aliases": ["棍儿茶", "药王茶", "金蜡梅", "金老梅", "格桑花"],
        "authorityUrl": "https://www.iplant.cn/bk/4D4B08698FE3A438",
        "note": "采用 iPlant 当前接受名与属级分类；旧拉丁名保留在校订记录中供检索。",
    },
    "HBFC-111": {
        "chinese": "蚕豆",
        "aliases": ["佛豆", "竖豆", "胡豆", "南豆"],
        "authorityUrl": "https://www.iplant.cn/bk/980C9EB0888D6113",
        "note": "移除原名录中的星号标记，并补充 iPlant 收录的常见别称。",
    },
    "HBFC-117": {
        "chinese": "牻牛儿苗",
        "aliases": ["太阳花"],
        "authorityUrl": "https://www.iplant.cn/bk/0868C537AB4B78B4",
        "note": "原表“糙牛儿苗”为误写；按 Erodium stephanianum 的接受中文名校订。",
    },
    "HBFC-220": {
        "chinese": "猬菊",
        "genus": "猬菊属",
        "genusLatin": "Olgaea",
        "aliases": ["蝟菊"],
        "authorityUrl": "https://www.iplant.cn/info/Olgaea%20lomonosowii",
        "note": "统一采用规范简体名称“猬菊”和“猬菊属”；原表繁体写法保留为历史别称供检索。",
    },
    "HBFC-290": {
        "chinese": "拉拉藤",
        "latin": "Galium spurium",
        "aliases": ["猪殃秧", "猪殃殃", "猪殃殃草", "猪殃殃草（未定种）"],
        "authorityUrl": "https://www.iplant.cn/info/Galium%20spurium",
        "note": "依据实习复核意见将原属级暂定记录接受为拉拉藤；原提交名称继续参与检索。",
    },
    "HBFC-283": {
        "latin": "Iris lactea",
        "aliases": ["马莲", "马帚", "箭秆风", "兰花草", "紫蓝草", "蠡实", "马兰花", "马兰", "白花马蔺"],
        "authorityUrl": "https://www.iplant.cn/bk/593E36A0B3852EC2",
        "note": "采用 iPlant 当前接受名；原变种名保留在校订记录中供检索。",
    },
}


def flatten_text(value):
    if isinstance(value, dict):
        for nested in value.values():
            yield from flatten_text(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from flatten_text(nested)
    elif isinstance(value, (str, int, float)) and str(value).strip():
        yield str(value).strip()


def split_aliases(value):
    return [part.strip() for part in re.split(r"[、,，;/；]", value or "") if part.strip()]


def add_revision(plant, field, original, accepted, curation):
    if not original or original == accepted:
        return
    revisions = plant["quality"].setdefault("revisions", [])
    if any(item.get("field") == field and item.get("acceptedValue") == accepted for item in revisions):
        return
    revisions.append({
        "field": field,
        "originalValue": original,
        "acceptedValue": accepted,
        "reviewStatus": "定向校订",
        "authorityUrl": curation["authorityUrl"],
        "note": curation["note"],
    })


def apply_curation(plant, curation):
    names = plant["names"]
    if curation.get("chinese") and names["chinese"] != curation["chinese"]:
        original = names["chinese"]
        names["originalChinese"] = names.get("originalChinese") or original
        names["chinese"] = curation["chinese"]
        add_revision(plant, "chineseName", original, curation["chinese"], curation)

    if curation.get("latin") and names["latin"] != curation["latin"]:
        original = names["latin"]
        names["originalLatin"] = names.get("originalLatin") or original
        names["latin"] = curation["latin"]
        add_revision(plant, "latinName", original, curation["latin"], curation)

    if curation.get("genus") and plant["taxonomy"]["genus"] != curation["genus"]:
        original = f"{plant['taxonomy']['genus']} {plant['taxonomy']['genusLatin']}"
        accepted = f"{curation['genus']} {curation['genusLatin']}"
        plant["taxonomy"]["genus"] = curation["genus"]
        plant["taxonomy"]["genusLatin"] = curation["genusLatin"]
        add_revision(plant, "genus", original, accepted, curation)

    aliases = [alias for alias in split_aliases(names.get("alias")) if alias != names["chinese"]]
    aliases.extend(curation.get("aliases", []))
    names["alias"] = "、".join(dict.fromkeys(aliases))
    plant["sources"]["iplantUrl"] = curation["authorityUrl"]
    plant["sources"]["iplantQuery"] = names["chinese"]

    searchable = {key: value for key, value in plant.items() if key != "searchText"}
    plant["searchText"] = " ".join(dict.fromkeys(flatten_text(searchable))).lower()


def main():
    plants = json.loads(PLANTS_PATH.read_text(encoding="utf-8"))
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    feature_index = json.loads(FEATURE_INDEX_PATH.read_text(encoding="utf-8"))
    plants_by_id = {plant["id"]: plant for plant in plants}

    missing = sorted(set(CURATIONS) - set(plants_by_id))
    if missing:
        raise RuntimeError(f"Missing plant records: {', '.join(missing)}")

    fine_sedge = plants_by_id["HBFC-268"]
    provisional_sedge = plants_by_id.get("HBFC-289")
    if provisional_sedge:
        existing_sample_ids = {sample["id"] for sample in fine_sedge["media"]["localSamples"]}
        for sample in provisional_sedge["media"]["localSamples"]:
            if sample["id"] not in existing_sample_ids:
                sample["plantId"] = "HBFC-268"
                sample["reviewStatus"] = "已挂接"
                sample["identificationRevision"] = {
                    "originalValue": sample.get("submittedName", "苔草"),
                    "acceptedValue": "细叶苔草",
                    "reviewStatus": "实习复核确认",
                }
                fine_sedge["media"]["localSamples"].append(sample)
        revision = {
            "field": "media.localSamples",
            "originalValue": "HBFC-289 苔草（未定种）",
            "acceptedValue": "HBFC-268 细叶苔草",
            "reviewStatus": "实习复核确认",
            "note": "将原苔草暂定样本并入细叶苔草，保留原提交名称。",
        }
        if not any(item.get("originalValue") == revision["originalValue"] for item in fine_sedge["quality"].setdefault("revisions", [])):
            fine_sedge["quality"]["revisions"].append(revision)
        plants.remove(provisional_sedge)
        del plants_by_id["HBFC-289"]
    if fine_sedge["media"]["localSamples"]:
        fine_sedge["media"]["status"]["whole"] = "已拍"
        fine_sedge["media"]["status"]["leaf"] = "已拍"

    for plant_id, curation in CURATIONS.items():
        apply_curation(plants_by_id[plant_id], curation)

    for feature in feature_index:
        normalized = []
        seen_ids = set()
        for plant_id, name in zip(feature.get("plantIds", []), feature.get("plantNames", [])):
            accepted_id = "HBFC-268" if plant_id == "HBFC-289" else plant_id
            accepted_name = "细叶苔草" if plant_id == "HBFC-289" else "拉拉藤" if plant_id == "HBFC-290" else "猬菊" if name == "蝟菊" else name
            if accepted_id in seen_ids:
                continue
            seen_ids.add(accepted_id)
            normalized.append((accepted_id, accepted_name))
        feature["plantIds"] = [item[0] for item in normalized]
        feature["plantNames"] = [item[1] for item in normalized]
        feature["plantCount"] = len(normalized)

    yellowroot = plants_by_id["HBFC-280"]
    yellowroot["sources"]["iplantUrl"] = "https://www.iplant.cn/bk/0AFDB1D075A2CECC"
    yellowroot["sources"]["iplantQuery"] = "黄精"
    searchable = {key: value for key, value in yellowroot.items() if key != "searchText"}
    yellowroot["searchText"] = " ".join(dict.fromkeys(flatten_text(searchable))).lower()

    summary["aliasCount"] = sum(bool(split_aliases(plant["names"].get("alias"))) for plant in plants)
    summary["genusCount"] = len({plant["taxonomy"]["genus"] for plant in plants if plant["taxonomy"]["genus"]})
    summary["recordCount"] = len(plants)
    summary["plantsWithImages"] = sum(bool(plant["media"]["localSamples"] or plant["media"]["iplantReferences"]) for plant in plants)
    summary["dataVersion"] = "V2.4-2026-07-14"
    summary["nameCuration"] = {
        "date": "2026-07-14",
        "correctedRecordCount": len(CURATIONS) + 1,
        "authority": "iPlant 植物智",
        "policy": "接受名用于展示，常见别称与历史误写继续参与检索",
    }

    PLANTS_PATH.write_text(json.dumps(plants, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    FEATURE_INDEX_PATH.write_text(json.dumps(feature_index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary["nameCuration"], ensure_ascii=False))


if __name__ == "__main__":
    main()
