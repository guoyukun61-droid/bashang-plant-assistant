"""BioCLIP-2 closed-set inference against the local Bashang plant catalog."""

from __future__ import annotations

import json
import hashlib
import os
import threading
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BIOCLIP_HOME = PROJECT_ROOT / "models" / "bioclip"
PROMPT_TEMPLATES = (
    "a photo of {}.",
    "a field photograph of {}.",
    "a close-up photograph of {}.",
    "a photograph of the plant species {}.",
)
ORGAN_WEIGHTS = {
    "全株": 0.9,
    "生境": 0.7,
    "花": 1.2,
    "叶": 1.0,
    "茎": 0.85,
    "果实": 1.2,
    "未标注": 0.8,
}


class BioCLIPBackend:
    def __init__(self) -> None:
        self.ready = False
        self.loading = False
        self.error = ""
        self.device = ""
        self.model_name = os.getenv("BIOCLIP_MODEL_NAME", "hf-hub:imageomics/bioclip-2")
        self.bioclip_home = Path(os.getenv("BIOCLIP_HOME", str(DEFAULT_BIOCLIP_HOME)))
        self.knowledge_base = Path(os.getenv(
            "PLANT_KNOWLEDGE_BASE",
            str(PROJECT_ROOT / "public" / "data" / "plants.json"),
        ))
        self.top_k = max(1, min(30, int(os.getenv("BIOCLIP_TOP_K", "10"))))
        self.model = None
        self.preprocess = None
        self.tokenizer = None
        self.torch = None
        self.plants: list[dict[str, Any]] = []
        self.text_features = None
        self._lock = threading.Lock()
        self.loaded_at = ""
        self.label_encoding_seconds = 0.0
        self.text_cache_hit = False

    def status(self) -> dict[str, Any]:
        return {
            "ready": self.ready,
            "loading": self.loading,
            "error": self.error,
            "model": self.model_name,
            "device": self.device or "uninitialized",
            "catalogSize": len(self.plants),
            "topK": self.top_k,
            "bioclipHome": str(self.bioclip_home),
            "knowledgeBase": str(self.knowledge_base),
            "loadedAt": self.loaded_at,
            "labelEncodingSeconds": self.label_encoding_seconds,
            "textCacheHit": self.text_cache_hit,
        }

    def load(self) -> None:
        if self.ready or self.loading:
            return
        self.loading = True
        self.error = ""
        try:
            self._configure_offline_cache()
            import open_clip
            import torch
            import torch.nn.functional as functional

            self.torch = torch
            requested_device = os.getenv("BIOCLIP_DEVICE", "auto").lower()
            self.device = "cuda" if requested_device == "auto" and torch.cuda.is_available() else requested_device
            if self.device == "auto":
                self.device = "cpu"
            if self.device == "cuda" and not torch.cuda.is_available():
                raise RuntimeError("BIOCLIP_DEVICE=cuda，但当前 PyTorch 未检测到 CUDA")

            if self.device == "cpu":
                thread_count = max(1, min(int(os.getenv("BIOCLIP_CPU_THREADS", "8")), os.cpu_count() or 1))
                torch.set_num_threads(thread_count)

            print(f"[BioCLIP] loading {self.model_name} on {self.device}", flush=True)
            model, _, preprocess = open_clip.create_model_and_transforms(self.model_name)
            tokenizer = open_clip.get_tokenizer(self.model_name)
            self.model = model.to(self.device).eval()
            self.preprocess = preprocess
            self.tokenizer = tokenizer
            self.plants = self._load_catalog()

            started = time.perf_counter()
            cache_path = self._text_cache_path()
            if cache_path.exists():
                cached = torch.load(cache_path, map_location=self.device, weights_only=True)
                self.text_features = cached["text_features"]
                self.text_cache_hit = True
            else:
                prompts = [
                    template.format(plant["names"]["latin"] or plant["names"]["chinese"])
                    for plant in self.plants
                    for template in PROMPT_TEMPLATES
                ]
                encoded_batches = []
                text_batch_size = max(8, int(os.getenv("BIOCLIP_TEXT_BATCH_SIZE", "64")))
                with torch.no_grad():
                    for offset in range(0, len(prompts), text_batch_size):
                        tokens = tokenizer(prompts[offset:offset + text_batch_size]).to(self.device)
                        encoded_batches.append(self.model.encode_text(tokens))
                    prompt_features = functional.normalize(torch.cat(encoded_batches), dim=-1)
                    class_features = prompt_features.reshape(
                        len(self.plants), len(PROMPT_TEMPLATES), -1
                    ).mean(dim=1)
                    class_features = functional.normalize(class_features, dim=-1)
                self.text_features = class_features.T.contiguous()
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                torch.save({"text_features": self.text_features.cpu()}, cache_path)
                self.text_features = self.text_features.to(self.device)
            self.label_encoding_seconds = round(time.perf_counter() - started, 2)
            self.loaded_at = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            self.ready = True
            print(
                f"[BioCLIP] ready: {len(self.plants)} labels, text encoding {self.label_encoding_seconds}s",
                flush=True,
            )
        except Exception as error:
            self.error = str(error)
            self.ready = False
            print(f"[BioCLIP] load failed: {self.error}", flush=True)
        finally:
            self.loading = False

    def _configure_offline_cache(self) -> None:
        hf_home = self.bioclip_home / "huggingface"
        snapshot = hf_home / "hub" / "models--imageomics--bioclip-2" / "snapshots"
        if not hf_home.exists() or not snapshot.exists():
            raise FileNotFoundError(f"未找到 BioCLIP 本地缓存: {hf_home}")
        os.environ["HF_HOME"] = str(hf_home)
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

    def _load_catalog(self) -> list[dict[str, Any]]:
        if not self.knowledge_base.exists():
            raise FileNotFoundError(f"植物知识库不存在: {self.knowledge_base}")
        plants = json.loads(self.knowledge_base.read_text(encoding="utf-8"))
        usable = [plant for plant in plants if plant.get("names", {}).get("latin")]
        if not usable:
            raise RuntimeError("植物知识库没有可用于 BioCLIP 的拉丁名")
        return usable

    def _text_cache_path(self) -> Path:
        signature = json.dumps({
            "model": self.model_name,
            "prompts": PROMPT_TEMPLATES,
            "labels": [(plant["id"], plant["names"]["latin"]) for plant in self.plants],
        }, ensure_ascii=False, sort_keys=True).encode("utf-8")
        digest = hashlib.sha256(signature).hexdigest()[:16]
        return PROJECT_ROOT / "model_service" / "cache" / f"catalog-text-{digest}.pt"

    @staticmethod
    def validate_images(images: list[bytes]) -> None:
        for content in images:
            with Image.open(BytesIO(content)) as image:
                image.verify()

    def identify(self, images: list[bytes], part_labels: list[str]) -> dict[str, Any]:
        if not self.ready or self.model is None or self.text_features is None:
            raise RuntimeError(self.error or "BioCLIP 模型尚未就绪")

        torch = self.torch
        started = time.perf_counter()
        score_rows = []
        normalized_parts = []
        with self._lock, torch.no_grad():
            for index, content in enumerate(images):
                with Image.open(BytesIO(content)) as opened:
                    image = opened.convert("RGB")
                    tensor = self.preprocess(image).unsqueeze(0).to(self.device)
                image_features = self.model.encode_image(tensor)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                logits = self.model.logit_scale.exp() * image_features @ self.text_features
                score_rows.append(logits.softmax(dim=-1).squeeze(0).cpu())
                normalized_parts.append(part_labels[index] if index < len(part_labels) else "未标注")

            scores = torch.stack(score_rows)
            weights = torch.tensor(
                [ORGAN_WEIGHTS.get(part, 0.8) for part in normalized_parts], dtype=scores.dtype
            )
            aggregate = (scores * weights[:, None]).sum(dim=0) / weights.sum()
            top_scores, top_indices = aggregate.topk(min(self.top_k, len(self.plants)))

        candidates = []
        for rank, (score, plant_index) in enumerate(zip(top_scores.tolist(), top_indices.tolist()), start=1):
            plant = self.plants[plant_index]
            per_image = scores[:, plant_index].tolist()
            evidence = [
                f"{normalized_parts[index]}图相对得分 {value * 100:.1f}%"
                for index, value in enumerate(per_image)
            ]
            candidates.append({
                "rank": rank,
                "plantId": plant["id"],
                "chineseName": plant["names"]["chinese"],
                "scientificName": plant["names"]["latin"],
                "family": plant["taxonomy"]["family"],
                "score": round(float(score), 6),
                "evidence": evidence,
                "reviewStatus": "待复核",
            })

        warnings = ["BioCLIP-2 直接分析完整照片；背景复杂时，请补充主体清晰的器官特写。"]
        if candidates:
            top_score = candidates[0]["score"]
            margin = top_score - candidates[1]["score"] if len(candidates) > 1 else top_score
            if top_score < 0.35:
                warnings.append("最高相对得分低于 35%，不建议据此确定物种。")
            if margin < 0.08:
                warnings.append("前两名差距小于 8 个百分点，建议补拍关键器官并人工复核。")

        return {
            "requestId": f"BIOCLIP-{uuid.uuid4().hex[:12].upper()}",
            "status": "ok",
            "model": self.model_name,
            "device": self.device,
            "scoreType": "closed_set_relative_probability",
            "elapsedSeconds": round(time.perf_counter() - started, 2),
            "candidates": candidates,
            "detections": [],
            "warnings": warnings,
        }


backend = BioCLIPBackend()
