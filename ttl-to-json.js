// ttl-to-json.js — versión extendida con extracción de metadatos RDF
import fs from 'fs';
import { Parser } from 'n3';

// === ⚙️ CONFIG ===
const INPUT_FILES = [
  './core-ontology-schema_v03.ttl',
  './core-ontology-concepts_v0.7.ttl'
];
const OUTPUT_FILE = './data/ontology.json';

// === 📦 FUNCIONES AUXILIARES ===
const simplifyURI = (uri) => {
  if (!uri) return uri;
  return uri.replace(/^.*[#/]/, '');
};

const prefixes = {
  category: 'CAT_',
  subcategory: 'SUB_',
  instance: 'ITM_'
};

const nodes = new Map(); // id → { id, name, kind, categoryName, ... }
const edges = [];
const relationTypes = new Set();

function ensureNode(id, name, kind = 'category') {
  if (!nodes.has(id)) {
    nodes.set(id, { id, name, kind, categoryName: name });
  }
  return nodes.get(id);
}

// === 🧠 PARSEADOR PRINCIPAL ===
async function parseTTL(path) {
  const ttl = fs.readFileSync(path, 'utf8');
  const parser = new Parser();
  const triples = parser.parse(ttl);

  console.log(`📄 Procesando ${path} (${triples.length} triples)`);

  for (const t of triples) {
    const s = simplifyURI(t.subject.value);
    const p = simplifyURI(t.predicate.value);
    const o = t.object.value ? simplifyURI(t.object.value) : null;
    const oLiteral = t.object.termType === 'Literal';

    // === DETECCIÓN DE CLASES ===
    if (p === 'rdf:type' && (o === 'Class' || o === 'owl:Class' || o === 'rdfs:Class')) {
      ensureNode(prefixes.category + s, s, 'category');
      continue;
    }

    // === SUBCLASES ===
    if (p === 'rdfs:subClassOf' || p === 'subClassOf') {
      const source = prefixes.category + s;
      const target = prefixes.category + o;
      ensureNode(source, s);
      ensureNode(target, o);
      edges.push({ source, target, type: 'is_a' });
      relationTypes.add('is_a');
      continue;
    }

    // === PROPIEDADES (OBJETO O DATO) ===
    if (
      p === 'rdf:type' &&
      (o === 'owl:ObjectProperty' ||
       o === 'owl:DatatypeProperty' ||
       o === 'rdf:Property')
    ) {
      const propId = prefixes.category + s;
      ensureNode(propId, s, 'relation');
      relationTypes.add(s);
      continue;
    }

    // === DOMINIO / RANGO ===
    if (p === 'rdfs:domain' || p === 'domain') {
      const source = prefixes.category + o;
      const target = prefixes.category + s;
      ensureNode(source, o);
      ensureNode(target, s);
      edges.push({ source, target, type: 'domainOf' });
      relationTypes.add('domainOf');
      continue;
    }

    if (p === 'rdfs:range' || p === 'range') {
      const source = prefixes.category + s;
      const target = prefixes.category + o;
      ensureNode(source, s);
      ensureNode(target, o);
      edges.push({ source, target, type: 'rangeOf' });
      relationTypes.add('rangeOf');
      continue;
    }

    // === ETIQUETA (rdfs:label) ===
    if (p === 'rdfs:label' || p === 'label') {
      const id = prefixes.category + s;
      ensureNode(id, s);
      nodes.get(id).label = t.object.value;
      continue;
    }

    // === DESCRIPCIÓN (rdfs:comment o dct:description) ===
    if (p === 'rdfs:comment' || p === 'comment' || p === 'dct:description' || p === 'description') {
      const id = prefixes.category + s;
      ensureNode(id, s);
      nodes.get(id).description = t.object.value;
      continue;
    }

    // === PROPIEDADES LITERALES GENÉRICAS ===
    if (oLiteral && !p.startsWith('rdf') && !p.startsWith('owl')) {
      const id = prefixes.category + s;
      ensureNode(id, s);
      const node = nodes.get(id);
      node[p] = t.object.value;
      continue;
    }

    // === RELACIONES GENERALES ENTRE ENTIDADES ===
    if (s && o && s !== o && !p.startsWith('rdf') && !p.startsWith('owl')) {
      const source = prefixes.category + s;
      const target = prefixes.category + o;
      ensureNode(source, s);
      ensureNode(target, o);
      edges.push({ source, target, type: p });
      relationTypes.add(p);
    }
  }
}

// === 🚀 EJECUCIÓN PRINCIPAL ===
(async function main() {
  for (const file of INPUT_FILES) {
    await parseTTL(file);
  }

  // === COMPILAR CATEGORÍAS ÚNICAS ===
  const categories = Array.from(
    new Set(Array.from(nodes.values()).map(n => n.categoryName))
  ).map(name => ({ name, subcategories: [], instancesPerSubcategory: 0 }));

  // === CONSTRUIR ONTOLOGÍA FINAL ===
  const ontology = {
    meta: {
      idPrefixes: prefixes,
      maxVisibleDepth: 3,
      instanceLabelTemplate: '{sub}-{num}',
      sources: INPUT_FILES
    },
    categories,
    relationTypes: Array.from(relationTypes),
    nodes: Array.from(nodes.values()),
    edges
  };

  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ontology, null, 2), 'utf8');

  console.log(`✅ Ontología exportada con ${nodes.size} nodos y ${edges.length} relaciones.`);
  console.log(`💾 Archivo: ${OUTPUT_FILE}`);
})();
