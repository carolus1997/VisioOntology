// ============================================================
// build-ontologies.js — v2 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Fase 1 del pipeline ontológico
// 🔹 Genera ontologías separadas (MIM, CyberDEM, Propio)
// 🔹 Integra fuentes desde ontology2.json (metadatos reales)
// ============================================================

import fs from "fs";
import { Parser } from "n3";

// === CONFIGURACIÓN DE ENTRADAS ===
const INPUT_FILES = [
  "./core/core-ontology-schema_v03.ttl",
  "./core/core-ontology-concepts_v0.7.ttl"
];

const OUTPUT_DIR = "./data";
const SOURCES = {
  mim: `${OUTPUT_DIR}/ontology_mim.json`,
  cyberdem: `${OUTPUT_DIR}/ontology_cyberdem.json`,
  propio: `${OUTPUT_DIR}/ontology_propio.json`
};

// === MAPAS DE DATOS ===
const nodes = { mim: new Map(), cyberdem: new Map(), propio: new Map() };
const edges = { mim: [], cyberdem: [], propio: [] };

// === CARGAR ONTOLOGY2.JSON COMO REFERENCIA DE FUENTES ===
let sourceMap = new Map();
if (fs.existsSync("./data/ontology2.json")) {
  console.log("📘 Cargando fuentes desde ontology2.json...");
  const ont = JSON.parse(fs.readFileSync("./data/ontology2.json", "utf8"));
  const arr = ont.nodes || ont;
  for (const n of arr) {
    if (n.name && n.source) sourceMap.set(n.name.toLowerCase(), n.source);
  }
  console.log(`🧩 ${sourceMap.size} nodos con fuente detectada`);
} else {
  console.warn("⚠️ No se encontró ./data/ontology2.json — se usará detección básica.");
}

// === FUNCIONES AUXILIARES ===
function simplify(uri) {
  return uri ? uri.replace(/^.*[#/]/, "") : uri;
}

function detectOrigin(value) {
  const key = (value || "").toLowerCase();
  // 🔹 Buscar en el mapa de fuentes del ontology2.json
  if (sourceMap.has(key)) {
    const src = sourceMap.get(key).toLowerCase();
    if (src.includes("mim")) return "mim";
    if (src.includes("cyberdem") || src.includes("siso-ref-072")) return "cyberdem";
  }
  // 🔹 Fallback textual
  if (key.includes("mim")) return "mim";
  if (key.includes("cyberdem") || key.includes("siso-ref-072")) return "cyberdem";
  return "propio";
}

function ensureNode(map, id, name, kind = "category") {
  if (!map.has(id)) map.set(id, { id, name, kind });
  return map.get(id);
}

// === PARSEAR TTL ===
function parseTTL(path) {
  const ttl = fs.readFileSync(path, "utf8");
  const parser = new Parser();
  const triples = parser.parse(ttl);
  console.log(`📄 Procesando ${path} (${triples.length} triples)`);

  for (const t of triples) {
    const s = simplify(t.subject?.value);
    const p = simplify(t.predicate?.value);
    const o = t.object?.value ? simplify(t.object.value) : null;
    const oLiteral = t.object?.termType === "Literal";

    if (!s || !p) continue;

    const origin = detectOrigin(s) || detectOrigin(o);
    const map = nodes[origin];
    const rel = edges[origin];

    if (p === "type" && ["Class", "OwlClass"].includes(o)) {
      ensureNode(map, "CAT_" + s, s, "category");
    }

    if (["label", "comment", "description"].includes(p) && oLiteral) {
      const node = ensureNode(map, "CAT_" + s, s);
      node[p] = t.object.value;
    }

    if (p === "subClassOf" && o) {
      rel.push({ source: "CAT_" + s, target: "CAT_" + o, type: "is_a" });
    }
  }
}

// === PROCESAR TODOS LOS TTL ===
INPUT_FILES.forEach(parseTTL);

// === EXPORTAR CADA ONTOLOGÍA ===
for (const origin of Object.keys(nodes)) {
  const ontology = {
    source: origin.toUpperCase(),
    nodes: Array.from(nodes[origin].values()),
    edges: edges[origin]
  };
  fs.writeFileSync(SOURCES[origin], JSON.stringify(ontology, null, 2), "utf8");
  console.log(`✅ Ontología ${origin} exportada (${ontology.nodes.length} nodos)`);
}

console.log("\n🎯 FASE 1 COMPLETADA: Ontologías individuales generadas en /data/");
