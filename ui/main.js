(async function init() {
  await Descriptor.init('descriptor', '../data/ontology2.json');
  await DropdownTree.init('dropdown', '../data/class-hierarchy2.json');

  console.log('main loaded');

  if (window.TreeView && typeof TreeView.init === 'function') {
    console.log('🟢 Ejecutando TreeView.init manualmente');
    await TreeView.init('tree-chart', '../data/class-hierarchy2.json');
  }

  if (window.RelationGraph && typeof RelationGraph.init === 'function') {
    await RelationGraph.init('relation-graph', '../data/ontology2.json');
  }
})();
