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

  // === NUEVO ===
  // 📂 Modelos ontológicos disponibles
  const MODELS = {
    "Ontología": "data/ontology2.json",
    "Catálogo": "data/ontology_catalog.json"
  };

  // === NUEVO ===
  // 🔽 Crear selector de modelo ontológico
  function createOntologySelector() {
    const bar = document.createElement('div');
    bar.className = 'ontology-switcher';
    bar.innerHTML = `
      <label>Modelo:</label>
      <select id="ontology-model">
        ${Object.keys(MODELS)
          .map(k => `<option value="${MODELS[k]}">${k}</option>`)
          .join('')}
      </select>
    `;
    document.body.prepend(bar);

    const select = bar.querySelector('#ontology-model');
    select.addEventListener('change', async (e) => {
      const path = e.target.value;
      console.log(`🔄 Cargando modelo ontológico: ${path}`);

      try {
        await Descriptor.init("descriptor", path);
        console.log("📘 Descriptor recargado correctamente");
      } catch (err) {
        console.error("[Descriptor] ❌ Error recargando ontología:", err);
      }

      try {
        await RelationGraph.init("relation-graph", path);
        console.log("🔗 RelationGraph recargado correctamente");
      } catch (err) {
        console.error("[RelationGraph] ❌ Error recargando grafo:", err);
      }
    });
  }

  // === Ejecutar creación del selector ===
  createOntologySelector();

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
      addFullscreenButton("tree-chart");
      console.log("🌲 TreeView renderizado correctamente");
    } catch (err) {
      console.error("❌ No se pudo inicializar TreeView:", err);
    }
  }

  // === RELATION GRAPH (si existe) ===
  if (window.RelationGraph && typeof RelationGraph.init === "function") {
    try {
      await RelationGraph.init("relation-graph", PATHS.ontology);
      addFullscreenButton("relation-graph");
      console.log("🔗 RelationGraph renderizado correctamente");
    } catch (err) {
      console.error("[RelationGraph] ❌ Error al cargar la ontología:", err);
    }
  }

  console.log("🟢 Aplicación inicializada completamente");
})();


// ======================================================
// 🔳 Botón genérico de Pantalla Completa para contenedores
// ======================================================
function addFullscreenButton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.querySelector('.fullscreen-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'fullscreen-btn';
  btn.textContent = '⛶';
  btn.title = 'Pantalla completa';
  container.style.position = 'relative';
  container.appendChild(btn);

  btn.addEventListener('click', () => {
    const isActive = container.classList.contains('fullscreen-active');

    if (!isActive) {
      container.classList.add('fullscreen-active');
      btn.textContent = '✕';
      btn.title = 'Salir de pantalla completa';
    } else {
      container.classList.add('closing');
      btn.textContent = '⛶';
      btn.title = 'Pantalla completa';
      setTimeout(() => {
        container.classList.remove('fullscreen-active', 'closing');
        const chart = echarts.getInstanceByDom(container);
        if (chart) chart.resize();
      }, 300);
    }

    const chart = echarts.getInstanceByDom(container);
    if (chart) chart.resize();
  });
}
