// ttl-hierarchy-builder_v4.js — integración y jerarquía fusionada CyberDEM v0.7
import fs from "fs";
import { Parser } from "n3";

// === ⚙️ CONFIG ===
const INPUT_FILES = [
    "./core-ontology-schema_v06.ttl",
    "./core-ontology-concepts_v0.12.ttl"
];
const OUTPUT_HIERARCHY = "./data/class-hierarchy3.json";
const OUTPUT_ONTOLOGY = "./data/ontology3.json";

// === 🔧 AUXILIARES ===
function simplify(uri) {
    if (!uri) return uri;
    return uri
        .replace(/^.*[#/]/, "")
        .replace(/_/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
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
const relationTypes = new Set();

function ensureNode(id, rawName, kind = "category") {
    if (!nodes.has(id)) {
        nodes.set(id, { id, name: simplify(rawName), rawName, kind });
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
        const rawSubject = t.subject?.value?.replace(/^.*[#/]/, "") || null;
        const rawObject = t.object?.value?.replace(/^.*[#/]/, "") || null;

        const s = simplify(rawSubject);
        const p = simplify(t.predicate?.value);
        const o = rawObject ? simplify(rawObject) : null;

        const oLiteral = t.object?.termType === "Literal";

        // --- Clases ---
        if (p === "type" && ["Class", "OwlClass", "RdfsClass"].includes(o)) {
            ensureNode(prefixes.category + s, rawSubject);
            allClasses.add(rawSubject);
            continue;
        }

        // --- Subclases ---
        if (p === "subClassOf") {
            const parentId = addPrefixIfMissing(prefixes.category + o);
            const childId = addPrefixIfMissing(prefixes.category + s);

            ensureNode(parentId, rawObject);
            ensureNode(childId, rawSubject);

            edges.push({ source: childId, target: parentId, type: "is_a" });
            relationTypes.add("is_a");

            allClasses.add(rawSubject);
            allClasses.add(rawObject);

            if (!subclasses.has(rawObject)) subclasses.set(rawObject, []);
            subclasses.get(rawObject).push(rawSubject);

            continue;
        }

        // --- Propiedades RDF/OWL ---
        if (
            p === "type" &&
            ["ObjectProperty", "DatatypeProperty", "Property"].includes(o)
        ) {
            const id = prefixes.relation + s;
            ensureNode(id, rawSubject, "relation");
            relationTypes.add(s);
            continue;
        }

        // --- Dominios y rangos ---
        if (p === "domain") {
            const source = addPrefixIfMissing(prefixes.category + o);
            const target = addPrefixIfMissing(prefixes.relation + s);
            ensureNode(source, rawObject);
            ensureNode(target, rawSubject, "relation");
            edges.push({ source, target, type: "domainOf" });
            relationTypes.add("domainOf");
            continue;
        }

        if (p === "range") {
            const source = addPrefixIfMissing(prefixes.relation + s);
            const target = addPrefixIfMissing(prefixes.category + o);
            ensureNode(source, rawSubject, "relation");
            ensureNode(target, rawObject);
            edges.push({ source, target, type: "rangeOf" });
            relationTypes.add("rangeOf");
            continue;
        }

        // --- Etiquetas y descripciones ---
        if (["label"].includes(p)) {
            const node = ensureNode(prefixes.category + s, rawSubject);
            node.label = t.object.value;
            continue;
        }

        if (["comment", "description"].includes(p)) {
            const node = ensureNode(prefixes.category + s, rawSubject);
            node.description = t.object.value;
            continue;
        }

        // --- Literales generales ---
        if (oLiteral && !p.startsWith("rdf") && !p.startsWith("owl")) {
            const node = ensureNode(prefixes.category + s, rawSubject);
            node[p] = t.object.value;
            continue;
        }

        // --- Relaciones genéricas ---
        if (s && o && s !== o && !p.startsWith("rdf") && !p.startsWith("owl")) {
            const source = addPrefixIfMissing(prefixes.category + s);
            const target = addPrefixIfMissing(prefixes.category + o);
            ensureNode(source, rawSubject);
            ensureNode(target, rawObject);
            edges.push({ source, target, type: p });
            relationTypes.add(p);
        }
    }
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

    let roots = rootsCandidates.filter(c => allClasses.has(c));
    if (roots.length === 0) roots = rootsCandidates;

    // === 🧼 LIMPIADOR DEFINITIVO DE NOMBRES ===

    const baseClassesProtect = [
        "Facility",
        "Feature",
        "Organisation",
        "Group",
        "Person",
        "Actor",
        "Object",
        "Materiel",
        "CyberObject"
    ];

    function cleanRawClassName(rawName, parentRawName = null) {
        if (!rawName) return "";

        let name = rawName;

        // 1) Quitar prefijos "_"
        name = name.replace(/^_+/, "");

        // 2) Quitar patrón Padre_Hijo
        if (parentRawName && name.startsWith(parentRawName + "_")) {
            name = name.slice((parentRawName + "_").length);
        }

        // 3) Quitar sufijo del padre concatenado
        if (parentRawName && name.startsWith(parentRawName)) {
            name = name.slice(parentRawName.length);
        }

        // 4) Si es clase base protegida → no limpiar semántica
        if (baseClassesProtect.includes(rawName)) {
            return rawName;
        }

        // 5) Limpiar sufijos SEMÁNTICOS SOLO A LOS HIJOS
        name = name
            .replace(/Facility$/, "")
            .replace(/Feature$/, "")
            .replace(/Organisation$/, "")
            .replace(/GroupOrganisation$/, "Group")
            .replace(/Group$/, "")
            .replace(/Event$/, "")
            .replace(/Unit$/, "")
            .replace(/Post$/, "")
            .replace(/Site$/, "")
            .replace(/Type$/, "")
            .replace(/Struct$/, "")
            .replace(/Service$/, "")
            .replace(/Component$/, "")
            .trim();

        // 6) Si se quedó vacío → dejar el rawName
        if (!name) name = rawName;

        return name;
    }

    // construcción recursiva
    function buildTree(nodeRaw, parentRaw = null, visited = new Set()) {
        if (!nodeRaw || visited.has(nodeRaw))
            return { name: nodeRaw + " (loop)" };

        visited.add(nodeRaw);

        const childrenRaw = (subclasses.get(nodeRaw) || []).filter(c => c !== nodeRaw);
        childrenRaw.sort();

        const displayName = cleanRawClassName(nodeRaw, parentRaw);

        return {
            name: displayName,
            id: nodeRaw, // si quieres ID explícito
            children: childrenRaw.map(c => buildTree(c, nodeRaw, visited))
        };

    }

    const forest = roots.map(r => buildTree(r, null));
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
}

// === 🚀 EJECUCIÓN ===
(function main() {
    INPUT_FILES.forEach(parseTTL);
    buildHierarchy();
    buildOntology();
})();
