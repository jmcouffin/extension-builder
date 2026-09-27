// Event handlers for pyRevit Extension Builder
const EventHandlers = {
  // ---------------------------------------------------------------------------
  // Panel actions
  // ---------------------------------------------------------------------------

  handlePanelAction(e) {
    const action = this.dataset.action;
    const panelId = this.dataset.panelId;

    if (action === "add-button") {
      window.ModalHandlers.openButtonModal("panel", panelId);
    } else if (action === "add-stack") {
      // `this` is the button that was clicked, not this module.
      window.EventHandlers.createNewStack(panelId);
    } else if (action === "add-group") {
      window.ModalHandlers.openGroupModal(panelId);
    }
  },

  /**
   * A stack starts life with the two commands pyRevit needs to render it at
   * all (StackBuilder.cs:80 skips a stack with fewer than 2 visible children).
   */
  createNewStack(panelId) {
    const panel = window.appState.panels[panelId];
    if (!panel) return;

    const stackId = "element" + window.appState.nextIds.element++;
    const stack = {
      type: "stack",
      name: this.uniquePanelSiblingName(panelId, "NEW STACK"),
      title: "",
      tooltip: "",
      iconData: null,
      children: [],
      panelId: panelId,
    };
    window.appState.elements[stackId] = stack;
    panel.elements.push(stackId);

    for (let i = 0; i < window.BundleTypes.get("stack").minChildren; i++) {
      const childId = "element" + window.appState.nextIds.element++;
      window.appState.elements[childId] = {
        type: "pushbutton",
        name: "Button " + (i + 1),
        title: "",
        tooltip: "",
        code: "",
        iconData: null,
        parentId: stackId,
      };
      stack.children.push(childId);
    }

    window.UIElements.renderPanels();
    window.FolderStructure.updateFolderPreview();
  },

  /** First free "NAME", "NAME 1", "NAME 2"... among a panel's elements. */
  uniquePanelSiblingName(panelId, base) {
    const panel = window.appState.panels[panelId];
    const taken = (panel.elements || []).map((id) => {
      const el = window.appState.elements[id];
      return el ? (el.name || "").toLowerCase() : "";
    });

    if (taken.indexOf(base.toLowerCase()) === -1) return base;
    let counter = 1;
    while (taken.indexOf((base + " " + counter).toLowerCase()) !== -1) counter++;
    return base + " " + counter;
  },

  // ---------------------------------------------------------------------------
  // Tabs and panels
  // ---------------------------------------------------------------------------

  activateTab(tabId) {
    if (!window.appState.tabs[tabId]) return;
    window.appState.activeTabId = tabId;

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tabId === tabId);
    });

    const addPanelButton = document.getElementById("addPanel");
    if (addPanelButton) addPanelButton.dataset.tabId = tabId;

    window.UIElements.renderPanels();
  },

  addNewTab() {
    const tabId = "tab" + window.appState.nextIds.tab++;
    const tabName = this.uniqueTabName("NEW TAB");

    window.appState.tabs[tabId] = { name: tabName, panels: [] };

    // Every tab needs a panel; an empty tab never appears in pyRevit.
    const panelId = "panel" + window.appState.nextIds.panel++;
    window.appState.panels[panelId] = {
      name: "NEW PANEL",
      elements: [],
      tabId: tabId,
    };
    window.appState.tabs[tabId].panels.push(panelId);

    const buttonId = "element" + window.appState.nextIds.element++;
    window.appState.elements[buttonId] = {
      type: "pushbutton",
      name: "Button 1",
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      panelId: panelId,
    };
    window.appState.panels[panelId].elements.push(buttonId);

    this.renderTabs();
    this.activateTab(tabId);
    window.FolderStructure.updateFolderPreview();
  },

  addNewPanel() {
    const tabId = window.appState.activeTabId;
    const tab = window.appState.tabs[tabId];
    if (!tab) return;

    const panelId = "panel" + window.appState.nextIds.panel++;
    window.appState.panels[panelId] = {
      // Two panels with the same name in one tab become the same folder.
      name: this.uniquePanelName(tabId, "NEW PANEL"),
      elements: [],
      tabId: tabId,
    };
    tab.panels.push(panelId);

    const buttonId = "element" + window.appState.nextIds.element++;
    window.appState.elements[buttonId] = {
      type: "pushbutton",
      name: "Button 1",
      title: "",
      tooltip: "",
      code: "",
      iconData: null,
      iconDarkData: null,
      panelId: panelId,
    };
    window.appState.panels[panelId].elements.push(buttonId);

    window.UIElements.renderPanels();
    window.FolderStructure.updateFolderPreview();
  },

  /** First free "NAME", "NAME 1", "NAME 2"... among a tab's panels. */
  uniquePanelName(tabId, base) {
    const tab = window.appState.tabs[tabId];
    const taken = (tab.panels || []).map((pid) => {
      const panel = window.appState.panels[pid];
      return panel ? (panel.name || "").toLowerCase() : "";
    });
    if (taken.indexOf(base.toLowerCase()) === -1) return base;
    let counter = 1;
    while (taken.indexOf((base + " " + counter).toLowerCase()) !== -1) counter++;
    return base + " " + counter;
  },

  uniqueTabName(base) {
    const taken = Object.keys(window.appState.tabs).map((id) =>
      window.appState.tabs[id].name.toLowerCase()
    );
    if (taken.indexOf(base.toLowerCase()) === -1) return base;
    let counter = 1;
    while (taken.indexOf((base + " " + counter).toLowerCase()) !== -1) counter++;
    return base + " " + counter;
  },

  /** Rebuild the tab strip. All tab markup is built here, once. */
  renderTabs() {
    const container = document.getElementById("tabsContainer");
    container.innerHTML = "";

    Object.keys(window.appState.tabs).forEach((tabId) => {
      const tab = window.appState.tabs[tabId];
      const tabElement = document.createElement("div");
      tabElement.className = "tab";
      tabElement.dataset.tabId = tabId;
      if (tabId === window.appState.activeTabId) {
        tabElement.classList.add("active");
      }
      tabElement.style.position = "relative";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "tab-name";
      input.value = tab.name;
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", () => {
        const newName = input.value.trim();
        if (!newName) {
          input.value = window.appState.tabs[tabId].name;
          return;
        }
        const isDuplicate = Object.keys(window.appState.tabs).some((otherId) => {
          if (otherId === tabId) return false;
          return (
            window.appState.tabs[otherId].name.toLowerCase() === newName.toLowerCase()
          );
        });
        if (isDuplicate) {
          alert("Tab name already exists. Please choose a different name.");
          input.value = window.appState.tabs[tabId].name;
          return;
        }
        window.appState.tabs[tabId].name = newName;
        window.FolderStructure.updateFolderPreview();
      });
      tabElement.appendChild(input);

      const deleteButton = document.createElement("button");
      deleteButton.className = "tab-delete-button";
      deleteButton.title = "Delete Tab";
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        window.UIElements.handleDelete(tabId, "tab");
        this.renderTabs();
      });
      tabElement.appendChild(deleteButton);

      tabElement.addEventListener("click", () => this.activateTab(tabId));
      container.appendChild(tabElement);
    });
  },

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  initializeApp() {
    document.getElementById("addTab").addEventListener("click", () => {
      this.addNewTab();
    });
    document.getElementById("addPanel").addEventListener("click", () => {
      this.addNewPanel();
    });
    document.getElementById("downloadZip").addEventListener("click", () => {
      window.FolderStructure.generateZipFile();
    });

    const extensionNameInput = document.getElementById("extensionName");
    extensionNameInput.addEventListener("change", () => {
      window.FolderStructure.updateFolderPreview();
    });

    // Modal shell
    document.querySelector(".close-modal").addEventListener("click", () => {
      window.ModalHandlers.closeModal();
    });
    document.querySelector(".cancel-button").addEventListener("click", () => {
      window.ModalHandlers.closeModal();
    });
    document.getElementById("createButton").addEventListener("click", () => {
      window.ModalHandlers.createNewElement();
    });

    window.ModalHandlers.bindIconInput("buttonIcon", "iconPreview");

    // One Enter handler for the whole modal. The old code bound Enter on three
    // separate inputs plus a document-level listener, so a single Enter could
    // create the same command two or three times.
    document.getElementById("buttonModal").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "TEXTAREA") return;
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      window.ModalHandlers.createNewElement();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("buttonModal");
      if (modal.style.display === "block") {
        e.preventDefault();
        window.ModalHandlers.closeModal();
      }
    });

    this.renderTabs();
    window.FolderStructure.updateFolderPreview();
    window.DragDrop.setupDragAndDrop();
    window.UIElements.setupDocumentClickHandler();
  },
};

window.EventHandlers = EventHandlers;
