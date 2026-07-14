import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Filter, Image, Search, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

const FLOWER_COLORS = ["", "黄色", "白色", "紫色", "蓝色", "红色", "粉色", "绿色"];
const IPLANT_FACT_LABELS = ["识别要点", "生活型", "生境", "海拔", "物候", "茎", "叶", "花", "果", "孢子囊", "分布", "濒危等级"];

function compactText(value, fallback = "待补充") {
  return value?.trim() || fallback;
}

function mediaUrl(item) {
  return item?.displayUrl || item?.url || "";
}

const LIBRARY_STATE_KEY = "bashang-library-state-v2";

function splitAliases(value) {
  return String(value || "").split(/[、，,；;]/).map((item) => item.trim()).filter(Boolean);
}

function readLibraryState() {
  try {
    return JSON.parse(sessionStorage.getItem(LIBRARY_STATE_KEY) || "{}");
  } catch {
    return {};
  }
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
  const savedState = useRef(readLibraryState()).current;
  const [query, setQuery] = useState(savedState.query || "");
  const [family, setFamily] = useState(savedState.family || "");
  const [lifeForm, setLifeForm] = useState(savedState.lifeForm || "");
  const [habitat, setHabitat] = useState(savedState.habitat || "");
  const [flowerColor, setFlowerColor] = useState(savedState.flowerColor || "");
  const [featureQuery, setFeatureQuery] = useState(savedState.featureQuery || "");
  const [indexOpen, setIndexOpen] = useState(false);
  const [gallery, setGallery] = useState("local");
  const [activeMedia, setActiveMedia] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const keyboardNavigation = useRef(false);
  const plantList = useRef(null);
  const activeOption = useRef(null);
  const lightboxClose = useRef(null);
  const lightboxOpener = useRef(null);

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

  const localMedia = useMemo(() => [...selected.media.localSamples].sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))), [selected.id, selected.media.localSamples]);
  const media = gallery === "local" ? localMedia : selected.media.iplantReferences;
  const fallbackMedia = selected.media.localSamples.length ? selected.media.localSamples : selected.media.iplantReferences;
  const shownMedia = media.length ? media : fallbackMedia;
  const hero = shownMedia[activeMedia] || shownMedia[0];
  const profileDetails = profileSegments(selected.profile?.sourceIntroduction);
  const selectedAliases = splitAliases(selected.names.alias);
  const iplantRecord = selected.external?.iplant;
  const iplantFacts = IPLANT_FACT_LABELS
    .map((label) => ({ label, text: iplantRecord?.fields?.[label] || "" }))
    .filter((item) => item.text)
    .slice(0, 8);

  const matchedSearchLabel = (plant) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || plant.names.chinese.toLowerCase().includes(normalizedQuery) || plant.names.latin.toLowerCase().includes(normalizedQuery)) return null;
    const alias = splitAliases(plant.names.alias).find((item) => item.toLowerCase().includes(normalizedQuery));
    if (alias) return { type: "别称", value: alias };
    const historical = plant.quality.revisions
      .map((revision) => revision.originalValue)
      .find((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    return historical ? { type: "原名校订", value: historical } : null;
  };
  const selectedIsFilteredOut = !results.some((plant) => plant.id === selected.id);

  useEffect(() => { setActiveMedia(0); setLightboxIndex(null); setGallery(selected.media.localSamples.length ? "local" : "reference"); }, [selected.id]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (plantList.current) plantList.current.scrollTop = Number(savedState.scrollTop || 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [savedState.scrollTop]);
  useEffect(() => {
    sessionStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify({ query, family, lifeForm, habitat, flowerColor, featureQuery, scrollTop: plantList.current?.scrollTop || 0 }));
  }, [query, family, lifeForm, habitat, flowerColor, featureQuery]);
  useEffect(() => {
    if (keyboardNavigation.current) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [selected.id]);
  useEffect(() => { const url = mediaUrl(hero); if (url) setBackdrop(url); }, [hero, setBackdrop]);
  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => lightboxClose.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      lightboxOpener.current?.focus?.({ preventScroll: true });
    };
  }, [lightboxIndex]);
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
      if (event.key === "Escape" && indexOpen) {
        event.preventDefault();
        setIndexOpen(false);
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
  }, [navigate, plants, selectedIndex, lightboxIndex, media.length, indexOpen]);

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
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="正名、别称、拉丁名或特征" />{query && <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="清除搜索"><X size={14} /></button>}<span>{results.length}</span></label>
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
        <div className="plant-list" ref={plantList} onScroll={(event) => { const state = readLibraryState(); sessionStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify({ ...state, scrollTop: event.currentTarget.scrollTop })); }} role="listbox" aria-label="植物列表">
          {selectedIsFilteredOut && <div className="pinned-current"><span>当前查看不在筛选结果中</span><strong>{selected.names.chinese}</strong><button onClick={clearFilters}>清除筛选并定位</button></div>}
          {results.map((plant) => {
            const match = matchedSearchLabel(plant);
            return <button ref={plant.id === selected.id ? activeOption : null} role="option" aria-selected={plant.id === selected.id} className={plant.id === selected.id ? "is-active" : ""} key={plant.id} onClick={() => selectPlant(plant.id)}>
              <span className="plant-list-thumb">{mediaUrl(plant.media.localSamples[0] || plant.media.iplantReferences[0]) ? <img src={mediaUrl(plant.media.localSamples[0] || plant.media.iplantReferences[0])} alt="" loading="lazy" /> : <Image size={17} />}</span>
              <span><strong>{plant.names.chinese}</strong>{match ? <em className="alias-match">{match.type}：{match.value}</em> : <em>{plant.names.latin}</em>}</span><small>{plant.id}</small>
            </button>;
          })}
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
            {selectedAliases.length > 0 && <div className="common-name-row" aria-label="常见别称">{selectedAliases.slice(0, 5).map((alias) => <span key={alias}>{alias}</span>)}{selectedAliases.length > 5 && <span>另有 {selectedAliases.length - 5} 个</span>}</div>}
            <div className="plant-meta"><span>{selected.ecology.lifeForm || "生活型待补充"}</span><span>{selected.media.localSamples.length ? `${selected.media.localSamples.length} 张本地样本` : "暂无本地样本"}</span><span>完整度 {Math.round(selected.quality.completeness * 100)}%</span></div>
          </div>
          <div className="plant-pagination"><button onClick={() => goRelative(-1)} aria-label="上一种" title="上一种"><ChevronLeft /></button><span>{String(selected.serial).padStart(3, "0")} / {plants.length}</span><button onClick={() => goRelative(1)} aria-label="下一种" title="下一种"><ChevronRight /></button></div>
        </div>

        <div className="detail-body">
          <section className="specimen-gallery specimen-gallery--dock"><span className="section-index">MEDIA</span><div className="gallery-content"><div className="gallery-heading"><div><span className="eyebrow">SPECIMEN MEDIA</span><h2>标本影像</h2><p>点击任一照片放大查看器官细节</p></div><div className="segmented-control"><button className={gallery === "local" ? "is-active" : ""} onClick={() => { setGallery("local"); setActiveMedia(0); setLightboxIndex(null); }}>实习样本 {selected.media.localSamples.length}</button><button className={gallery === "reference" ? "is-active" : ""} onClick={() => { setGallery("reference"); setActiveMedia(0); setLightboxIndex(null); }}>参考图库 {selected.media.iplantReferences.length}</button></div></div>
            {media.length ? <div className="gallery-strip">{media.map((item, index) => <button key={item.id} className={index === activeMedia ? "is-active" : ""} onClick={(event) => { lightboxOpener.current = event.currentTarget; setActiveMedia(index); setLightboxIndex(index); }}><img src={mediaUrl(item)} alt={`${selected.names.chinese}${item.organLabel || "参考图"}`} loading="lazy" /><span>{item.organLabel || "参考图"}</span><ZoomIn className="gallery-zoom" size={17} /></button>)}</div> : <div className="gallery-empty">该来源暂无图片。当前首图来自另一图库，不会混淆来源标签。</div>}
          </div></section>
          <section className="plant-introduction"><span className="section-index">01</span><div className="plant-introduction__content"><div className="profile-heading"><div><span className="eyebrow">PLANT PROFILE</span><h2>{selected.names.chinese} · 植物简介</h2></div>{selected.sources.iplantUrl && <a className="iplant-source-link" href={selected.sources.iplantUrl} target="_blank" rel="noreferrer">iPlant 物种资料<ExternalLink size={16} /></a>}</div><p className="introduction-lead">{compactText(selected.profile?.introduction || selected.morphology.appearance)}</p>{selected.profile?.iplantSummary && selected.profile.iplantSummary !== selected.profile?.introduction && <div className="iplant-summary"><span>iPlant 资料补充</span><p>{selected.profile.iplantSummary}</p></div>}{profileDetails.length > 0 && <div className="profile-notes">{profileDetails.map((detail) => <div key={detail.label}><span>{detail.label}</span><p>{detail.text}</p></div>)}</div>}{selected.identification.keyCombination && <div className="profile-key"><span>关键识别组合</span><p>{selected.identification.keyCombination}</p></div>}<dl className="introduction-facts"><div><dt>科属</dt><dd>{selected.taxonomy.family} · {selected.taxonomy.genus}</dd></div><div><dt>生活型</dt><dd>{compactText(selected.ecology.lifeForm)}</dd></div><div><dt>坝上生境</dt><dd>{compactText(selected.profile?.habitatNote || selected.ecology.habitat)}</dd></div>{selected.names.alias && <div><dt>别名</dt><dd>{selected.names.alias}</dd></div>}</dl>{iplantFacts.length > 0 && <details className="iplant-facts"><summary>查看 iPlant 详情字段 <span>{iplantFacts.length} 项</span></summary><dl>{iplantFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.text}</dd></div>)}</dl><p>资料抓取于 {iplantRecord.fetchedAt?.slice(0, 10)}。分类冲突不会自动覆盖本地名录。</p></details>}</div></section>
          <section className="recognition-story"><span className="section-index">02</span><div><span className="eyebrow">FIELD IDENTIFICATION</span><h2>在样方里，按这个顺序辨认</h2><ol>{selected.identification.steps.length ? selected.identification.steps.map((step) => <li key={step}>{step}</li>) : <li>先记录全株与生境，再补花、叶、茎或果实特写。</li>}</ol></div></section>
          <section className="trait-ledger"><span className="section-index">03</span><div className="trait-ledger__content"><div><span className="eyebrow">STRUCTURED FEATURES</span><h2>结构化特征档案</h2></div><dl>
            <div><dt>整体</dt><dd>{compactText(selected.morphology.appearance)}</dd></div>
            <div><dt>花</dt><dd>{compactText(selected.morphology.flower.description || [selected.morphology.flower.color, selected.morphology.flower.inflorescence, selected.morphology.flower.corollaShape].filter(Boolean).join("；"))}</dd></div>
            <div><dt>叶</dt><dd>{compactText(selected.morphology.leaf.description || [selected.morphology.leaf.arrangement, selected.morphology.leaf.type, selected.morphology.leaf.shape].filter(Boolean).join("；"))}</dd></div>
            <div><dt>茎</dt><dd>{compactText(selected.morphology.stem.description || [selected.morphology.stem.texture, selected.morphology.stem.posture, selected.morphology.stem.surface].filter(Boolean).join("；"))}</dd></div>
            <div><dt>果实</dt><dd>{compactText(selected.morphology.fruit.description || selected.morphology.fruit.type)}</dd></div>
            <div><dt>生境</dt><dd>{compactText(selected.ecology.habitat)}</dd></div>
          </dl></div></section>
          {selected.quality.revisions.length > 0 && <section className="review-record"><span>名称与分类复核</span>{selected.quality.revisions.map((revision, index) => <p key={`${revision.field}-${index}`}><strong>{revision.reviewStatus}</strong><span>{revision.originalValue} → {revision.acceptedValue}</span>{revision.authorityUrl && <a href={revision.authorityUrl} target="_blank" rel="noreferrer">核对来源 <ExternalLink size={13} /></a>}</p>)}</section>}
          <div className="detail-footer-nav"><button onClick={() => goRelative(-1)}><ArrowLeft />上一种</button><button onClick={() => goRelative(1)}>下一种<ArrowRight /></button></div>
        </div>
      </article>
      {createPortal(<AnimatePresence>{lightboxIndex !== null && media[lightboxIndex] && <motion.div className="specimen-lightbox" role="dialog" aria-modal="true" aria-label={`${selected.names.chinese}标本图片预览`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightboxIndex(null)}><button ref={lightboxClose} className="icon-button lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="关闭标本图片预览"><X /><span>关闭</span></button><button className="lightbox-nav lightbox-nav--previous" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + media.length) % media.length); }} aria-label="上一张标本图片"><ChevronLeft /></button><motion.img onClick={(event) => event.stopPropagation()} key={mediaUrl(media[lightboxIndex])} src={mediaUrl(media[lightboxIndex])} alt={`${selected.names.chinese}${media[lightboxIndex].organLabel || "参考图"}放大图`} initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} /><button className="lightbox-nav lightbox-nav--next" onClick={(event) => { event.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % media.length); }} aria-label="下一张标本图片"><ChevronRight /></button><div className="lightbox-caption" onClick={(event) => event.stopPropagation()}><strong>{selected.names.chinese} · {media[lightboxIndex].organLabel || "参考图"}</strong><span>{gallery === "local" ? `${media[lightboxIndex].sourceType || "实习本地样本"}${media[lightboxIndex].submittedAt ? ` · ${media[lightboxIndex].submittedAt}` : ""}` : media[lightboxIndex].sourceType || "参考图"} · {lightboxIndex + 1} / {media.length}</span>{media[lightboxIndex].sourceUrl && <a href={media[lightboxIndex].sourceUrl} target="_blank" rel="noreferrer">查看原始来源 <ExternalLink size={13} /></a>}</div></motion.div>}</AnimatePresence>, document.body)}
    </section>
  );
}
