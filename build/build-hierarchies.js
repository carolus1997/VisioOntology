// ============================================================
// build-hierarchies.js — v2 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Fase 2 del pipeline ontológico
// 🔹 Construye jerarquías MIM / CyberDEM / Propio directamente
//    desde ontology2.json, usando el campo "source".
// 🔹 Exporta: hierarchy_mim.json, hierarchy_cyberdem.json, hierarchy_propio.json
// ============================================================

import fs from "fs";

const INPUT_ONTOLOGY = "./data/ontology2.json";
const OUTPUT_DIR = "./data";

if (!fs.existsSync(INPUT_ONTOLOGY)) {
  console.error("❌ No se encontró ontology2.json. Ejecuta antes la Fase 1.");
  process.exit(1);
}

console.log("📘 Cargando ontology2.json...");
const ontology = JSON.parse(fs.readFileSync(INPUT_ONTOLOGY, "utf8"));
const nodes = ontology.nodes || ontology;
const edges = ontology.edges || [];

// === AUXILIARES ===
function detectSource(srcText = "") {
  const txt = srcText.toLowerCase();
  if (txt.includes("mim")) return "mim";
  if (txt.includes("cyberdem") || txt.includes("siso-ref-072")) return "cyberdem";
  return "propio";
}

// === Agrupar nodos por origen ===
const groups = { mim: [], cyberdem: [], propio: [] };

for (const node of nodes) {
  const src = detectSource(node.source || node.info || "");
  groups[src].push(node);
}

console.table(
  Object.entries(groups).map(([k, v]) => ({ source: k, nodes: v.length }))
);

// === Reconstruir jerarquías ===
function buildHierarchy(sourceKey) {
  const groupNodes = groups[sourceKey];
  if (!groupNodes || !groupNodes.length) return null;

  // Mapa de nodos
  const nodeMap = new Map(groupNodes.map(n => [n.id || n.name, { ...n, children: [] }]));

  // Relaciones válidas dentro del mismo grupo
  const groupEdges = edges.filter(e => {
    const srcNode = nodeMap.get(e.source);
    const tgtNode = nodeMap.get(e.target);
    return srcNode && tgtNode; // ambos deben pertenecer al mismo origen
  });

  for (const edge of groupEdges) {
    const parent = nodeMap.get(edge.target);
    const child = nodeMap.get(edge.source);
    if (parent && child && parent !== child) parent.children.push(child);
  }

  // Detectar raíces
  const allChildren = new Set(groupEdges.map(e => e.source));
  const roots = Array.from(nodeMap.values()).filter(n => !allChildren.has(n.id));

  // Nodo raíz virtual
  const rootNode = {
    name: `${sourceKey.toUpperCase()} Ontology`,
    kind: "root",
    source: sourceKey,
    children: roots
  };

  return rootNode;
}

// === Generar y exportar ===
for (const src of ["mim", "cyberdem", "propio"]) {
  console.log(`\n🌳 Construyendo jerarquía para ${src.toUpperCase()}...`);
  const hierarchy = buildHierarchy(src);
  if (!hierarchy) {
    console.warn(`⚠️ No se pudo construir jerarquía para ${src}`);
    continue;
  }

  const outPath = `${OUTPUT_DIR}/hierarchy_${src}.json`;
  fs.writeFileSync(outPath, JSON.stringify(hierarchy, null, 2));
  console.log(`✅ Exportada → ${outPath}`);
}

console.log("\n🎯 FASE 2 COMPLETADA: Jerarquías individuales generadas desde ontology2.json");
