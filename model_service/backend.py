"""BioCLIP-2 closed-set inference against the local Bashang plant catalog."""

from __future__ import annotations

import json
import hashlib
import os
import sys
import threading
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BIOCLIP_HOME = PROJECT_ROOT / "models" / "bioclip"
PROMPT_TEMPLATES = (
    "a photo of a {label}",
    "a field photograph of {label}",
    "a close-up photograph of {label}",
    "a botanical photograph of the plant species {label}",
    "a photograph of {label}, genus {genus}",
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
        self.engine_home = Path(os.getenv("BIOCLIP_ENGINE_HOME", str(self.bioclip_home)))
        self.engine_version = os.getenv("BIOCLIP_ENGINE_VERSION", "1.7")
        self.strategy = os.getenv("BIOCLIP_STRATEGY", "ensemble").strip().lower()
        self.tta_enabled = os.getenv("BIOCLIP_TTA", "0").strip().lower() in {"1", "true", "yes", "on"}
        self.tta_augments = max(1, min(8, int(os.getenv("BIOCLIP_TTA_AUGMENTS", "4"))))
        self.prior_enabled = os.getenv("BIOCLIP_PRIOR", "1").strip().lower() in {"1", "true", "yes", "on"}
        self.prior_region = os.getenv("BIOCLIP_PRIOR_REGION", "broad_grassland")
        self.prior_strength = max(0.0, min(1.0, float(os.getenv("BIOCLIP_PRIOR_STRENGTH", "1.0"))))
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
        self.prior_library = None
        self.prior_stats: dict[str, Any] = {}
        self.prior_error = ""

    def status(self) -> dict[str, Any]:
        return {
            "ready": self.ready,
            "loading": self.loading,
            "error": self.error,
            "model": self.model_name,
            "engineVersion": self.engine_version,
            "strategy": self.strategy,
            "ttaEnabled": self.tta_enabled,
            "ttaAugments": self.tta_augments if self.tta_enabled else 1,
            "priorEnabled": bool(self.prior_enabled and self.prior_library),
            "priorRegion": self.prior_region,
            "priorStats": self.prior_stats,
            "priorError": self.prior_error,
            "device": self.device or "uninitialized",
            "catalogSize": len(self.plants),
            "topK": self.top_k,
            "bioclipHome": str(self.bioclip_home),
            "engineHome": str(self.engine_home),
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

            print(f"[BioCLIP v{self.engine_version}] loading {self.model_name} on {self.device}", flush=True)
            model, _, preprocess = open_clip.create_model_and_transforms(self.model_name)
            tokenizer = open_clip.get_tokenizer(self.model_name)
            self.model = model.to(self.device).eval()
            self.preprocess = preprocess
            self.tokenizer = tokenizer
            self.plants = self._load_catalog()
            self._load_prior_library()

            started = time.perf_counter()
            cache_path = self._text_cache_path()
            if cache_path.exists():
                cached = torch.load(cache_path, map_location=self.device, weights_only=True)
                self.text_features = cached["text_features"]
                self.text_cache_hit = True
            else:
                prompts = [
                    template.format(
                        label=plant["names"]["latin"] or plant["names"]["chinese"],
                        genus=(plant["names"]["latin"] or plant["names"]["chinese"]).split()[0],
                    )
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
                    )
                    class_features = functional.normalize(class_features, dim=-1)
                self.text_features = class_features.contiguous()
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                torch.save({"text_features": self.text_features.cpu()}, cache_path)
                self.text_features = self.text_features.to(self.device)
            self.label_encoding_seconds = round(time.perf_counter() - started, 2)
            self.loaded_at = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            self.ready = True
            print(
                f"[BioCLIP v{self.engine_version}] ready: {len(self.plants)} labels, "
                f"strategy={self.strategy}, tta={self.tta_enabled}, prior={bool(self.prior_library)}, "
                f"text encoding {self.label_encoding_seconds}s",
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

    def _load_prior_library(self) -> None:
        if not self.prior_enabled:
            return
        constraints_dir = self.engine_home / "constraints"
        data_dir = constraints_dir / "data"
        if not constraints_dir.exists() or not data_dir.exists():
            self.prior_error = f"v1.7 约束库不存在: {constraints_dir}"
            return
        try:
            engine_path = str(self.engine_home)
            if engine_path not in sys.path:
                sys.path.insert(0, engine_path)
            from constraints import ConstraintLibrary

            self.prior_library = ConstraintLibrary(str(data_dir))
            self.prior_stats = self.prior_library.load()
        except Exception as error:
            self.prior_library = None
            self.prior_error = str(error)
            print(f"[BioCLIP v{self.engine_version}] prior disabled: {error}", flush=True)

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

    def _image_variants(self, image: Image.Image) -> list[Image.Image]:
        if not self.tta_enabled:
            return [image]
        variants = [
            image,
            ImageOps.mirror(image),
            image.rotate(90, expand=True),
            image.rotate(-90, expand=True),
            ImageEnhance.Brightness(image).enhance(1.2),
            ImageEnhance.Brightness(image).enhance(0.8),
            ImageEnhance.Contrast(image).enhance(1.15),
            ImageEnhance.Contrast(image).enhance(0.85),
        ]
        return variants[:self.tta_augments]

    def _class_probabilities(self, image: Image.Image):
        torch = self.torch
        rows = []
        for variant in self._image_variants(image):
            tensor = self.preprocess(variant).unsqueeze(0).to(self.device)
            image_features = self.model.encode_image(tensor)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            similarities = torch.einsum("bd,cpd->bcp", image_features, self.text_features)
            best_similarity = similarities.max(dim=-1).values
            logits = self.model.logit_scale.exp() * best_similarity
            rows.append(logits.softmax(dim=-1).squeeze(0).cpu())
        stacked = torch.stack(rows)
        return stacked.mean(dim=0), stacked.std(dim=0, unbiased=False)

    @staticmethod
    def _photo_date(value: Any) -> str:
        text = str(value or "").strip()
        if len(text) >= 10 and text[4] == "-":
            return text[5:10]
        return text if len(text) == 5 and text[2] == "-" else "__skip__"

    @staticmethod
    def _life_form(context: dict[str, Any]) -> str:
        explicit = str(context.get("lifeForm") or "").strip()
        if explicit:
            return explicit
        text = " ".join(filter(None, [str(context.get("notes") or ""), str(context.get("habitat") or "")]))
        return next((term for term in ("草本", "灌木", "乔木", "藤本", "亚灌木") if term in text), "")

    def _apply_prior(self, candidates: list[dict[str, Any]], context: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
        if not self.prior_library or not candidates:
            return candidates, []
        labels = {
            f'{plant["names"]["chinese"]} {plant["names"]["latin"]}': plant["id"]
            for plant in self.plants
        }
        predictions = [
            {
                "rank": candidate["rank"],
                "label": f'{candidate["chineseName"]} {candidate["scientificName"]}',
                "confidence": candidate["score"] * 100,
            }
            for candidate in candidates
        ]
        result = [{"file": "", "error": None, "predictions": predictions}]
        adjusted = self.prior_library.apply(
            result,
            target_region=str(context.get("region") or self.prior_region),
            photo_date=self._photo_date(context.get("observedAt")),
            single_plant=True,
            penalty_strength=self.prior_strength,
            observed_traits=" ".join(filter(None, [str(context.get("habitat") or ""), str(context.get("climate") or ""), str(context.get("notes") or "")])),
            observed_life_form=self._life_form(context),
        )[0]
        by_id = {candidate["plantId"]: candidate for candidate in candidates}
        warnings = []
        reordered = []
        for prediction in adjusted.get("predictions", []):
            plant_id = labels.get(prediction.get("label", ""))
            if not plant_id or plant_id not in by_id:
                continue
            candidate = by_id[plant_id]
            candidate["scoreBeforePrior"] = candidate["score"]
            candidate["score"] = round(float(prediction.get("confidence", 0)) / 100, 6)
            factors = prediction.get("penalty_factors", {})
            candidate["priorFactors"] = factors
            candidate["rank"] = len(reordered) + 1
            reordered.append(candidate)
        for adjustment in adjusted.get("adjustments", []):
            reasons = "、".join(adjustment.get("reasons", []))
            if reasons:
                warnings.append(f'{adjustment.get("species", "候选物种")}：{reasons}')
        return reordered or candidates, warnings[:3]

    def identify(self, images: list[bytes], part_labels: list[str], context: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.ready or self.model is None or self.text_features is None:
            raise RuntimeError(self.error or "BioCLIP 模型尚未就绪")

        torch = self.torch
        started = time.perf_counter()
        score_rows = []
        normalized_parts = []
        stability_rows = []
        with self._lock, torch.no_grad():
            for index, content in enumerate(images):
                with Image.open(BytesIO(content)) as opened:
                    image = opened.convert("RGB")
                probabilities, stability = self._class_probabilities(image)
                score_rows.append(probabilities)
                stability_rows.append(stability)
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
                "stability": round(float(torch.stack(stability_rows)[:, plant_index].mean()), 6),
                "evidence": evidence,
                "reviewStatus": "待复核",
            })

        candidates, prior_warnings = self._apply_prior(candidates, context or {})
        warnings = ["BioCLIP v1.7 结果为本地名录内的相对排序，需结合关键器官与教师复核。", *prior_warnings]
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
            "model": f"BioCLIP-2 v{self.engine_version}",
            "modelName": self.model_name,
            "engineVersion": self.engine_version,
            "strategy": self.strategy,
            "ttaEnabled": self.tta_enabled,
            "priorApplied": bool(self.prior_library),
            "device": self.device,
            "scoreType": "v1.7_closed_set_ensemble_constrained_score",
            "elapsedSeconds": round(time.perf_counter() - started, 2),
            "candidates": candidates,
            "detections": [],
            "warnings": warnings,
        }


backend = BioCLIPBackend()
