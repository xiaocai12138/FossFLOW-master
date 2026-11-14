import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import EditorWorkspace from './pages/EditorWorkspace';
import RuntimePage from './pages/RuntimePage';
import { ROUTES } from './routes';

/**
 * 应用入口。
 * 编辑视图与运行视图使用独立地址，便于单独嵌入或外链分享。
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.editor} element={<EditorWorkspace />} />
        <Route path={ROUTES.runtime} element={<RuntimePage />} />
        {/* 兼容旧地址：根路径进入编辑视图 */}
        <Route path="*" element={<Navigate to={ROUTES.editor} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
