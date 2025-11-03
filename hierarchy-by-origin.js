// hierarchy-by-origin.js — Genera jerarquías por origen y combinaciones
// ⚙️ Requiere Node.js 18+
// 🗂️ Entrada: ./data/class-hierarchy2.json
// 📤 Salida: ./data/origin-views/class-hierarchy_*.json

import fs from "fs";

// === CONFIGURACIÓN ===
const INPUT = "./data/class-hierarchy2.json";
const OUTPUT_DIR = "./data/origin-views/";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("🚀 Generando jerarquías por origen desde", INPUT);

// === UTILIDADES ===
function detectOrigin(node) {
  if (!node) return "propio";

  const src = (node.source || "").toLowerCase().trim();

  // --- 🟢 MIM ---
  if (src.includes("mim")) return "mim";

  // --- 🔵 CyberDEM ---
  if (src.includes("cyberdem") || src.includes("siso-ref-072")) return "cyberdem";

  // --- 🟠 Propio (sin source o vacío) ---
  return "propio";
}



// === FUNCIÓN PRINCIPAL DE FILTRADO ===
function filterByOrigin(node, activeOrigins) {
  if (!node || node.invisibleRoot) return null;

  const nodeOrigin = detectOrigin(node);
  const childClones = (node.children || [])
    .map(child => filterByOrigin(child, activeOrigins))
    .filter(Boolean);

  // Mantener nodo si pertenece al origen activo o si tiene hijos válidos
  if (activeOrigins.includes(nodeOrigin) || childClones.length > 0) {
    const clone = structuredClone(node);
    clone.children = childClones;
    return clone;
  }
  return null;
}

// === CONSTRUCCIÓN DEL ÁRBOL COMBINADO ===
function buildHierarchy(data, activeOrigins) {
  const roots = [];
  const inputRoots = Array.isArray(data) ? data : [data];

  for (const origin of activeOrigins) {
    const originChildren = inputRoots
      .map(root => filterByOrigin(root, [origin]))
      .filter(Boolean)
      .flat();

    if (originChildren.length > 0) {
      roots.push({
        name: origin.toUpperCase(),
        source: origin,
        children: originChildren
      });
    }
  }

  return {
    name: `Ontology (${activeOrigins.join(" + ").toUpperCase()})`,
    invisibleRoot: true,
    children: roots
  };
}

// === GENERADOR DE TODAS LAS COMBINACIONES ===
function generateCombinations(origins) {
  const combos = [];
  for (let i = 1; i < 1 << origins.length; i++) {
    const combo = origins.filter((_, idx) => i & (1 << idx));
    combos.push(combo);
  }
  return combos;
}

// === CARGA DE DATOS Y GENERACIÓN ===
const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const ORIGINS = ["mim", "cyberdem", "propio"];
const combinations = generateCombinations(ORIGINS);

for (const combo of combinations) {
  const name = combo.join("_");
  const tree = buildHierarchy(data, combo);
  const outputPath = `${OUTPUT_DIR}/class-hierarchy_${name}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2));
  console.log(`✅ Generado ${outputPath}`);
}

console.log("🎉 Todas las combinaciones exportadas correctamente.");
