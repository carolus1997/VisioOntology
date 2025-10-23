// ttl-hierarchy-builder_v4.js — integración y jerarquía fusionada CyberDEM v0.7
import fs from "fs";
import { Parser } from "n3";

// === ⚙️ CONFIG ===
const INPUT_FILES = [
    "./core-ontology-schema_v03.ttl",
    "./core-ontology-concepts_v0.7.ttl"
];
const OUTPUT_HIERARCHY = "./data/class-hierarchy2.json";
const OUTPUT_ONTOLOGY = "./data/ontology2.json";

// === 🔧 AUXILIARES ===
function simplify(uri) {
    if (!uri) return uri;
    return uri
        .replace(/^.*[#/]/, "")           // corta namespace
        .replace(/_/g, "")                // quita underscores
        .replace(/[^a-zA-Z0-9]/g, "")     // limpia símbolos raros
        .trim();
}

const prefixes = {
    category: "CAT_",
    relation: "REL_",
    component: "COMP_"
};

function addPrefixIfMissing(id, prefix = "CAT_") {
    if (!id) return id;
    return id.startsWith(prefix) ? id : (prefix + id);
}


const nodes = new Map();
const edges = [];
const subclasses = new Map();
const allClasses = new Set();
const allParents = new Set();
const relationTypes = new Set();

function ensureNode(id, name, kind = "category") {
    if (!nodes.has(id)) {
        nodes.set(id, { id, name, kind });
    }
    return nodes.get(id);
}

// === 🧠 PARSEADOR TTL ===
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

        // --- Clases ---
        if (p === "type" && ["Class", "OwlClass", "RdfsClass"].includes(o)) {
            ensureNode(prefixes.category + s, s, "category");
            continue;
        }

        // --- Subclases ---
        if (p === "subClassOf") {
            const parent = addPrefixIfMissing(prefixes.category + o, "CAT_");
            const child = addPrefixIfMissing(prefixes.category + s, "CAT_");
            ensureNode(parent, o);
            ensureNode(child, s);
            edges.push({ source: child, target: parent, type: "is_a" });
            relationTypes.add("is_a");

            allClasses.add(s);
            allClasses.add(o);
            allParents.add(o);
            if (!subclasses.has(o)) subclasses.set(o, []);
            subclasses.get(o).push(s);
            continue;
        }


        // --- Propiedades RDF/OWL ---
        if (
            p === "type" &&
            ["ObjectProperty", "DatatypeProperty", "Property"].includes(o)
        ) {
            const id = prefixes.relation + s;
            ensureNode(id, s, "relation");
            relationTypes.add(s);
            continue;
        }

        // --- Dominios y rangos ---
        if (p === "domain") {
            const source = addPrefixIfMissing(prefixes.category + o, "CAT_");
            const target = addPrefixIfMissing(prefixes.relation + s, "REL_");
            ensureNode(source, o);
            ensureNode(target, s, "relation");
            edges.push({ source, target, type: "domainOf" });
            relationTypes.add("domainOf");
            continue;
        }

        if (p === "range") {
            const source = addPrefixIfMissing(prefixes.relation + s, "REL_");
            const target = addPrefixIfMissing(prefixes.category + o, "CAT_");
            ensureNode(source, s, "relation");
            ensureNode(target, o);
            edges.push({ source, target, type: "rangeOf" });
            relationTypes.add("rangeOf");
            continue;
        }


        // --- Etiquetas y descripciones ---
        if (["label"].includes(p)) {
            const id = addPrefixIfMissing(prefixes.category + s, "CAT_");
            ensureNode(id, s);
            nodes.get(id).label = t.object.value;
            continue;
        }

        if (["comment", "description"].includes(p)) {
            const id = addPrefixIfMissing(prefixes.category + s, "CAT_");
            ensureNode(id, s);
            nodes.get(id).description = t.object.value;
            continue;
        }


        // --- Literales generales ---
        if (oLiteral && !p.startsWith("rdf") && !p.startsWith("owl")) {
            const id = prefixes.category + s;
            ensureNode(id, s);
            nodes.get(id)[p] = t.object.value;
            continue;
        }

        // --- Relaciones genéricas ---
        if (s && o && s !== o && !p.startsWith("rdf") && !p.startsWith("owl")) {
            const source = addPrefixIfMissing(prefixes.category + s, "CAT_");
            const target = addPrefixIfMissing(prefixes.category + o, "CAT_");
            ensureNode(source, s);
            ensureNode(target, o);
            edges.push({ source, target, type: p });
            relationTypes.add(p);
        }

    }
}

// === 🔄 FUSIÓN DE NODOS EQUIVALENTES ===
function mergeEquivalentNodes() {
    const uriMap = new Map();
    for (const node of nodes.values()) {
        const simple = simplify(node.name);
        if (!uriMap.has(simple)) {
            uriMap.set(simple, node);
        } else {
            const target = uriMap.get(simple);
            target.description ||= node.description;
            target.kind ||= node.kind;
            for (const e of edges) {
                if (e.source === node.id) e.source = target.id;
                if (e.target === node.id) e.target = target.id;
            }
            nodes.delete(node.id);
        }
    }
    console.log(`🧩 Nodos fusionados por URI simplificada: ${nodes.size}`);
}

// === 🌳 CONSTRUIR JERARQUÍA ===
function buildHierarchy() {
    const rootsCandidates = [
        "Capability",
        "Category",
        "Component",
        "DeprecatedClass",
        "LOV",
        "uuid"
    ];


    // Identificar raíces explícitas o forzadas
    let roots = rootsCandidates.filter(c => allClasses.has(c));
    if (roots.length === 0) {
        roots = rootsCandidates; // fallback
        console.warn(`⚠️ No se detectaron raíces por herencia. Usando predeterminadas: ${roots.join(", ")}`);
    } else {
        console.log(`🌳 Raíces detectadas: ${roots.length}`);
    }

    function buildTree(node, visited = new Set()) {
        if (!node || visited.has(node)) return { name: node + " (loop)" };
        visited.add(node);

        // 🧩 Obtener hijos seguros
        const children = (subclasses.get(node) || []).filter(c => c !== node);
        children.sort();

        // ⚠️ Log de detección de ciclos directos
        if (children.includes(node)) {
            console.warn(`⚠️ Ciclo directo detectado en ${node}`);
        }

        // 🌳 Construcción recursiva
        return {
            name: node,
            children: children.map(c => buildTree(c, visited))
        };
    }



    const forest = roots.map(r => buildTree(r));
    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(OUTPUT_HIERARCHY, JSON.stringify(forest, null, 2), "utf8");
    console.log(`✅ Jerarquía exportada a ${OUTPUT_HIERARCHY}`);
}

// === 🧩 CONSTRUIR GRAFO ===
function buildOntology() {
    const ontology = {
        meta: {
            idPrefixes: prefixes,
            sources: INPUT_FILES,
            totalNodes: nodes.size,
            totalEdges: edges.length
        },
        relationTypes: Array.from(relationTypes),
        nodes: Array.from(nodes.values()),
        edges
    };

    fs.writeFileSync(OUTPUT_ONTOLOGY, JSON.stringify(ontology, null, 2), "utf8");
    console.log(`✅ Ontología exportada a ${OUTPUT_ONTOLOGY}`);
    console.log(`📊 Nodos: ${nodes.size} | Relaciones: ${edges.length}`);
}

// === 🚀 EJECUCIÓN ===
(function main() {
    INPUT_FILES.forEach(parseTTL);
    mergeEquivalentNodes();
    buildHierarchy();
    buildOntology();
})();
