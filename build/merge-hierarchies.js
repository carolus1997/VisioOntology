// ============================================================
// merge-hierarchies.js — v1.1 (24/10/2025)
// ------------------------------------------------------------
// 🔹 Fase 4 del pipeline ontológico
// 🔹 Fusiona las jerarquías individuales (MIM, CyberDEM, Propio)
// 🔹 Añade metadatos, colores y verificación de integridad
// 🔹 Exporta: /data/class-hierarchy_final.json
// ============================================================

import fs from "fs";

const INPUTS = {
  mim: "./data/hierarchy_mim.json",
  cyberdem: "./data/hierarchy_cyberdem.json",
  propio: "./data/hierarchy_propio.json"
};

const OUTPUT = "./data/class-hierarchy_final.json";

// === Utilidad para leer y validar jerarquías ===
function loadHierarchy(path, key) {
  if (!fs.existsSync(path)) {
    console.warn(`⚠️ No se encontró la jerarquía ${key}: ${path}`);
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    const count = data.children?.length || 0;
    console.log(`📂 ${key.toUpperCase()} → ${count} ramas raíz`);

    // Log de los primeros niveles
    if (count > 0) {
      console.table(
        data.children.slice(0, 5).map(c => ({
          name: c.name,
          hijos: c.children ? c.children.length : 0
        }))
      );
    }

    return data;
  } catch (err) {
    console.error(`❌ Error al leer ${path}:`, err);
    return null;
  }
}

// === Construcción de ramas raíz ===
const roots = [];

for (const [key, path] of Object.entries(INPUTS)) {
  const tree = loadHierarchy(path, key);
  if (tree) {
    const color =
      key === "mim"
        ? "#00e68a"
        : key === "cyberdem"
        ? "#00baff"
        : "#ff9f1c";

    const branch = {
      name: key.toUpperCase(),
      source: key,
      kind: "root-branch",
      color,
      lineStyle: { color },
      children: tree.children || []
    };

    // Log de diagnóstico
    console.log(
      `🧩 Rama ${branch.name} añadida → ${branch.children.length} hijos`
    );
    roots.push(branch);
  }
}

// === Verificación final ===
if (roots.length === 0) {
  console.error("❌ No se pudo construir la jerarquía global. No hay ramas válidas.");
  process.exit(1);
}

const globalRoot = {
  name: "Ontology",
  invisibleRoot: true,
  kind: "root",
  children: roots,
  lineStyle: { color: "#ffffff" }
};

// === Exportación ===
fs.writeFileSync(OUTPUT, JSON.stringify(globalRoot, null, 2));

console.log("\n✅ Jerarquía global exportada correctamente:");
console.log(`📄 ${OUTPUT}`);
console.log(`🌳 Ramas incluidas: ${roots.map(r => r.name).join(", ")}`);
console.log(`📊 Total hijos raíz: ${roots.reduce((a, r) => a + (r.children?.length || 0), 0)}`);
console.log("\n🎯 FASE 4 COMPLETADA: class-hierarchy_final.json listo para TreeView");
