// Main application entry point.
document.addEventListener("DOMContentLoaded", function () {
  const modules = {
    BundleTypes: window.BundleTypes,
    templates: window.templates,
    appState: window.appState,
    UIElements: window.UIElements,
    EventHandlers: window.EventHandlers,
    ModalHandlers: window.ModalHandlers,
    DragDrop: window.DragDrop,
    FolderStructure: window.FolderStructure,
    SaveLoad: window.SaveLoad,
    Draft: window.Draft,
  };

  const missing = Object.keys(modules).filter((name) => !modules[name]);
  if (missing.length) {
    console.error("Extension Builder failed to start. Missing:", missing.join(", "));
    return;
  }

  // Every postfix in the table must be one pyRevit actually knows, otherwise
  // the type would be skipped silently on load.
  Object.keys(window.BundleTypes.types).forEach((id) => {
    if (!window.BundleTypes.isRealPostfix(window.BundleTypes.types[id].postfix)) {
      console.error(
        "Bundle type '" +
          id +
          "' uses postfix '" +
          window.BundleTypes.types[id].postfix +
          "', which pyRevit does not recognise."
      );
    }
  });

  // A draft from a previous visit wins over the blank default, so an
  // in-progress extension survives a reload. It is applied before the first
  // paint so the ribbon never flashes the default and then swap.
  const restored = window.Draft.restore();

  // Render the initial shell before icons arrive, so the app is usable even
  // if the icon files fail to load.
  window.EventHandlers.renderTabs();
  window.EventHandlers.activateTab(window.appState.activeTabId);
  window.FolderStructure.updateFolderPreview();

  window.UIElements.initialize();
  window.UIElements.setupPreviewDisclosure();
  window.SaveLoad.initialize();
  window.EventHandlers.initializeApp();

  if (!window.Draft.available()) {
    console.info(
      "Local storage is unavailable, so this session will not be remembered between reloads."
    );
  } else if (restored) {
    console.info("Restored your last draft. RESET discards it.");
  }

  // Do not lose the last few keystrokes to a closed tab.
  window.addEventListener("pagehide", () => window.Draft.saveNow());
  window.addEventListener("beforeunload", () => window.Draft.saveNow());

  if (typeof JSZip === "undefined") {
    console.warn("JSZip did not load; the DOWNLOAD button will not work.");
  }
});
