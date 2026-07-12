import { ArrowRight, BookMarked, ExternalLink, Microscope, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

function mediaUrl(plant) {
  return plant?.media.localSamples[0]?.displayUrl || plant?.media.iplantReferences[0]?.url || "";
}

export default function TeachingView() {
  const navigate = useNavigate();
  const { plants, confusionLessons, setBackdrop } = useKnowledgeBase();
  const [activeId, setActiveId] = useState(confusionLessons[0]?.id || "");
  const activeLesson = confusionLessons.find((lesson) => lesson.id === activeId) || confusionLessons[0];
  const lessonPlants = useMemo(
    () => activeLesson.plantIds.map((id) => plants.find((plant) => plant.id === id)).filter(Boolean),
    [activeLesson, plants],
  );

  useEffect(() => {
    const image = mediaUrl(lessonPlants[0]);
    if (image) setBackdrop(image);
  }, [lessonPlants, setBackdrop]);

  return (
    <section className="teaching-view page-view">
      <header className="teaching-header">
        <div><span className="eyebrow">FIELD COMPARISON NOTES</span><h1>易混淆物种辨析</h1></div>
        <p>依据《植物特征总结》整理，结合当前知识库的结构化特征与影像。分类结论仍以教师复核为准。</p>
      </header>
      <div className="teaching-layout">
        <nav className="lesson-index" aria-label="辨析主题">
          {confusionLessons.map((lesson, index) => (
            <button key={lesson.id} className={lesson.id === activeLesson.id ? "is-active" : ""} onClick={() => setActiveId(lesson.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><em>{lesson.plantIds.length} 种 · PDF {lesson.sourcePages} 页</em></div><ArrowRight size={16} />
            </button>
          ))}
        </nav>
        <article className="lesson-detail">
          <div className="lesson-title"><div><span>{activeLesson.subtitle}</span><h2>{activeLesson.title}</h2></div><BookMarked size={26} /></div>
          <section className="lesson-method"><Microscope size={20} /><div><strong>现场辨认方法</strong><p>{activeLesson.method}</p></div></section>
          <div className="lesson-focus"><span>优先观察</span>{activeLesson.focus.map((item) => <b key={item}>{item}</b>)}</div>
          <section className="lesson-species">
            {lessonPlants.map((plant) => (
              <button key={plant.id} onClick={() => navigate(`/library/${plant.id}`)}>
                <img src={mediaUrl(plant)} alt={`${plant.names.chinese}参考图`} loading="lazy" />
                <div><span>{plant.id}</span><h3>{plant.names.chinese}</h3><em>{plant.names.latin}</em><p>{plant.identification.keyCombination || plant.morphology.appearance}</p><strong>打开植物档案 <ExternalLink size={14} /></strong></div>
              </button>
            ))}
          </section>
          <footer className="lesson-source"><ScanSearch size={17} /><span>资料来源：《植物特征总结》PDF 第 {activeLesson.sourcePages} 页；物种文字与图片来自坝上植物知识库。</span></footer>
        </article>
      </div>
    </section>
  );
}
