// main.js — versión segura para GitHub Pages y entorno local
(async function init() {
  console.log("🚀 Iniciando aplicación...");

  // === CONFIGURACIÓN DE RUTAS ===
  // En GitHub Pages, el index.html está en raíz, y los JSON en /data/
  // En local, la estructura es la misma, así que se mantiene igual.
  const PATHS = {
    ontology: "data/ontology2.json",
    hierarchy: "data/class-hierarchy2.json"
  };

  // === DESCRIPTOR PANEL ===
  try {
    await Descriptor.init("descriptor", PATHS.ontology);
    console.log("📘 Descriptor cargado correctamente");
  } catch (err) {
    console.error("[Descriptor] ❌ Error cargando ontología:", err);
  }

  // === DROPDOWN TREE ===
  try {
    await DropdownTree.init("dropdown", PATHS.hierarchy);
    console.log("🌳 Dropdown Tree cargado correctamente");
  } catch (err) {
    console.error("[DropdownTree] ❌ Error cargando jerarquía:", err);
  }

  console.log("✅ main.js cargado por completo");

  // === TREE VIEW (si existe) ===
  if (window.TreeView && typeof TreeView.init === "function") {
    try {
      console.log("🟢 Ejecutando TreeView.init manualmente");
      await TreeView.init("tree-chart", PATHS.hierarchy);
      console.log("🌲 TreeView renderizado correctamente");
    } catch (err) {
      console.error("❌ No se pudo inicializar TreeView:", err);
    }
  }

  // === RELATION GRAPH (si existe) ===
  if (window.RelationGraph && typeof RelationGraph.init === "function") {
    try {
      await RelationGraph.init("relation-graph", PATHS.ontology);
      console.log("🔗 RelationGraph renderizado correctamente");
    } catch (err) {
      console.error("[RelationGraph] ❌ Error al cargar la ontología:", err);
    }
  }

  console.log("🟢 Aplicación inicializada completamente");
})();
