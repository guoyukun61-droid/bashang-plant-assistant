from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import requests
from bs4 import BeautifulSoup
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
CACHE_DIR = ROOT / "tmp" / "iplant-cache"
PLANTS_PATH = DATA_DIR / "plants.json"
SUMMARY_PATH = DATA_DIR / "catalogSummary.json"
ENRICHMENT_PATH = DATA_DIR / "iplantEnrichment.json"
DEFAULT_EXPORT = ROOT / "release" / "河北丰宁坝上植物知识库_iPlant详情增强_20260714.xlsx"
BASE_URL = "https://www.iplant.cn"
USER_AGENT = "BashangPlantAssistant/2.2 (educational field-practice knowledge-base enrichment)"

MORPHOLOGY_FIELDS = {"识别要点", "形态特征", "生活型", "株", "根", "茎", "枝", "叶", "花", "果", "种子", "孢子囊"}
ECOLOGY_FIELDS = {"产地", "分布", "特有", "生境", "海拔", "物候", "栽培"}
REVIEW_FIELDS = {"俗名", "保护等级", "濒危等级", "分类讨论"}
DISPLAY_FIELD_ORDER = [
    "识别要点", "形态特征", "生活型", "株", "根", "茎", "枝", "叶", "花", "果", "种子", "孢子囊",
    "生境", "海拔", "物候", "产地", "分布", "俗名", "保护等级", "濒危等级", "经济价值",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = BeautifulSoup(html.unescape(str(value)), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def decode_detail(value: str | None) -> str:
    if not value:
        return ""
    try:
        return clean_text(base64.b64decode(value).decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return clean_text(value)


def cache_path(plant_id: str) -> Path:
    return CACHE_DIR / f"{plant_id}.json"


def read_cache(plant_id: str) -> dict[str, Any] | None:
    path = cache_path(plant_id)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if payload.get("status") in {"ok", "unresolved"} else None
    except (json.JSONDecodeError, OSError):
        return None


def write_cache(plant_id: str, payload: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path(plant_id).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class PoliteSession:
    def __init__(self, delay: float, timeout: float) -> None:
        self.delay = max(delay, 0.2)
        self.timeout = timeout
        self.last_request = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"})

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        pause = self.delay - (time.monotonic() - self.last_request)
        if pause > 0:
            time.sleep(pause)
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self.session.request(method, url, timeout=self.timeout, **kwargs)
                self.last_request = time.monotonic()
                if response.status_code in {429, 500, 502, 503, 504}:
                    time.sleep(2 ** attempt)
                    continue
                response.raise_for_status()
                return response
            except requests.RequestException as exc:
                last_error = exc
                self.last_request = time.monotonic()
                time.sleep(2 ** attempt)
        raise RuntimeError(f"请求失败: {url}: {last_error}")


def canonical_info_url(plant: dict[str, Any]) -> str:
    configured = str(plant.get("sources", {}).get("iplantUrl") or "").strip()
    if configured.startswith(BASE_URL):
        return configured
    latin = plant.get("names", {}).get("latin") or plant.get("names", {}).get("chinese")
    return f"{BASE_URL}/info/{quote(str(latin), safe='')}"


def parse_spid(page_text: str) -> str:
    for pattern in (r'var\s+spno\s*=\s*"([^"]+)"', r'var\s+spid\s*=\s*"([^"]+)"'):
        match = re.search(pattern, page_text)
        if match:
            return match.group(1).strip()
    return ""


def flatten_details(payload: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    fields: dict[str, str] = {}
    groups: dict[str, str] = {}
    for group in payload.get("spdesc", []):
        group_name = clean_text(group.get("t"))
        values = []
        for item in group.get("desclist", []):
            field_name = clean_text(item.get("subname"))
            field_value = decode_detail(item.get("desc"))
            if field_name and field_value:
                fields[field_name] = field_value
                values.append(f"{field_name}：{field_value}")
        if group_name and values:
            groups[group_name] = "；".join(values)
    return fields, groups


def fetch_plant(session: PoliteSession, plant: dict[str, Any]) -> dict[str, Any]:
    source_url = canonical_info_url(plant)
    page = None
    spid = ""
    for attempt in range(3):
        page = session.request("GET", source_url, params={"retry": attempt} if attempt else None)
        page_text = page.content.decode("utf-8", errors="replace")
        spid = parse_spid(page_text)
        if spid:
            break
        time.sleep(1.2 * (attempt + 1))
    if not spid:
        return {
            "plantId": plant["id"], "queryName": plant["names"]["latin"], "sourceUrl": source_url,
            "resolvedUrl": page.url, "status": "unresolved", "fetchedAt": now_iso(), "fields": {}, "taxonomy": {},
            "note": "公开页面连续三次未返回物种编号；可能是名称未匹配或站点临时限流，不能解释为物种不存在。",
        }

    detail_response = session.request(
        "GET", f"{BASE_URL}/ashx/plantinfo.ashx", params={"spid": spid, "type": "descall"},
        headers={"Referer": page.url},
    )
    detail_payload = detail_response.json()
    fields, groups = flatten_details(detail_payload)

    taxonomy_response = session.request(
        "GET", f"{BASE_URL}/ashx/getclasssys.ashx", params={"spid": spid}, headers={"Referer": page.url},
    )
    try:
        taxonomy_raw = taxonomy_response.json()
    except requests.JSONDecodeError:
        taxonomy_raw = json.loads(taxonomy_response.text)
    taxonomy = {
        "division": clean_text(taxonomy_raw.get("menctxt")),
        "divisionLatin": clean_text(taxonomy_raw.get("menl")),
        "family": clean_text(taxonomy_raw.get("famctxt")),
        "familyLatin": clean_text(taxonomy_raw.get("faml")),
        "genus": clean_text(taxonomy_raw.get("genctxt")),
        "genusLatin": clean_text(taxonomy_raw.get("genl")),
    }
    return {
        "plantId": plant["id"],
        "queryName": plant["names"]["latin"],
        "sourceUrl": source_url,
        "resolvedUrl": page.url,
        "spid": spid,
        "recordKey": clean_text(detail_payload.get("spid")),
        "status": "ok",
        "fetchedAt": now_iso(),
        "fields": fields,
        "groups": groups,
        "taxonomy": taxonomy,
        "contentHash": hashlib.sha256(json.dumps({"fields": fields, "taxonomy": taxonomy}, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest(),
    }


def append_unique_aliases(current: str, incoming: str) -> str:
    values = [part.strip() for part in re.split(r"[、，,；;\s]+", current or "") if part.strip()]
    for part in re.split(r"[、，,；;\s]+", incoming or ""):
        part = part.strip()
        if 1 < len(part) <= 12 and part not in values:
            values.append(part)
    return "、".join(values)


def concise_summary(fields: dict[str, str]) -> str:
    candidates = []
    if fields.get("生活型"):
        candidates.append(fields["生活型"].rstrip("；。"))
    for key in ("识别要点", "形态特征", "株", "叶", "花", "果", "孢子囊"):
        text = fields.get(key, "").strip()
        if text:
            candidates.append(text.rstrip("；。"))
        if sum(len(item) for item in candidates) >= 180:
            break
    return "；".join(candidates)[:260].rstrip("；，, ") + ("。" if candidates else "")


def add_revision(plant: dict[str, Any], field: str, original: str, accepted: str, url: str) -> None:
    revisions = plant.setdefault("quality", {}).setdefault("revisions", [])
    marker = (field, original, accepted, url)
    if any((item.get("field"), item.get("originalValue"), item.get("acceptedValue"), item.get("authorityUrl")) == marker for item in revisions):
        return
    revisions.append({
        "field": field, "originalValue": original, "acceptedValue": accepted,
        "reviewStatus": "待老师复核", "authorityUrl": url, "source": "iPlant 公开物种资料",
    })
    plant["quality"]["needsReview"] = True


def merge_enrichment(plant: dict[str, Any], item: dict[str, Any]) -> list[dict[str, str]]:
    conflicts: list[dict[str, str]] = []
    external = plant.setdefault("external", {})
    external["iplant"] = {
        key: item.get(key) for key in ("status", "spid", "recordKey", "sourceUrl", "resolvedUrl", "fetchedAt", "contentHash", "taxonomy", "fields")
    }
    plant.setdefault("sources", {})["iplantFetchedAt"] = item.get("fetchedAt", "")
    if item.get("status") != "ok":
        return conflicts

    fields = item.get("fields", {})
    taxonomy = item.get("taxonomy", {})
    plant.setdefault("profile", {})["iplantSummary"] = concise_summary(fields)

    fill_targets = [
        (("ecology", "lifeForm"), fields.get("生活型", "")),
        (("ecology", "habitat"), fields.get("生境", "")),
        (("profile", "habitatNote"), fields.get("生境", "")),
        (("morphology", "appearance"), fields.get("形态特征", "") or fields.get("株", "")),
        (("morphology", "root"), fields.get("根", "")),
        (("morphology", "stem", "description"), "；".join(filter(None, (fields.get("茎"), fields.get("枝"))))),
        (("morphology", "leaf", "description"), fields.get("叶", "")),
        (("morphology", "flower", "description"), fields.get("花", "")),
        (("morphology", "fruit", "description"), fields.get("果", "") or fields.get("孢子囊", "")),
        (("morphology", "fruit", "seed"), fields.get("种子", "")),
        (("identification", "quickMethod"), fields.get("识别要点", "")),
    ]
    for path, value in fill_targets:
        if not value:
            continue
        node = plant
        for key in path[:-1]:
            node = node.setdefault(key, {})
        if not str(node.get(path[-1], "")).strip():
            node[path[-1]] = value

    if fields.get("俗名"):
        plant["names"]["alias"] = append_unique_aliases(plant["names"].get("alias", ""), fields["俗名"])

    comparisons = [
        ("taxonomy.family", plant["taxonomy"].get("family", ""), taxonomy.get("family", "")),
        ("taxonomy.familyLatin", plant["taxonomy"].get("familyLatin", ""), taxonomy.get("familyLatin", "")),
        ("taxonomy.genus", plant["taxonomy"].get("genus", ""), taxonomy.get("genus", "")),
        ("taxonomy.genusLatin", plant["taxonomy"].get("genusLatin", ""), taxonomy.get("genusLatin", "")),
    ]
    for field, local_value, remote_value in comparisons:
        if local_value and remote_value and local_value.casefold() != remote_value.casefold():
            conflict = {"plantId": plant["id"], "field": field, "localValue": local_value, "iplantValue": remote_value, "sourceUrl": item["sourceUrl"]}
            conflicts.append(conflict)
            add_revision(plant, field, local_value, remote_value, item["sourceUrl"])

    search_text = plant.get("searchText", "").lower()
    additions = [plant["profile"].get("iplantSummary", ""), plant["names"].get("alias", "")]
    additions.extend(fields.get(key, "") for key in DISPLAY_FIELD_ORDER)
    for value in filter(None, additions):
        normalized = value.lower()
        if normalized not in search_text:
            search_text = f"{search_text} {normalized}".strip()
    plant["searchText"] = search_text
    return conflicts


def export_workbook(path: Path, plants: list[dict[str, Any]], enrichment: list[dict[str, Any]], conflicts: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    overview = workbook.active
    overview.title = "植物知识库"
    overview_headers = ["ID", "中文名", "别称", "拉丁名", "科", "属", "生活型", "坝上生境", "iPlant增强摘要", "iPlant状态", "iPlant链接", "抓取时间"]
    overview.append(overview_headers)
    by_id = {item["plantId"]: item for item in enrichment}
    for plant in plants:
        item = by_id.get(plant["id"], {})
        overview.append([
            plant["id"], plant["names"]["chinese"], plant["names"].get("alias", ""), plant["names"]["latin"],
            plant["taxonomy"].get("family", ""), plant["taxonomy"].get("genus", ""), plant["ecology"].get("lifeForm", ""),
            plant["ecology"].get("habitat", ""), plant.get("profile", {}).get("iplantSummary", ""), item.get("status", ""),
            item.get("sourceUrl", ""), item.get("fetchedAt", ""),
        ])

    details = workbook.create_sheet("iPlant抓取详情")
    detail_headers = ["ID", "中文名", "拉丁名", "状态", "物种编号", "来源链接", "抓取时间", *DISPLAY_FIELD_ORDER]
    details.append(detail_headers)
    plant_by_id = {plant["id"]: plant for plant in plants}
    for item in enrichment:
        plant = plant_by_id[item["plantId"]]
        fields = item.get("fields", {})
        details.append([item["plantId"], plant["names"]["chinese"], plant["names"]["latin"], item.get("status", ""), item.get("spid", ""), item.get("sourceUrl", ""), item.get("fetchedAt", ""), *[fields.get(key, "") for key in DISPLAY_FIELD_ORDER]])

    review = workbook.create_sheet("字段冲突与复核")
    review.append(["ID", "字段", "本地值", "iPlant值", "处理状态", "来源链接"])
    for conflict in conflicts:
        review.append([conflict["plantId"], conflict["field"], conflict["localValue"], conflict["iplantValue"], "待老师复核（未覆盖）", conflict["sourceUrl"]])

    readme = workbook.create_sheet("数据说明")
    notes = [
        ("数据范围", f"正式植物 {len(plants)} 种；iPlant 公开页面详情增强。"),
        ("合并原则", "老师标注和本地名录优先；iPlant 只补空字段。名称、科属冲突进入复核表，不静默覆盖。"),
        ("字段来源", "iPlant 植物智公开物种页面及其公开详情接口；每条记录保留来源链接和抓取时间。"),
        ("内容边界", "导出的是用于实习辨认的事实字段与简短摘要，不包含账号数据、精确 GPS、群聊身份或原始网页缓存。"),
        ("更新方式", "运行 python scripts/enrich_from_iplant.py；缓存位于 tmp/iplant-cache，支持中断续跑。"),
    ]
    readme.append(["项目", "说明"])
    for row in notes:
        readme.append(row)

    for sheet in workbook.worksheets:
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="1D4B3C")
            cell.alignment = Alignment(horizontal="center", vertical="center")
        for column in range(1, sheet.max_column + 1):
            values = [str(sheet.cell(row=row, column=column).value or "") for row in range(1, min(sheet.max_row, 80) + 1)]
            width = min(max(max((len(value) for value in values), default=8) + 2, 10), 48)
            sheet.column_dimensions[get_column_letter(column)].width = width
        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
    workbook.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="限速抓取 iPlant 公开物种详情并增强坝上植物知识库")
    parser.add_argument("--delay", type=float, default=0.45, help="两次请求之间的最小秒数")
    parser.add_argument("--timeout", type=float, default=25.0)
    parser.add_argument("--limit", type=int, default=0, help="仅处理前 N 条，用于测试")
    parser.add_argument("--refresh", action="store_true", help="忽略已有成功缓存")
    parser.add_argument("--retry-unresolved", action="store_true", help="只重试此前未能解析物种编号的记录")
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    args = parser.parse_args()

    plants = json.loads(PLANTS_PATH.read_text(encoding="utf-8"))
    target_plants = plants[: args.limit] if args.limit else plants
    session = PoliteSession(args.delay, args.timeout)
    enrichment: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for index, plant in enumerate(target_plants, start=1):
        cached = None if args.refresh else read_cache(plant["id"])
        if args.retry_unresolved and cached and cached.get("status") == "unresolved":
            cached = None
        try:
            item = cached or fetch_plant(session, plant)
            if not cached:
                write_cache(plant["id"], item)
            enrichment.append(item)
            print(f"[{index:03d}/{len(target_plants):03d}] {plant['id']} {plant['names']['latin']} -> {item['status']} ({len(item.get('fields', {}))} fields)", flush=True)
        except Exception as exc:
            item = {"plantId": plant["id"], "queryName": plant["names"]["latin"], "sourceUrl": canonical_info_url(plant), "status": "error", "fetchedAt": now_iso(), "fields": {}, "taxonomy": {}, "error": str(exc)}
            enrichment.append(item)
            failures.append({"plantId": plant["id"], "error": str(exc)})
            print(f"[{index:03d}/{len(target_plants):03d}] {plant['id']} ERROR {exc}", flush=True)

    by_id = {item["plantId"]: item for item in enrichment}
    conflicts: list[dict[str, str]] = []
    for plant in plants:
        if plant["id"] in by_id:
            conflicts.extend(merge_enrichment(plant, by_id[plant["id"]]))

    status_counts = Counter(item.get("status", "unknown") for item in enrichment)
    field_counts = Counter(key for item in enrichment for key in item.get("fields", {}))
    report = {
        "schemaVersion": "1.0",
        "generatedAt": now_iso(),
        "source": {"name": "iPlant 植物智", "baseUrl": BASE_URL, "robotsChecked": True, "accessPolicy": "公开页面；限速；缓存；不绕过认证"},
        "summary": {
            "requestedCount": len(target_plants), "statusCounts": dict(status_counts), "conflictCount": len(conflicts),
            "recordsWithMorphology": sum(any(key in item.get("fields", {}) for key in MORPHOLOGY_FIELDS) for item in enrichment),
            "recordsWithEcology": sum(any(key in item.get("fields", {}) for key in ECOLOGY_FIELDS) for item in enrichment),
            "fieldCoverage": dict(field_counts), "failureCount": len(failures),
        },
        "records": enrichment,
        "conflicts": conflicts,
        "failures": failures,
    }
    ENRICHMENT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    PLANTS_PATH.write_text(json.dumps(plants, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    summary["dataVersion"] = "V2.3-2026-07-14"
    summary["iplantEnrichment"] = {**report["summary"], "generatedAt": report["generatedAt"], "detailFile": "/data/iplantEnrichment.json"}
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    export_workbook(args.export, plants, enrichment, conflicts)
    print(json.dumps({"output": str(ENRICHMENT_PATH), "excel": str(args.export), **report["summary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
