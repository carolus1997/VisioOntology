// ui-panels.js
// Control centralizado de los paneles del visualizador
// Maneja el conmutador del panel derecho (Ontología / Composiciones / Catálogo)

window.UIPanels = (() => {

  function init() {
    console.log("🟦 [UIPanels] Inicializando paneles…");

    setupRightPanelSwitcher();

    console.log("🟩 [UIPanels] Paneles listos");
  }


  // ---------------------------------------------------------
  // 🔹 Conmutador de panel derecho
  // ---------------------------------------------------------
  function setupRightPanelSwitcher() {
    const buttons = document.querySelectorAll(".rps-btn");
    const panels = document.querySelectorAll(".rpanel");

    if (!buttons.length || !panels.length) {
      console.warn("⚠️ [UIPanels] No hay botones o paneles para el switcher");
      return;
    }

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;

        if (!target) {
          console.warn("⚠️ [UIPanels] Botón sin data-target");
          return;
        }

        // Quitar activo de todos los botones
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Ocultar todos los paneles
        panels.forEach(p => p.classList.remove("active"));

        // Mostrar panel target
        const panel = document.getElementById(target);
        if (panel) {
          panel.classList.add("active");
          console.log(`📘 [UIPanels] Cambiando a panel: ${target}`);
        } else {
          console.error(`❌ [UIPanels] No se encontró el panel: ${target}`);
        }
      });
    });
  }


  // ---------------------------------------------------------
  // API pública
  // ---------------------------------------------------------
  return {
    init
  };

})();
