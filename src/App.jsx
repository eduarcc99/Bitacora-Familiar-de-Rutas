import EditorApp from "./editor/EditorApp";
import VisitorApp from "./visitor/VisitorApp";

function isEditorRoute() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path === "/editar";
}

export default function App() {
  // `/` = mapa visitante 2.0 · `/editar` = catálogo de gestión (sin mapa)
  if (isEditorRoute()) {
    return <EditorApp />;
  }
  return <VisitorApp />;
}
