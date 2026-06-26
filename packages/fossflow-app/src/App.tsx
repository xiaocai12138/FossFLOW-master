import EditorWorkspace from './pages/EditorWorkspace';

/**
 * Application entry point.
 * Keeps startup wiring minimal and delegates editor behavior to the workspace page.
 */
function App() {
  return <EditorWorkspace />;
}

export default App;
