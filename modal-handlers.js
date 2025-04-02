const ModalHandlers = {
  /**
   * Opens the button creation modal
   */
  openButtonModal(target, containerId) {
    const buttonModal = document.getElementById("buttonModal");

    buttonModal.dataset.target = target;
    buttonModal.dataset.containerId = containerId;

    let defaultButtonName = "Button 1";

    if (target === "panel") {
      const panel = window.appState.panels[containerId];
      if (panel && panel.elements) {
        const buttonNames = panel.elements
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));

        if (buttonNames.length > 0) {
          buttonNames.sort((a, b) => a - b);

          let nextNum = 1;
          for (const num of buttonNames) {
            if (num !== nextNum) {
              break;
            }
            nextNum++;
          }
          defaultButtonName = `Button ${nextNum}`;
        }
      }
    } else if (target === "stack" || target === "pulldown") {
      const container = window.appState.elements[containerId];
      if (container && container.children) {
        const buttonNames = container.children
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));

        if (buttonNames.length > 0) {
          buttonNames.sort((a, b) => a - b);
          let nextNum = 1;
          for (const num of buttonNames) {
            if (num !== nextNum) {
              break;
            }
            nextNum++;
          }
          defaultButtonName = `Button ${nextNum}`;
        }
      }
    }

    document.getElementById("buttonName").value = defaultButtonName;
    document.getElementById("buttonTitle").value = "";
    document.getElementById("buttonTooltip").value = "";
    document.getElementById("buttonCode").value = "";
    document.getElementById("iconPreview").innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==" alt="Default Icon">';
    document.getElementById("buttonIcon").value = "";

    const buttonTypes = document.querySelectorAll(".button-type");

    buttonTypes.forEach((type) => {
      type.style.display = "block";
    });

    if (target === "pulldown") {
      const pulldownOption = document.querySelector(
        '.button-type[data-type="pulldown"]'
      );
      if (pulldownOption) {
        pulldownOption.style.display = "none";
      }

      this.selectButtonType(
        document.querySelector('.button-type[data-type="pushbutton"]')
      );
    } else {
      this.selectButtonType(
        document.querySelector('.button-type[data-type="pushbutton"]')
      );
    }

    buttonModal.style.display = "block";
    buttonModal.style.zIndex = "2000";

    this.setupModalKeyboardEvents();
  },

  setupModalKeyboardEvents() {
    document.removeEventListener("keydown", this.handleModalKeyDown);

    document.addEventListener("keydown", this.handleModalKeyDown);
  },

  /**
   * Handle keyboard events for the modal
   */
  handleModalKeyDown(e) {
    const buttonModal = document.getElementById("buttonModal");

    if (buttonModal.style.display !== "block") return;

    if (e.key === "Enter") {
      e.preventDefault();
      window.ModalHandlers.createNewElement();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      window.ModalHandlers.closeModal();
    }
  },

  /**
   * Closes the button creation modal
   */
  closeModal() {
    const buttonModal = document.getElementById("buttonModal");
    buttonModal.style.display = "none";

    document.getElementById("createButton").textContent = "Create";

    document.removeEventListener("keydown", this.handleModalKeyDown);
  },

  /**
   * Selects a button type in the modal
   */
  selectButtonType(typeElement) {
    document.querySelectorAll(".button-type").forEach((type) => {
      type.classList.remove("selected");
    });
    typeElement.classList.add("selected");
  },

  /**
   * Shows a preview of the selected icon
   */
  previewIcon() {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById(
          "iconPreview"
        ).innerHTML = `<img src="${e.target.result}" alt="Icon Preview">`;
      };
      reader.readAsDataURL(file);
    }
  },

  /**
   * Edit an existing element
   */
  editElement(elementId) {
    const element = window.appState.elements[elementId];
    if (!element) return;

    const buttonModal = document.getElementById("buttonModal");

    buttonModal.dataset.target = "edit";
    buttonModal.dataset.elementId = elementId;
    buttonModal.dataset.originalType = element.type;

    document.getElementById("buttonName").value = element.name || "";
    document.getElementById("buttonTitle").value = element.title || "";
    document.getElementById("buttonTooltip").value = element.tooltip || "";
    document.getElementById("buttonCode").value = element.code || "";

    if (element.iconData) {
      document.getElementById(
        "iconPreview"
      ).innerHTML = `<img src="${element.iconData}" alt="Icon Preview">`;
    } else {
      document.getElementById(
        "iconPreview"
      ).innerHTML = `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==" alt="Default Icon">`;
    }

    const buttonTypes = document.querySelectorAll(".button-type");

    buttonTypes.forEach((type) => {
      type.style.display = "block";
    });

    if (
      element.parentId &&
      window.appState.elements[element.parentId].type === "pulldown"
    ) {
      const pulldownOption = document.querySelector(
        '.button-type[data-type="pulldown"]'
      );
      if (pulldownOption) {
        pulldownOption.style.display = "none";
      }
    }

    this.selectButtonType(
      document.querySelector(`.button-type[data-type="${element.type}"]`)
    );

    document.getElementById("createButton").textContent = "Update";

    buttonModal.style.display = "block";
  },

  createNewElement() {
    const buttonModal = document.getElementById("buttonModal");
    const target = buttonModal.dataset.target;

    const newType = document.querySelector(".button-type.selected").dataset
      .type;
    let name = document.getElementById("buttonName").value;
    const title = document.getElementById("buttonTitle").value;
    const tooltip = document.getElementById("buttonTooltip").value;
    const code = document.getElementById("buttonCode").value;

    if (!name || name.trim() === "") {
      name = this.generateDefaultButtonName(
        target,
        buttonModal.dataset.containerId
      );
    }

    const iconInput = document.getElementById("buttonIcon");
    let iconData = null;

    if (target === "edit") {
      const elementId = buttonModal.dataset.elementId;
      const element = window.appState.elements[elementId];
      const originalType = buttonModal.dataset.originalType;

      const isTypeChanged = originalType !== newType;

      if (iconInput.files.length === 0) {
        iconData = element.iconData;
        updateElement();
      } else {
        const reader = new FileReader();
        reader.onload = function (e) {
          iconData = e.target.result;
          updateElement();
        };
        reader.readAsDataURL(iconInput.files[0]);
      }

      function updateElement() {
        if (
          (originalType === "pulldown" || originalType === "stack") &&
          newType === "pushbutton"
        ) {
          if (element.children && element.children.length > 0) {
            if (
              !confirm(
                `This ${originalType} contains ${element.children.length} button(s). Changing it to a pushbutton will delete these buttons. Continue?`
              )
            ) {
              ModalHandlers.closeModal();
              return;
            }
          }

          if (element.children) {
            element.children.forEach((childId) => {
              delete window.appState.elements[childId];
            });
            delete element.children;
          }
        }

        if (
          (newType === "pulldown" || newType === "stack") &&
          originalType === "pushbutton"
        ) {
          element.children = [];
        }

        element.type = newType;
        element.name = name;
        element.title = title;
        element.tooltip = tooltip;
        element.code = code;
        element.iconData = iconData;

        ModalHandlers.closeModal();

        document.getElementById("createButton").textContent = "Create";

        window.UIElements.renderPanels();

        window.FolderStructure.updateFolderPreview();
      }
    } else {
      const containerId = buttonModal.dataset.containerId;

      if (iconInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function (e) {
          iconData = e.target.result;
          finishElementCreation();
        };
        reader.readAsDataURL(iconInput.files[0]);
      } else {
        finishElementCreation();
      }

      function finishElementCreation() {
        const isDuplicate = ModalHandlers.checkDuplicateButtonName(
          name,
          target,
          containerId
        );
        if (isDuplicate) {
          alert(
            "A button with this name already exists in the same container. Please choose a different name."
          );
          return;
        }

        const elementId = `element${window.appState.nextIds.element++}`;

        window.appState.elements[elementId] = {
          type: newType,
          name: name,
          title: title,
          tooltip: tooltip,
          code: code,
          iconData: iconData,
          children:
            newType === "pulldown" || newType === "stack" ? [] : undefined,
        };

        if (target === "panel") {
          window.appState.panels[containerId].elements.push(elementId);
          window.appState.elements[elementId].panelId = containerId;
        } else if (target === "stack" || target === "pulldown") {
          if (!window.appState.elements[containerId].children) {
            window.appState.elements[containerId].children = [];
          }
          window.appState.elements[containerId].children.push(elementId);
          window.appState.elements[elementId].parentId = containerId;
        }

        ModalHandlers.closeModal();

        if (target === "pulldown") {
          window.UIElements.showPulldownContent(containerId);
        } else {
          window.UIElements.renderPanels();
        }

        window.FolderStructure.updateFolderPreview();
      }
    }
  },

  /**
   * Generate a default button name for a new element
   */
  generateDefaultButtonName(target, containerId) {
    let existingButtons = [];

    if (target === "panel") {
      const panel = window.appState.panels[containerId];
      if (panel && panel.elements) {
        existingButtons = panel.elements
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));
      }
    } else if (target === "stack" || target === "pulldown") {
      const container = window.appState.elements[containerId];
      if (container && container.children) {
        existingButtons = container.children
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));
      }
    }

    let buttonNum = 1;

    if (existingButtons.length > 0) {
      existingButtons.sort((a, b) => a - b);

      for (const num of existingButtons) {
        if (num !== buttonNum) {
          break;
        }
        buttonNum++;
      }
    }

    return `Button ${buttonNum}`;
  },

  /**
   * Check if a button name is duplicate within its container
   */
  checkDuplicateButtonName(name, target, containerId) {
    if (target === "panel") {
      const panelElements = window.appState.panels[containerId].elements;
      return panelElements.some(
        (id) =>
          window.appState.elements[id].name.toLowerCase() === name.toLowerCase()
      );
    } else if (target === "stack" || target === "pulldown") {
      const container = window.appState.elements[containerId];
      if (!container.children) return false;

      return container.children.some(
        (id) =>
          window.appState.elements[id].name.toLowerCase() === name.toLowerCase()
      );
    }
    return false;
  },
};

window.ModalHandlers = ModalHandlers;
