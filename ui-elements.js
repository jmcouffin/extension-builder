const UIElements = {
  defaultIconPath: "icon.png",
  defaultDarkIconPath: "icon.dark.png",

  defaultIconData: null,
  defaultDarkIconData: null,

  /**
   * Initialize by loading default icons
   */
  initialize() {
    this.loadDefaultIcons();
  },

  togglePulldownContent: function (pulldownId, pulldownElement) {
    const pulldownContentContainer = document.getElementById(
      "pulldownContentContainer"
    );

    if (
      window.appState.activePulldown === pulldownId &&
      pulldownContentContainer.style.display === "block"
    ) {
      pulldownContentContainer.style.display = "none";
      window.appState.activePulldown = null;
      return;
    }

    this.showPulldownContent(pulldownId, pulldownElement);
  },

  /**
   * Load default icons from the root
   */
  loadDefaultIcons() {
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

          this.renderPanels();
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error(`Error loading default icon:`, error);
      });

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
    panelElement.style.position = "relative";

    const panelContent = document.createElement("div");
    panelContent.className = "panel-content";
    panelContent.id = `panelContent${panelId.replace("panel", "")}`;

    panel.elements.forEach((elementId) => {
      const element = window.appState.elements[elementId];
      const elementElement = this.createElementElement(elementId, element);
      panelContent.appendChild(elementElement);
    });

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

    panelControls.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", window.EventHandlers.handlePanelAction);
    });

    const panelNameContainer = document.createElement("div");
    panelNameContainer.className = "panel-name-container";
    panelNameContainer.innerHTML = `<input type="text" class="panel-name" value="${panel.name}">`;

    panelNameContainer
      .querySelector(".panel-name")
      .addEventListener("change", function () {
        const newName = this.value;

        const tabId = panel.tabId;
        const isDuplicate = window.appState.tabs[tabId].panels.some((pid) => {
          if (pid === panelId) return false;
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

    panelElement.appendChild(panelContent);
    panelElement.appendChild(panelControls);
    panelElement.appendChild(panelNameContainer);

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

        this.addDeleteButton(elementElement, elementId);

        elementElement.addEventListener("click", (e) => {
          this.togglePulldownContent(elementId, elementElement);
        });

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
          e.stopPropagation();
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

        const stackName = document.createElement("div");
        stackName.className = "stack-name";
        stackName.textContent = element.name;
        elementElement.appendChild(stackName);

        this.addDeleteButton(elementElement, elementId);

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
    buttonElement.draggable = true;

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "stacked-button-content";
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "row";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.width = "100%";
    contentWrapper.style.overflow = "hidden";

    const iconDiv = document.createElement("div");
    iconDiv.className = "button-icon";
    iconDiv.style.minWidth = "18px";
    iconDiv.style.height = "18px";
    iconDiv.style.marginRight = "4px";
    iconDiv.style.marginBottom = "0";
    iconDiv.innerHTML = `<img src="${this.getIconData(
      button
    )}" alt="Button Icon">`;

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
      const pulldownIndicator = document.createElement("span");
      pulldownIndicator.className = "pulldown-indicator";
      pulldownIndicator.innerHTML = "▼";
      pulldownIndicator.title = "Open Pulldown Content";

      pulldownIndicator.addEventListener("click", (e) => {
        e.stopPropagation();
        window.UIElements.togglePulldownContent(buttonId);
      });

      contentWrapper.appendChild(pulldownIndicator);
    }

    this.addDeleteButton(buttonElement, buttonId);

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

    buttonElement.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      window.ModalHandlers.editElement(buttonId);
    });

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

    pulldownContentContainer.innerHTML = "";

    const contentDiv = document.createElement("div");
    contentDiv.className = "pulldown-content";

    const label = document.createElement("div");
    label.className = "pulldown-label";
    label.textContent = "PULLDOWN CONTENT";
    contentDiv.appendChild(label);

    if (pulldown.children && pulldown.children.length > 0) {
      pulldown.children.forEach((childId) => {
        const child = window.appState.elements[childId];
        const childElement = this.createElementElement(childId, child);
        contentDiv.appendChild(childElement);
      });
    }

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.innerHTML = '<span class="plus">+</span> NEW BUTTON';
    addButton.addEventListener("click", () => {
      window.ModalHandlers.openButtonModal("pulldown", pulldownId);
    });
    contentDiv.appendChild(addButton);

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

    if (pulldownElement) {
      const rect = pulldownElement.getBoundingClientRect();
      pulldownContentContainer.style.position = "absolute";
      pulldownContentContainer.style.top = rect.bottom + 5 + "px";
      pulldownContentContainer.style.left = rect.left + "px";
      pulldownContentContainer.style.zIndex = "1000";
    }
  },
  addTabDeleteButton: function () {
    document.querySelectorAll(".tab").forEach((tabElement) => {
      if (tabElement.querySelector(".tab-delete-button")) return;

      const tabId = tabElement.dataset.tabId;

      const deleteButton = document.createElement("button");
      deleteButton.className = "tab-delete-button";
      deleteButton.innerHTML = "";
      deleteButton.title = "Delete Tab";

      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();

        if (Object.keys(window.appState.tabs).length <= 1) {
          alert("Cannot delete the last tab. Add another tab first.");
          return;
        }

        // Removed confirmation dialog and performing action directly
        const tab = window.appState.tabs[tabId];

        tab.panels.forEach((panelId) => {
          const panel = window.appState.panels[panelId];

          if (panel && panel.elements) {
            panel.elements.forEach((elementId) => {
              const element = window.appState.elements[elementId];

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

          delete window.appState.panels[panelId];
        });

        delete window.appState.tabs[tabId];

        const remainingTabIds = Object.keys(window.appState.tabs);
        if (remainingTabIds.length > 0) {
          window.EventHandlers.activateTab(remainingTabIds[0]);
        }

        tabElement.remove();

        window.FolderStructure.updateFolderPreview();
      });

      deleteButton.addEventListener("mouseover", function () {
        this.style.opacity = "1";
      });

      deleteButton.addEventListener("mouseout", function () {
        this.style.opacity = "0.7";
      });

      tabElement.style.position = "relative";

      tabElement.appendChild(deleteButton);
    });
  },
  addPanelDeleteButton: function (panelElement, panelId) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "panel-delete-button";
    deleteButton.innerHTML = "";
    deleteButton.title = "Delete Panel";
    deleteButton.style.position = "absolute";

    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();

      const panel = window.appState.panels[panelId];
      if (!panel) return;

      const tabId = panel.tabId;
      const tab = window.appState.tabs[tabId];

      if (tab.panels.length <= 1) {
        alert(
          "Cannot delete the last panel in a tab. Add another panel first or delete the entire tab."
        );
        return;
      }

      // Removed confirmation dialog and performing action directly
      if (panel.elements && panel.elements.length > 0) {
        panel.elements.forEach((elementId) => {
          const element = window.appState.elements[elementId];

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

      tab.panels = tab.panels.filter((id) => id !== panelId);

      delete window.appState.panels[panelId];

      window.UIElements.renderPanels();

      window.FolderStructure.updateFolderPreview();
    });

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
    deleteButton.innerHTML = "";
    deleteButton.title = "Delete Element";

    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const element = window.appState.elements[elementId];

      // Removed confirmation dialog and performing action directly
      if (element.type === "stack" || element.type === "pulldown") {
        if (element.children && element.children.length > 0) {
          // Removed confirmation dialog for child elements
          element.children.forEach((childId) => {
            delete window.appState.elements[childId];
          });
        }
      }

      if (element.panelId) {
        const panel = window.appState.panels[element.panelId];
        panel.elements = panel.elements.filter((id) => id !== elementId);
      } else if (element.parentId) {
        const parent = window.appState.elements[element.parentId];
        parent.children = parent.children.filter((id) => id !== elementId);
      }

      delete window.appState.elements[elementId];

      window.UIElements.renderPanels();

      window.FolderStructure.updateFolderPreview();
    });

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

    ribbonContainer.innerHTML = "";

    panelIds.forEach((panelId) => {
      const panel = window.appState.panels[panelId];
      const panelElement = this.createPanelElement(panelId, panel);
      ribbonContainer.appendChild(panelElement);
    });

    this.addTabDeleteButton();
  },
  setupDocumentClickHandler() {
    document.addEventListener("click", (e) => {
      const pulldownContentContainer = document.getElementById(
        "pulldownContentContainer"
      );

      if (
        pulldownContentContainer &&
        pulldownContentContainer.style.display === "block"
      ) {
        if (!pulldownContentContainer.contains(e.target)) {
          const clickedPulldown = e.target.closest(".pulldown");
          if (
            !clickedPulldown ||
            clickedPulldown.dataset.buttonId !== window.appState.activePulldown
          ) {
            pulldownContentContainer.style.display = "none";
            window.appState.activePulldown = null;
          }
        }
      }
    });
  },
};

window.UIElements = UIElements;
