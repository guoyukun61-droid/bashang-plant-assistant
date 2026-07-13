const runtimeEnv = import.meta.env || {};

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

const visionApiUrl = cleanUrl(runtimeEnv.VITE_VISION_API_URL);
const healthApiUrl = cleanUrl(runtimeEnv.VITE_MODEL_HEALTH_URL);
const semanticApiUrl = cleanUrl(runtimeEnv.VITE_SEMANTIC_API_URL);
const parsedTimeout = Number(runtimeEnv.VITE_MODEL_TIMEOUT_MS);
const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 60_000;

export function getModelGatewayStatus() {
  return {
    visionConfigured: Boolean(visionApiUrl),
    semanticConfigured: Boolean(semanticApiUrl),
    visionApiUrl,
    healthApiUrl,
    semanticApiUrl,
  };
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.detail || payload?.message || `模型服务返回 ${response.status}`);
    if (!payload || typeof payload !== "object") throw new Error("模型服务返回了无效数据");
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("模型服务响应超时");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function requestModelHealth() {
  if (!healthApiUrl) throw new Error("尚未配置模型状态地址");
  return fetchJson(healthApiUrl, { method: "GET" });
}

export async function requestVisionIdentification(files, partLabels = [], context = {}) {
  if (!visionApiUrl) throw new Error("尚未配置图片识别服务地址");
  const list = Array.from(files || []);
  if (!list.length) throw new Error("请先选择图片");

  const body = new FormData();
  list.forEach((file) => body.append("images", file, file.name));
  body.append("manifest", JSON.stringify({
    partLabels,
    context,
    client: "bashang-plant-assistant",
    schemaVersion: "1.1",
  }));

  const payload = await fetchJson(visionApiUrl, { method: "POST", body });
  if (!Array.isArray(payload.candidates)) throw new Error("识别服务缺少 candidates 数组");
  return {
    requestId: String(payload.requestId || ""),
    candidates: payload.candidates,
    detections: Array.isArray(payload.detections) ? payload.detections : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    model: String(payload.model || ""),
    engineVersion: String(payload.engineVersion || ""),
    strategy: String(payload.strategy || ""),
    ttaEnabled: Boolean(payload.ttaEnabled),
    priorApplied: Boolean(payload.priorApplied),
    device: String(payload.device || ""),
    scoreType: String(payload.scoreType || ""),
    elapsedSeconds: Number(payload.elapsedSeconds) || 0,
  };
}

export async function requestSemanticExplanation(query, candidates) {
  if (!semanticApiUrl) throw new Error("尚未配置语义解释服务地址");
  return fetchJson(semanticApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, candidates, schemaVersion: "1.0" }),
  });
}
