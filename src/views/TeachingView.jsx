import { AlertTriangle, ArrowRight, BarChart3, BookMarked, Check, ExternalLink, GraduationCap, Layers3, Microscope, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useKnowledgeBase } from "../context/KnowledgeBaseContext.jsx";

function mediaUrl(plant) {
  return plant?.media.localSamples[0]?.displayUrl || plant?.media.iplantReferences[0]?.url || "";
}

function SourceList({ sources }) {
  return <div className="lesson-sources">{sources.map((source) => <span key={`${source.document}-${source.location}`}><BookMarked size={13} />{source.document} · {source.location}</span>)}</div>;
}

export default function TeachingView() {
  const navigate = useNavigate();
  const { plants, confusionLessons, fieldLessons, setBackdrop } = useKnowledgeBase();
  const [mode, setMode] = useState("compare");
  const [activeId, setActiveId] = useState(confusionLessons[0]?.id || "");
  const [activeFieldId, setActiveFieldId] = useState(fieldLessons[0]?.id || "");
  const [quizAnswers, setQuizAnswers] = useState({});
  const viewRef = useRef(null);
  const activeLesson = confusionLessons.find((lesson) => lesson.id === activeId) || confusionLessons[0];
  const activeField = fieldLessons.find((lesson) => lesson.id === activeFieldId) || fieldLessons[0];
  const lessonPlants = useMemo(
    () => activeLesson.plantIds.map((id) => plants.find((plant) => plant.id === id)).filter(Boolean),
    [activeLesson, plants],
  );
  const selectedAnswer = quizAnswers[activeLesson.id];

  useEffect(() => {
    const image = mediaUrl(lessonPlants[0]);
    if (image) setBackdrop(image);
  }, [lessonPlants, setBackdrop]);
  useEffect(() => {
    viewRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [mode]);

  return (
    <section ref={viewRef} className="teaching-view page-view">
      <header className="teaching-header">
        <div><span className="eyebrow">FIELD TEACHING NOTES</span><h1>实习教学文档</h1></div>
        <p>依据《植物特征总结》和 B 组实习汇报整理。内容用于组织观察与复核，不能替代植物志检索和教师定种。</p>
      </header>
      <div className="teaching-mode" role="tablist" aria-label="教学文档类型">
        <button role="tab" aria-selected={mode === "compare"} className={mode === "compare" ? "is-active" : ""} onClick={() => setMode("compare")}><Microscope size={17} /><span>物种辨析</span><em>{confusionLessons.length} 组</em></button>
        <button role="tab" aria-selected={mode === "field"} className={mode === "field" ? "is-active" : ""} onClick={() => setMode("field")}><BarChart3 size={17} /><span>实习方法</span><em>{fieldLessons.length} 讲</em></button>
      </div>

      {mode === "compare" ? <div className="teaching-layout">
        <nav className="lesson-index" aria-label="辨析主题">
          {confusionLessons.map((lesson, index) => (
            <button key={lesson.id} className={lesson.id === activeLesson.id ? "is-active" : ""} onClick={() => setActiveId(lesson.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><em>{lesson.plantIds.length} 种 · {lesson.sources.length} 项资料</em></div><ArrowRight size={16} />
            </button>
          ))}
        </nav>
        <article className="lesson-detail">
          <div className="lesson-title"><div><span>{activeLesson.subtitle}</span><h2>{activeLesson.title}</h2></div><BookMarked size={26} /></div>
          <SourceList sources={activeLesson.sources} />
          <section className="lesson-method"><Microscope size={20} /><div><strong>现场辨认方法</strong><p>{activeLesson.method}</p></div></section>
          <div className="lesson-focus"><span>优先观察</span>{activeLesson.focus.map((item) => <b key={item}>{item}</b>)}</div>
          <section className="lesson-pitfall"><AlertTriangle size={18} /><div><strong>常见误判</strong><p>{activeLesson.pitfall}</p></div></section>
          {activeLesson.reviewNote && <p className="lesson-review-note">待核对：{activeLesson.reviewNote}</p>}
          <section className="lesson-species">
            {lessonPlants.map((plant) => (
              <button key={plant.id} onClick={() => navigate(`/library/${plant.id}`)}>
                <img src={mediaUrl(plant)} alt={`${plant.names.chinese}参考图`} loading="lazy" />
                <div><span>{plant.id}</span><h3>{plant.names.chinese}</h3><em>{plant.names.latin}</em><p>{activeLesson.diagnosticNotes?.[plant.id] || plant.identification.keyCombination || plant.morphology.appearance}</p><strong>打开植物档案 <ExternalLink size={14} /></strong></div>
              </button>
            ))}
          </section>
          <section className="lesson-quiz" aria-live="polite">
            <div><GraduationCap size={20} /><span><b>证据判断</b>{activeLesson.quiz.question}</span></div>
            <div className="quiz-choices">{activeLesson.quiz.choices.map((choice, index) => {
              const answered = Number.isInteger(selectedAnswer);
              const isCorrect = index === activeLesson.quiz.answer;
              const isChosen = index === selectedAnswer;
              return <button key={choice} disabled={answered} className={`${isChosen ? "is-chosen" : ""} ${answered && isCorrect ? "is-correct" : ""}`} onClick={() => setQuizAnswers((current) => ({ ...current, [activeLesson.id]: index }))}>{answered && isCorrect && <Check size={14} />}{choice}</button>;
            })}</div>
            {Number.isInteger(selectedAnswer) && <p className={selectedAnswer === activeLesson.quiz.answer ? "is-correct" : "is-wrong"}>{selectedAnswer === activeLesson.quiz.answer ? "判断正确。" : "需要继续核对。"}{activeLesson.quiz.explanation}</p>}
          </section>
          <footer className="lesson-source"><ScanSearch size={17} /><span>页面特征取自教学资料与本地知识库；名录外名称和未完整取证的判断保留待复核状态。</span></footer>
        </article>
      </div> : <div className="field-teaching-layout">
        <nav className="field-lesson-index" aria-label="实习方法主题">
          {fieldLessons.map((lesson) => <button key={lesson.id} className={lesson.id === activeField.id ? "is-active" : ""} onClick={() => setActiveFieldId(lesson.id)}><span>{lesson.number}</span><div><strong>{lesson.title}</strong><em>{lesson.source}</em></div><ArrowRight size={16} /></button>)}
        </nav>
        <article className="field-lesson-detail">
          <div className="field-lesson-heading"><span>{activeField.number} · FIELD METHOD</span><h2>{activeField.title}</h2><p>{activeField.summary}</p></div>
          <section className="field-procedure"><div className="field-section-title"><Layers3 size={18} /><strong>调查步骤</strong></div><ol>{activeField.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>
          <div className="field-evidence-grid">
            <section><span>实习记录</span><p>{activeField.evidence}</p></section>
            <section><span>统计解释</span><p>{activeField.statistics}</p></section>
          </div>
          <section className="field-caution"><AlertTriangle size={19} /><div><strong>解释边界</strong><p>{activeField.caution}</p></div></section>
          <footer className="lesson-source"><BookMarked size={16} /><span>{activeField.source}</span></footer>
        </article>
      </div>}
    </section>
  );
}
