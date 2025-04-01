// UI Element creation and management for pyRevit Extension Builder
const UIElements = {
  // Store default icon paths
  defaultIconPath: "icon.png",
  defaultDarkIconPath: "icon.dark.png",

  // Store loaded icon data
  defaultIconData: null,
  defaultDarkIconData: null,

  /**
   * Initialize by loading default icons
   */
  initialize() {
    // Load default icons
    this.loadDefaultIcons();
  },

  togglePulldownContent: function (pulldownId, pulldownElement) {
    const pulldownContentContainer = document.getElementById(
      "pulldownContentContainer"
    );

    // If the pulldown content is already shown for this pulldown, hide it
    if (
      window.appState.activePulldown === pulldownId &&
      pulldownContentContainer.style.display === "block"
    ) {
      pulldownContentContainer.style.display = "none";
      window.appState.activePulldown = null;
      return;
    }

    // Otherwise show the content for this pulldown
    this.showPulldownContent(pulldownId, pulldownElement);
  },

  /**
   * Load default icons from the root
   */
  loadDefaultIcons() {
    // Load default icon
    fetch(this.defaultIconPath)
      .then((response) => {
        if (!response.ok) {
          console.warn(
            `Default icon ${this.defaultIconPath} not found, using placeholder`
          );
          return null;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob) return;

        const reader = new FileReader();
        reader.onload = () => {
          this.defaultIconData = reader.result;
          // Refresh UI to update all buttons with the default icon
          this.renderPanels();
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error(`Error loading default icon:`, error);
      });

    // Also load dark icon if needed
    fetch(this.defaultDarkIconPath)
      .then((response) => {
        if (!response.ok) {
          console.warn(
            `Default dark icon ${this.defaultDarkIconPath} not found`
          );
          return null;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob) return;

        const reader = new FileReader();
        reader.onload = () => {
          this.defaultDarkIconData = reader.result;
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error(`Error loading default dark icon:`, error);
      });
  },

  /**
   * Get icon data for an element (use default if none set)
   */
  getIconData(element) {
    if (element.iconData) {
      return element.iconData;
    }

    // Use default icon if available, otherwise use placeholder
    return (
      this.defaultIconData ||
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg=="
    );
  },

  /**
   * Creates a panel DOM element
   */
  createPanelElement(panelId, panel) {
    const panelElement = document.createElement("div");
    panelElement.className = "panel";
    panelElement.dataset.panelId = panelId;
    panelElement.dataset.tabId = panel.tabId;
    panelElement.style.position = "relative"; // For absolute positioning of delete button

    // Create panel content
    const panelContent = document.createElement("div");
    panelContent.className = "panel-content";
    panelContent.id = `panelContent${panelId.replace("panel", "")}`;

    // Add elements to panel
    panel.elements.forEach((elementId) => {
      const element = window.appState.elements[elementId];
      const elementElement = this.createElementElement(elementId, element);
      panelContent.appendChild(elementElement);
    });

    // Create panel controls
    const panelControls = document.createElement("div");
    panelControls.className = "panel-controls";
    panelControls.innerHTML = `
            <button class="add-button" data-panel-id="${panelId}" data-action="add-button">
                <span class="plus">+</span> NEW BUTTON
            </button>
            <button class="add-button" data-panel-id="${panelId}" data-action="add-stack">
                <span class="plus">+</span> NEW STACK
            </button>
        `;

    // Add event listeners to controls
    panelControls.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", window.EventHandlers.handlePanelAction);
    });

    // Create panel name container
    const panelNameContainer = document.createElement("div");
    panelNameContainer.className = "panel-name-container";
    panelNameContainer.innerHTML = `<input type="text" class="panel-name" value="${panel.name}">`;

    // Add event listener to panel name
    panelNameContainer
      .querySelector(".panel-name")
      .addEventListener("change", function () {
        const newName = this.value;

        // Check for duplicate panel names in the same tab
        const tabId = panel.tabId;
        const isDuplicate = window.appState.tabs[tabId].panels.some((pid) => {
          if (pid === panelId) return false; // Skip the current panel
          return (
            window.appState.panels[pid].name.toLowerCase() ===
            newName.toLowerCase()
          );
        });

        if (isDuplicate) {
          alert(
            "Panel name already exists in this tab. Please choose a different name."
          );
          this.value = window.appState.panels[panelId].name;
          return;
        }

        window.appState.panels[panelId].name = newName;
        window.FolderStructure.updateFolderPreview();
      });

    // Assemble panel
    panelElement.appendChild(panelContent);
    panelElement.appendChild(panelControls);
    panelElement.appendChild(panelNameContainer);

    // Add delete button to panel
    this.addPanelDeleteButton(panelElement, panelId);

    return panelElement;
  },

  /**
   * Creates an element (button, stack, pulldown) DOM element
   */
  createElementElement(elementId, element) {
    let elementElement;

    switch (element.type) {
      case "pushbutton":
        elementElement = document.createElement("div");
        elementElement.className = "button";
        elementElement.draggable = true;
        elementElement.dataset.type = "pushbutton";
        elementElement.dataset.buttonId = elementId;
        elementElement.innerHTML = `
                    <div class="button-icon">
                        <img src="${this.getIconData(
                          element
                        )}" alt="Button Icon">
                    </div>
                    <div class="button-name">${element.name}</div>
                `;

        // Add delete button
        this.addDeleteButton(elementElement, elementId);
        break;

      case "pulldown":
        elementElement = document.createElement("div");
        elementElement.className = "pulldown";
        elementElement.draggable = true;
        elementElement.dataset.type = "pulldown";
        elementElement.dataset.buttonId = elementId;
        elementElement.innerHTML = `
                    <div class="button-icon">
                        <img src="${this.getIconData(
                          element
                        )}" alt="Button Icon">
                    </div>
                    <div class="button-name">${element.name}</div>
                `;

        // Add delete button for pulldown
        this.addDeleteButton(elementElement, elementId);

        // Add click event for toggling pulldown content
        elementElement.addEventListener("click", (e) => {
          this.togglePulldownContent(elementId, elementElement);
        });

        // Add explicit pulldown indicator/button
        const pulldownIndicator = document.createElement("div");
        pulldownIndicator.className = "pulldown-indicator";
        pulldownIndicator.innerHTML = "▼";
        pulldownIndicator.style.position = "absolute";
        pulldownIndicator.style.bottom = "2px";
        pulldownIndicator.style.right = "2px";
        pulldownIndicator.style.fontSize = "10px";
        pulldownIndicator.style.color = "#555";
        pulldownIndicator.style.padding = "2px";
        pulldownIndicator.style.cursor = "pointer";

        pulldownIndicator.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent parent click from firing
          this.togglePulldownContent(elementId, elementElement);
        });

        elementElement.appendChild(pulldownIndicator);
        break;

      case "stack":
        elementElement = document.createElement("div");
        elementElement.className = "stack";
        elementElement.draggable = true;
        elementElement.dataset.type = "stack";
        elementElement.dataset.buttonId = elementId;

        // Add stack children
        if (element.children && element.children.length > 0) {
          element.children.forEach((childId) => {
            const child = window.appState.elements[childId];
            const childElement = this.createStackedButtonElement(
              childId,
              child
            );
            elementElement.appendChild(childElement);
          });
        }

        // Add "Add button" element if less than 3 buttons
        if (!element.children || element.children.length < 3) {
          const addButtonElement = document.createElement("div");
          addButtonElement.className = "stack-add-button";
          addButtonElement.innerHTML = "+ Add Button";
          addButtonElement.addEventListener("click", () => {
            if (element.children && element.children.length >= 3) return;

            window.ModalHandlers.openButtonModal("stack", elementId);
          });
          elementElement.appendChild(addButtonElement);
        }

        // Add stack name
        const stackName = document.createElement("div");
        stackName.className = "stack-name";
        stackName.textContent = element.name;
        elementElement.appendChild(stackName);

        // Add delete button for stack
        this.addDeleteButton(elementElement, elementId);

        // Make stack name editable
        stackName.addEventListener("click", function () {
          const currentText = this.textContent;
          elementElement.classList.add("stack-edit-mode");
          this.innerHTML = `<input type="text" value="${currentText}" style="width:90%;">`;
          const input = this.querySelector("input");
          input.focus();

          input.addEventListener("blur", function () {
            const newName = this.value;
            window.appState.elements[elementId].name = newName;
            this.parentElement.textContent = newName;
            elementElement.classList.remove("stack-edit-mode");
            window.FolderStructure.updateFolderPreview();
          });

          input.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
              this.blur();
            }
          });
        });

        break;
    }

    // Add drag event listeners and button events
    if (elementElement) {
      window.DragDrop.setupElementDragEvents(elementElement);
      window.EventHandlers.initializeButtonEvents(elementElement);
    }

    return elementElement;
  },

  /**
   * Creates a button element for use inside stacks
   */
  createStackedButtonElement(buttonId, button) {
    const buttonElement = document.createElement("div");
    buttonElement.className = "button stacked-button";
    buttonElement.dataset.type = button.type;
    buttonElement.dataset.buttonId = buttonId;
    buttonElement.draggable = true; // Make stack buttons draggable

    // Create a wrapper for the content with flexible width
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "stacked-button-content";
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "row";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.width = "100%";
    contentWrapper.style.overflow = "hidden";

    // Icon with fixed width
    const iconDiv = document.createElement("div");
    iconDiv.className = "button-icon";
    iconDiv.style.minWidth = "18px";
    iconDiv.style.height = "18px";
    iconDiv.style.marginRight = "4px";
    iconDiv.style.marginBottom = "0";
    iconDiv.innerHTML = `<img src="${this.getIconData(
      button
    )}" alt="Button Icon">`;

    // Name with flexible width
    const nameDiv = document.createElement("div");
    nameDiv.className = "button-name";
    nameDiv.style.overflow = "hidden";
    nameDiv.style.textOverflow = "ellipsis";
    nameDiv.style.whiteSpace = "nowrap";
    nameDiv.style.flexGrow = "1";
    nameDiv.textContent = button.name;

    contentWrapper.appendChild(iconDiv);
    contentWrapper.appendChild(nameDiv);
    buttonElement.appendChild(contentWrapper);

    if (button.type === "pulldown") {
      // Create pulldown indicator
      const pulldownIndicator = document.createElement("span");
      pulldownIndicator.className = "pulldown-indicator";
      pulldownIndicator.innerHTML = "▼";
      pulldownIndicator.title = "Open Pulldown Content";

      // Add click handler to show pulldown content
      pulldownIndicator.addEventListener("click", (e) => {
        e.stopPropagation();
        window.UIElements.togglePulldownContent(buttonId);
      });

      // Add to button
      contentWrapper.appendChild(pulldownIndicator);
    }

    // Add delete button
    this.addDeleteButton(buttonElement, buttonId);

    // Make button name editable
    nameDiv.addEventListener("click", function (e) {
      e.stopPropagation();
      const currentText = this.textContent;
      this.innerHTML = `<input type="text" value="${currentText}" style="width:90%;">`;
      const input = this.querySelector("input");
      input.focus();

      input.addEventListener("blur", function () {
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

    // Double-click to edit
    buttonElement.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      window.ModalHandlers.editElement(buttonId);
    });

    // Add drag event listeners
    window.DragDrop.setupElementDragEvents(buttonElement);

    return buttonElement;
  },

  /**
   * Shows pulldown content for a pulldown button
   */
  showPulldownContent(pulldownId, pulldownElement) {
    window.appState.activePulldown = pulldownId;
    const pulldown = window.appState.elements[pulldownId];
    const pulldownContentContainer = document.getElementById(
      "pulldownContentContainer"
    );

    // Create content for pulldown
    pulldownContentContainer.innerHTML = "";

    const contentDiv = document.createElement("div");
    contentDiv.className = "pulldown-content";

    const label = document.createElement("div");
    label.className = "pulldown-label";
    label.textContent = "PULLDOWN CONTENT";
    contentDiv.appendChild(label);

    // Add pulldown buttons
    if (pulldown.children && pulldown.children.length > 0) {
      pulldown.children.forEach((childId) => {
        const child = window.appState.elements[childId];
        const childElement = this.createElementElement(childId, child);
        contentDiv.appendChild(childElement);
      });
    }

    // Add button to add new buttons to pulldown
    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.innerHTML = '<span class="plus">+</span> NEW BUTTON';
    addButton.addEventListener("click", () => {
      window.ModalHandlers.openButtonModal("pulldown", pulldownId);
    });
    contentDiv.appendChild(addButton);

    // Add a "Close Pulldown" button
    const closeButton = document.createElement("button");
    closeButton.className = "add-button";
    closeButton.style.marginTop = "10px";
    closeButton.style.backgroundColor = "#95a5a6";
    closeButton.innerHTML = "CLOSE";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      pulldownContentContainer.style.display = "none";
      window.appState.activePulldown = null;
    });
    contentDiv.appendChild(closeButton);

    pulldownContentContainer.appendChild(contentDiv);
    pulldownContentContainer.style.display = "block";

    // Position pulldown content under the pulldown button
    if (pulldownElement) {
      const rect = pulldownElement.getBoundingClientRect();
      pulldownContentContainer.style.position = "absolute";
      pulldownContentContainer.style.top = rect.bottom + 5 + "px"; // Added 5px gap
      pulldownContentContainer.style.left = rect.left + "px";
      pulldownContentContainer.style.zIndex = "1000"; // Set lower z-index than modal
    }
  },
  addTabDeleteButton: function () {
    // Add delete buttons to all tabs
    document.querySelectorAll(".tab").forEach((tabElement) => {
      // Skip if already has a delete button
      if (tabElement.querySelector(".tab-delete-button")) return;

      const tabId = tabElement.dataset.tabId;

      // Create delete button
      const deleteButton = document.createElement("button");
      deleteButton.className = "tab-delete-button";
      deleteButton.innerHTML = "";
      deleteButton.title = "Delete Tab";
      deleteButton.style.position = "absolute";
      deleteButton.style.top = "2px";
      deleteButton.style.right = "2px";
      deleteButton.style.backgroundColor = "#e74c3c";
      deleteButton.style.color = "white";
      deleteButton.style.border = "none";
      deleteButton.style.borderRadius = "50%";
      deleteButton.style.width = "18px";
      deleteButton.style.height = "18px";
      deleteButton.style.fontSize = "9px";
      deleteButton.style.display = "flex";
      deleteButton.style.alignItems = "center";
      deleteButton.style.justifyContent = "center";
      deleteButton.style.cursor = "pointer";
      deleteButton.style.zIndex = "5";
      deleteButton.style.opacity = "0.7";
      deleteButton.style.transition = "opacity 0.2s";

      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();

        // Check if this is the last tab
        if (Object.keys(window.appState.tabs).length <= 1) {
          alert("Cannot delete the last tab. Add another tab first.");
          return;
        }

        // Ask for confirmation
        if (
          !confirm(
            `Are you sure you want to delete this tab and all its panels and elements?`
          )
        ) {
          return;
        }

        const tab = window.appState.tabs[tabId];

        // Delete all panels and their elements
        tab.panels.forEach((panelId) => {
          const panel = window.appState.panels[panelId];

          // Delete all elements in the panel
          if (panel && panel.elements) {
            panel.elements.forEach((elementId) => {
              const element = window.appState.elements[elementId];
              // If element is a container (stack or pulldown), also delete its children
              if (
                element &&
                (element.type === "stack" || element.type === "pulldown") &&
                element.children
              ) {
                element.children.forEach((childId) => {
                  delete window.appState.elements[childId];
                });
              }
              delete window.appState.elements[elementId];
            });
          }

          // Delete panel
          delete window.appState.panels[panelId];
        });

        // Delete tab
        delete window.appState.tabs[tabId];

        // Activate another tab
        const remainingTabIds = Object.keys(window.appState.tabs);
        if (remainingTabIds.length > 0) {
          window.EventHandlers.activateTab(remainingTabIds[0]);
        }

        // Update UI: Remove tab element from DOM
        tabElement.remove();

        // Update folder preview
        window.FolderStructure.updateFolderPreview();
      });

      // Add hover effect
      deleteButton.addEventListener("mouseover", function () {
        this.style.opacity = "1";
      });

      deleteButton.addEventListener("mouseout", function () {
        this.style.opacity = "0.7";
      });

      // Make the tab position relative for absolute positioning of the delete button
      tabElement.style.position = "relative";

      // Add button to tab
      tabElement.appendChild(deleteButton);
    });
  },
  addPanelDeleteButton: function (panelElement, panelId) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "panel-delete-button";
    deleteButton.innerHTML = "";
    deleteButton.title = "Delete Panel";
    deleteButton.style.position = "absolute";
    deleteButton.style.top = "5px";
    deleteButton.style.right = "5px";
    deleteButton.style.backgroundColor = "#e74c3c";
    deleteButton.style.color = "white";
    deleteButton.style.border = "none";
    deleteButton.style.borderRadius = "50%";
    deleteButton.style.width = "20px";
    deleteButton.style.height = "20px";
    deleteButton.style.fontSize = "10px";
    deleteButton.style.display = "flex";
    deleteButton.style.alignItems = "center";
    deleteButton.style.justifyContent = "center";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.zIndex = "5";
    deleteButton.style.opacity = "0.7";
    deleteButton.style.transition = "opacity 0.2s";

    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();

      const panel = window.appState.panels[panelId];
      if (!panel) return;

      const tabId = panel.tabId;
      const tab = window.appState.tabs[tabId];

      // Check if this is the last panel in the tab
      if (tab.panels.length <= 1) {
        alert(
          "Cannot delete the last panel in a tab. Add another panel first or delete the entire tab."
        );
        return;
      }

      // Ask for confirmation
      if (
        !confirm(
          `Are you sure you want to delete this panel and all its elements?`
        )
      ) {
        return;
      }

      // Delete all elements in the panel
      if (panel.elements && panel.elements.length > 0) {
        panel.elements.forEach((elementId) => {
          const element = window.appState.elements[elementId];
          // If element is a container (stack or pulldown), also delete its children
          if (
            element &&
            (element.type === "stack" || element.type === "pulldown") &&
            element.children
          ) {
            element.children.forEach((childId) => {
              delete window.appState.elements[childId];
            });
          }
          delete window.appState.elements[elementId];
        });
      }

      // Remove panel from tab
      tab.panels = tab.panels.filter((id) => id !== panelId);

      // Delete panel
      delete window.appState.panels[panelId];

      // Update UI
      window.UIElements.renderPanels();

      // Update folder preview
      window.FolderStructure.updateFolderPreview();
    });

    // Add hover effect
    deleteButton.addEventListener("mouseover", function () {
      this.style.opacity = "1";
    });

    deleteButton.addEventListener("mouseout", function () {
      this.style.opacity = "0.7";
    });

    panelElement.appendChild(deleteButton);
  },
  addDeleteButton: function (elementElement, elementId) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerHTML = "✕";
    deleteButton.title = "Delete Element";

    // Position at top right corner
    deleteButton.style.position = "absolute";
    deleteButton.style.top = "2px";
    deleteButton.style.right = "2px";

    deleteButton.style.backgroundColor = "#e74c3c";
    deleteButton.style.color = "white";
    deleteButton.style.border = "none";
    deleteButton.style.borderRadius = "50%";
    deleteButton.style.width = "7px";
    deleteButton.style.height = "7px";
    deleteButton.style.fontSize = "5px";
    deleteButton.style.display = "flex";
    deleteButton.style.alignItems = "center";
    deleteButton.style.justifyContent = "center";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.opacity = "0.7";
    deleteButton.style.transition = "opacity 0.2s";

    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const element = window.appState.elements[elementId];

      // Ask for confirmation
      if (!confirm(`Are you sure you want to delete this ${element.type}?`)) {
        return;
      }

      // Handle different elements differently
      if (element.type === "stack" || element.type === "pulldown") {
        // For stacks and pulldowns, also delete children
        if (element.children && element.children.length > 0) {
          if (
            !confirm(
              `This ${element.type} contains ${element.children.length} button(s). These will also be deleted. Continue?`
            )
          ) {
            return;
          }

          // Delete all children
          element.children.forEach((childId) => {
            delete window.appState.elements[childId];
          });
        }
      }

      // Remove from container (panel or parent element)
      if (element.panelId) {
        const panel = window.appState.panels[element.panelId];
        panel.elements = panel.elements.filter((id) => id !== elementId);
      } else if (element.parentId) {
        const parent = window.appState.elements[element.parentId];
        parent.children = parent.children.filter((id) => id !== elementId);
      }

      // Delete the element itself
      delete window.appState.elements[elementId];

      // Update UI
      window.UIElements.renderPanels();

      // Update folder preview
      window.FolderStructure.updateFolderPreview();
    });

    // Add hover effect
    deleteButton.addEventListener("mouseover", function () {
      this.style.opacity = "1";
    });

    deleteButton.addEventListener("mouseout", function () {
      this.style.opacity = "0.7";
    });

    elementElement.appendChild(deleteButton);
  },

  /**
   * Renders panels for the active tab
   */
  renderPanels() {
    const tabId = window.appState.activeTabId;
    const panelIds = window.appState.tabs[tabId].panels;
    const ribbonContainer = document.getElementById("ribbonContainer");

    // Clear ribbon container
    ribbonContainer.innerHTML = "";

    // Add panels
    panelIds.forEach((panelId) => {
      const panel = window.appState.panels[panelId];
      const panelElement = this.createPanelElement(panelId, panel);
      ribbonContainer.appendChild(panelElement);
    });

    // Update tab delete buttons
    this.addTabDeleteButton();
  },
  setupDocumentClickHandler() {
    // Add click handler to document to close pulldown content when clicking outside
    document.addEventListener("click", (e) => {
      const pulldownContentContainer = document.getElementById(
        "pulldownContentContainer"
      );

      // If pulldown content is open and click is outside
      if (
        pulldownContentContainer &&
        pulldownContentContainer.style.display === "block"
      ) {
        // Check if click is inside pulldown content
        if (!pulldownContentContainer.contains(e.target)) {
          // Check if click is on a pulldown button (those have their own click handlers)
          const clickedPulldown = e.target.closest(".pulldown");
          if (
            !clickedPulldown ||
            clickedPulldown.dataset.buttonId !== window.appState.activePulldown
          ) {
            // Hide pulldown content
            pulldownContentContainer.style.display = "none";
            window.appState.activePulldown = null;
          }
        }
      }
    });
  },
};

// Export UI Elements to be used by other modules
window.UIElements = UIElements;


