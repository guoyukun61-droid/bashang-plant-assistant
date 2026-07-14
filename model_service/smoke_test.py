"""Send one or more images to the local BioCLIP service."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description="Test the Bashang BioCLIP endpoint")
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--parts", nargs="*", default=[])
    parser.add_argument("--query", default="", help="Semantic traits used by the v1.7 constraint engine")
    parser.add_argument("--habitat", default="")
    parser.add_argument("--climate", default="")
    parser.add_argument("--life-form", default="")
    parser.add_argument("--region", default="broad_grassland")
    parser.add_argument("--date", default="")
    parser.add_argument("--url", default="http://127.0.0.1:8011/v1/identify")
    args = parser.parse_args()

    missing = [str(path) for path in args.images if not path.is_file()]
    if missing:
        raise SystemExit(f"Image not found: {', '.join(missing)}")

    handles = [path.open("rb") for path in args.images]
    try:
        files = [
            ("images", (path.name, handle, "application/octet-stream"))
            for path, handle in zip(args.images, handles)
        ]
        response = httpx.post(
            args.url,
            files=files,
            data={"manifest": json.dumps({
                "partLabels": args.parts,
                "context": {
                    "notes": args.query,
                    "habitat": args.habitat,
                    "climate": args.climate,
                    "lifeForm": args.life_form,
                    "observedAt": args.date,
                    "region": args.region,
                },
                "schemaVersion": "1.1",
            }, ensure_ascii=False)},
            timeout=180,
        )
        response.raise_for_status()
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    finally:
        for handle in handles:
            handle.close()


if __name__ == "__main__":
    main()
