// ui/descriptor-overlay.js
// v1.0 — Overlay a pantalla completa para el panel Descriptor

window.DescriptorOverlay = (() => {
  let overlay, closeBtn, content;

  function init() {
    overlay = document.createElement('div');
    overlay.id = 'descriptor-overlay';
    overlay.innerHTML = `
      <div id="descriptor-overlay-inner">
        <button id="descriptor-overlay-close">✕</button>
        <div id="descriptor-overlay-content">
          <div id="descriptor"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    closeBtn = overlay.querySelector('#descriptor-overlay-close');
    content = overlay.querySelector('#descriptor');

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) hide();
    });

    // Inicializamos Descriptor dentro del overlay
    // Ya no inicializamos otra instancia, reutilizamos el render global
    console.log('DescriptorOverlay enlazado al Descriptor global');


    console.log('DescriptorOverlay inicializado');
  }

  function show(nodeId) {
    if (!overlay) init();
    overlay.classList.add('visible');
    document.body.classList.add('no-scroll');

    // Llamamos a render si existe
    if (window.Descriptor?._render) {
      window.Descriptor._render(nodeId);
    }
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    document.body.classList.remove('no-scroll');
  }

  return { init, show, hide };
})();
