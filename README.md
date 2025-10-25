VisioOntology/
 ├─ core/
 │   ├─ core-ontology-schema_v03.ttl
 │   └─ core-ontology-concepts_v0.7.ttl
 │
 ├─ data/
 │   ├─ ontology_mim.json
 │   ├─ ontology_cyberdem.json
 │   ├─ ontology_propio.json
 │   ├─ hierarchy_mim.json
 │   ├─ hierarchy_cyberdem.json
 │   ├─ hierarchy_propio.json
 │   ├─ ontology_merged.json
 │   ├─ hierarchy_merged.json
 │   └─ class-hierarchy_final.json
 │
 ├─ ui/
 │   ├─ descriptor.js
 │   ├─ tree-view.js
 │   ├─ dropdown-tree.js
 │   ├─ relation-graph.js
 │   └─ main.js
 │
 ├─ build/
 │   ├─ build-ontologies.js          # Fase 1
 │   ├─ build-hierarchies.js         # Fase 2
 │   ├─ merge-ontologies.js          # Fase 3
 │   ├─ merge-hierarchies.js         # Fase 4
 │   └─ main-pipeline.js             # Orquestador
 │
 ├─ ttl-to-json.js
 ├─ ttl-hierarchy-builder.js
 ├─ hierarchy-by-origin.js
 ├─ index.html
 ├─ package.json
 └─ README.md
