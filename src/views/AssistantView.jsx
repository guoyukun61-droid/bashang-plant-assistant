import {
  ArrowRight,
  Check,
  Database,
  Focus,
  GitCompare,
  ImagePlus,
  ListFilter,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";
import { assistantEngine } from "../lib/assistantEngine.js";
import { setTransferredFiles } from "../lib/transferBuffer.js";

const EXAMPLES = [
  "黄色 头状花序 舌状花",
  "湿地 禾本科",
  "紫色 球状花",
  "轮生叶 蒴果",
  "帮我区分问荆和节节草",
];

function candidateImage(plant) {
  return plant.media.localSamples[0]?.thumbnailUrl || plant.media.iplantReferences[0]?.url || "";
}

function backgroundPhotos(plants) {
  const available = plants.filter((plant) => plant.media.localSamples[0]?.displayUrl);
  return [5, 25, 45].map((index) => available[index % available.length]?.media.localSamples[0].displayUrl).filter(Boolean);
}

function ComparisonResult({ result, onOpen }) {
  return (
    <div className="comparison-workbench">
      <div className="comparison-head">
        <GitCompare />
        <div><span className="eyebrow">COMPARISON</span><h2>{result.plants.map((plant) => plant.names.chinese).join(" vs ")}</h2></div>
      </div>
      <div className="comparison-plants">
        {result.plants.map((plant) => (
          <button key={plant.id} onClick={() => onOpen(plant.id)}>
            <img src={candidateImage(plant)} alt={plant.names.chinese} />
            <span><strong>{plant.names.chinese}</strong><em>{plant.names.latin}</em></span><ArrowRight />
          </button>
        ))}
      </div>
      <div className="comparison-table">
        {result.rows.map((row) => <div className="comparison-row" key={row.label}><strong>{row.label}</strong>{row.values.map((value, index) => <p key={`${row.label}-${index}`}>{value}</p>)}</div>)}
      </div>
      <p className="next-observation"><Focus size={17} />{result.nextObservation}</p>
    </div>
  );
}

function Candidate({ candidate, onOpen }) {
  const { plant } = candidate;
  return (
    <article className="candidate-card">
      <button className="candidate-image" onClick={() => onOpen(plant.id)}>
        <img src={candidateImage(plant)} alt={plant.names.chinese} /><span>{candidate.matchLevel}</span>
      </button>
      <div className="candidate-content">
        <div className="candidate-title">
          <div><span>{plant.id} · {plant.taxonomy.family}</span><h3>{plant.names.chinese}</h3><em>{plant.names.latin}</em></div>
          <button className="icon-button" onClick={() => onOpen(plant.id)} aria-label={`打开${plant.names.chinese}`}><ArrowRight size={18} /></button>
        </div>
        <div className="evidence-block evidence-block--support"><strong><Check size={15} />支持特征</strong><p>{candidate.supportFeatures.length ? candidate.supportFeatures.join(" · ") : "暂无稳定支持组合"}</p></div>
        {candidate.conflictFeatures.length > 0 && <div className="evidence-block evidence-block--conflict"><strong><TriangleAlert size={15} />冲突特征</strong><p>{candidate.conflictFeatures.join(" · ")}</p></div>}
        <div className="evidence-block"><strong>待确认</strong><p>{candidate.pendingFeatures.length ? candidate.pendingFeatures.join(" · ") : "主要特征已有对应记录"}</p></div>
        <p className="candidate-next">复核建议：{candidate.nextObservation}</p>
        <div className="source-tags">{candidate.sources.map((source) => <span key={source}>{source}</span>)}</div>
      </div>
    </article>
  );
}

export default function AssistantView() {
  const knowledgeBase = useKnowledgeBase();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => sessionStorage.getItem("bashang-assistant-query") || "");
  const [submitted, setSubmitted] = useState(() => sessionStorage.getItem("bashang-assistant-submitted") || "");
  const [dragging, setDragging] = useState(false);
  const photos = useMemo(() => backgroundPhotos(knowledgeBase.plants), [knowledgeBase.plants]);
  const result = useMemo(() => submitted ? assistantEngine(submitted, knowledgeBase) : null, [submitted, knowledgeBase]);
  const run = (value = query) => { const next = value.trim(); if (!next) return; setQuery(next); setSubmitted(next); };
  const clear = () => { setQuery(""); setSubmitted(""); };
  const transfer = (files) => { if (!files?.length) return; setTransferredFiles(files); navigate("/vision", { state: { fromAssistant: true } }); };
  useEffect(() => {
    sessionStorage.setItem("bashang-assistant-query", query);
    sessionStorage.setItem("bashang-assistant-submitted", submitted);
  }, [query, submitted]);

  return (
    <section className="assistant-view page-view" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); transfer(event.dataTransfer.files); }}>
      <div className="workbench-photo-field workbench-photo-field--assistant" aria-hidden="true">{photos.map((photo, index) => <img key={photo} src={photo} alt="" className={`photo-layer photo-layer--${index + 1}`} />)}</div>
      {dragging && <div className="assistant-drop"><ImagePlus size={28} /><span>转交图片识别</span></div>}

      <header className="workbench-header">
        <div><span className="eyebrow">SEMANTIC IDENTIFICATION</span><h1>语义识别</h1></div>
        <div className="workbench-status" aria-label="知识库状态">
          <span><Database size={15} />{knowledgeBase.summary.recordCount} 种植物</span>
          <span><ListFilter size={15} />{knowledgeBase.summary.reverseIndexCount} 条特征索引</span>
          <span className="status-online"><i />本地引擎可用</span>
        </div>
      </header>

      <div className="query-console">
        <div className="console-status"><strong>观察记录</strong><span><i />本地候选检索</span><em>大模型解释未启用</em>{(query || submitted) && <button className="console-clear" onClick={clear} aria-label="清空观察记录" title="清空"><X size={14} /></button>}</div>
        <label className="query-editor">
          <Search size={21} />
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); run(); } }} placeholder="记录生活型、生境、花序、叶序或特殊结构" rows={3} />
          <button onClick={() => run()} disabled={!query.trim()}>生成候选<ArrowRight size={17} /></button>
        </label>
        <div className="example-queries"><span>常用组合</span>{EXAMPLES.map((example) => <button key={example} onClick={() => run(example)}>{example}</button>)}</div>
      </div>

      {!result && <section className="assistant-standby"><header><div><span className="eyebrow">RESULTS</span><h2>识别结果</h2></div><span>未分析</span></header><dl><div><dt>已提取特征</dt><dd>0</dd></div><div><dt>候选记录</dt><dd>0</dd></div><div><dt>冲突项</dt><dd>0</dd></div><div><dt>数据来源</dt><dd>本地知识库 V2</dd></div></dl></section>}
      {result?.mode === "comparison" && <ComparisonResult result={result} onOpen={(id) => navigate(`/library/${id}`)} />}
      {result?.mode === "identification" && <div className="assistant-results"><div className="result-summary"><div><span className="eyebrow">RESULTS</span><h2>识别结果</h2></div><div className="feature-chips">{result.features.map((feature) => <span key={feature}>{feature}</span>)}</div><p>已提取 {result.features.length} 个特征 · 返回 {result.candidates.length} 条本地候选</p></div><div className="candidate-grid">{result.candidates.map((candidate) => <Candidate key={candidate.plant.id} candidate={candidate} onOpen={(id) => navigate(`/library/${id}`)} />)}{!result.candidates.length && <div className="no-candidates">暂无候选记录</div>}</div></div>}
    </section>
  );
}
