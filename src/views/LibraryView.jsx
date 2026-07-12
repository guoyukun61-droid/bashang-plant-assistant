import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Filter, Image, Search, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

const FLOWER_COLORS = ["", "黄色", "白色", "紫色", "蓝色", "红色", "粉色", "绿色"];

function compactText(value, fallback = "待补充") {
  return value?.trim() || fallback;
}

function mediaUrl(item) {
  return item?.displayUrl || item?.url || "";
}

function profileSegments(text) {
  return String(text || "")
    .split(/；；+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((segment) => {
      const separator = segment.indexOf("：");
      return separator > 0
        ? { label: segment.slice(0, separator), text: segment.slice(separator + 1) }
        : { label: "资料", text: segment };
    });
}

export default function LibraryView() {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const { plants, setBackdrop } = useKnowledgeBase();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [lifeForm, setLifeForm] = useState("");
  const [habitat, setHabitat] = useState("");
  const [flowerColor, setFlowerColor] = useState("");
  const [featureQuery, setFeatureQuery] = useState("");
  const [indexOpen, setIndexOpen] = useState(false);
  const [gallery, setGallery] = useState("local");
  const [activeMedia, setActiveMedia] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const keyboardNavigation = useRef(false);

  const selected = plants.find((plant) => plant.id === plantId) || plants[0];
  const selectedIndex = plants.findIndex((plant) => plant.id === selected.id);
  const families = useMemo(() => [...new Set(plants.map((plant) => plant.taxonomy.family).filter(Boolean))].sort(), [plants]);
  const lifeForms = useMemo(() => [...new Set(plants.map((plant) => plant.ecology.lifeForm).filter(Boolean))].sort(), [plants]);
  const results = useMemo(() => plants.filter((plant) => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedHabitat = habitat.trim();
    const normalizedFeature = featureQuery.trim().toLowerCase();
    const textMatch = !normalizedQuery || plant.searchText.includes(normalizedQuery);
    return textMatch
      && (!family || plant.taxonomy.family === family)
      && (!lifeForm || plant.ecology.lifeForm === lifeForm)
      && (!normalizedHabitat || plant.ecology.habitat.includes(normalizedHabitat))
      && (!flowerColor || plant.morphology.flower.color.includes(flowerColor))
      && (!normalizedFeature || plant.searchText.includes(normalizedFeature));
  }), [plants, query, family, lifeForm, habitat, flowerColor, featureQuery]);
  const activeFilterCount = [family, lifeForm, habitat.trim(), flowerColor, featureQuery.trim()].filter(Boolean).length;

  const media = gallery === "local" ? selected.media.localSamples : selected.media.iplantReferences;
  const fallbackMedia = selected.media.localSamples.length ? selected.media.localSamples : selected.media.iplantReferences;
  const shownMedia = media.length ? media : fallbackMedia;
  const hero = shownMedia[activeMedia] || shownMedia[0];
  const profileDetails = profileSegments(selected.profile?.sourceIntroduction);

  useEffect(() => { setActiveMedia(0); setLightboxIndex(null); setGallery(selected.media.localSamples.length ? "local" : "reference"); }, [selected.id]);
  useEffect(() => { const url = mediaUrl(hero); if (url) setBackdrop(url); }, [hero, setBackdrop]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (lightboxIndex !== null) {
        if (event.key === "Escape") {
          event.preventDefault();
          setLightboxIndex(null);
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const delta = event.key === "ArrowRight" ? 1 : -1;
          setLightboxIndex((current) => (current + delta + media.length) % media.length);
        }
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      keyboardNavigation.current = true;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = plants[(selectedIndex + delta + plants.length) % plants.length];
      navigate(`/library/${next.id}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, plants, selectedIndex, lightboxIndex, media.length]);

  const goRelative = (delta) => {
    keyboardNavigation.current = false;
    const next = plants[(selectedIndex + delta + plants.length) % plants.length];
    navigate(`/library/${next.id}`);
  };
  const selectPlant = (id) => { navigate(`/library/${id}`); setIndexOpen(false); };
  const clearFilters = () => {
    setQuery("");
    setFamily("");
    setLifeForm("");
    setHabitat("");
    setFlowerColor("");
    setFeatureQuery("");
  };

  return (
    <section className="library-view page-view">
      <button className="mobile-index-trigger" onClick={() => setIndexOpen(true)}><Search size={17} />搜索 {plants.length} 种植物</button>
      {indexOpen && <button className="library-index-scrim mobile-only" onClick={() => setIndexOpen(false)} aria-label="关闭植物索引" />}
      <aside className={`library-index ${indexOpen ? "is-open" : ""}`}>
        <div className="index-title"><div><span className="eyebrow">DIGITAL FLORA</span><h2>植物名录</h2></div><button className="icon-button mobile-only" onClick={() => setIndexOpen(false)} aria-label="关闭植物索引"><X size={18} /></button></div>
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="中文名、拉丁名、科属或特征" /><span>{results.length}</span></label>
        <details className="filter-drawer">
          <summary><Filter size={16} />筛选植物{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</summary>
          <div className="filter-grid">
            <label>科<select value={family} onChange={(event) => setFamily(event.target.value)}><option value="">全部科</option>{families.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>生活型<select value={lifeForm} onChange={(event) => setLifeForm(event.target.value)}><option value="">全部生活型</option>{lifeForms.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>生境<input value={habitat} onChange={(event) => setHabitat(event.target.value)} placeholder="如：湿地" /></label>
            <label>花色<select value={flowerColor} onChange={(event) => setFlowerColor(event.target.value)}>{FLOWER_COLORS.map((value) => <option key={value} value={value}>{value || "全部花色"}</option>)}</select></label>
            <label className="filter-wide">器官特征<input value={featureQuery} onChange={(event) => setFeatureQuery(event.target.value)} placeholder="如：头状花序、轮生叶" /></label>
          </div>
        </details>
        <div className="plant-list" role="listbox" aria-label="植物列表">
          {results.map((plant) => <button role="option" aria-selected={plant.id === selected.id} className={plant.id === selected.id ? "is-active" : ""} key={plant.id} onClick={() => selectPlant(plant.id)}>
            <span className="plant-list-thumb">{mediaUrl(plant.media.localSamples[0] || plant.media.iplantReferences[0]) ? <img src={mediaUrl(plant.media.localSamples[0] || plant.media.iplantReferences[0])} alt="" loading="lazy" /> : <Image size={17} />}</span>
            <span><strong>{plant.names.chinese}</strong><em>{plant.names.latin}</em></span><small>{plant.id}</small>
          </button>)}
          {!results.length && <div className="list-empty"><span>没有符合当前条件的记录。</span><button onClick={clearFilters}>清除搜索与筛选</button></div>}
        </div>
      </aside>

      <article className="plant-detail">
        <div className="plant-hero">
          <AnimatePresence mode="wait"><motion.img key={mediaUrl(hero)} src={mediaUrl(hero)} alt={`${selected.names.chinese}植物照片`} initial={{ opacity: 0, scale: reducedMotion || keyboardNavigation.current ? 1 : 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion || keyboardNavigation.current ? 0 : 0.34 }} /></AnimatePresence>
          <div className="plant-hero-shade" />
          <div className="plant-title-block">
            <span className="eyebrow">{selected.id} · {selected.taxonomy.family} / {selected.taxonomy.genus}</span>
            <h1>{selected.names.chinese}</h1><p className="latin-name">{selected.names.latin}</p>
            <div className="plant-meta"><span>{selected.ecology.lifeForm || "生活型待补充"}</span><span>{selected.media.localSamples.length ? `${selected.media.localSamples.length} 张本地样本` : "暂无本地样本"}</span><span>完整度 {Math.round(selected.quality.completeness * 100)}%</span></div>
          </div>
          <div className="plant-pagination"><button onClick={() => goRelative(-1)} aria-label="上一种" title="上一种"><ChevronLeft /></button><span>{String(selected.serial).padStart(3, "0")} / {plants.length}</span><button onClick={() => goRelative(1)} aria-label="下一种" title="下一种"><ChevronRight /></button></div>
        </div>

        <div className="detail-body">
          <section className="specimen-gallery specimen-gallery--dock"><span className="section-index">MEDIA</span><div className="gallery-content"><div className="gallery-heading"><div><span className="eyebrow">SPECIMEN MEDIA</span><h2>标本影像</h2><p>点击任一照片放大查看器官细节</p></div><div className="segmented-control"><button className={gallery === "local" ? "is-active" : ""} onClick={() => { setGallery("local"); setActiveMedia(0); setLightboxIndex(null); }}>实习样本 {selected.media.localSamples.length}</button><button className={gallery === "reference" ? "is-active" : ""} onClick={() => { setGallery("reference"); setActiveMedia(0); setLightboxIndex(null); }}>iPlant 参考 {selected.media.iplantReferences.length}</button></div></div>
            {media.length ? <div className="gallery-strip">{media.map((item, index) => <button key={item.id} className={index === activeMedia ? "is-active" : ""} onClick={() => { setActiveMedia(index); setLightboxIndex(index); }}><img src={mediaUrl(item)} alt={`${selected.names.chinese}${item.organLabel || "参考图"}`} loading="lazy" /><span>{item.organLabel || "参考图"}</span><ZoomIn className="gallery-zoom" size={17} /></button>)}</div> : <div className="gallery-empty">该来源暂无图片。当前首图来自另一图库，不会混淆来源标签。</div>}
          </div></section>
          <section className="plant-introduction"><span className="section-index">01</span><div className="plant-introduction__content"><div className="profile-heading"><div><span className="eyebrow">PLANT PROFILE</span><h2>{selected.names.chinese} · 植物简介</h2></div>{selected.sources.iplantUrl && <a className="iplant-source-link" href={selected.sources.iplantUrl} target="_blank" rel="noreferrer">iPlant 物种资料<ExternalLink size={16} /></a>}</div><p className="introduction-lead">{compactText(selected.profile?.introduction || selected.morphology.appearance)}</p>{profileDetails.length > 0 && <div className="profile-notes">{profileDetails.map((detail) => <div key={detail.label}><span>{detail.label}</span><p>{detail.text}</p></div>)}</div>}{selected.identification.keyCombination && <div className="profile-key"><span>关键识别组合</span><p>{selected.identification.keyCombination}</p></div>}<dl className="introduction-facts"><div><dt>科属</dt><dd>{selected.taxonomy.family} · {selected.taxonomy.genus}</dd></div><div><dt>生活型</dt><dd>{compactText(selected.ecology.lifeForm)}</dd></div><div><dt>坝上生境</dt><dd>{compactText(selected.profile?.habitatNote || selected.ecology.habitat)}</dd></div>{selected.names.alias && <div><dt>别名</dt><dd>{selected.names.alias}</dd></div>}</dl></div></section>
          <section className="recognition-story"><span className="section-index">02</span><div><span className="eyebrow">FIELD IDENTIFICATION</span><h2>在样方里，按这个顺序辨认</h2><ol>{selected.identification.steps.length ? selected.identification.steps.map((step) => <li key={step}>{step}</li>) : <li>先记录全株与生境，再补花、叶、茎或果实特写。</li>}</ol></div></section>
          <section className="trait-ledger"><span className="section-index">03</span><div className="trait-ledger__content"><div><span className="eyebrow">STRUCTURED FEATURES</span><h2>结构化特征档案</h2></div><dl>
            <div><dt>整体</dt><dd>{compactText(selected.morphology.appearance)}</dd></div>
            <div><dt>花</dt><dd>{compactText(selected.morphology.flower.description || [selected.morphology.flower.color, selected.morphology.flower.inflorescence, selected.morphology.flower.corollaShape].filter(Boolean).join("；"))}</dd></div>
            <div><dt>叶</dt><dd>{compactText(selected.morphology.leaf.description || [selected.morphology.leaf.arrangement, selected.morphology.leaf.type, selected.morphology.leaf.shape].filter(Boolean).join("；"))}</dd></div>
            <div><dt>茎</dt><dd>{compactText(selected.morphology.stem.description || [selected.morphology.stem.texture, selected.morphology.stem.posture, selected.morphology.stem.surface].filter(Boolean).join("；"))}</dd></div>
            <div><dt>果实</dt><dd>{compactText(selected.morphology.fruit.description || selected.morphology.fruit.type)}</dd></div>
            <div><dt>生境</dt><dd>{compactText(selected.ecology.habitat)}</dd></div>
          </dl></div></section>
          {selected.quality.revisions.length > 0 && <section className="review-record"><span>复核记录</span>{selected.quality.revisions.map((revision, index) => <p key={`${revision.field}-${index}`}><strong>{revision.reviewStatus}</strong>{revision.originalValue} → {revision.acceptedValue}</p>)}</section>}
          <div className="detail-footer-nav"><button onClick={() => goRelative(-1)}><ArrowLeft />上一种</button><button onClick={() => goRelative(1)}>下一种<ArrowRight /></button></div>
        </div>
      </article>
      <AnimatePresence>{lightboxIndex !== null && media[lightboxIndex] && <motion.div className="specimen-lightbox" role="dialog" aria-modal="true" aria-label={`${selected.names.chinese}标本图片预览`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="icon-button lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="关闭标本图片预览"><X /></button><button className="lightbox-nav lightbox-nav--previous" onClick={() => setLightboxIndex((lightboxIndex - 1 + media.length) % media.length)} aria-label="上一张标本图片"><ChevronLeft /></button><motion.img key={mediaUrl(media[lightboxIndex])} src={mediaUrl(media[lightboxIndex])} alt={`${selected.names.chinese}${media[lightboxIndex].organLabel || "参考图"}放大图`} initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} /><button className="lightbox-nav lightbox-nav--next" onClick={() => setLightboxIndex((lightboxIndex + 1) % media.length)} aria-label="下一张标本图片"><ChevronRight /></button><div className="lightbox-caption"><strong>{selected.names.chinese} · {media[lightboxIndex].organLabel || "参考图"}</strong><span>{gallery === "local" ? "实习本地样本" : "iPlant 参考图"} · {lightboxIndex + 1} / {media.length}</span></div></motion.div>}</AnimatePresence>
    </section>
  );
}
