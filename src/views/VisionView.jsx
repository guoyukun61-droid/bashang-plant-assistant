import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Camera, Check, Clock3, Download, Eye, ImagePlus, Images, RotateCcw, Save, ScanLine, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";
import { consumeTransferredFiles } from "../lib/transferBuffer.js";
import { deletePendingIdentification, listPendingIdentifications, savePendingIdentification, updatePendingIdentification } from "../lib/identificationStore.js";
import { clearVisionDraft, loadVisionDraft, saveVisionDraft } from "../lib/jointDraftStore.js";
import { getModelGatewayStatus, requestModelHealth, requestVisionIdentification } from "../lib/modelGateway.js";
import { exportReviewFile, loadImportedReviews, saveImportedReview } from "../lib/sampleReviewStore.js";
import { visionPipeline } from "../lib/visionPipeline.js";

const PART_OPTIONS = ["未标注", "全株", "花", "叶", "茎", "果实", "生境", "根"];
const CORE_PARTS = ["全株", "花", "叶", "茎", "果实"];

function makeEntries(files) {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/")).map((file) => ({ file, part: "未标注", url: URL.createObjectURL(file) }));
}

function backgroundPhotos(plants) {
  const available = plants.filter((plant) => plant.media.localSamples[0]?.displayUrl);
  return [15, 35, 55].map((index) => available[index % available.length]?.media.localSamples[0].displayUrl).filter(Boolean);
}

function plantImage(plant) {
  return plant?.media.localSamples[0]?.thumbnailUrl || plant?.media.iplantReferences[0]?.url || "";
}

function ReviewWorkbench({ history, pendingSamples, plants, onHistoryChange, onNavigate }) {
  const [source, setSource] = useState("imported");
  const [query, setQuery] = useState("");
  const [reviews, setReviews] = useState(loadImportedReviews);
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState({ linkedPlantId: "", status: "待复核", note: "" });
  const [previewUrls, setPreviewUrls] = useState([]);
  const [notice, setNotice] = useState("");

  const items = useMemo(() => {
    const imported = pendingSamples.map((sample) => ({ key: `imported:${sample.id}`, source: "imported", sample }));
    const local = history.map((record) => ({ key: `local:${record.id}`, source: "local", record }));
    const normalized = query.trim().toLowerCase();
    return [...(source === "imported" ? imported : local)].filter((item) => {
      const text = item.source === "imported"
        ? `${item.sample.submittedName} ${item.sample.organLabel}`
        : `${item.record.metadata?.submittedName || "未命名"} ${item.record.recordType || ""}`;
      return !normalized || text.toLowerCase().includes(normalized);
    });
  }, [history, pendingSamples, query, source]);
  const selected = items.find((item) => item.key === selectedKey) || items[0];

  useEffect(() => {
    if (!selected) return;
    setSelectedKey(selected.key);
    const saved = selected.source === "imported" ? reviews[selected.sample.id] : selected.record.review;
    setDraft({
      linkedPlantId: saved?.linkedPlantId || selected.record?.metadata?.linkedPlantId || "",
      status: saved?.status || selected.record?.status || "待复核",
      note: saved?.note || "",
    });
    const urls = selected.source === "local"
      ? selected.record.files.filter((file) => file.blob instanceof Blob).map((file) => URL.createObjectURL(file.blob))
      : [selected.sample.displayUrl];
    setPreviewUrls(urls);
    return () => urls.filter((url) => url.startsWith("blob:")).forEach((url) => URL.revokeObjectURL(url));
  }, [selected?.key]);

  const saveDecision = async () => {
    if (!selected) return;
    if (draft.status === "已确认" && !draft.linkedPlantId) {
      setNotice("标记为已确认前，请先关联一条正式植物记录");
      return;
    }
    if (selected.source === "imported") {
      const decision = saveImportedReview(selected.sample.id, draft);
      setReviews((current) => ({ ...current, [selected.sample.id]: decision }));
    } else {
      await updatePendingIdentification(selected.record.id, { status: draft.status, review: draft });
      await onHistoryChange();
    }
    setNotice("复核结果已保存在本机");
  };
  const applyToSameName = () => {
    if (!selected || selected.source !== "imported") return;
    if (draft.status === "已确认" && !draft.linkedPlantId) {
      setNotice("批量确认前，请先关联一条正式植物记录");
      return;
    }
    const sameNameSamples = pendingSamples.filter((sample) => sample.submittedName === selected.sample.submittedName);
    const decisions = sameNameSamples.reduce((result, sample) => {
      result[sample.id] = saveImportedReview(sample.id, draft);
      return result;
    }, {});
    setReviews((current) => ({ ...current, ...decisions }));
    setNotice(`已将结论应用到 ${sameNameSamples.length} 条同名样本`);
  };
  const removeLocal = async () => {
    if (!selected || selected.source !== "local") return;
    await deletePendingIdentification(selected.record.id);
    setSelectedKey("");
    await onHistoryChange();
    setNotice("本机补录记录已删除");
  };
  const exportAll = () => {
    const localRecords = history.map((record) => ({
      id: record.id, createdAt: record.createdAt, status: record.status, recordType: record.recordType,
      metadata: record.metadata, review: record.review || null,
      files: record.files.map(({ blob, ...file }) => file), modelResult: record.modelResult || null,
    }));
    const importedRecords = pendingSamples.map((sample) => ({ ...sample, localReview: reviews[sample.id] || null }));
    exportReviewFile({ exportedAt: new Date().toISOString(), localRecords, importedRecords });
    setNotice("复核清单已导出");
  };
  const linkedPlant = plants.find((plant) => plant.id === draft.linkedPlantId);

  return <section className="review-workbench" id="sample-review-workbench">
    <header><div><span className="eyebrow">SAMPLE REVIEW</span><h2>样本复核工作台</h2><p>为未定种样本建立可追溯的处理结论</p></div><button onClick={exportAll}><Download size={16} />导出复核清单</button></header>
    <div className="review-source-tabs" role="tablist"><button className={source === "imported" ? "is-active" : ""} onClick={() => { setSource("imported"); setSelectedKey(""); }}>导入待复核 <span>{pendingSamples.length}</span></button><button className={source === "local" ? "is-active" : ""} onClick={() => { setSource("local"); setSelectedKey(""); }}>本机补录 <span>{history.length}</span></button><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索暂定名称" /></div>
    <div className="review-layout">
      <div className="review-queue">{items.map((item) => { const sample = item.sample; const record = item.record; const name = sample?.submittedName || record?.metadata?.submittedName || "未命名记录"; const thumb = sample?.thumbnailUrl || ""; const status = sample ? reviews[sample.id]?.status || "待复核" : record.status; return <button className={selected?.key === item.key ? "is-active" : ""} key={item.key} onClick={() => setSelectedKey(item.key)}>{thumb ? <img src={thumb} alt="" /> : <ImagePlus size={20} />}<span><strong>{name}</strong><em>{sample?.organLabel || `${record.files.length} 张照片`}</em></span><small>{status}</small></button>; })}{!items.length && <p>当前没有符合条件的待复核记录。</p>}</div>
      {selected && <article className="review-detail"><div className="review-previews">{previewUrls.map((url, index) => <img key={url} src={url} alt={`待复核样本 ${index + 1}`} />)}</div><div className="review-form"><div><span className="eyebrow">{selected.source === "imported" ? selected.sample.id : selected.record.id}</span><h3>{selected.sample?.submittedName || selected.record.metadata?.submittedName || "未命名记录"}</h3></div><label>关联正式植物<select value={draft.linkedPlantId} onChange={(event) => setDraft((current) => ({ ...current, linkedPlantId: event.target.value }))}><option value="">仍未确定</option>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.id} · {plant.names.chinese}</option>)}</select></label><label>处理状态<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>{["待复核", "已确认", "需补拍", "不纳入名录"].map((status) => <option key={status}>{status}</option>)}</select></label><label>复核意见<textarea rows={3} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="记录判断依据、缺失器官或老师意见" /></label><div className="review-actions"><button className="primary-command" onClick={saveDecision}><Save size={16} />保存复核</button>{selected.source === "imported" && <button onClick={applyToSameName}><Images size={15} />应用到同名样本</button>}{linkedPlant && <button onClick={() => onNavigate(linkedPlant.id)}>查看 {linkedPlant.names.chinese}<ArrowRight size={15} /></button>}{selected.source === "local" && <button className="review-delete" onClick={removeLocal}><Trash2 size={15} />删除记录</button>}</div>{notice && <p role="status"><Check size={14} />{notice}</p>}</div></article>}
    </div>
  </section>;
}

export default function VisionView() {
  const navigate = useNavigate();
  const { summary, captureChecklist, plants, pendingSamples } = useKnowledgeBase();
  const [mode, setMode] = useState(() => sessionStorage.getItem("bashang-vision-mode") || "check");
  const [entries, setEntries] = useState([]);
  const [result, setResult] = useState(null);
  const [modelResult, setModelResult] = useState(null);
  const [selectedUrl, setSelectedUrl] = useState("");
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [modelHealth, setModelHealth] = useState(() => ({
    state: getModelGatewayStatus().visionConfigured ? "checking" : "disabled",
    device: "",
    engineVersion: "",
    catalogSize: 0,
  }));
  const [submission, setSubmission] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("bashang-vision-draft")) || {
        submittedName: "", linkedPlantId: "", habitat: "", climate: "",
        observedAt: new Date().toISOString().slice(0, 10), notes: "",
      };
    } catch {
      return { submittedName: "", linkedPlantId: "", habitat: "", climate: "", observedAt: new Date().toISOString().slice(0, 10), notes: "" };
    }
  });
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const lightboxClose = useRef(null);
  const entriesRef = useRef([]);
  const modelGateway = getModelGatewayStatus();
  const photos = useMemo(() => backgroundPhotos(plants), [plants]);
  const coveredParts = useMemo(() => new Set(entries.map((entry) => entry.part).filter((part) => part !== "未标注")), [entries]);
  const missingCoreParts = CORE_PARTS.filter((part) => !coveredParts.has(part));
  entriesRef.current = entries;
  const refreshHistory = useCallback(async () => {
    const records = await listPendingIdentifications();
    setHistory(records);
    return records;
  }, []);

  useEffect(() => {
    let active = true;
    const transferred = consumeTransferredFiles();
    loadVisionDraft().then((draft) => {
      if (!active) return;
      if (transferred.length) {
        setEntries(makeEntries(transferred));
      } else if (draft) {
        setEntries((draft.entries || []).filter((entry) => entry.file instanceof Blob).map((entry) => ({ ...entry, url: URL.createObjectURL(entry.file) })));
        setMode(draft.mode || "check");
        if (draft.submission) setSubmission(draft.submission);
        setResult(draft.result || null);
        setModelResult(draft.modelResult || null);
        setMessage(draft.message || "");
      }
    }).catch(() => {
      if (transferred.length) setEntries(makeEntries(transferred));
    }).finally(() => active && setDraftReady(true));
    refreshHistory().catch(() => setHistory([]));
    if (sessionStorage.getItem("bashang-open-review") === "1") {
      sessionStorage.removeItem("bashang-open-review");
      window.setTimeout(() => document.getElementById("sample-review-workbench")?.scrollIntoView({ block: "start" }), 120);
    }
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!modelGateway.visionConfigured || !modelGateway.healthApiUrl) return undefined;
    let active = true;
    const checkHealth = async () => {
      try {
        const health = await requestModelHealth();
        if (!active) return;
        setModelHealth({
          state: health.modelReady ? "ready" : health.status === "loading" ? "loading" : "unavailable",
          device: String(health.device || ""),
          engineVersion: String(health.engineVersion || ""),
          catalogSize: Number(health.catalogSize) || 0,
          error: String(health.error || ""),
        });
      } catch (error) {
        if (active) setModelHealth({ state: "unavailable", device: "", engineVersion: "", catalogSize: 0, error: error.message });
      }
    };
    checkHealth();
    const timer = window.setInterval(checkHealth, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [modelGateway.healthApiUrl, modelGateway.visionConfigured]);
  useEffect(() => () => entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url)), []);
  useEffect(() => {
    sessionStorage.setItem("bashang-vision-mode", mode);
    sessionStorage.setItem("bashang-vision-draft", JSON.stringify(submission));
  }, [mode, submission]);
  useEffect(() => {
    if (!draftReady) return undefined;
    const timer = window.setTimeout(() => saveVisionDraft({ mode, submission, entries, result, modelResult, message }).catch(() => {}), 180);
    return () => window.clearTimeout(timer);
  }, [draftReady, entries, message, mode, modelResult, result, submission]);
  useEffect(() => {
    if (!selectedUrl) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedUrl("");
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => lightboxClose.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedUrl]);

  const addFiles = (files) => {
    const provided = Array.from(files || []);
    const incoming = makeEntries(provided);
    if (incoming.length < provided.length) setMessage("已忽略非图片文件");
    setEntries((current) => {
      const keys = new Set(current.map((entry) => `${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`));
      const unique = incoming.filter((entry) => !keys.has(`${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`));
      const combined = [...current, ...unique];
      if (unique.length < incoming.length) setMessage("重复图片未再次加入");
      if (combined.length > 8) setMessage("每条记录最多保留 8 张图片");
      combined.slice(8).forEach((entry) => URL.revokeObjectURL(entry.url));
      return combined.slice(0, 8);
    });
    setResult(null);
    setModelResult(null);
  };
  const removeEntry = (index) => {
    setEntries((current) => { URL.revokeObjectURL(current[index].url); return current.filter((_, itemIndex) => itemIndex !== index); });
    setResult(null); setModelResult(null);
  };
  const clearEntries = () => {
    entriesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    setEntries([]); setResult(null); setModelResult(null); setMessage("已清空本次照片");
    clearVisionDraft().catch(() => {});
  };
  const setPart = (index, part) => {
    setEntries((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, part } : entry));
    setResult(null); setModelResult(null);
  };
  const updateSubmission = (field, value) => setSubmission((current) => ({ ...current, [field]: value }));
  const selectLinkedPlant = (plantId) => {
    const plant = plants.find((item) => item.id === plantId);
    setSubmission((current) => ({ ...current, linkedPlantId: plantId, submittedName: plant ? plant.names.chinese : current.submittedName }));
  };
  const inspect = async () => {
    try {
      const next = await visionPipeline(entries.map((entry) => entry.file), entries.map((entry) => entry.part));
      setResult(next);
      setMessage("");
    } catch {
      setMessage("图片检查失败，请移除无法读取的文件后重试");
    }
  };
  const recognize = async () => {
    try {
      setMessage("正在等待识别服务返回");
      const next = await requestVisionIdentification(
        entries.map((entry) => entry.file),
        entries.map((entry) => entry.part),
        {
          observedAt: submission.observedAt,
          habitat: submission.habitat.trim(),
          climate: submission.climate?.trim() || "",
          notes: submission.notes.trim(),
          region: "broad_grassland",
        },
      );
      setModelResult(next);
      setMessage(`识别服务返回 ${next.candidates.length} 条候选`);
    } catch (error) {
      setModelResult(null);
      setMessage(error.message || "识别服务调用失败");
    }
  };
  const save = async () => {
    if (!entries.length) return;
    const submittedName = submission.submittedName.trim();
    if (mode === "contribute" && !submittedName) {
      setMessage("请填写暂定植物名称");
      return;
    }
    if (mode === "contribute" && entries.every((entry) => entry.part === "未标注")) {
      setMessage("请至少为一张照片标注器官");
      return;
    }
    const pipeline = result || await visionPipeline(entries.map((entry) => entry.file), entries.map((entry) => entry.part));
    const record = {
      id: `LOCAL-${Date.now()}`, createdAt: new Date().toISOString(), status: "待复核",
      files: entries.map((entry) => ({ name: entry.file.name, type: entry.file.type, size: entry.file.size, part: entry.part, blob: entry.file })),
      missingParts: pipeline.missingParts,
      modelStatus: modelResult ? "BioCLIP 已运行，结果待复核" : "本次未运行识别模型",
      modelResult: modelResult ? {
        requestId: modelResult.requestId,
        model: modelResult.model,
        candidates: modelResult.candidates.slice(0, 10).map((candidate) => ({
          plantId: candidate.plantId,
          scientificName: candidate.scientificName,
          score: candidate.score,
        })),
      } : null,
      recordType: mode === "contribute" ? "样本补录" : "图片检查",
      metadata: mode === "contribute" ? {
        submittedName,
        linkedPlantId: submission.linkedPlantId,
        habitat: submission.habitat.trim(),
        climate: submission.climate?.trim() || "",
        observedAt: submission.observedAt,
        notes: submission.notes.trim(),
        sourceType: "后续实习补录",
      } : null,
    };
    try {
      await savePendingIdentification(record);
      await refreshHistory();
      setResult(pipeline);
      setMessage(mode === "contribute" ? "补录样本已保存到本机待复核" : "已保存到本机待复核记录");
    } catch {
      setMessage("本机存储失败，请检查浏览器存储权限或可用空间");
    }
  };

  return <section className="vision-view page-view">
    <div className="workbench-photo-field workbench-photo-field--vision" aria-hidden="true">{photos.map((photo, index) => <img key={photo} src={photo} alt="" className={`photo-layer photo-layer--${index + 1}`} />)}</div>
    <header className="workbench-header vision-workbench-header"><div><span className="eyebrow">FIELD SAMPLE RECORDS</span><h1>样本补录</h1></div><div className="workbench-status" aria-label="样本补录状态"><span><Images size={15} />{summary.localImageCount} 张实习样本</span><span><Check size={15} />图像检查可用</span><span className={modelHealth.state === "ready" ? "status-online" : "status-pending"}><i />{{ ready: `BioCLIP${modelHealth.engineVersion ? ` v${modelHealth.engineVersion}` : ""} 已就绪${modelHealth.device ? ` · ${modelHealth.device.toUpperCase()}` : ""}`, checking: "正在检查 BioCLIP", loading: "BioCLIP 加载中", unavailable: "BioCLIP 未就绪", disabled: "本地记录可用" }[modelHealth.state]}</span></div></header>
    <div className="vision-mode-switch" role="tablist" aria-label="图片工作模式"><button role="tab" aria-selected={mode === "check"} className={mode === "check" ? "is-active" : ""} onClick={() => { setMode("check"); setMessage(""); }}><ScanLine size={16} />图片检查</button><button role="tab" aria-selected={mode === "contribute"} className={mode === "contribute" ? "is-active" : ""} onClick={() => { setMode("contribute"); setMessage(""); }}><Upload size={16} />样本补录</button></div>
    <div className="vision-layout">
      <div className="upload-workspace">
        {mode === "contribute" && <section className="submission-form"><div className="submission-form__heading"><div><span className="eyebrow">SAMPLE CONTRIBUTION</span><h2>补录信息</h2></div><span>本机待复核</span></div><div className="submission-grid"><label>暂定植物名称<input value={submission.submittedName} onChange={(event) => updateSubmission("submittedName", event.target.value)} placeholder="必填；可填写名录外名称" /></label><label>关联正式名录<select value={submission.linkedPlantId} onChange={(event) => selectLinkedPlant(event.target.value)}><option value="">名录外或暂不确定</option>{plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.id} · {plant.names.chinese}</option>)}</select></label><label>采集生境<input value={submission.habitat} onChange={(event) => updateSubmission("habitat", event.target.value)} placeholder="如：湿草地、林缘、河滩" /></label><label>气候/天气<input value={submission.climate || ""} onChange={(event) => updateSubmission("climate", event.target.value)} placeholder="如：凉湿、干旱、雨后" /></label><label>观察日期<input type="date" value={submission.observedAt} onChange={(event) => updateSubmission("observedAt", event.target.value)} /></label><label className="submission-notes">补充说明<textarea value={submission.notes} onChange={(event) => updateSubmission("notes", event.target.value)} rows={2} placeholder="可记录株高、伴生种或需教师确认的问题" /></label></div></section>}
        <div className={`upload-zone ${draggingFiles ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDraggingFiles(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingFiles(false); }} onDrop={(event) => { event.preventDefault(); setDraggingFiles(false); addFiles(event.dataTransfer.files); }}>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <ImagePlus size={28} /><div><strong>{draggingFiles ? "松开以加入照片" : mode === "contribute" ? "补录照片" : "样本图像"}</strong><span>同一植株 · 支持多选 · 最多 8 张</span></div>
          <div className="upload-actions"><button onClick={() => fileInput.current?.click()}><Upload size={16} />选择图片</button><button onClick={() => cameraInput.current?.click()}><Camera size={16} />打开相机</button></div>
          <div className="upload-capacity" aria-label={`已选择 ${entries.length} 张，最多 8 张`}><span style={{ "--upload-progress": `${(entries.length / 8) * 100}%` }} /><b>{entries.length}</b><em>/ 8</em></div>
        </div>

        {entries.length > 0 && <section className="upload-manifest"><header><div><span className="eyebrow">PHOTO MANIFEST</span><strong>{entries.length} 张照片 · 已覆盖 {coveredParts.size} 类观察</strong><p>{missingCoreParts.length ? `建议补充：${missingCoreParts.join("、")}` : "核心器官覆盖完整"}</p></div><button onClick={clearEntries}><RotateCcw size={15} />清空本次</button></header><div className="coverage-track" aria-label="核心器官覆盖情况">{CORE_PARTS.map((part) => <span className={coveredParts.has(part) ? "is-covered" : ""} key={part}><i />{part}</span>)}</div><div className="upload-grid">{entries.map((entry, index) => <article className="upload-item" key={`${entry.file.name}-${index}`}><button className="upload-preview" onClick={() => setSelectedUrl(entry.url)} aria-label={`放大查看${entry.file.name}`}><img src={entry.url} alt={entry.file.name} /><Eye size={18} /><em>{String(index + 1).padStart(2, "0")}</em></button><div className="upload-item__body"><div className="upload-file-meta"><strong>{entry.file.name}</strong><span>{(entry.file.size / 1024 / 1024).toFixed(1)} MB</span></div><div className="organ-strip" role="group" aria-label={`${entry.file.name}器官标签`}>{PART_OPTIONS.map((part) => <button type="button" className={entry.part === part ? "is-active" : ""} aria-pressed={entry.part === part} key={part} onClick={() => setPart(index, part)}>{part}</button>)}</div></div><button className="icon-button remove-upload" onClick={() => removeEntry(index)} aria-label={`移除${entry.file.name}`} title="移除照片"><Trash2 size={15} /></button></article>)}</div></section>}
        <div className="vision-commands"><button className="primary-command" onClick={inspect} disabled={!entries.length}><ScanLine size={17} />检查图片与器官覆盖</button>{modelGateway.visionConfigured && <button onClick={recognize} disabled={!entries.length || modelHealth.state !== "ready"} title={modelHealth.state === "ready" ? "使用本机 BioCLIP 生成候选" : "请先启动 BioCLIP 服务"}><ScanLine size={17} />BioCLIP 识别</button>}<button onClick={save} disabled={!entries.length}><Save size={17} />{mode === "contribute" ? "保存补录" : "保存为待复核"}</button>{message && <span role="status"><Check size={15} />{message}</span>}</div>
        {result && <div className="capture-review"><div><span className="eyebrow">IMAGE CHECK</span><strong>{result.status}</strong></div><p>{result.suggestion}</p></div>}
        {modelResult && <section className="model-results" aria-live="polite"><div><span className="eyebrow">BIOCLIP CANDIDATES</span><strong>识别候选</strong><em>{modelResult.elapsedSeconds ? `${modelResult.elapsedSeconds.toFixed(1)} 秒 · ` : ""}闭集相对得分</em></div>{modelResult.candidates.length ? <ol>{modelResult.candidates.map((candidate, index) => { const plant = plants.find((item) => item.id === candidate.plantId); const image = plantImage(plant); return <li key={`${candidate.plantId || candidate.scientificName || "candidate"}-${index}`}><button type="button" onClick={() => candidate.plantId && navigate(`/library/${candidate.plantId}`)} disabled={!candidate.plantId}>{image ? <img className="model-candidate-image" src={image} alt={candidate.chineseName || "候选植物"} /> : <span className="model-candidate-image model-candidate-image--empty"><ImagePlus size={16} /></span>}<span className="model-candidate-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{candidate.chineseName || candidate.plantId || "未命名候选"}</strong><em>{candidate.scientificName || ""}</em><small>{candidate.family || ""}</small></div>{Number.isFinite(candidate.score) && <b>{(candidate.score * 100).toFixed(1)}%</b>}</button></li>; })}</ol> : <p>服务未返回候选物种。</p>}{modelResult.warnings.length > 0 && <div className="model-result-warnings">{modelResult.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}</section>}
      </div>

      <aside className="capture-guidance"><div className="capture-guidance__title"><Camera size={19} /><div><span className="eyebrow">CAPTURE STANDARD</span><h2>拍摄注意事项</h2></div></div>
        <ol>{captureChecklist.map((item, index) => <li key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.subject}<em>至少 {item.minimumCount} 张</em></strong><p>{item.requirement}</p><small>常见问题：{item.commonIssue}</small></div></li>)}</ol>
        <div className="local-history"><div><Clock3 size={16} /><strong>本机待复核</strong><span>{history.length}</span></div>{history.slice(0, 3).map((record) => <p key={record.id}><span>{record.metadata?.submittedName || new Date(record.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><strong>{record.files.length} 张 · {record.recordType || record.status}</strong></p>)}{!history.length && <em>尚无本地保存记录</em>}</div>
      </aside>
    </div>
    <ReviewWorkbench history={history} pendingSamples={pendingSamples} plants={plants} onHistoryChange={refreshHistory} onNavigate={(id) => navigate(`/library/${id}`)} />
    {createPortal(<AnimatePresence>{selectedUrl && <motion.div className="image-lightbox" role="dialog" aria-modal="true" aria-label="上传图片放大预览" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUrl("")}><button ref={lightboxClose} className="icon-button lightbox-close" onClick={() => setSelectedUrl("")} aria-label="关闭预览"><X /><span>关闭</span></button><img onClick={(event) => event.stopPropagation()} src={selectedUrl} alt="上传图片放大预览" /></motion.div>}</AnimatePresence>, document.body)}
  </section>;
}
