"""Interactive PowerShell-friendly client for BioCLIP v1.7."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

import httpx


DEFAULT_URL = "http://127.0.0.1:8011/v1/identify"


def split_paths(value: str) -> list[Path]:
    return [Path(item.strip().strip('"')) for item in value.split(";") if item.strip()]


def ask(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def normalize_date(value: str) -> str:
    value = value.strip()
    if value.isdigit() and 1 <= int(value) <= 12:
        return f"{date.today().year}-{int(value):02d}-15"
    return value


def collect_interactively() -> dict:
    print("\n坝上植物 BioCLIP v1.7 交互识别")
    print("多张图片路径请用英文分号 ; 分隔。直接回车可跳过非必填项。\n")
    images = split_paths(ask("图片路径"))
    parts = [item.strip() for item in ask("器官标签（按图片顺序，逗号分隔）", "未标注").replace("，", ",").split(",") if item.strip()]
    return {
        "images": images,
        "parts": parts,
        "query": ask("语义特征（生活型、花叶果特征等）"),
        "habitat": ask("生境"),
        "climate": ask("气候或当日条件（如凉湿、干旱、雨后）"),
        "observed_at": normalize_date(ask("观察日期或月份", str(date.today()))),
        "life_form": ask("生活型（可留空由语义推断）"),
        "region": ask("区域约束", "broad_grassland"),
    }


def identify(url: str, payload: dict) -> dict:
    images: list[Path] = payload["images"]
    missing = [str(path) for path in images if not path.is_file()]
    if not images:
        raise SystemExit("至少需要一张植物图片；语义和气候用于约束图片候选，不能单独替代视觉输入。")
    if missing:
        raise SystemExit(f"图片不存在: {', '.join(missing)}")

    handles = [path.open("rb") for path in images]
    try:
        files = [("images", (path.name, handle, "application/octet-stream")) for path, handle in zip(images, handles)]
        manifest = {
            "partLabels": payload["parts"],
            "context": {
                "notes": payload["query"],
                "habitat": payload["habitat"],
                "climate": payload["climate"],
                "observedAt": payload["observed_at"],
                "lifeForm": payload["life_form"],
                "region": payload["region"],
            },
            "client": "powershell-interactive",
            "schemaVersion": "1.2",
        }
        response = httpx.post(url, files=files, data={"manifest": json.dumps(manifest, ensure_ascii=False)}, timeout=300)
        if response.status_code >= 400:
            detail = response.json().get("detail", response.text) if response.headers.get("content-type", "").startswith("application/json") else response.text
            raise SystemExit(f"模型服务返回 {response.status_code}: {detail}")
        return response.json()
    finally:
        for handle in handles:
            handle.close()


def print_result(result: dict) -> None:
    print(f"\n模型: {result.get('model', '')} | 设备: {str(result.get('device', '')).upper()} | 耗时: {result.get('elapsedSeconds', 0)} 秒")
    print(f"约束已应用: {'是' if result.get('priorApplied') else '否'}\n")
    print(f"{'序号':<4} {'中文名':<14} {'拉丁名':<34} {'得分':>8} {'约束前':>8}")
    print("-" * 78)
    for candidate in result.get("candidates", []):
        before = candidate.get("scoreBeforePrior")
        before_text = f"{before * 100:6.1f}%" if isinstance(before, (int, float)) else "   --  "
        print(f"{candidate.get('rank', 0):<4} {candidate.get('chineseName', '')[:12]:<14} {candidate.get('scientificName', '')[:32]:<34} {candidate.get('score', 0) * 100:6.1f}% {before_text}")
    if result.get("warnings"):
        print("\n注意事项:")
        for warning in result["warnings"]:
            print(f"- {warning}")


def main() -> None:
    parser = argparse.ArgumentParser(description="BioCLIP v1.7 图片、语义、物候与气候联合识别")
    parser.add_argument("images", nargs="*", type=Path)
    parser.add_argument("--parts", nargs="*", default=[])
    parser.add_argument("--query", default="")
    parser.add_argument("--habitat", default="")
    parser.add_argument("--climate", default="")
    parser.add_argument("--date", default="")
    parser.add_argument("--month", type=int)
    parser.add_argument("--life-form", default="")
    parser.add_argument("--region", default="broad_grassland")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--output", type=Path, default=Path("bioclip-result.json"))
    parser.add_argument("--interactive", action="store_true")
    args = parser.parse_args()

    if args.interactive or not args.images:
        payload = collect_interactively()
    else:
        observed_at = args.date or (f"{date.today().year}-{args.month:02d}-15" if args.month else "")
        payload = {
            "images": args.images, "parts": args.parts, "query": args.query, "habitat": args.habitat,
            "climate": args.climate, "observed_at": observed_at, "life_form": args.life_form, "region": args.region,
        }
    result = identify(args.url, payload)
    print_result(result)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n完整结果已保存: {args.output.resolve()}")


if __name__ == "__main__":
    main()
