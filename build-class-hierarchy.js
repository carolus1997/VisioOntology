// build-class-hierarchy.js — v3.0 integración schema + concepts
import fs from 'fs';
import { Parser } from 'n3';

// === 🔧 CONFIG ===
const INPUT_FILES = [
  './core-ontology-schema_v03.ttl',      // base jerárquica
  './core-ontology-concepts_v0.7.ttl'    // conceptos nuevos
];
const OUTPUT_FILE = './data/class-hierarchy.json';

// === 🔍 HELPERS ===
function simplify(uri) {
  return uri.replace(/^.*[#/]/, '');
}

const parser = new Parser();
const subclasses = new Map();
const allClasses = new Set();
const allParents = new Set();

// === 📦 LECTURA DE AMBOS TTL ===
for (const file of INPUT_FILES) {
  const ttl = fs.readFileSync(file, 'utf8');
  const triples = parser.parse(ttl);
  console.log(`📄 Procesando ${file} (${triples.length} triples)`);

  for (const t of triples) {
    const s = simplify(t.subject.value);
    const p = t.predicate.value;
    const o = t.object?.value ? simplify(t.object.value) : null;
    const isSubClass =
      p.includes('subClassOf') || p.endsWith('#subClassOf') || p.endsWith('/subClassOf');

    if (isSubClass && o && !o.startsWith('xsd:')) {
      allClasses.add(s);
      allClasses.add(o);
      allParents.add(o);
      if (!subclasses.has(o)) subclasses.set(o, []);
      subclasses.get(o).push(s);
    }
  }
}

// === 🌳 DETECCIÓN DE RAÍCES ===
const roots = Array.from(allClasses).filter(c => !allParents.has(c));
console.log(`🌳 Raíces detectadas: ${roots.length}`);

// === 🌿 CONSTRUCCIÓN RECURSIVA ===
function buildTree(node, visited = new Set()) {
  if (visited.has(node)) return { name: node };
  visited.add(node);
  const children = subclasses.get(node) || [];
  children.sort();
  return {
    name: node,
    children: children.map(c => buildTree(c, new Set(visited)))
  };
}

const forest = roots.map(r => buildTree(r));
fs.mkdirSync('./data', { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(forest, null, 2), 'utf8');

console.log(`✅ Jerarquía combinada exportada a ${OUTPUT_FILE}`);
console.log(`📦 Total de clases: ${allClasses.size}`);
