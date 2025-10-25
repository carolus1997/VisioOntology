// ============================================================
// main-pipeline.js — v2 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Ejecuta todas las fases del pipeline ontológico en orden
// 🔹 Permite limpiar o ejecutar parcialmente con flags (--clean, --fast)
// ============================================================

import { execSync } from "child_process";
import fs from "fs";

const args = process.argv.slice(2);
const start = Date.now();

console.log("🚀 Iniciando pipeline de generación ontológica...\n");

if (args.includes("--clean")) {
  console.log("🧹 Limpiando archivos previos de /data...");
  const files = fs.readdirSync("./data").filter(f => f.endsWith(".json"));
  for (const file of files) fs.unlinkSync(`./data/${file}`);
  console.log("✅ Carpeta /data limpia.\n");
}

// === EJECUCIÓN DE FASES ===
if (!args.includes("--fast")) {
  execSync("node build/build-ontologies.js", { stdio: "inherit" });
  execSync("node build/build-hierarchies.js", { stdio: "inherit" });
}

execSync("node build/merge-ontologies.js", { stdio: "inherit" });
execSync("node build/merge-hierarchies.js", { stdio: "inherit" });

const elapsed = ((Date.now() - start) / 1000).toFixed(2);
console.log(`\n✅ Pipeline completado en ${elapsed}s. Archivos listos en /data/`);
