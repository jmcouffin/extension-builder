// Modal handling functions for pyRevit Extension Builder
const ModalHandlers = {
  /**
   * Opens the button creation modal
   */
  openButtonModal(target, containerId) {
    const buttonModal = document.getElementById("buttonModal");

    // Set modal context
    buttonModal.dataset.target = target;
    buttonModal.dataset.containerId = containerId;

    // Generate the appropriate default button name
    let defaultButtonName = "Button 1"; // Default if we can't determine container

    if (target === "panel") {
      // For panels, look at existing elements and find next available "Button X" number
      const panel = window.appState.panels[containerId];
      if (panel && panel.elements) {
        const buttonNames = panel.elements
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));

        // Find the first unused number
        if (buttonNames.length > 0) {
          // Sort numbers
          buttonNames.sort((a, b) => a - b);

          // Find first gap or use next number
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
      // For stacks/pulldowns, similar logic
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

    // Reset form
    document.getElementById("buttonName").value = defaultButtonName;
    document.getElementById("buttonTitle").value = "";
    document.getElementById("buttonTooltip").value = "";
    document.getElementById("buttonCode").value = "";
    document.getElementById("iconPreview").innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==" alt="Default Icon">';
    document.getElementById("buttonIcon").value = "";

    // Get all button type options
    const buttonTypes = document.querySelectorAll(".button-type");

    // First show all options
    buttonTypes.forEach((type) => {
      type.style.display = "block";
    });

    // Restrict available types based on container
    if (target === "pulldown") {
      // When adding to a pulldown, hide the pulldown option
      const pulldownOption = document.querySelector(
        '.button-type[data-type="pulldown"]'
      );
      if (pulldownOption) {
        pulldownOption.style.display = "none";
      }

      // Select pushbutton by default
      this.selectButtonType(
        document.querySelector('.button-type[data-type="pushbutton"]')
      );
    } else {
      // Select pushbutton type by default for other cases
      this.selectButtonType(
        document.querySelector('.button-type[data-type="pushbutton"]')
      );
    }

    // Show modal with proper z-index (ensure it's above pulldown content)
    buttonModal.style.display = "block";
    buttonModal.style.zIndex = "2000"; // Higher z-index than pulldown content

    // Add keyboard event listeners
    this.setupModalKeyboardEvents();
  },

  setupModalKeyboardEvents() {
    // Remove any existing event listeners
    document.removeEventListener("keydown", this.handleModalKeyDown);

    // Add keydown event listener
    document.addEventListener("keydown", this.handleModalKeyDown);
  },

  /**
   * Handle keyboard events for the modal
   */
  handleModalKeyDown(e) {
    const buttonModal = document.getElementById("buttonModal");

    // Only process events when modal is visible
    if (buttonModal.style.display !== "block") return;

    // Enter or Ctrl+Enter to submit
    if (e.key === "Enter") {
      e.preventDefault();
      window.ModalHandlers.createNewElement();
    }

    // Escape to close
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

    // Reset create button text to "Create" if it was changed
    document.getElementById("createButton").textContent = "Create";

    // Remove keyboard event listeners
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

    // Set modal context for editing
    buttonModal.dataset.target = "edit";
    buttonModal.dataset.elementId = elementId;
    buttonModal.dataset.originalType = element.type; // Store original type for comparison

    // Fill form with element data
    document.getElementById("buttonName").value = element.name || "";
    document.getElementById("buttonTitle").value = element.title || "";
    document.getElementById("buttonTooltip").value = element.tooltip || "";
    document.getElementById("buttonCode").value = element.code || "";

    // Set icon preview
    if (element.iconData) {
      document.getElementById(
        "iconPreview"
      ).innerHTML = `<img src="${element.iconData}" alt="Icon Preview">`;
    } else {
      document.getElementById(
        "iconPreview"
      ).innerHTML = `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==" alt="Default Icon">`;
    }

    // Get all button type options
    const buttonTypes = document.querySelectorAll(".button-type");

    // First show all options
    buttonTypes.forEach((type) => {
      type.style.display = "block";
    });

    // Check if element is inside a pulldown - if so, restrict type options
    if (
      element.parentId &&
      window.appState.elements[element.parentId].type === "pulldown"
    ) {
      // When editing an element inside a pulldown, hide the pulldown option
      const pulldownOption = document.querySelector(
        '.button-type[data-type="pulldown"]'
      );
      if (pulldownOption) {
        pulldownOption.style.display = "none";
      }
    }

    // Select the correct button type
    this.selectButtonType(
      document.querySelector(`.button-type[data-type="${element.type}"]`)
    );

    // Change create button text to "Update"
    document.getElementById("createButton").textContent = "Update";

    // Show modal
    buttonModal.style.display = "block";
  },

  // Create new element or update existing one
  createNewElement() {
    const buttonModal = document.getElementById("buttonModal");
    const target = buttonModal.dataset.target;

    // Get form values
    const newType = document.querySelector(".button-type.selected").dataset
      .type;
    let name = document.getElementById("buttonName").value;
    const title = document.getElementById("buttonTitle").value;
    const tooltip = document.getElementById("buttonTooltip").value;
    const code = document.getElementById("buttonCode").value;

    // If name is empty or just whitespace, generate a default name
    if (!name || name.trim() === "") {
      name = this.generateDefaultButtonName(
        target,
        buttonModal.dataset.containerId
      );
    }

    // Get icon data
    const iconInput = document.getElementById("buttonIcon");
    let iconData = null;

    // Check if we're editing an existing element
    if (target === "edit") {
      const elementId = buttonModal.dataset.elementId;
      const element = window.appState.elements[elementId];
      const originalType = buttonModal.dataset.originalType;

      // Handle type change logic
      const isTypeChanged = originalType !== newType;

      // Keep existing icon if no new one is selected
      if (iconInput.files.length === 0) {
        iconData = element.iconData;
        updateElement();
      } else {
        // Read new icon
        const reader = new FileReader();
        reader.onload = function (e) {
          iconData = e.target.result;
          updateElement();
        };
        reader.readAsDataURL(iconInput.files[0]);
      }

      function updateElement() {
        // If changing from a container type (pulldown, stack) to a simple type (pushbutton)
        if (
          (originalType === "pulldown" || originalType === "stack") &&
          newType === "pushbutton"
        ) {
          // Ask for confirmation if there are children
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

          // Remove children references if any
          if (element.children) {
            // Actually delete child elements from appState
            element.children.forEach((childId) => {
              delete window.appState.elements[childId];
            });
            delete element.children;
          }
        }

        // If changing to a container type from pushbutton, initialize children array
        if (
          (newType === "pulldown" || newType === "stack") &&
          originalType === "pushbutton"
        ) {
          element.children = [];
        }

        // Update element properties
        element.type = newType;
        element.name = name;
        element.title = title;
        element.tooltip = tooltip;
        element.code = code;
        element.iconData = iconData;

        // Close modal
        ModalHandlers.closeModal();

        // Reset create button text
        document.getElementById("createButton").textContent = "Create";

        // Refresh UI
        window.UIElements.renderPanels();

        // Update folder preview
        window.FolderStructure.updateFolderPreview();
      }
    } else {
      // Creating a new element
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
        // Check for duplicate button names
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

        // Create element data
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

        // Add to container
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

        // Close modal
        ModalHandlers.closeModal();

        // Refresh UI
        if (target === "pulldown") {
          window.UIElements.showPulldownContent(containerId);
        } else {
          window.UIElements.renderPanels();
        }

        // Update folder preview
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
      // Get all buttons in the panel
      const panel = window.appState.panels[containerId];
      if (panel && panel.elements) {
        existingButtons = panel.elements
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));
      }
    } else if (target === "stack" || target === "pulldown") {
      // Get all buttons in the stack/pulldown
      const container = window.appState.elements[containerId];
      if (container && container.children) {
        existingButtons = container.children
          .map((id) => window.appState.elements[id])
          .filter((el) => el && el.name && el.name.match(/^Button \d+$/))
          .map((el) => parseInt(el.name.replace("Button ", "")));
      }
    }

    // Find the next available "Button X" number
    let buttonNum = 1;

    if (existingButtons.length > 0) {
      // Sort button numbers
      existingButtons.sort((a, b) => a - b);

      // Find first gap
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

// Export Modal Handlers to be used by other modules
window.ModalHandlers = ModalHandlers;
