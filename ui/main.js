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
      addFullscreenButton("tree-chart"); // ✅ AÑADE ESTA LÍNEA
      console.log("🌲 TreeView renderizado correctamente");
    } catch (err) {
      console.error("❌ No se pudo inicializar TreeView:", err);
    }
  }


  // === RELATION GRAPH (si existe) ===
  if (window.RelationGraph && typeof RelationGraph.init === "function") {
    try {
      await RelationGraph.init("relation-graph", PATHS.ontology);
      addFullscreenButton("relation-graph"); // ✅ AÑADE ESTA LÍNEA
      console.log("🔗 RelationGraph renderizado correctamente");
    } catch (err) {
      console.error("[RelationGraph] ❌ Error al cargar la ontología:", err);
    }
  }

  console.log("🟢 Aplicación inicializada completamente");

})();
// ======================================================
// 🔳 Pantalla completa con Descriptor lateral (usa scroll del layout base)
// ======================================================
async function addFullscreenButton(containerId) {
  const baseContainer = document.getElementById(containerId);
  if (!baseContainer) return;

  // Evita crear dos botones
  if (baseContainer.querySelector('.fullscreen-btn')) return;

  // Crear botón
  const btn = document.createElement('button');
  btn.className = 'fullscreen-btn';
  btn.textContent = '⛶';
  btn.title = 'Pantalla completa';
  baseContainer.style.position = 'relative';
  baseContainer.appendChild(btn);

  // Evento de click
  btn.addEventListener('click', async () => {
    const isTree = containerId.includes('tree');
    const ontologyPath = 'data/ontology3.json';
    const hierarchyPath = 'data/class-hierarchy3.json';

    // === Estructura principal del modo fullscreen ===
    const layout = document.createElement('div');
    layout.classList.add('fullscreen-active', 'with-descriptor');

    // Panel izquierdo: descriptor (scroll igual que layout base)
    const descriptorPanel = document.createElement('div');
    descriptorPanel.className = 'descriptor-inline descriptor-panel';
    descriptorPanel.id = 'descriptor-inline';
    layout.appendChild(descriptorPanel);

    // Panel derecho: gráfico
    const chartArea = document.createElement('div');
    chartArea.className = 'echart-area';
    const chartDiv = document.createElement('div');
    chartDiv.id = `${containerId}-fullscreen`;
    chartDiv.style.width = '100%';
    chartDiv.style.height = '100%';
    chartArea.appendChild(chartDiv);
    layout.appendChild(chartArea);

    // Botón de cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Cerrar pantalla completa';
    layout.appendChild(closeBtn);

    document.body.appendChild(layout);
    document.body.classList.add('no-scroll');

    // === Renderizado del Descriptor ===
    try {
      await Descriptor.init('descriptor-inline', ontologyPath);
      console.log('📘 Descriptor cargado en fullscreen');
    } catch (err) {
      console.error('❌ Error cargando descriptor:', err);
    }


    // === Renderizado del gráfico con conservación de estado ===
    try {
      if (isTree) {
        await TreeView.init(`${containerId}-fullscreen`, hierarchyPath);
        console.log('🌳 TreeView renderizado correctamente');
      } else {
        // Intentar copiar el estado del grafo existente
        const state = window.RelationGraph?.getState(containerId);
        if (state) {
          await RelationGraph.restoreState(`${containerId}-fullscreen`, ontologyPath, state);
        
          console.log('🔁 RelationGraph restaurado con su estado previo');
        } else {
          await RelationGraph.init(`${containerId}-fullscreen`, ontologyPath);
          console.log('🔗 RelationGraph renderizado nuevo');
        }
      }
    } catch (err) {
      console.error('❌ Error renderizando gráfico fullscreen:', err);
    }


    // === Sincronización de eventos globales ===
    window.addEventListener('node:select', (e) => {
      const id = e.detail?.id;
      if (id && window.Descriptor?._render) {
        window.Descriptor._render(id);
      }
    });

    // === Redimensionar ECharts tras render ===
    setTimeout(() => {
      const chart = echarts.getInstanceByDom(chartDiv);
      if (chart) chart.resize();
    }, 400);

    // === Cerrar pantalla completa ===
    // dentro del listener del botón de cerrar en addFullscreenButton(...)
    closeBtn.addEventListener('click', () => {

      let lastState = null;
      if (!isTree && window.RelationGraph?.getState) {
        lastState = window.RelationGraph.getState(`${containerId}-fullscreen`);
      }

      // Ahora SÍ puedes destruir:
      const chart = echarts.getInstanceByDom(chartDiv);
      if (chart) chart.dispose();
      layout.remove();
      document.body.classList.remove('no-scroll');

      // === 🔹 Propagar sincronización a vista principal ===
      if (lastState) {
        const id = lastState.center;
        console.log(`Sincronizando con vista principal: ${id}`);

        // 1. Actualizar Descriptor
        if (window.Descriptor?._render) {
          window.Descriptor._render(id);
        }

        // Cerrar overlay antes de sincronizar el descriptor normal
        if (window.DescriptorOverlay) {
          window.DescriptorOverlay.hide();
        }

        // 2. Centrar TreeView (solo si existe)
        window.dispatchEvent(new CustomEvent('node:select', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('tree:focus', { detail: { id } }));

        // 3. Mantener Dropdown sincronizado
        const node = id.replace(/^CAT_/, '');
        window.dispatchEvent(new CustomEvent('dropdown:highlight', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('dropdown:change', { detail: { root: node } }));
      }
    });

  });
}

