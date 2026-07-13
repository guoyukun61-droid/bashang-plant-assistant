from __future__ import annotations

import json
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend import backend


app = FastAPI(title="Bashang Plant Model Service", version="1.7.0")
origins = [item.strip() for item in os.getenv(
    "PLANT_APP_ORIGINS",
    "http://127.0.0.1:4173,http://127.0.0.1:5173",
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    backend.load()


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok" if backend.ready else "loading" if backend.loading else "unavailable",
        "modelReady": backend.ready,
        "schemaVersion": "1.1",
        **backend.status(),
    }


@app.post("/v1/identify")
async def identify(
    images: list[UploadFile] = File(...),
    manifest: str = Form("{}"),
) -> dict[str, object]:
    try:
        metadata = json.loads(manifest)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="manifest 不是有效 JSON") from error

    if not 1 <= len(images) <= 8:
        raise HTTPException(status_code=400, detail="每次需要 1 至 8 张图片")
    contents = [await image.read() for image in images]
    try:
        backend.validate_images(contents)
    except Exception as error:
        raise HTTPException(status_code=400, detail="存在无法读取的图片") from error
    if not backend.ready:
        raise HTTPException(status_code=503, detail="模型后端尚未加载")

    try:
        return backend.identify(
            contents,
            list(metadata.get("partLabels", [])),
            dict(metadata.get("context") or {}),
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
