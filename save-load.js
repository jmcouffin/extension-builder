// Save and Load functionality for pyRevit Extension Builder
const SaveLoad = {
  /**
   * Saves the current extension state to a JSON file
   */
  saveExtension() {
    // Create a snapshot of the current state
    const stateSnapshot = {
      version: "1.0", // For future compatibility
      extensionName: document.getElementById("extensionName").value,
      tabs: window.appState.tabs,
      panels: window.appState.panels,
      elements: window.appState.elements,
      activeTabId: window.appState.activeTabId,
      nextIds: window.appState.nextIds,
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(stateSnapshot, null, 2);

    // Create file name based on extension name
    const extensionName = document
      .getElementById("extensionName")
      .value.replace(/\s+/g, "_")
      .toLowerCase();
    const fileName = `${extensionName}_layout.json`;

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.style.display = "none";

    // Add to DOM, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    console.log("Extension state saved to", fileName);
  },

  /**
   * Load an extension from a JSON file
   * @param {File} file - The JSON file to load
   * @returns {Promise} - Resolves when loading is complete
   */
  loadExtension(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonString = event.target.result;
          const loadedState = JSON.parse(jsonString);

          // Validate the loaded file
          if (!this.validateLoadedState(loadedState)) {
            reject(new Error("Invalid extension file format"));
            return;
          }

          // Apply the loaded state
          this.applyLoadedState(loadedState);
          resolve();
        } catch (error) {
          console.error("Error loading extension:", error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(error);
      };

      reader.readAsText(file);
    });
  },

  /**
   * Validates that the loaded state has the required structure
   * @param {Object} state - The loaded state object
   * @returns {Boolean} - True if valid, false otherwise
   */
  validateLoadedState(state) {
    // Basic validation
    if (!state || typeof state !== "object") return false;

    // Check for required properties
    const requiredProps = ["tabs", "panels", "elements", "extensionName"];
    for (const prop of requiredProps) {
      if (!state.hasOwnProperty(prop)) {
        console.error(`Missing required property: ${prop}`);
        return false;
      }
    }

    // Check tabs structure
    if (
      typeof state.tabs !== "object" ||
      Object.keys(state.tabs).length === 0
    ) {
      console.error("Invalid tabs structure");
      return false;
    }

    // Check panels structure
    if (
      typeof state.panels !== "object" ||
      Object.keys(state.panels).length === 0
    ) {
      console.error("Invalid panels structure");
      return false;
    }

    return true;
  },

  /**
   * Apply the loaded state to the application
   * @param {Object} state - The validated state to apply
   */
  applyLoadedState(state) {
    // Update extension name
    const extensionNameInput = document.getElementById("extensionName");
    if (extensionNameInput) {
      extensionNameInput.value = state.extensionName || "Loaded Extension";
    }

    // Replace state
    window.appState.tabs = state.tabs;
    window.appState.panels = state.panels;
    window.appState.elements = state.elements;
    window.appState.nextIds = state.nextIds || {
      tab:
        Math.max(
          ...Object.keys(state.tabs).map((id) =>
            parseInt(id.replace("tab", ""))
          )
        ) + 1,
      panel:
        Math.max(
          ...Object.keys(state.panels).map((id) =>
            parseInt(id.replace("panel", ""))
          )
        ) + 1,
      element:
        Math.max(
          ...Object.keys(state.elements).map((id) =>
            parseInt(id.replace("element", ""))
          )
        ) + 1,
    };

    // Set active tab
    window.appState.activeTabId =
      state.activeTabId || Object.keys(state.tabs)[0];

    // Refresh UI
    this.refreshUI();

    console.log("Extension loaded successfully");
  },

  /**
   * Refresh the UI after loading a new state
   */
  refreshUI() {
    // Rebuild tabs UI
    const tabsContainer = document.getElementById("tabsContainer");
    if (tabsContainer) {
      tabsContainer.innerHTML = ""; // Clear tabs

      // Create tab elements
      Object.keys(window.appState.tabs).forEach((tabId) => {
        const tab = window.appState.tabs[tabId];
        const tabElement = document.createElement("div");
        tabElement.className = "tab";
        tabElement.dataset.tabId = tabId;
        if (tabId === window.appState.activeTabId) {
          tabElement.classList.add("active");
        }

        tabElement.innerHTML = `<input type="text" class="tab-name" value="${tab.name}">`;

        // Add event listeners
        tabElement.addEventListener("click", () =>
          window.EventHandlers.activateTab(tabId)
        );

        tabElement
          .querySelector(".tab-name")
          .addEventListener("change", function () {
            const newName = this.value;
            const isDuplicate = Object.values(window.appState.tabs).some(
              (t) =>
                t.name.toLowerCase() === newName.toLowerCase() &&
                window.appState.tabs[tabId] !== t
            );

            if (isDuplicate) {
              alert("Tab name already exists. Please choose a different name.");
              this.value = window.appState.tabs[tabId].name;
              return;
            }

            window.appState.tabs[tabId].name = newName;
            window.FolderStructure.updateFolderPreview();
          });

        tabsContainer.appendChild(tabElement);
      });
    }

    // Update add panel button
    const addPanelButton = document.getElementById("addPanel");
    if (addPanelButton) {
      addPanelButton.dataset.tabId = window.appState.activeTabId;
    }

    // Render panels for the active tab
    window.UIElements.renderPanels();

    // Update folder preview
    window.FolderStructure.updateFolderPreview();
  },

  /**
   * Open the file selector for loading an extension
   */
  openFileSelector() {
    // Create a file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";

    // Add to DOM
    document.body.appendChild(fileInput);

    // Add change listener
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        this.loadExtension(file)
          .then(() => {
            // Success - notify user
            alert("Extension loaded successfully!");
          })
          .catch((error) => {
            // Error - notify user
            alert(`Error loading extension: ${error.message}`);
          });
      }

      // Clean up
      document.body.removeChild(fileInput);
    });

    // Trigger file selection dialog
    fileInput.click();
  },

  /**
   * Initialize save/load functionality
   */
  initialize() {
    // Add event listeners to existing buttons
    const saveButton = document.getElementById("saveConfig");
    const loadButton = document.getElementById("loadConfig");

    if (saveButton) {
      saveButton.addEventListener("click", () => this.saveExtension());
    }

    if (loadButton) {
      loadButton.addEventListener("click", () => this.openFileSelector());
    }

    console.log("Save/Load functionality initialized");
  },
};

// Export SaveLoad to be used by other modules
window.SaveLoad = SaveLoad;