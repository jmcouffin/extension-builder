// Event handlers for pyRevit Extension Builder
const EventHandlers = {
  /**
   * Initialize all event listeners for a button element
   */
  initializeButtonEvents(buttonElement) {
    if (!buttonElement) return;

    // Make button name editable with click
    const buttonName = buttonElement.querySelector(".button-name");
    if (buttonName) {
      buttonName.addEventListener("click", function (e) {
        e.stopPropagation(); // Prevent double-click from triggering
        const button = this.closest(".button");
        const currentText = this.textContent;
        this.innerHTML = `<input type="text" value="${currentText}">`;
        const input = this.querySelector("input");
        input.focus();

        input.addEventListener("blur", function () {
          const buttonId = button.dataset.buttonId;
          const newName = this.value;
          window.appState.elements[buttonId].name = newName;
          this.parentElement.textContent = newName;
          window.FolderStructure.updateFolderPreview();
        });

        input.addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
            this.blur();
          }
        });
      });
    }

    // Add double-click to edit button properties
    buttonElement.addEventListener("dblclick", function () {
      const buttonId = this.dataset.buttonId;
      window.ModalHandlers.editElement(buttonId);
    });
  },

  /**
   * Handle panel button actions (add button, add stack)
   */
  handlePanelAction(e) {
    const action = this.dataset.action;
    const panelId = this.dataset.panelId;

    if (action === "add-button") {
      window.ModalHandlers.openButtonModal("panel", panelId);
    } else if (action === "add-stack") {
      window.EventHandlers.createNewStack(panelId);
    }
  },

  /**
   * Creates a new stack directly with default buttons
   */
  createNewStack(panelId) {
    const panel = window.appState.panels[panelId];
    if (!panel) return;

    // Create a unique stack name
    let stackName = "NEW STACK";
    let counter = 1;
    let uniqueStackName = stackName;

    while (
      panel.elements.some((elementId) => {
        const element = window.appState.elements[elementId];
        return (
          element &&
          element.name.toLowerCase() === uniqueStackName.toLowerCase()
        );
      })
    ) {
      uniqueStackName = `${stackName} ${counter}`;
      counter++;
    }

    // Create stack element
    const stackId = `element${window.appState.nextIds.element++}`;

    // Create stack data
    window.appState.elements[stackId] = {
      type: "stack",
      name: uniqueStackName,
      title: "",
      tooltip: "",
      iconData: null,
      children: [],
      panelId: panelId,
    };

    // Add stack to panel
    window.appState.panels[panelId].elements.push(stackId);

    // Create default buttons for the stack
    for (let i = 0; i < 2; i++) {
      const buttonId = `element${window.appState.nextIds.element++}`;
      window.appState.elements[buttonId] = {
        type: "pushbutton",
        name: `Button ${i + 1}`,
        title: "",
        tooltip: "",
        code: "",
        iconData: null,
        parentId: stackId,
      };
      window.appState.elements[stackId].children.push(buttonId);
    }

    // Update UI
    window.UIElements.renderPanels();

    // Put stack name in edit mode
    setTimeout(() => {
      const stackElement = document.querySelector(
        `[data-button-id="${stackId}"]`
      );
      if (stackElement) {
        const stackNameEl = stackElement.querySelector(".stack-name");
        if (stackNameEl) {
          stackElement.classList.add("stack-edit-mode");
          const currentText = stackNameEl.textContent;
          stackNameEl.innerHTML = `<input type="text" value="${currentText}" style="width:90%;">`;
          const input = stackNameEl.querySelector("input");
          input.focus();
          input.select();

          input.addEventListener("blur", function () {
            const newName = this.value || "NEW STACK";
            // Check for duplicate stack names in the panel
            const isDuplicate = panel.elements.some((elementId) => {
              if (elementId === stackId) return false; // Skip this stack
              const element = window.appState.elements[elementId];
              return (
                element && element.name.toLowerCase() === newName.toLowerCase()
              );
            });

            if (isDuplicate) {
              alert(
                "A stack with this name already exists in this panel. Please choose a different name."
              );
              this.focus();
              return;
            }

            window.appState.elements[stackId].name = newName;
            stackNameEl.textContent = newName;
            stackElement.classList.remove("stack-edit-mode");
            window.FolderStructure.updateFolderPreview();
          });

          input.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
              this.blur();
            }
          });
        }
      }
    }, 100);

    // Update folder preview
    window.FolderStructure.updateFolderPreview();
  },

  /**
   * Activates a tab and displays its panels
   */
  activateTab(tabId) {
    // Update state
    window.appState.activeTabId = tabId;

    // Update UI
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active");
      if (tab.dataset.tabId === tabId) {
        tab.classList.add("active");
      }
    });

    // Update add panel button
    document.getElementById("addPanel").dataset.tabId = tabId;

    // Hide pulldown content if open
    const pulldownContent = document.getElementById("pulldownContentContainer");
    if (pulldownContent) {
      pulldownContent.style.display = "none";
    }

    // Display panels for this tab
    window.UIElements.renderPanels();
  },

  /**
   * Adds a new tab to the UI
   */
  addNewPanel() {
    const tabId = window.appState.activeTabId;
    const panelId = `panel${window.appState.nextIds.panel++}`;

    // Check if panel name already exists in this tab
    const panelName = "NEW PANEL";
    let uniquePanelName = panelName;
    let counter = 1;

    while (
      window.appState.tabs[tabId].panels.some(
        (pid) =>
          window.appState.panels[pid].name.toLowerCase() ===
          uniquePanelName.toLowerCase()
      )
    ) {
      uniquePanelName = `${panelName} ${counter}`;
      counter++;
    }

    // Create panel data
    window.appState.panels[panelId] = {
      name: uniquePanelName,
      elements: [],
      tabId: tabId,
    };

    // Add to tab
    window.appState.tabs[tabId].panels.push(panelId);

    // Add a default button to the panel
    const buttonId = `element${window.appState.nextIds.element++}`;
    window.appState.elements[buttonId] = {
      type: "pushbutton",
      name: "Button 1", // Changed from 'NEW BUTTON' to 'Button 1'
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      panelId: panelId,
    };
    window.appState.panels[panelId].elements.push(buttonId);

    // Render panels
    window.UIElements.renderPanels();

    // Update folder preview
    window.FolderStructure.updateFolderPreview();
  },

  /**
   * Adds a new panel to the active tab
   */
  addNewPanel() {
    const tabId = window.appState.activeTabId;
    const panelId = `panel${window.appState.nextIds.panel++}`;

    // Check if panel name already exists in this tab
    const panelName = "NEW PANEL";
    let uniquePanelName = panelName;
    let counter = 1;

    while (
      window.appState.tabs[tabId].panels.some(
        (pid) =>
          window.appState.panels[pid].name.toLowerCase() ===
          uniquePanelName.toLowerCase()
      )
    ) {
      uniquePanelName = `${panelName} ${counter}`;
      counter++;
    }

    // Create panel data
    window.appState.panels[panelId] = {
      name: uniquePanelName,
      elements: [],
      tabId: tabId,
    };

    // Add to tab
    window.appState.tabs[tabId].panels.push(panelId);

    // Add a default button to the panel
    const buttonId = `element${window.appState.nextIds.element++}`;
    window.appState.elements[buttonId] = {
      type: "pushbutton",
      name: "NEW BUTTON",
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      panelId: panelId,
    };
    window.appState.panels[panelId].elements.push(buttonId);

    // Render panels
    window.UIElements.renderPanels();

    // Update folder preview
    window.FolderStructure.updateFolderPreview();
  },
  /**
   * Adds a new tab to the UI
   */
  addNewTab() {
    const tabId = `tab${window.appState.nextIds.tab++}`;
    const tabsContainer = document.getElementById("tabsContainer");

    // Create tab data with same structure as default tab
    window.appState.tabs[tabId] = {
      name: "NEW TAB",
      panels: [],
    };

    // Create UI element
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.tabId = tabId;
    tab.innerHTML = `<input type="text" class="tab-name" value="NEW TAB">`;

    // Add event listeners
    tab.addEventListener("click", () =>
      window.EventHandlers.activateTab(tabId)
    );
    tab.querySelector(".tab-name").addEventListener("change", function () {
      // Check for duplicate tab names
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

    // Add to DOM
    tabsContainer.appendChild(tab);

    // Create a default panel like the first tab
    const panelId = `panel${window.appState.nextIds.panel++}`;
    window.appState.panels[panelId] = {
      name: "NEW PANEL",
      elements: [],
      tabId: tabId,
    };
    window.appState.tabs[tabId].panels.push(panelId);

    // Create default button for new panel
    const buttonId = `element${window.appState.nextIds.element++}`;
    window.appState.elements[buttonId] = {
      type: "pushbutton",
      name: "Button 1", // Changed from 'NEW BUTTON' to 'Button 1'
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      panelId: panelId,
    };
    window.appState.panels[panelId].elements.push(buttonId);

    // Activate the new tab
    window.EventHandlers.activateTab(tabId);

    // Update folder preview
    window.FolderStructure.updateFolderPreview();
  },

  /**
   * Initialize all event handlers for the application
   */
  // Modify this section in your event-handlers.js file

/**
 * Initialize all event handlers for the application
 */
initializeApp() {
    // DOM elements
    const extensionNameInput = document.getElementById("extensionName");

    // Event listeners for main UI controls
    document.getElementById("addTab").addEventListener("click", this.addNewTab);
    document
      .getElementById("addPanel")
      .addEventListener("click", this.addNewPanel);

    // IMPORTANT: Make sure the download button event is properly bound
    const downloadButton = document.getElementById("downloadZip");
    if (downloadButton) {
      downloadButton.addEventListener("click", function () {
        console.log("Download button clicked");
        if (
          window.FolderStructure &&
          typeof window.FolderStructure.generateZipFile === "function"
        ) {
          window.FolderStructure.generateZipFile();
        } else {
          alert(
            "ZIP generation function not available. Check console for errors."
          );
        }
      });
    }

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabId = tab.dataset.tabId;
        this.activateTab(tabId);
      });
    });

    // Modal event listeners
    document
      .querySelector(".close-modal")
      .addEventListener("click", window.ModalHandlers.closeModal);
    document
      .querySelector(".cancel-button")
      .addEventListener("click", window.ModalHandlers.closeModal);
    document
      .getElementById("createButton")
      .addEventListener("click", window.ModalHandlers.createNewElement);
    document
      .getElementById("buttonIcon")
      .addEventListener("change", window.ModalHandlers.previewIcon);

    // Add keyboard event for the buttonName input to support Enter key
    document
      .getElementById("buttonName")
      .addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.ModalHandlers.createNewElement();
        }
      });

    // Add keyboard event for the buttonTitle input to support Enter key
    document
      .getElementById("buttonTitle")
      .addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.ModalHandlers.createNewElement();
        }
      });

    // Add keyboard event for the buttonTooltip input to support Enter key
    document
      .getElementById("buttonTooltip")
      .addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.ModalHandlers.createNewElement();
        }
      });

    document.querySelectorAll(".button-type").forEach((type) => {
      type.addEventListener("click", () =>
        window.ModalHandlers.selectButtonType(type)
      );
    });

    // Add event listeners for panel buttons
    document
      .querySelectorAll('[data-action="add-button"], [data-action="add-stack"]')
      .forEach((button) => {
        button.addEventListener("click", this.handlePanelAction);
      });

    // Initialize event listeners for the default button
    this.initializeButtonEvents(document.querySelector(".button"));

    // Set up extensions name change listener
    extensionNameInput.addEventListener("change", function () {
      window.FolderStructure.updateFolderPreview();
    });

    // Make tab name editable
    document.querySelector(".tab-name").addEventListener("change", function () {
      const tabId = this.closest(".tab").dataset.tabId;
      window.appState.tabs[tabId].name = this.value;
      window.FolderStructure.updateFolderPreview();
    });

    // Make panel name editable
    document
      .querySelector(".panel-name")
      .addEventListener("change", function () {
        const panelId = this.closest(".panel").dataset.panelId;
        window.appState.panels[panelId].name = this.value;
        window.FolderStructure.updateFolderPreview();
      });

    // Setup initial folder preview
    window.FolderStructure.updateFolderPreview();

    // Setup drag and drop functionality
    window.DragDrop.setupDragAndDrop();
    
    // Add tab delete buttons
    if (window.UIElements && typeof window.UIElements.addTabDeleteButton === 'function') {
        window.UIElements.addTabDeleteButton();
    }
    
    // Setup document click handler for closing pulldowns
    if (window.UIElements && typeof window.UIElements.setupDocumentClickHandler === 'function') {
        window.UIElements.setupDocumentClickHandler();
    }

    // Log initialization success
    console.log("Event handlers initialized successfully");
    console.log(
      "JSZip availability:",
      typeof JSZip !== "undefined" ? "Available" : "Not Available"
    );
  },
};

// Export Event Handlers to be used by other modules
window.EventHandlers = EventHandlers;
