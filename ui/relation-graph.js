// ui/relation-graph.js
// RelationGraph v3.7.1 — Etiquetas radiales más separadas + layout circular estable

window.RelationGraph = (() => {
  //let _chart, _container;

  const instances = new Map(); // containerId -> { chart, container, visibleNodes, visibleEdges, currentCenter }

  const nodeById = new Map();
  const neighborsMap = new Map();
  //const visibleNodes = new Set();
  //const visibleEdges = new Map();
  let currentCenter = null;

  const MAX_VISIBLE_NODES = 150;


  function getInst(containerId) { return instances.get(containerId); }

  function clearVisible(inst){ inst.visibleNodes.clear(); inst.visibleEdges.clear(); }
  function addNode(inst, id){ if (!nodeById.has(id)) return false;
    if (inst.visibleNodes.size >= MAX_VISIBLE_NODES) return false;
    inst.visibleNodes.add(id); return true; }
  function addEdge(inst, s, t, kind){
    const key = s < t ? `${s}|${t}` : `${t}|${s}`;
    if (!inst.visibleEdges.has(key)) inst.visibleEdges.set(key, { source:s, target:t, kind });
  }
  function expandDepth1(inst, centerId){
    const neigh = new Set(neighborsMap.get(centerId) || []);
    for (const [src,set] of neighborsMap.entries()) if (set.has(centerId)) neigh.add(src);
    const sorted = [...neigh].sort((a,b)=>(neighborsMap.get(b)?.size||0)-(neighborsMap.get(a)?.size||0));
    for (const nb of sorted){ if (!addNode(inst, nb)) break; addEdge(inst, centerId, nb, 'bidirectional'); }
  }


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

  function render(inst, centerId){
    const chart = inst.chart;
    if (!chart) return;
    const data = [], links = [];
    const total = inst.visibleNodes.size;
    let i = 0;
    for (const id of inst.visibleNodes){
      const base = nodeById.get(id); if (!base) continue;
      const isCenter = id === centerId;
      const angle = (360/total) * i; const rad = angle*Math.PI/180;
      const offsetX = Math.cos(rad)*22, offsetY = Math.sin(rad)*22; i++;
      data.push({ ...base,
        symbolSize: isCenter ? 16 : 9,
        label: { show:true, color:'#ddd', fontSize:10, formatter:'{b}', offset:[offsetX, offsetY] },
        itemStyle: isCenter ? { color: base.itemStyle.color, shadowBlur:20, shadowColor: base.itemStyle.color } : base.itemStyle
      });
    }
    for (const e of inst.visibleEdges.values()){
      const sc = colorForOrigin(nodeById.get(e.source)||{});
      links.push({ source:e.source, target:e.target,
        lineStyle:{ color:sc, width:1.3, opacity:0.85, shadowBlur:6, shadowColor:sc }});
    }
    chart.setOption({ backgroundColor:'#000', series:[{ type:'graph', layout:'circular',
      circular:{ rotateLabel:false }, data, links, roam:true, focusNodeAdjacency:true,
      lineStyle:{ curveness:0.25 }, emphasis:{ scale:true, focus:'adjacency' } }]}, true);
  }


  async function init(containerId='relation-graph', ontologyPath='../data/ontology.json'){
    const container = document.getElementById(containerId);
    if (!container) return showError(`No se encontró el contenedor #${containerId}`);
    const chart = echarts.init(container);
    chart.showLoading('default', { text:'Cargando relaciones...' });

    // registra/obtiene instancia
    const inst = { chart, container, visibleNodes:new Set(), visibleEdges:new Map(), currentCenter:null };
    instances.set(containerId, inst);

    try {
      const res = await fetch(ontologyPath);
      const data = await res.json();
      chart.hideLoading();
      buildIndexes(data.nodes, data.edges);

      chart.on('click', (params) => {
        if (params.dataType !== 'node') return;
        const id = params.data.id;
        inst.currentCenter = id;
        clearVisible(inst); addNode(inst, id); expandDepth1(inst, id); render(inst, id);
        window.dispatchEvent(new CustomEvent('node:select', { detail:{ id } }));
        window.dispatchEvent(new CustomEvent('tree:focus', { detail:{ id } }));
        window.dispatchEvent(new CustomEvent('dropdown:highlight', { detail:{ id } }));
        const node = nodeById.get(id);
        const nameFromId = id.replace(/^CAT_/,'');
        const rootName = (node && node.name) ? node.name : nameFromId;
        window.dispatchEvent(new CustomEvent('dropdown:change', { detail:{ root: rootName } }));
      });

      // escuchar selección global, pero operar sobre ESTA instancia
      window.addEventListener('node:select', (e) => {
        const id = e.detail?.id; if (!id || !nodeById.has(id)) return;
        inst.currentCenter = id;
        clearVisible(inst); addNode(inst, id); expandDepth1(inst, id); render(inst, id);
      });

      const seedId = 'CAT_Action';
      if (nodeById.has(seedId)){
        inst.currentCenter = seedId;
        clearVisible(inst); addNode(inst, seedId); expandDepth1(inst, seedId); render(inst, seedId);
      }
    } catch(err){
      showError(`Error al cargar la ontología: ${err.message}`);
    }
  }

  // expón un método para liberar una instancia
  function dispose(containerId){
    const inst = instances.get(containerId);
    if (!inst) return;
    try { inst.chart?.dispose(); } catch(_) {}
    instances.delete(containerId);
  }

  return { init, dispose };

})();
