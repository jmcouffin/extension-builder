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

  // Render the initial shell before icons arrive, so the app is usable even
  // if icon.png fails to load.
  window.EventHandlers.renderTabs();
  window.EventHandlers.activateTab(window.appState.activeTabId);
  window.FolderStructure.updateFolderPreview();

  window.UIElements.initialize();
  window.SaveLoad.initialize();
  window.EventHandlers.initializeApp();

  if (typeof JSZip === "undefined") {
    console.warn("JSZip did not load; the DOWNLOAD button will not work.");
  }
});
