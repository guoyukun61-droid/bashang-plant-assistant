import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  Check,
  Database,
  Eye,
  Focus,
  GitCompare,
  ImagePlus,
  Images,
  ListFilter,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";
import { assistantEngine } from "../lib/assistantEngine.js";
import { clearJointDraft, loadJointDraft, saveJointDraft } from "../lib/jointDraftStore.js";
import { getModelGatewayStatus, requestModelHealth, requestVisionIdentification } from "../lib/modelGateway.js";
import { visionPipeline } from "../lib/visionPipeline.js";

const EXAMPLES = [
  "黄色 头状花序 舌状花",
  "湿地 禾本科",
  "紫色 球状花",
  "轮生叶 蒴果",
  "帮我区分问荆和节节草",
];
const PART_OPTIONS = ["未标注", "全株", "花", "叶", "茎", "果实", "生境", "根"];

function candidateImage(plant) {
  return plant.media.localSamples[0]?.thumbnailUrl || plant.media.iplantReferences[0]?.url || "";
}

function backgroundPhotos(plants) {
  const available = plants.filter((plant) => plant.media.localSamples[0]?.displayUrl);
  return [5, 25, 45].map((index) => available[index % available.length]?.media.localSamples[0].displayUrl).filter(Boolean);
}

function makeEntries(files) {
  return Array.from(files || [])
    .filter((file) => file.type.startsWith("image/"))
    .map((file) => ({ file, part: "未标注", url: URL.createObjectURL(file) }));
}

function ComparisonResult({ result, onOpen }) {
  return (
    <div className="comparison-workbench">
      <div className="comparison-head"><GitCompare /><div><span className="eyebrow">COMPARISON</span><h2>{result.plants.map((plant) => plant.names.chinese).join(" vs ")}</h2></div></div>
      <div className="comparison-plants">{result.plants.map((plant) => <button key={plant.id} onClick={() => onOpen(plant.id)}><img src={candidateImage(plant)} alt={plant.names.chinese} /><span><strong>{plant.names.chinese}</strong><em>{plant.names.latin}</em></span><ArrowRight /></button>)}</div>
      <div className="comparison-table">{result.rows.map((row) => <div className="comparison-row" key={row.label}><strong>{row.label}</strong>{row.values.map((value, index) => <p key={`${row.label}-${index}`}>{value}</p>)}</div>)}</div>
      <p className="next-observation"><Focus size={17} />{result.nextObservation}</p>
    </div>
  );
}

function Candidate({ candidate, onOpen }) {
  const { plant } = candidate;
  return (
    <article className="candidate-card">
      <button className="candidate-image" onClick={() => onOpen(plant.id)}><img src={candidateImage(plant)} alt={plant.names.chinese} /><span>{candidate.matchLevel}</span></button>
      <div className="candidate-content">
        <div className="candidate-title"><div><span>{plant.id} · {plant.taxonomy.family}</span><h3>{plant.names.chinese}</h3><em>{plant.names.latin}</em></div><button className="icon-button" onClick={() => onOpen(plant.id)} aria-label={`打开${plant.names.chinese}`}><ArrowRight size={18} /></button></div>
        <div className="evidence-block evidence-block--support"><strong><Check size={15} />支持特征</strong><p>{candidate.supportFeatures.length ? candidate.supportFeatures.join(" · ") : "暂无稳定支持组合"}</p></div>
        {candidate.conflictFeatures.length > 0 && <div className="evidence-block evidence-block--conflict"><strong><TriangleAlert size={15} />冲突特征</strong><p>{candidate.conflictFeatures.join(" · ")}</p></div>}
        <div className="evidence-block"><strong>待确认</strong><p>{candidate.pendingFeatures.length ? candidate.pendingFeatures.join(" · ") : "主要特征已有对应记录"}</p></div>
        <p className="candidate-next">复核建议：{candidate.nextObservation}</p>
        <div className="source-tags">{candidate.sources.map((source) => <span key={source}>{source}</span>)}</div>
      </div>
    </article>
  );
}

function ModelResults({ result, onOpen, combined, plants }) {
  if (!result) return null;
  return (
    <section className="model-results model-results--joint" aria-live="polite">
      <div><span className="eyebrow">{combined ? "COMBINED EVIDENCE" : "IMAGE EVIDENCE"}</span><strong>{combined ? "图片与性状联合候选" : "图片候选"}</strong><em>{result.model} · {result.elapsedSeconds.toFixed(1)} 秒</em></div>
      {result.candidates.length ? <ol>{result.candidates.map((candidate, index) => { const plant = plants.find((item) => item.id === candidate.plantId); const image = plant ? candidateImage(plant) : ""; return <li key={`${candidate.plantId || candidate.scientificName}-${index}`}><button type="button" onClick={() => candidate.plantId && onOpen(candidate.plantId)} disabled={!candidate.plantId}>{image ? <img className="model-candidate-image" src={image} alt={candidate.chineseName || plant?.names.chinese || "候选植物"} /> : <span className="model-candidate-image model-candidate-image--empty"><ImagePlus size={16} /></span>}<span className="model-candidate-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{candidate.chineseName || "未命名候选"}</strong><em>{candidate.scientificName || ""}</em><small>{candidate.family || ""}{candidate.evidence?.length ? ` · ${candidate.evidence[0]}` : ""}</small></div>{Number.isFinite(candidate.score) && <b>{(candidate.score * 100).toFixed(1)}%</b>}</button></li>; })}</ol> : <p>服务未返回候选物种。</p>}
      {result.warnings.length > 0 && <div className="model-result-warnings">{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    </section>
  );
}

export default function AssistantView() {
  const knowledgeBase = useKnowledgeBase();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => sessionStorage.getItem("bashang-assistant-query") || "");
  const [submitted, setSubmitted] = useState(() => sessionStorage.getItem("bashang-assistant-submitted") || "");
  const [conditions, setConditions] = useState(() => ({
    habitat: "", climate: "", lifeForm: "", observedAt: new Date().toISOString().slice(0, 10), region: "broad_grassland",
  }));
  const [entries, setEntries] = useState([]);
  const [modelResult, setModelResult] = useState(null);
  const [imageCheck, setImageCheck] = useState(null);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [dragging, setDragging] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [modelHealth, setModelHealth] = useState(() => ({ state: getModelGatewayStatus().visionConfigured ? "checking" : "disabled", device: "", engineVersion: "" }));
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const entriesRef = useRef([]);
  const lightboxClose = useRef(null);
  const modelGateway = getModelGatewayStatus();
  const photos = useMemo(() => backgroundPhotos(knowledgeBase.plants), [knowledgeBase.plants]);
  const result = useMemo(() => submitted ? assistantEngine(submitted, knowledgeBase) : null, [submitted, knowledgeBase]);
  entriesRef.current = entries;

  useEffect(() => {
    let active = true;
    loadJointDraft().then((draft) => {
      if (!active || !draft) return;
      const restored = (draft.entries || []).filter((entry) => entry.file instanceof Blob).map((entry) => ({ ...entry, url: URL.createObjectURL(entry.file) }));
      setEntries(restored);
      setQuery(draft.query || "");
      setSubmitted(draft.submitted || "");
      if (draft.conditions) setConditions(draft.conditions);
      setModelResult(draft.modelResult || null);
      setImageCheck(draft.imageCheck || null);
      setMessage(draft.message || (restored.length ? `已恢复 ${restored.length} 张识别照片` : ""));
    }).catch(() => {}).finally(() => active && setDraftReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    sessionStorage.setItem("bashang-assistant-query", query);
    sessionStorage.setItem("bashang-assistant-submitted", submitted);
  }, [query, submitted]);
  useEffect(() => setVisibleCount(12), [submitted]);
  useEffect(() => {
    if (!draftReady) return undefined;
    const timer = window.setTimeout(() => {
      saveJointDraft({ query, submitted, conditions, entries, modelResult, imageCheck, message }).catch(() => {});
    }, 180);
    return () => window.clearTimeout(timer);
  }, [conditions, draftReady, entries, imageCheck, message, modelResult, query, submitted]);
  useEffect(() => () => entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url)), []);
  useEffect(() => {
    if (!modelGateway.visionConfigured || !modelGateway.healthApiUrl) return undefined;
    let active = true;
    const check = async () => {
      try {
        const health = await requestModelHealth();
        if (active) setModelHealth({ state: health.modelReady ? "ready" : health.status === "loading" ? "loading" : "unavailable", device: String(health.device || ""), engineVersion: String(health.engineVersion || "") });
      } catch {
        if (active) setModelHealth({ state: "unavailable", device: "", engineVersion: "" });
      }
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [modelGateway.healthApiUrl, modelGateway.visionConfigured]);
  useEffect(() => {
    if (!selectedUrl) return undefined;
    const previous = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") setSelectedUrl(""); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => lightboxClose.current?.focus());
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [selectedUrl]);

  const addFiles = (files) => {
    const incoming = makeEntries(files);
    setEntries((current) => {
      const keys = new Set(current.map((entry) => `${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`));
      const unique = incoming.filter((entry) => !keys.has(`${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`));
      const combined = [...current, ...unique];
      combined.slice(8).forEach((entry) => URL.revokeObjectURL(entry.url));
      if (combined.length > 8) setMessage("每次最多使用 8 张照片");
      return combined.slice(0, 8);
    });
    setModelResult(null);
    setImageCheck(null);
  };
  const removeEntry = (index) => setEntries((current) => { URL.revokeObjectURL(current[index].url); return current.filter((_, itemIndex) => itemIndex !== index); });
  const setPart = (index, part) => setEntries((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, part } : entry));
  const clear = () => {
    entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    setQuery(""); setSubmitted(""); setConditions({ habitat: "", climate: "", lifeForm: "", observedAt: new Date().toISOString().slice(0, 10), region: "broad_grassland" }); setEntries([]); setModelResult(null); setImageCheck(null); setMessage("");
    clearJointDraft().catch(() => {});
  };
  const run = async (value = query) => {
    const text = value.trim();
    const structuredText = [text, conditions.lifeForm, conditions.habitat, conditions.climate].filter(Boolean).join(" ");
    if (!structuredText && !entries.length) return;
    setSubmitted(structuredText);
    setRunning(true);
    setMessage("");
    setModelResult(null);
    try {
      if (entries.length) {
        const files = entries.map((entry) => entry.file);
        const parts = entries.map((entry) => entry.part);
        setImageCheck(await visionPipeline(files, parts));
        if (modelHealth.state === "ready") {
          const response = await requestVisionIdentification(files, parts, {
            notes: text,
            habitat: conditions.habitat,
            climate: conditions.climate,
            lifeForm: conditions.lifeForm,
            observedAt: conditions.observedAt,
            region: conditions.region,
          });
          setModelResult(response);
          setMessage(`已返回 ${response.candidates.length} 条待复核候选`);
        } else {
          setMessage(text ? "已完成文字检索；BioCLIP 服务未启动，照片仅完成质量检查" : "BioCLIP 服务未启动，照片已完成质量检查");
        }
      }
    } catch (error) {
      setMessage(error.message || "识别服务调用失败");
    } finally {
      setRunning(false);
    }
  };

  const hasInput = Boolean(query.trim() || conditions.habitat || conditions.climate || conditions.lifeForm || entries.length);
  const readyLabel = modelHealth.engineVersion ? `BioCLIP v${modelHealth.engineVersion}` : "BioCLIP";
  return (
    <section className="assistant-view page-view" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
      <div className="workbench-photo-field workbench-photo-field--assistant" aria-hidden="true">{photos.map((photo, index) => <img key={photo} src={photo} alt="" className={`photo-layer photo-layer--${index + 1}`} />)}</div>
      {dragging && <div className="assistant-drop"><ImagePlus size={28} /><span>加入本次识别</span></div>}
      <header className="workbench-header"><div><span className="eyebrow">MULTIMODAL IDENTIFICATION</span><h1>联合识别</h1></div><div className="workbench-status" aria-label="识别服务状态"><span><Database size={15} />{knowledgeBase.summary.recordCount} 种植物</span><span><ListFilter size={15} />{knowledgeBase.summary.reverseIndexCount} 条特征索引</span><span className={modelHealth.state === "ready" ? "status-online" : "status-pending"}><i />{modelHealth.state === "ready" ? `${readyLabel} · ${modelHealth.device.toUpperCase()}` : "图片模型未就绪"}</span></div></header>

      <div className="query-console joint-console">
        <div className="console-status"><strong>识别材料</strong><span><i />文字特征</span><em>{entries.length ? `${entries.length} 张照片` : "可加入照片"}</em>{hasInput && <button className="console-clear" onClick={clear} aria-label="清空本次识别" title="清空"><X size={14} /></button>}</div>
        <label className="query-editor"><Search size={21} /><textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); run(); } }} placeholder="输入植物名称，或记录生活型、生境、花、叶、茎、果实等特征" rows={3} /><button onClick={() => run()} disabled={!hasInput || running}>{running ? "识别中" : "开始识别"}<ArrowRight size={17} /></button></label>
        <div className="constraint-fields"><label>生活型<select value={conditions.lifeForm} onChange={(event) => setConditions((current) => ({ ...current, lifeForm: event.target.value }))}><option value="">不限</option>{["草本", "灌木", "乔木", "藤本", "亚灌木"].map((value) => <option key={value}>{value}</option>)}</select></label><label>生境<input value={conditions.habitat} onChange={(event) => setConditions((current) => ({ ...current, habitat: event.target.value }))} placeholder="湿草地、林缘、河滩" /></label><label>气候/天气<input value={conditions.climate} onChange={(event) => setConditions((current) => ({ ...current, climate: event.target.value }))} placeholder="凉湿、干旱、雨后" /></label><label>观察日期<input type="date" value={conditions.observedAt} onChange={(event) => setConditions((current) => ({ ...current, observedAt: event.target.value }))} /></label></div>
        <div className="joint-image-panel">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <div className="joint-upload-copy"><ImagePlus size={20} /><div><strong>照片证据</strong><span>同一植株最多 8 张；可分别标注器官</span></div></div>
          <div className="joint-upload-actions"><button type="button" onClick={() => fileInput.current?.click()}><Upload size={15} />选择照片</button><button type="button" onClick={() => cameraInput.current?.click()}><Camera size={15} />拍照</button><button type="button" onClick={() => { sessionStorage.setItem("bashang-vision-mode", "contribute"); navigate("/vision"); }}><Images size={15} />样本补录</button></div>
        </div>
        {entries.length > 0 && <div className="joint-photo-strip">{entries.map((entry, index) => <article key={`${entry.file.name}-${index}`}><button className="joint-photo-preview" onClick={() => setSelectedUrl(entry.url)} aria-label={`放大查看${entry.file.name}`}><img src={entry.url} alt={entry.file.name} /><Eye size={16} /></button><select value={entry.part} onChange={(event) => setPart(index, event.target.value)} aria-label={`${entry.file.name}器官标签`}>{PART_OPTIONS.map((part) => <option key={part}>{part}</option>)}</select><button className="icon-button" onClick={() => removeEntry(index)} aria-label={`移除${entry.file.name}`}><Trash2 size={14} /></button></article>)}</div>}
        <div className="example-queries"><span>常用组合</span>{EXAMPLES.map((example) => <button key={example} onClick={() => { setQuery(example); run(example); }}>{example}</button>)}</div>
      </div>

      {message && <div className="joint-message" role="status"><Check size={15} />{message}</div>}
      {imageCheck && <div className="capture-review joint-image-check"><div><span className="eyebrow">IMAGE CHECK</span><strong>{imageCheck.status}</strong></div><p>{imageCheck.suggestion}</p></div>}
      <ModelResults result={modelResult} combined={Boolean(submitted)} plants={knowledgeBase.plants} onOpen={(id) => navigate(`/library/${id}`)} />
      {!result && !modelResult && <section className="assistant-standby"><header><div><span className="eyebrow">RESULTS</span><h2>识别结果</h2></div><span>等待输入</span></header><dl><div><dt>文字特征</dt><dd>可选</dd></div><div><dt>照片</dt><dd>可选</dd></div><div><dt>联合约束</dt><dd>可用</dd></div><div><dt>结果状态</dt><dd>待复核</dd></div></dl></section>}
      {result?.mode === "comparison" && <ComparisonResult result={result} onOpen={(id) => navigate(`/library/${id}`)} />}
      {result?.mode === "identification" && <div className="assistant-results"><div className="result-summary"><div><span className="eyebrow">STRUCTURED EVIDENCE</span><h2>结构化特征核对</h2></div><div className="feature-chips">{result.features.map((feature) => <span key={feature}>{feature}</span>)}</div><p>已提取 {result.features.length} 个特征 · 返回 {result.candidates.length} 条本地记录</p></div><div className="candidate-grid">{result.candidates.slice(0, visibleCount).map((candidate) => <Candidate key={candidate.plant.id} candidate={candidate} onOpen={(id) => navigate(`/library/${id}`)} />)}{!result.candidates.length && <div className="no-candidates">暂无候选记录</div>}</div>{visibleCount < result.candidates.length && <button className="candidate-more" onClick={() => setVisibleCount((count) => Math.min(count + 12, result.candidates.length))}>继续显示 12 条<span>剩余 {result.candidates.length - visibleCount} 条</span></button>}</div>}
      {createPortal(<AnimatePresence>{selectedUrl && <motion.div className="image-lightbox" role="dialog" aria-modal="true" aria-label="识别照片放大预览" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUrl("")}><button ref={lightboxClose} className="icon-button lightbox-close" onClick={() => setSelectedUrl("")} aria-label="关闭预览"><X /><span>关闭</span></button><img onClick={(event) => event.stopPropagation()} src={selectedUrl} alt="识别照片放大预览" /></motion.div>}</AnimatePresence>, document.body)}
    </section>
  );
}
