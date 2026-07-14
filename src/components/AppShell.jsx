import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, BookOpenCheck, Database, FlaskConical, Images, Leaf, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

const NAV_ITEMS = [
  { to: "/atlas/whole", label: "特征图谱", short: "图谱", icon: Leaf, match: "/atlas" },
  { to: "/library/HBFC-071", label: "植物名录", short: "名录", icon: BookOpen, match: "/library" },
  { to: "/assistant", label: "联合识别", short: "识别", icon: FlaskConical, match: "/assistant" },
  { to: "/teaching", label: "辨析教学", short: "辨析", icon: BookOpenCheck, match: "/teaching" },
];

function DataDrawer({ open, onClose }) {
  const { summary, pendingSamples } = useKnowledgeBase();
  const navigate = useNavigate();
  if (!summary) return null;
  const newestPending = [...pendingSamples].sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  const pendingByName = [...new Map(newestPending.map((sample) => [sample.submittedName, sample])).values()];
  const stats = [
    [summary.recordCount, "正式植物"], [summary.referenceImageCount, "参考图库"],
    [summary.localImageCount, "实习样本"], [summary.localCoveredPlants, "本地覆盖物种"],
    [summary.pendingLocalImages, "待复核图片"],
  ];
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button className="drawer-scrim" aria-label="关闭数据状态" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="data-drawer" aria-label="数据状态" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="drawer-heading">
              <div><span className="eyebrow">DATA STATUS</span><h2>坝上知识库</h2><em className="data-version">{summary.dataVersion || "V2"}</em></div>
              <button className="icon-button" onClick={onClose} aria-label="关闭数据状态" title="关闭"><X size={18} /></button>
            </div>
            <div className="data-stats">
              {stats.map(([value, label]) => <div className="data-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
            </div>
            {summary.additionalImport?.date && <div className="latest-import"><span>最近导入 · {summary.additionalImport.date}</span><strong>{summary.additionalImport.imageCount} 张实习样本</strong><p>{summary.additionalImport.matchedImageCount} 张已挂接正式植物，{summary.additionalImport.pendingImageCount} 张进入待复核池，{summary.additionalImport.partReviewCount} 张需补充器官标签。</p></div>}
            <div className="data-provenance"><Images size={18} /><div><strong>{summary.matchedLocalImages} 张已挂接 · {summary.pendingLocalImages} 张待复核</strong><p>待复核池包含 {new Set(pendingSamples.map((sample) => sample.submittedName)).size} 个尚未确认名称，不自动并入已定种记录。</p></div></div>
            <div className="pending-pool"><span>待复核样本池</span><div>{pendingByName.slice(0, 6).map((sample) => <figure key={sample.id}><img src={sample.thumbnailUrl} alt={`${sample.submittedName}${sample.organLabel}待复核样本`} /><figcaption><strong>{sample.submittedName}</strong><em>{sample.organLabel} · 待复核</em></figcaption></figure>)}</div><button onClick={() => { sessionStorage.setItem("bashang-open-review", "1"); onClose(); navigate("/vision"); }}>进入样本复核工作台</button></div>
            <div className="privacy-note"><span>隐私处理</span><p>展示图已剥离 EXIF；公开数据不含发送者、消息 ID 与精确 GPS。群消息时间统一标注为提交时间。</p></div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function FirstVisitIntro() {
  const [visible, setVisible] = useState(() => sessionStorage.getItem("bashang-intro-seen") !== "1");
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("bashang-intro-seen", "1");
      setVisible(false);
    }, reducedMotion ? 100 : 880);
    return () => window.clearTimeout(timer);
  }, [visible, reducedMotion]);
  const close = () => { sessionStorage.setItem("bashang-intro-seen", "1"); setVisible(false); };
  return (
    <AnimatePresence>
      {visible && <motion.div className="intro-frame" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24 }}>
        <motion.div className="intro-leaf" initial={reducedMotion ? false : { scale: 1.18, filter: "blur(10px)" }} animate={{ scale: 1, filter: "blur(0px)" }} transition={{ duration: reducedMotion ? 0 : 0.72, ease: [0.2, 0.8, 0.2, 1] }} />
        <span>PLANT GEOGRAPHY AGENT</span><button onClick={close}>跳过</button>
      </motion.div>}
    </AnimatePresence>
  );
}

export default function AppShell() {
  const { backdrop, summary, loading, error } = useKnowledgeBase();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const routeSection = location.pathname.split("/")[1] || "library";
  if (loading) return <div className="app-state"><Leaf />正在装载坝上植物知识库</div>;
  if (error) return <div className="app-state app-state--error"><strong>知识库未能打开</strong><span>{error}</span></div>;

  return (
    <div className="app-shell">
      <div className="global-backdrop" aria-hidden="true"><AnimatePresence mode="popLayout">{backdrop && <motion.img key={backdrop} src={backdrop} alt="" initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.02 }} animate={{ opacity: 0.2, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.42 }} />}</AnimatePresence></div>
      <header className="brand-mark"><Leaf size={18} /><div><strong>坝上植物实习小助手</strong><span>Plant Geography Agent</span></div></header>
      <nav className="desktop-rail" aria-label="主导航">
        <div className="rail-monogram">PGA</div>
        {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => <NavLink key={to} to={to} className={() => `rail-link ${location.pathname.startsWith(match) ? "is-active" : ""}`} aria-label={label} title={label}><Icon size={19} /><span>{label}</span></NavLink>)}
        <button className="rail-link rail-link--button" onClick={() => setDrawerOpen(true)} aria-label="数据状态" title="数据状态"><Database size={19} /><span>数据状态</span></button>
      </nav>
      <button className="data-trigger" onClick={() => setDrawerOpen(true)} aria-label="打开数据状态" title="数据状态"><Database size={17} /><span>V2</span></button>
      <main className="app-main"><AnimatePresence mode="wait" initial={false}><motion.div className="route-frame" key={routeSection} initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }} transition={{ duration: reducedMotion ? 0 : 0.36, ease: [0.2, 0.8, 0.2, 1] }}><Outlet /></motion.div></AnimatePresence></main>
      <nav className="mobile-nav" aria-label="主导航">{NAV_ITEMS.map(({ to, short, icon: Icon, match }) => <NavLink key={to} to={to} className={() => location.pathname.startsWith(match) ? "is-active" : ""}><Icon size={20} /><span>{short}</span></NavLink>)}</nav>
      <a className="deerflow-signature" href="https://deerflow.tech" target="_blank" rel="noreferrer">Created By Deerflow</a>
      <DataDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} /><FirstVisitIntro />
    </div>
  );
}
