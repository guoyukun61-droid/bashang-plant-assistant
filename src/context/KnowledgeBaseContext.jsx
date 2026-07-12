import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KnowledgeBaseContext = createContext(null);

const DATA_FILES = {
  plants: "/data/plants.json",
  featureIndex: "/data/featureIndex.json",
  glossary: "/data/glossary.json",
  captureChecklist: "/data/captureChecklist.json",
  pendingSamples: "/data/pendingSamples.json",
  summary: "/data/catalogSummary.json",
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  return response.json();
}

export function KnowledgeBaseProvider({ children }) {
  const [knowledgeBase, setKnowledgeBase] = useState(null);
  const [error, setError] = useState("");
  const [backdrop, setBackdrop] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(Object.values(DATA_FILES).map(fetchJson))
      .then((values) => {
        if (!active) return;
        const next = Object.fromEntries(Object.keys(DATA_FILES).map((key, index) => [key, values[index]]));
        setKnowledgeBase(next);
        const featured = next.plants.find((plant) => plant.id === "HBFC-071") || next.plants[0];
        setBackdrop(featured?.media.localSamples[0]?.displayUrl || featured?.media.iplantReferences[0]?.url || "");
      })
      .catch((reason) => active && setError(reason.message || "知识库加载失败"));
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ ...knowledgeBase, loading: !knowledgeBase && !error, error, backdrop, setBackdrop }),
    [knowledgeBase, error, backdrop],
  );

  return <KnowledgeBaseContext.Provider value={value}>{children}</KnowledgeBaseContext.Provider>;
}

export function useKnowledgeBase() {
  const context = useContext(KnowledgeBaseContext);
  if (!context) throw new Error("useKnowledgeBase 必须在 KnowledgeBaseProvider 内使用");
  return context;
}
