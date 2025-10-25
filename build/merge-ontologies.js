// ============================================================
// merge-ontologies.js — v1 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Fase 3 del pipeline ontológico
// 🔹 Fusiona las ontologías individuales (MIM, CyberDEM, Propio)
// 🔹 Elimina duplicados y combina propiedades y relaciones
// ============================================================

import fs from "fs";

const INPUTS = [
  "./data/ontology_mim.json",
  "./data/ontology_cyberdem.json",
  "./data/ontology_propio.json"
];

const OUTPUT = "./data/ontology_merged.json";

// === FUNCIONES AUXILIARES ===
function mergeNodes(allNodes) {
  const mergedMap = new Map();

  for (const node of allNodes) {
    const key = node.id || node.name?.toLowerCase();
    if (!key) continue;

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...node });
    } else {
      const existing = mergedMap.get(key);

      // 🔧 Combinamos propiedades sin sobrescribir datos válidos
      mergedMap.set(key, {
        ...existing,
        ...node,
        source: mergeSources(existing.source, node.source),
        label: existing.label || node.label,
        description: existing.description || node.description,
        kind: existing.kind || node.kind
      });
    }
  }

  return Array.from(mergedMap.values());
}

function mergeEdges(allEdges) {
  const edgeSet = new Set();
  const merged = [];

  for (const e of allEdges) {
    const key = `${e.source}-${e.target}-${e.type}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      merged.push(e);
    }
  }

  return merged;
}

function mergeSources(src1, src2) {
  if (!src1) return src2 || "";
  if (!src2) return src1;
  if (src1 === src2) return src1;
  return `${src1} / ${src2}`;
}

// === LECTURA DE ONTOLOGÍAS ===
let allNodes = [];
let allEdges = [];

for (const path of INPUTS) {
  if (!fs.existsSync(path)) {
    console.warn(`⚠️ Archivo no encontrado: ${path}`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  const nodes = data.nodes || [];
  const edges = data.edges || [];

  console.log(`📦 ${path} → ${nodes.length} nodos, ${edges.length} relaciones`);
  allNodes = allNodes.concat(nodes);
  allEdges = allEdges.concat(edges);
}

// === FUSIÓN DE NODOS Y RELACIONES ===
console.log("\n🔗 Fusionando ontologías...");
const mergedNodes = mergeNodes(allNodes);
const mergedEdges = mergeEdges(allEdges);

const mergedOntology = {
  meta: {
    sources: INPUTS,
    totalNodes: mergedNodes.length,
    totalEdges: mergedEdges.length,
    generated: new Date().toISOString()
  },
  nodes: mergedNodes,
  edges: mergedEdges
};

// === EXPORTACIÓN FINAL ===
fs.writeFileSync(OUTPUT, JSON.stringify(mergedOntology, null, 2));
console.log(`\n✅ Ontología unificada exportada → ${OUTPUT}`);
console.log(`📊 ${mergedNodes.length} nodos totales`);
console.log(`🔗 ${mergedEdges.length} relaciones totales`);
console.log("\n🎯 FASE 3 COMPLETADA: Ontología global lista para la jerarquía");
