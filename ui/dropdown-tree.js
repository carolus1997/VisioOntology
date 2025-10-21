// ui/dropdown-tree.js
// v3.8 — expansión total sin cortes (transición altura real + recalculado)

window.DropdownTree = (() => {
  let container;

  async function init(containerId = 'dropdown', hierarchyPath = '../data/class-hierarchy2.json') {
    container = document.getElementById(containerId);
    if (!container) return console.error('[DropdownTree] No se encontró el contenedor');

    try {
      const res = await fetch(hierarchyPath);
      const data = await res.json();
      const roots = Array.isArray(data) ? data : [data];
      container.innerHTML = '';

      // === Cabecera ===
      const header = document.createElement('div');
      header.id = 'dropdown-header';

      const title = document.createElement('div');
      title.id = 'dropdown-title';
      title.textContent = 'Contenidos indexados';

      const resetBtn = document.createElement('button');
      resetBtn.id = 'dropdown-reset';
      resetBtn.textContent = '⟳';
      resetBtn.title = 'Reiniciar árbol';
      resetBtn.addEventListener('click', () => collapseAll());

      header.appendChild(title);
      header.appendChild(resetBtn);
      container.appendChild(header);

      // === Árbol jerárquico ===
      const tree = buildTree(roots);
      container.appendChild(tree);

      // Sincronización con TreeView
      window.addEventListener('node:select', (e) => highlightNode(e.detail?.id));

    } catch (err) {
      console.error('[DropdownTree] Error cargando jerarquía:', err);
      container.innerHTML = `<p>⚠️ No se pudo cargar la jerarquía.</p>`;
    }
  }

  // === Construcción recursiva ===
  function buildTree(nodes) {
    const ul = document.createElement('ul');
    ul.classList.add('dropdown-tree');

    nodes.forEach(node => {
      const li = document.createElement('li');

      if (node.children && node.children.length) {
        const toggle = document.createElement('span');
        toggle.classList.add('toggle');
        toggle.textContent = '▶';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleNode(li);
        });
        li.appendChild(toggle);
      } else {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        dot.textContent = '•';
        li.appendChild(dot);
      }

      const label = document.createElement('span');
      label.classList.add('node-label');
      label.textContent = node.name;
      label.dataset.nodeId = node.id || ('CAT_' + node.name);
      label.addEventListener('click', () => {
        console.log(`📂 Nodo desde DropdownTree: ${node.name}`);
        window.dispatchEvent(new CustomEvent('dropdown:change', { detail: { root: node.name } }));
      });
      li.appendChild(label);

      if (node.children && node.children.length) {
        const childUL = buildTree(node.children);
        li.appendChild(childUL);
      }

      ul.appendChild(li);
    });

    return ul;
  }

  // === 🌀 Animación altura real ===
  function toggleNode(li) {
    const ul = li.querySelector(':scope > ul');
    const isExpanding = !li.classList.contains('expanded');

    if (isExpanding) {
      // Cerrar hermanos
      const siblings = Array.from(li.parentElement.children).filter(x => x !== li);
      siblings.forEach(sib => collapseBranch(sib));

      // Abrir rama actual
      li.classList.add('expanded');
      if (ul) animateHeight(ul, true);
    } else {
      collapseBranch(li);
    }
  }

  function collapseBranch(li) {
    const ul = li.querySelector(':scope > ul');
    li.classList.remove('expanded');
    if (ul) animateHeight(ul, false);

    ul?.querySelectorAll('li.expanded').forEach(child => {
      child.classList.remove('expanded');
      const cul = child.querySelector(':scope > ul');
      if (cul) {
        cul.style.height = '0px';
        cul.style.overflow = 'hidden';
      }
    });
  }

  // === Animación precisa usando altura real ===
  function animateHeight(el, expanding) {
    el.style.overflow = 'hidden';
    if (expanding) {
      const start = el.offsetHeight;
      el.style.height = 'auto';
      const end = el.offsetHeight;
      el.style.height = start + 'px';
      requestAnimationFrame(() => {
        el.style.height = end + 'px';
      });
    } else {
      const start = el.offsetHeight;
      el.style.height = start + 'px';
      requestAnimationFrame(() => {
        el.style.height = '0px';
      });
    }

    el.addEventListener('transitionend', () => {
      if (expanding) {
        el.style.height = 'auto';
      }
    }, { once: true });
  }

  function collapseAll() {
    container.querySelectorAll('li.expanded').forEach(li => collapseBranch(li));
  }

  // === 🟢 Resaltar desde TreeView ===
  function highlightNode(nodeId) {
    if (!container || !nodeId) return;

    container.querySelectorAll('.node-label.selected').forEach(el => el.classList.remove('selected'));
    const target = container.querySelector(`[data-node-id="${nodeId}"]`);
    if (!target) return;

    target.classList.add('selected');

    // Expandir padres
    let parent = target.parentElement;
    while (parent && parent !== container) {
      if (parent.tagName === 'LI' && !parent.classList.contains('expanded')) {
        parent.classList.add('expanded');
        const ul = parent.querySelector(':scope > ul');
        if (ul) {
          ul.style.height = 'auto';
        }
      }
      parent = parent.parentElement;
    }

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  return { init };
})();
