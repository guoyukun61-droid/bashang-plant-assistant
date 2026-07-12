import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Camera, ExternalLink, Focus, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

const ORGANS = {
  whole: { label: "整体", sample: "全株", hotspot: [48, 80], tip: "观察生活型、植株高度、分枝方式及整体轮廓。" },
  stem: { label: "茎", sample: "茎", hotspot: [49, 61], tip: "记录茎的节、棱、沟、毛被、刺及分枝方式。" },
  leaf: { label: "叶", sample: "叶", hotspot: [38, 49], tip: "记录连续茎节上的叶序，以及叶片正反面、叶缘和叶柄特征。" },
  flower: { label: "花", sample: "花", hotspot: [57, 23], tip: "记录单花正面与完整花序侧面，判定花序类型、花冠形态及对称性。" },
  fruit: { label: "果实", sample: "果", hotspot: [62, 36], tip: "记录果实未熟与成熟阶段，并设置尺度参照。" },
};

function imageForOrgan(plant, organ) {
  const expected = ORGANS[organ].sample;
  const sample = plant.media.localSamples.find((item) => item.organLabel.includes(expected));
  const fallback = plant.media.localSamples.find((item) => item.organLabel.includes("全株"));
  const reference = plant.media.iplantReferences[0];
  return {
    url: sample?.displayUrl || fallback?.displayUrl || reference?.url || "",
    local: Boolean(sample),
    label: sample?.organLabel || (fallback ? "全株替代图" : "iPlant 参考图"),
  };
}

export default function AtlasView() {
  const { organ = "whole" } = useParams();
  const currentOrgan = ORGANS[organ] ? organ : "whole";
  const { plants, featureIndex, setBackdrop } = useKnowledgeBase();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const featured = plants.find((plant) => plant.id === "HBFC-071") || plants.find((plant) => plant.media.localSamples.length >= 4) || plants[0];
  const image = imageForOrgan(featured, currentOrgan);
  const organFeatures = useMemo(() => featureIndex.filter((item) => item.organ === ORGANS[currentOrgan].label && item.plantCount > 0), [featureIndex, currentOrgan]);
  const categories = useMemo(() => [...new Set(organFeatures.map((item) => item.category))], [organFeatures]);
  const [category, setCategory] = useState(categories[0] || "");
  const [featureId, setFeatureId] = useState(organFeatures[0]?.id || "");

  useEffect(() => {
    setCategory(categories[0] || "");
    setFeatureId(organFeatures[0]?.id || "");
  }, [currentOrgan, categories, organFeatures]);
  useEffect(() => { if (image.url) setBackdrop(image.url); }, [image.url, setBackdrop]);

  const categoryFeatures = organFeatures.filter((item) => item.category === category).slice(0, 8);
  const activeFeature = organFeatures.find((item) => item.id === featureId) || categoryFeatures[0];
  const maxFeatureCount = Math.max(...categoryFeatures.map((item) => item.plantCount), 1);
  const organPosition = Object.keys(ORGANS).indexOf(currentOrgan) + 1;

  return (
    <section className="atlas-view page-view">
      <div className="atlas-stage">
        <motion.img key={image.url} src={image.url} alt={`${featured.names.chinese}${ORGANS[currentOrgan].label}观察图`} initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.025 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.42 }} />
        <div className="stage-shade" />
        <div className="atlas-heading">
          <span className="eyebrow">{featured.id} · {featured.taxonomy.family} / {featured.taxonomy.genus}</span>
          <h1>{featured.names.chinese}</h1>
          <p className="atlas-latin-name">{featured.names.latin}</p>
        </div>
        <div className="hotspot-layer" aria-label="器官热点">
          {Object.entries(ORGANS).map(([key, item]) => (
            <button key={key} className={`plant-hotspot ${key === currentOrgan ? "is-active" : ""}`} style={{ left: `${item.hotspot[0]}%`, top: `${item.hotspot[1]}%` }} onClick={() => navigate(`/atlas/${key}`)} aria-label={`观察${item.label}`}>
              <span /><b>{item.label}</b>
            </button>
          ))}
        </div>
        <div className="stage-caption"><span className={image.local ? "source-local" : "source-reference"}>{image.local ? "实习本地样本" : "参考图 / 本地缺少该器官"}</span><em>{image.label}</em></div>
      </div>

      <aside className="atlas-inspector">
        <div className="inspector-topline"><div><span>当前观察</span><em>{String(organPosition).padStart(2, "0")} / 05</em></div><strong>{ORGANS[currentOrgan].label}</strong></div>
        <p className="observation-tip"><Focus size={18} />{ORGANS[currentOrgan].tip}</p>
        <div className="inspector-section-label"><span>特征分类</span><em>{organFeatures.length} 项记录</em></div>
        <div className="branch-filter" role="tablist" aria-label="特征类别">
          {categories.slice(0, 7).map((item) => <button role="tab" aria-selected={item === category} className={item === category ? "is-active" : ""} key={item} onClick={() => { setCategory(item); const first = organFeatures.find((feature) => feature.category === item); setFeatureId(first?.id || ""); }}>{item}</button>)}
        </div>
        <div className="feature-branches">
          {categoryFeatures.map((item) => <button key={item.id} className={item.id === activeFeature?.id ? "is-active" : ""} onClick={() => setFeatureId(item.id)} style={{ "--feature-share": `${Math.max(6, (item.plantCount / maxFeatureCount) * 100)}%` }}><span>{item.value}</span><b>{item.plantCount}<small>种</small></b></button>)}
        </div>
        {activeFeature ? <div className="feature-focus">
          <span className="eyebrow">{activeFeature.id}</span><h2>{activeFeature.value}</h2>
          <p>{activeFeature.beginnerExplanation || activeFeature.note || "该特征已进入坝上植物反向索引。"}</p>
          <div className="feature-count"><Sprout size={17} /><strong>{activeFeature.plantCount}</strong><span>种植物记录此特征</span></div>
          <div className="linked-plants">{activeFeature.plantIds.slice(0, 5).map((id, index) => <button key={id} onClick={() => navigate(`/library/${id}`)}>{activeFeature.plantNames[index] || id}<ArrowRight size={14} /></button>)}</div>
          {activeFeature.recommendedPart && <p className="capture-hint"><Camera size={16} />{activeFeature.recommendedPart}</p>}
        </div> : <div className="empty-feature"><Camera />该器官暂无标准特征，建议按拍摄规范补充样本。</div>}
        <button className="text-command" onClick={() => navigate(`/library/${featured.id}`)}>打开 {featured.names.chinese} 数字标本 <ExternalLink size={15} /></button>
      </aside>
    </section>
  );
}
