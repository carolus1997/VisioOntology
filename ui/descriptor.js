// ui/descriptor.js
// DESCRIPTOR v1 — Inspector de Nodo
// Escucha eventos `node:select` y pinta la ficha del nodo con sus relaciones.

(() => {
  const STATE = {
    container: null,
    ontology: null,
    indexById: new Map(),
    relationsById: new Map(),
    ready: false
  };

  // Util: escapado básico para evitar inyección si las descripciones vienen con HTML
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  async function init(containerId = 'descriptor', ontologyPath = 'data/ontology2.json') {
    STATE.container = document.getElementById(containerId);
    if (!STATE.container) {
      console.warn(`[Descriptor] No se encontró el contenedor #${containerId}`);
      return;
    }

    try {
      const res = await fetch(ontologyPath);
      STATE.ontology = await res.json();
      buildIndexes(STATE.ontology);
      console.log(`[Descriptor] Ontología cargada con ${STATE.indexById.size} nodos.`);
      STATE.ready = true;
      STATE.container.innerHTML = `<p>Selecciona un nodo en el árbol o grafo para ver sus detalles.</p>`;
    } catch (err) {
      console.error('[Descriptor] Error cargando ontología:', err);
      STATE.container.innerHTML = `<p>⚠️ No se pudo cargar la ontología.</p>`;
      return;
    }


    // Escucha global de selección de nodo
    window.addEventListener('node:select', (e) => {
      const id = e?.detail?.id;
      renderNodeInfo(id);
    });
  }

  function buildIndexes(ontology) {
    const nodes = Array.isArray(ontology?.nodes) ? ontology.nodes : [];
    const edges = Array.isArray(ontology?.edges) ? ontology.edges : [];

    // Índice de nodos por id
    STATE.indexById.clear();
    for (const n of nodes) {
      if (n?.id != null) STATE.indexById.set(n.id, n);
    }

    // Mapa de relaciones por id
    STATE.relationsById.clear();
    for (const e of edges) {
      if (!e?.source || !e?.target) continue;
      // Salientes
      if (!STATE.relationsById.has(e.source)) STATE.relationsById.set(e.source, { out: [], in: [] });
      STATE.relationsById.get(e.source).out.push(e);
      // Entrantes
      if (!STATE.relationsById.has(e.target)) STATE.relationsById.set(e.target, { out: [], in: [] });
      STATE.relationsById.get(e.target).in.push(e);
    }
  }

  function renderNodeInfo(id) {
    if (!STATE.ready) return;

    if (!id) {
      STATE.container.innerHTML = `<p>Selecciona un nodo para inspeccionarlo.</p>`;
      return;
    }

    const cleanId = id.trim();
    const variants = [
      cleanId,
      cleanId.toLowerCase(),
      'CAT_' + cleanId,
      'CAT_' + cleanId.toLowerCase(),
      'SUB_' + cleanId,
      'SUB_' + cleanId.toLowerCase(),
      'ITM_' + cleanId,
      'ITM_' + cleanId.toLowerCase()
    ];

    // Buscar el nodo en cualquiera de las variantes o por label/name
    console.log('[Descriptor] Buscando nodo:', id);
    console.log('[Descriptor] Total de nodos en índice:', STATE.indexById.size);
    console.log('[Descriptor] Ejemplo de IDs disponibles:', Array.from(STATE.indexById.keys()).slice(0, 10));

    let node =
      STATE.indexById.get(cleanId) ||
      variants.map(v => STATE.indexById.get(v)).find(Boolean) ||
      Array.from(STATE.indexById.values()).find(
        n =>
          n.label?.toLowerCase() === cleanId.toLowerCase() ||
          n.name?.toLowerCase() === cleanId.toLowerCase() ||
          n.id?.toLowerCase() === cleanId.toLowerCase()
      );

    if (!node) {
      console.warn(`[Descriptor] Nodo no encontrado: ${id}`);
      STATE.container.innerHTML = `<p>❌ Sin información disponible para <b>${esc(id)}</b>.</p>`;
      return;
    }


    const rel = STATE.relationsById.get(node.id) || { out: [], in: [] };
    const labelOf = (nid) => esc(STATE.indexById.get(nid)?.label ?? nid);
    const cat = node.categoryName ?? node.category ?? '—';
    const kind = node.kind ?? '—';
    const desc =
      node.description ??
      node['rdfs:comment'] ??
      node['rdfs:label'] ??
      node.desc ??
      '';


    const LIMIT = 25;
    const moreBadge = (arr) =>
      arr.length > LIMIT ? `<li>… y ${arr.length - LIMIT} más</li>` : '';

    const outItems = rel.out.slice(0, LIMIT)
      .map(e => `<li>→ <b>${labelOf(e.target)}</b> <span class="chip">${esc(e.type ?? 'rel')}</span></li>`).join('');
    const inItems = rel.in.slice(0, LIMIT)
      .map(e => `<li>← <b>${labelOf(e.source)}</b> <span class="chip">${esc(e.type ?? 'rel')}</span></li>`).join('');

    // Extraer atributos literales adicionales
    const excludedKeys = new Set([
      'id', 'name', 'label', 'description', 'desc',
      'kind', 'categoryName', 'children'
    ]);

    const literalEntries = Object.entries(node)
      .filter(([k, v]) => !excludedKeys.has(k) && typeof v === 'string' && v.trim().length > 0);

    const literalsHTML = literalEntries.length
      ? `<div class="meta-attrs"><b>Atributos</b><ul>
        ${literalEntries.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}
      </ul></div>`
      : '';


    // === Sección RDF extra ===
    const rdfEntries = Object.entries(node)
      .filter(([k, v]) => k.startsWith('rdf:') || k.startsWith('rdfs:'));
    const rdfHTML = rdfEntries.length
      ? `
  <div class="meta-attrs">
    <b>📘 Metadatos RDF</b>
    <ul>
      ${rdfEntries.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}
    </ul>
  </div>`
      : '';

    STATE.container.innerHTML = `
    <h3>${esc(node.label ?? node.id)}</h3>
    <div class="meta">
      <b>ID:</b> ${esc(node.id)}<br>
      <b>Categoría:</b> ${esc(cat)}<br>
      <b>Tipo:</b> ${esc(kind)}
    </div>

    ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
    ${literalsHTML}${rdfHTML}

    <div class="rels">
      <div class="rel-col">
        <b>Relaciones salientes</b>
        ${rel.out.length
        ? `<ul>${outItems}${moreBadge(rel.out)}</ul>`
        : `<p class="muted">Sin relaciones salientes.</p>`}
      </div>
      <div class="rel-col">
        <b>Relaciones entrantes</b>
        ${rel.in.length
        ? `<ul>${inItems}${moreBadge(rel.in)}</ul>`
        : `<p class="muted">Sin relaciones entrantes.</p>`}
      </div>
    </div>
  `;
  }
  




  // Exponer API mínima
  window.Descriptor = { init, _render: renderNodeInfo };
})();
