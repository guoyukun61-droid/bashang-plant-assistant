"""Fill image gaps with traceable, Creative Commons occurrence photos.

Run with ``--download`` when refreshing the supplemental assets. Normal data
imports call the script without that flag and only re-attach files that are
already stored in ``public/plant-images/supplemental``.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PLANTS_PATH = ROOT / "public" / "data" / "plants.json"
ASSET_DIR = ROOT / "public" / "plant-images" / "supplemental"
MANIFEST_PATH = ROOT / "public" / "data" / "supplementalImageManifest.json"
SUMMARY_PATH = ROOT / "public" / "data" / "catalogSummary.json"

# Query accepted names without silently changing the workbook taxonomy.
QUERY_NAMES = {
    "HBFC-014": "Persicaria maculosa",
    "HBFC-021": "Rheum franzenbachii",
    "HBFC-030": "Eremogone juncea",
    "HBFC-053": "Noccaea thlaspidioides",
    "HBFC-065": "Spiraea aquilegifolia",
    "HBFC-083": "Sibbaldia adpressa",
    "HBFC-093": "Lespedeza hedysaroides",
    "HBFC-098": "Astragalus melilotoides",
    "HBFC-099": "Astragalus tataricus",
    "HBFC-104": "Oxytropis leptophylla",
    "HBFC-155": "Myosotis arvensis",
    "HBFC-174": "Veronica dahurica",
    "HBFC-176": "Cymbaria dahurica",
    "HBFC-185": "Viburnum opulus var. calvescens",
    "HBFC-189": "Scabiosa tschiliensis",
    "HBFC-226": "Leuzea uniflora",
    "HBFC-255": "Koeleria macrantha",
    "HBFC-268": "Carex rigescens",
    "HBFC-286": "Iris ruthenica var. nana",
}


def request_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "BashangPlantAssistant/2.1"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def occurrence_photo(query_name: str) -> dict:
    match_url = "https://api.gbif.org/v1/species/match?name=" + urllib.parse.quote(query_name)
    match = request_json(match_url)
    taxon_key = match.get("acceptedUsageKey") or match.get("usageKey")
    if not taxon_key or int(match.get("confidence", 0)) < 80:
        raise RuntimeError(f"GBIF could not confidently match {query_name}: {match}")

    params = urllib.parse.urlencode({
        "taxon_key": taxon_key,
        "media_type": "StillImage",
        "basis_of_record": "HUMAN_OBSERVATION",
        "limit": 100,
    })
    result = request_json("https://api.gbif.org/v1/occurrence/search?" + params)
    candidates = []
    for occurrence in result.get("results", []):
        for media in occurrence.get("media", []):
            license_url = media.get("license") or occurrence.get("license") or ""
            image_url = media.get("identifier") or ""
            if image_url.startswith("http") and "creativecommons.org" in license_url:
                candidates.append((occurrence, media, license_url))
    if not candidates:
        raise RuntimeError(f"No Creative Commons field image found for {query_name}")

    # Prefer Chinese observations, then records with a named creator and source page.
    candidates.sort(key=lambda item: (
        item[0].get("countryCode") == "CN",
        bool(item[1].get("creator") or item[0].get("recordedBy")),
        bool(item[1].get("references") or item[0].get("references")),
    ), reverse=True)
    occurrence, media, license_url = candidates[0]
    return {
        "queryName": query_name,
        "matchedScientificName": occurrence.get("scientificName") or occurrence.get("species"),
        "gbifOccurrenceKey": occurrence.get("key"),
        "sourceUrl": media.get("references") or occurrence.get("references") or f"https://www.gbif.org/occurrence/{occurrence.get('key')}",
        "downloadUrl": media["identifier"],
        "creator": media.get("creator") or occurrence.get("recordedBy") or "未署名贡献者",
        "publisher": media.get("publisher") or occurrence.get("publishingOrgKey") or "GBIF occurrence network",
        "license": license_url,
    }


def download_webp(url: str, output_path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "BashangPlantAssistant/2.1"})
    with urllib.request.urlopen(request, timeout=90) as response:
        raw = response.read()
    with Image.open(BytesIO(raw)) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "WEBP", quality=84, method=6, exif=b"")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    plants = json.loads(PLANTS_PATH.read_text(encoding="utf-8"))
    previous = {}
    if MANIFEST_PATH.exists():
        previous = {item["plantId"]: item for item in json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))}

    manifest = []
    for plant in plants:
        media = plant.setdefault("media", {})
        plant_id = plant["id"]
        query_name = QUERY_NAMES.get(plant_id)
        if not query_name:
            if not (media.get("localSamples") or media.get("iplantReferences")):
                raise RuntimeError(f"No supplemental image query configured for {plant_id}")
            continue
        existing_item = next((item for item in media.get("iplantReferences", []) if item.get("id") == f"SUPPLEMENT-{plant_id}"), None)
        embedded_record = None
        if existing_item:
            embedded_record = {
                "queryName": query_name,
                "matchedScientificName": existing_item.get("matchedScientificName", query_name),
                "sourceUrl": existing_item.get("sourceUrl", ""),
                "creator": existing_item.get("creator", "未署名贡献者"),
                "publisher": "GBIF occurrence network",
                "license": existing_item.get("license", ""),
            }
        output_path = ASSET_DIR / f"{plant_id}.webp"
        record = previous.get(plant_id) or embedded_record
        if args.download:
            record = occurrence_photo(query_name)
            download_webp(record["downloadUrl"], output_path)
        if not record or not output_path.exists():
            raise RuntimeError(f"Supplemental asset missing for {plant_id}; run with --download")
        record = {**record, "plantId": plant_id, "assetUrl": f"/plant-images/supplemental/{plant_id}.webp"}
        manifest.append(record)
        media.setdefault("localSamples", [])
        retained_references = [item for item in media.get("iplantReferences", []) if item.get("id") != f"SUPPLEMENT-{plant_id}"]
        media["iplantReferences"] = retained_references + [{
            "id": f"SUPPLEMENT-{plant_id}",
            "url": record["assetUrl"],
            "thumbnailUrl": record["assetUrl"],
            "sourceType": "GBIF 社区参考图",
            "organLabel": "全株参考",
            "sourceUrl": record["sourceUrl"],
            "creator": record["creator"],
            "license": record["license"],
            "matchedScientificName": record["matchedScientificName"],
        }]

    leak = next(plant for plant in plants if plant["id"] == "HBFC-226")
    aliases = [part.strip() for part in re.split(r"[、,，;/；]", leak["names"].get("alias", "")) if part.strip()]
    if "漏芦" not in aliases:
        aliases.append("漏芦")
    leak["names"]["alias"] = "、".join(aliases)
    if "漏芦" not in leak.get("searchText", ""):
        leak["searchText"] = (leak.get("searchText", "") + " 漏芦").strip()

    PLANTS_PATH.write_text(json.dumps(plants, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    summary["supplementalReferenceImageCount"] = len(manifest)
    summary["referenceImageCount"] = sum(len(plant["media"].get("iplantReferences", [])) for plant in plants)
    summary["plantsWithImages"] = sum(bool(plant["media"].get("localSamples") or plant["media"].get("iplantReferences")) for plant in plants)
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = [plant["id"] for plant in plants if not (plant["media"].get("localSamples") or plant["media"].get("iplantReferences"))]
    if missing:
        raise RuntimeError(f"Image coverage still incomplete: {missing}")
    print(f"Image coverage complete: {len(plants)}/{len(plants)} plants; {len(manifest)} supplemental references")


if __name__ == "__main__":
    main()
