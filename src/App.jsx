import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { KnowledgeBaseProvider } from "./context/KnowledgeBaseContext.jsx";
import AppShell from "./components/AppShell.jsx";

const AtlasView = lazy(() => import("./views/AtlasView.jsx"));
const LibraryView = lazy(() => import("./views/LibraryView.jsx"));
const AssistantView = lazy(() => import("./views/AssistantView.jsx"));
const VisionView = lazy(() => import("./views/VisionView.jsx"));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status">
      <span className="route-fallback__line" />
      正在展开坝上植物志
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <KnowledgeBaseProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/library/HBFC-071" replace />} />
              <Route path="/atlas" element={<Navigate to="/atlas/whole" replace />} />
              <Route path="/atlas/:organ" element={<AtlasView />} />
              <Route path="/library" element={<LibraryView />} />
              <Route path="/library/:plantId" element={<LibraryView />} />
              <Route path="/assistant" element={<AssistantView />} />
              <Route path="/vision" element={<VisionView />} />
              <Route path="*" element={<Navigate to="/library/HBFC-071" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </KnowledgeBaseProvider>
    </HashRouter>
  );
}
