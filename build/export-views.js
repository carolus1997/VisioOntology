// ============================================================
// export-views.js — v1 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Fase 5 del pipeline ontológico
// 🔹 Genera vistas independientes para cada modelo ontológico
// 🔹 Entrada:  /data/class-hierarchy_final.json
// 🔹 Salida:   /data/class-hierarchy_{mim|cyberdem|propio|all}.json
// ============================================================

import fs from "fs";

const INPUT = "./data/class-hierarchy_final.json";
const OUTPUT_DIR = "./data";

if (!fs.existsSync(INPUT)) {
  console.error(`❌ No se encontró ${INPUT}`);
  process.exit(1);
}

// === Leer la jerarquía global ===
const globalData = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const branches = globalData.children || [];

console.log("📘 FASE 5 — Exportación de vistas individuales");
console.log(`🌳 Total ramas detectadas: ${branches.length}`);

// === Función para exportar ramas ===
function exportBranch(branch) {
  if (!branch || !branch.name) return;

  const filename = `class-hierarchy_${branch.source}.json`;
  const outputPath = `${OUTPUT_DIR}/${filename}`;

  // Crear estructura raíz limpia
  const cleaned = {
    name: branch.name,
    source: branch.source,
    kind: branch.kind,
    children: branch.children || [],
    lineStyle: branch.lineStyle || { color: "#999" }
  };

  fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));

  console.log(`✅ Exportado → ${outputPath} (${branch.children?.length || 0} hijos)`);
}

// === Exportar cada vista raíz ===
branches.forEach(exportBranch);

// === Exportar la vista global ("all") ===
const allPath = `${OUTPUT_DIR}/class-hierarchy_all.json`;
fs.writeFileSync(allPath, JSON.stringify(globalData, null, 2));
console.log(`🌍 Exportado → ${allPath} (vista completa)`);

console.log("\n🎯 FASE 5 COMPLETADA: Vistas independientes generadas en /data/");
