// ui/relation-graph.js
// RelationGraph v3.7.1 — Etiquetas radiales más separadas + layout circular estable

window.RelationGraph = (() => {
  let _chart, _container;
  const nodeById = new Map();
  const neighborsMap = new Map();
  const visibleNodes = new Set();
  const visibleEdges = new Map();
  let currentCenter = null;

  const MAX_VISIBLE_NODES = 150;

  function showError(msg) {
    console.error('[RelationGraph] ❌', msg);
    const el = _container || document.getElementById('relation-graph');
    if (el)
      el.innerHTML = `<div style="color:#f66;padding:1rem;font-family:monospace;">⚠️ ${msg}</div>`;
  }

  function normalizeId(id) {
    if (!id) return null;
    let clean = String(id).trim();
    clean = clean.replace(/^cat_/i, '').replace(/^CAT_/i, '');
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    return `CAT_${clean}`;
  }

  function colorForCategory(cat) {
    switch (cat) {
      case 'Capability': return '#4aa8ff';
      case 'Category': return '#24d28a';
      case 'Component': return '#ffa62b';
      case 'Source': return '#a78bfa';
      default: return '#999';
    }
  }

  // === Añadir debajo de colorForCategory ===
  function colorForOrigin(n) {
    const src = (n.source || n.info || '').toLowerCase();
    if (src.includes('mim')) return '#00e68a';        // Verde MIM
    if (src.includes('cyberdem') || src.includes('cdem')) return '#00baff'; // Azul CDEM
    return '#ff9f1c';                                // Naranja propio
  }

  function buildIndexes(nodes, edges) {
    nodeById.clear();
    neighborsMap.clear();

    for (const n of nodes) {
      const id = normalizeId(n.id);
      const node = {
        id,
        name: n.label || id.replace(/^CAT_/, ''),
        category: n.categoryName || 'Desconocido',
        source: n.source || '',
        info: n.info || '',
        itemStyle: { color: colorForOrigin(n) },
      };
      nodeById.set(id, node);
      neighborsMap.set(id, new Set());
    }

    let dropped = 0;
    for (const e of edges) {
      const s = normalizeId(e.source);
      const t = normalizeId(e.target);

      if (!s || !t) continue;

      const hasS = nodeById.has(s);
      const hasT = nodeById.has(t);

      // ✅ Relación bidireccional completa (si ambos existen)
      if (hasS && hasT) {
        neighborsMap.get(s).add(t);
        neighborsMap.get(t).add(s);
      }
      // ⚙️ Si solo uno existe, se registra igualmente el otro
      else if (hasS && !hasT) {
        if (!neighborsMap.has(s)) neighborsMap.set(s, new Set());
        neighborsMap.get(s).add(t);
      } else if (hasT && !hasS) {
        if (!neighborsMap.has(t)) neighborsMap.set(t, new Set());
        neighborsMap.get(t).add(s);
      } else dropped++;
    }

    if (dropped) console.warn(`[RelationGraph] ${dropped} enlaces omitidos por nodos inexistentes.`);
    window.RelationGraph.__debug = { nodeById, neighborsMap };
  }


  function clearVisible() {
    visibleNodes.clear();
    visibleEdges.clear();
  }

  function addNode(id) {
    if (!nodeById.has(id)) return false;
    if (visibleNodes.size >= MAX_VISIBLE_NODES) return false;
    visibleNodes.add(id);
    return true;
  }

  function addEdge(source, target, kind) {
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (!visibleEdges.has(key)) visibleEdges.set(key, { source, target, kind });
  }

  function expandDepth1(centerId) {
    const neigh = neighborsMap.get(centerId) || new Set();

    // 🔹 Incluye también conexiones donde el nodo actual es el target
    for (const [src, set] of neighborsMap.entries()) {
      if (set.has(centerId)) neigh.add(src);
    }

    const sorted = [...neigh].sort(
      (a, b) => (neighborsMap.get(b)?.size || 0) - (neighborsMap.get(a)?.size || 0)
    );

    for (const nb of sorted) {
      if (!addNode(nb)) break;
      addEdge(centerId, nb, 'bidirectional');
    }
  }


  function render(centerId) {
    if (!_chart) return;
    const data = [];
    const links = [];
    const total = visibleNodes.size;
    let i = 0;

    for (const id of visibleNodes) {
      const base = nodeById.get(id);
      if (!base) continue;
      const isCenter = id === centerId;

      // 📐 Desplazamiento radial mayor (22 px)
      const angle = (360 / total) * i;
      const rad = (angle * Math.PI) / 180;
      const offsetX = Math.cos(rad) * 22;
      const offsetY = Math.sin(rad) * 22;
      i++;

      data.push({
        ...base,
        symbolSize: isCenter ? 16 : 9,
        label: {
          show: true,
          color: '#ddd',
          fontSize: 10,
          formatter: '{b}',
          offset: [offsetX, offsetY],
        },
        itemStyle: isCenter
          ? {
            color: base.itemStyle.color,
            shadowBlur: 20,
            shadowColor: base.itemStyle.color,
          }
          : base.itemStyle,
      });
    }

    for (const e of visibleEdges.values()) {
      const sourceNode = nodeById.get(e.source);
      const targetNode = nodeById.get(e.target);
      const sourceColor = colorForOrigin(sourceNode || {});
      const targetColor = colorForOrigin(targetNode || {});

      // 🎨 Opción 1 — color del origen del nodo fuente
      let color = sourceColor;

      // 🎨 Opción 2 (comentada): degradado entre source y target
      // let color = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
      //   { offset: 0, color: sourceColor },
      //   { offset: 1, color: targetColor }
      // ]);

      links.push({
        source: e.source,
        target: e.target,
        lineStyle: {
          color,
          width: 1.3,
          opacity: 0.85,
          shadowBlur: 6,
          shadowColor: color
        },
      });
    }


    _chart.setOption({
      backgroundColor: '#000',
      series: [
        {
          type: 'graph',
          layout: 'circular',
          circular: { rotateLabel: false },
          data,
          links,
          roam: true,
          focusNodeAdjacency: true,
          lineStyle: { curveness: 0.25 },
          emphasis: { scale: true, focus: 'adjacency' },
        },
      ],
    }, true);
  }

  async function init(containerId = 'relation-graph', ontologyPath = '../data/ontology.json') {
    _container = document.getElementById(containerId);
    if (!_container) return showError(`No se encontró el contenedor #${containerId}`);

    _chart = echarts.init(_container);
    _chart.showLoading('default', { text: 'Cargando relaciones...' });

    try {
      const res = await fetch(ontologyPath);
      const data = await res.json();
      _chart.hideLoading();

      buildIndexes(data.nodes, data.edges);

      _chart.on('click', (params) => {
        if (params.dataType !== 'node') return;
        const id = params.data.id;

        currentCenter = id;
        clearVisible();
        addNode(id);
        expandDepth1(id);
        render(id);

        // 🔹 Eventos existentes
        window.dispatchEvent(new CustomEvent('node:select', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('tree:focus', { detail: { id } }));
        window.dispatchEvent(new CustomEvent('dropdown:highlight', { detail: { id } }));

        // 🔹 NUEVO: notificar al árbol igual que hace el dropdown
        const node = nodeById.get(id);
        const nameFromId = id.replace(/^CAT_/, '');
        const rootName = (node && node.name) ? node.name : nameFromId;
        window.dispatchEvent(new CustomEvent('dropdown:change', { detail: { root: rootName } }));
      });


      window.addEventListener('node:select', (e) => {
        const id = e.detail?.id;
        if (!id || !nodeById.has(id)) return;
        currentCenter = id;
        clearVisible();
        addNode(id);
        expandDepth1(id);
        render(id);
      });



      const seedId = 'CAT_Action';
      if (nodeById.has(seedId)) {
        currentCenter = seedId;
        clearVisible();
        addNode(seedId);
        expandDepth1(seedId);
        render(seedId);
        console.log('[RelationGraph] Render inicial en', seedId);
      }

    } catch (err) {
      showError(`Error al cargar la ontología: ${err.message}`);
    }
  }



  return { init };
})();
