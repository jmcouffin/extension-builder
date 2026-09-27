const UIElements = {
  defaultIconData: null,
  defaultDarkIconData: null,

  FALLBACK_ICON:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",

  initialize() {
    window.FolderStructure.loadDefaultIcons().then(() => {
      this.defaultIconData = window.FolderStructure.defaultIconData;
      this.defaultDarkIconData = window.FolderStructure.defaultDarkIconData;
      this.renderPanels();
    });
  },

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  getIconData(element) {
    if (element && element.iconData) return element.iconData;
    return this.defaultIconData || this.FALLBACK_ICON;
  },

  // ---------------------------------------------------------------------------
  // Small DOM helpers -- everything user-supplied goes through textContent or
  // a property assignment, never innerHTML.
  // ---------------------------------------------------------------------------

  el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  },

  iconImg(element, alt) {
    const img = document.createElement("img");
    img.src = this.getIconData(element);
    img.alt = alt || "Icon";
    return img;
  },

  /** Make a label's text editable in place. */
  makeEditable(labelNode, currentValue, onCommit) {
    labelNode.textContent = "";
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentValue;
    labelNode.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const next = input.value.trim();
      input.removeEventListener("blur", commit);
      input.removeEventListener("keydown", onKey);
      onCommit(next);
    };
    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.value = currentValue;
        input.blur();
      }
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", onKey);
  },

  // ---------------------------------------------------------------------------
  // Panels
  // ---------------------------------------------------------------------------

  createPanelElement(panelId, panel) {
    const panelElement = this.el("div", "panel");
    panelElement.dataset.panelId = panelId;
    panelElement.dataset.tabId = panel.tabId;
    panelElement.style.position = "relative";

    const panelContent = this.el("div", "panel-content");

    (panel.elements || []).forEach((elementId) => {
      const element = window.appState.elements[elementId];
      if (!element) return;
      const node = this.createElementElement(elementId, element);
      if (node) panelContent.appendChild(node);
    });

    // Pulldown / split groups open their own editor panel.
    const groupActions = this.el("div", "panel-controls");
    [
      { action: "add-button", label: "BUTTON", title: "Add a command" },
      { action: "add-stack", label: "STACK", title: "Add a stack of 2-3 commands" },
      { action: "add-group", label: "GROUP", title: "Add a pulldown or split button" },
    ].forEach((spec) => {
      const button = this.el("button", "add-button", spec.label);
      button.dataset.panelId = panelId;
      button.dataset.action = spec.action;
      button.title = spec.title;
      button.addEventListener("click", window.EventHandlers.handlePanelAction);
      groupActions.appendChild(button);
    });

    // Revit puts the panel name along the bottom of the panel, so the name and
    // the add controls share a footer under the items.
    const footer = this.el("div", "panel-footer");

    const panelName = document.createElement("input");
    panelName.type = "text";
    panelName.className = "panel-name";
    panelName.value = panel.name || "";
    panelName.title = "Panel name - becomes the folder in your extension";
    panelName.addEventListener("change", () => {
      const newName = panelName.value.trim();
      if (!newName) {
        panelName.value = window.appState.panels[panelId].name;
        return;
      }
      const tabId = panel.tabId;
      const isDuplicate = (window.appState.tabs[tabId].panels || []).some((pid) => {
        if (pid === panelId) return false;
        return (
          (window.appState.panels[pid].name || "").toLowerCase() ===
          newName.toLowerCase()
        );
      });
      if (isDuplicate) {
        alert("Panel name already exists in this tab. Please choose a different name.");
        panelName.value = window.appState.panels[panelId].name;
        return;
      }
      window.appState.panels[panelId].name = newName;
      window.FolderStructure.updateFolderPreview();
    });
    footer.appendChild(panelName);
    footer.appendChild(groupActions);

    // A small + at the panel's own bottom-right adds a panel to this panel's
    // tab, which is more discoverable than one button for the whole ribbon.
    const addPanel = this.el("button", "add-button add-panel-inline");
    addPanel.dataset.panelId = panelId;
    addPanel.title = "Add another panel to this tab";
    addPanel.setAttribute("aria-label", "Add another panel to this tab");
    addPanel.addEventListener("click", (e) => {
      e.stopPropagation();
      window.EventHandlers.addNewPanel(panelId);
    });
    footer.appendChild(addPanel);

    panelElement.appendChild(panelContent);
    panelElement.appendChild(footer);

    this.addDeleteButton(panelElement, panelId, "panel");

    return panelElement;
  },

  // ---------------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------------

  createElementElement(elementId, element, options) {
    const opts = options || {};
    const typeDef = window.BundleTypes.get(element.type);

    if (!typeDef) {
      return this.createUnknownElement(elementId, element);
    }

    if (typeDef.container) {
      return typeDef.postfix === ".stack"
        ? this.createStackElement(elementId, element)
        : this.createGroupElement(elementId, element);
    }

    return this.createCommandElement(elementId, element, typeDef, opts);
  },

  createUnknownElement(elementId, element) {
    const node = this.el("div", "button unknown-type");
    node.dataset.type = element.type || "";
    node.dataset.buttonId = elementId;
    node.draggable = true;
    const name = this.el("div", "button-name", element.name || "(unnamed)");
    node.appendChild(name);
    node.title =
      "This element has an unrecognised type (" +
      (element.type || "none") +
      "). It cannot be exported.";
    this.addDeleteButton(node, elementId, "element");
    return node;
  },

  createCommandElement(elementId, element, typeDef, opts) {
    const node = this.el("div", "button " + typeDef.postfix.slice(1));
    node.dataset.type = element.type;
    node.dataset.buttonId = elementId;
    node.draggable = true;
    node.title = typeDef.label + " - " + typeDef.postfix;

    const iconWrap = this.el("div", "button-icon");
    iconWrap.appendChild(this.iconImg(element));
    node.appendChild(iconWrap);

    const name = this.el("div", "button-name");
    if (opts.inlineEdit) {
      this.makeEditable(name, element.name, (next) => {
        this.renameElement(elementId, next);
        window.UIElements.renderPanels();
      });
    } else {
      name.textContent = element.name;
      name.addEventListener("click", (e) => {
        e.stopPropagation();
        this.makeEditable(name, element.name, (next) => {
          this.renameElement(elementId, next);
        });
      });
    }
    node.appendChild(name);

    this.addDeleteButton(node, elementId, "element");
    node.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      window.ModalHandlers.editElement(elementId);
    });

    window.DragDrop.setupElementDragEvents(node);
    return node;
  },

  createGroupElement(elementId, element) {
    const typeDef = window.BundleTypes.get(element.type);
    const node = this.el("div", "group " + typeDef.postfix.slice(1));
    node.dataset.type = element.type;
    node.dataset.buttonId = elementId;
    node.draggable = true;
    node.title = typeDef.label + " - " + typeDef.postfix;

    const header = this.el("div", "group-header");
    // The icon needs the same wrapper the plain commands use, otherwise the
    // image renders at its natural size and swamps the item.
    const iconWrap = this.el("div", "button-icon");
    iconWrap.appendChild(this.iconImg(element));
    header.appendChild(iconWrap);

    // Clicking the icon opens the group, clicking the name renames it. The
    // name stops propagation to rename, so the icon is what opens the list -
    // same split as a plain command, where the name renames too.
    iconWrap.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openGroupEditor(elementId, node);
    });

    const name = this.el("div", "button-name", element.name);
    name.addEventListener("click", (e) => {
      e.stopPropagation();
      this.makeEditable(name, element.name, (next) => {
        this.renameElement(elementId, next);
      });
    });
    header.appendChild(name);
    // Revit marks a command that opens a list with a small chevron just under
    // the label. It is an empty element drawn by CSS borders, not a text
    // glyph: a literal triangle was re-encoded into mojibake on the way to
    // disk, and a rotated border chevron cannot be corrupted that way. The
    // header reserves the room for it, so it sits under the title whether the
    // title is one line or wraps to two.
    const caret = this.el("div", "group-caret");
    caret.setAttribute("aria-hidden", "true");
    header.appendChild(caret);
    node.appendChild(header);
    node.title =
      typeDef.label +
      " - " +
      typeDef.postfix +
      ' "' +
      element.name +
      '" with ' +
      (element.children || []).length +
      " command(s). Click the icon to open them.";

    const body = this.el("div", "group-body");
    (element.children || []).forEach((childId) => {
      const child = window.appState.elements[childId];
      if (!child) return;
      const childNode = this.createElementElement(childId, child);
      if (childNode) body.appendChild(childNode);
    });

    const add = this.el("button", "add-button group-add", "+ ADD COMMAND");
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      window.ModalHandlers.openButtonModal(element.type, elementId);
    });
    body.appendChild(add);
    node.appendChild(body);

    node.addEventListener("click", (e) => {
      if (e.target.closest(".group-add") || e.target.closest(".delete-button")) {
        return;
      }
      this.openGroupEditor(elementId, node);
    });
    node.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      window.ModalHandlers.editElement(elementId);
    });

    this.addDeleteButton(node, elementId, "element");
    window.DragDrop.setupElementDragEvents(node);
    return node;
  },

  openGroupEditor(groupId, anchorNode) {
    const container = document.getElementById("pulldownContentContainer");
    const group = window.appState.elements[groupId];
    if (!group) return;

    container.innerHTML = "";
    const content = this.el("div", "pulldown-content");
    content.appendChild(this.el("div", "pulldown-label", group.name.toUpperCase()));

    (group.children || []).forEach((childId) => {
      const child = window.appState.elements[childId];
      if (!child) return;
      const node = this.createElementElement(childId, child);
      if (node) content.appendChild(node);
    });

    const add = this.el("button", "add-button group-editor-add");
    add.appendChild(this.el("span", "plus", "+"));
    add.appendChild(document.createTextNode(" ADD COMMAND"));
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      window.ModalHandlers.openButtonModal(group.type, groupId);
    });
    content.appendChild(add);

    const close = this.el("button", "add-button", "CLOSE");
    close.style.marginTop = "10px";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeGroupEditor();
    });
    content.appendChild(close);

    container.appendChild(content);
    container.style.display = "block";
    container.dataset.groupId = groupId;

    const rect = anchorNode.getBoundingClientRect();
    container.style.position = "absolute";
    container.style.top = rect.bottom + 5 + "px";
    container.style.left = Math.max(8, rect.left) + "px";
    container.style.zIndex = "1000";
  },

  closeGroupEditor() {
    const container = document.getElementById("pulldownContentContainer");
    if (!container) return;
    container.style.display = "none";
    container.innerHTML = "";
    delete container.dataset.groupId;
    window.appState.activePulldown = null;
  },

  createStackElement(elementId, element) {
    const typeDef = window.BundleTypes.get("stack");
    const node = this.el("div", "stack");
    node.dataset.type = "stack";
    node.dataset.buttonId = elementId;
    node.draggable = true;
    node.title = "Stack - " + typeDef.postfix;

    const children = element.children || [];

    // Revit draws a stack as vertical rows inside one panel slot, so the
    // children get their own column rather than being laid out by the panel.
    const items = this.el("div", "stack-items");
    children.forEach((childId) => {
      const child = window.appState.elements[childId];
      if (!child) return;
      const childNode = this.createElementElement(childId, child);
      if (childNode) items.appendChild(childNode);
    });
    node.appendChild(items);

    // No stack label. Revit shows none, and a caption under the rows would make
    // the stack taller than the band a full-height button occupies, so the two
    // would no longer sit on the same baseline. The name is the folder name and
    // is visible in the tree; double-click renames it through the modal.

    // The add affordance is a row in the column, not an overlay. A stack reads
    // as "these commands, plus room for one more", so the + belongs where the
    // next command will land - at the bottom, in the same place as the third
    // row - rather than as a badge floating over the top-right corner.
    const remaining = typeDef.maxChildren - children.length;
    if (remaining > 0) {
      const add = this.el("div", "stack-add-button");
      add.setAttribute("role", "button");
      add.setAttribute("tabindex", "0");
      add.title =
        remaining +
        " slot" +
        (remaining === 1 ? "" : "s") +
        " free - click to add a command";
      add.setAttribute(
        "aria-label",
        "Add a command to stack " + element.name
      );
      add.addEventListener("click", (e) => {
        e.stopPropagation();
        window.ModalHandlers.openButtonModal("stack", elementId);
      });
      add.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        window.ModalHandlers.openButtonModal("stack", elementId);
      });
      node.appendChild(add);
    }

    node.title =
      "Stack - " +
      typeDef.postfix +
      ' "' +
      element.name +
      '" with ' +
      children.length +
      " command(s). Double-click to edit.";

    if (children.length < typeDef.minChildren) {
      node.classList.add("stack-invalid");
    }

    this.addDeleteButton(node, elementId, "element");
    node.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      window.ModalHandlers.editElement(elementId);
    });
    window.DragDrop.setupElementDragEvents(node);
    return node;
  },

  // ---------------------------------------------------------------------------
  // Folder preview disclosure
  // ---------------------------------------------------------------------------

  /**
   * The tree is collapsed by default and its state is remembered, so it stays
   * out of the way without the user having to re-collapse it every reload.
   * The <details> element does the toggling; this only restores and records.
   */
  setupPreviewDisclosure() {
    const details = document.getElementById("previewDisclosure");
    if (!details) return;

    details.open = !!window.Prefs.get("previewOpen", false);

    // A user's explicit toggle wins over the stored value, so only record it
    // once the element has been initialised - the open assignment above fires a
    // toggle event of its own.
    this._previewReady = true;
    details.addEventListener("toggle", () => {
      if (!this._previewReady) return;
      window.Prefs.set("previewOpen", details.open);
    });
  },

  /** A short one-line description of what the tree currently holds. */
  updatePreviewSummary() {
    const meta = document.getElementById("previewSummaryMeta");
    if (!meta) return;

    const details = document.getElementById("previewDisclosure");
    if (details && !details.open) {
      meta.textContent = "";
      return;
    }

    const counts = { bundle: 0, file: 0 };
    const walk = (node) => {
      if (node.type === "file") counts.file++;
      else if (node.type === "folder") counts.bundle++;
      (node.children || []).forEach(walk);
    };
    walk(window.FolderStructure.buildFolderStructure(window.FolderStructure.extensionName()));

    const problems = window.FolderStructure.validate();
    meta.textContent =
      counts.bundle +
      " folder" +
      (counts.bundle === 1 ? "" : "s") +
      ", " +
      counts.file +
      " file" +
      (counts.file === 1 ? "" : "s") +
      (problems.length ? "  \u26A0 " + problems.length + " to fix" : "");
  },

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  renameElement(elementId, next) {
    const element = window.appState.elements[elementId];
    if (!element) return;
    const trimmed = String(next || "").trim();
    if (!trimmed) {
      window.UIElements.renderPanels();
      return;
    }
    element.name = trimmed;
    window.FolderStructure.updateFolderPreview();
  },

  /**
   * Delete an element and everything under it. One place, so a delete can no
   * longer leave a dangling child behind.
   */
  removeElementRecursive(elementId) {
    const element = window.appState.elements[elementId];
    if (!element) return;

    const def = window.BundleTypes.get(element.type);
    if (def && def.container && element.children) {
      element.children.forEach((childId) => {
        this.removeElementRecursive(childId);
      });
    }

    if (element.panelId) {
      const panel = window.appState.panels[element.panelId];
      if (panel) {
        panel.elements = panel.elements.filter((id) => id !== elementId);
      }
    } else if (element.parentId) {
      const parent = window.appState.elements[element.parentId];
      if (parent && parent.children) {
        parent.children = parent.children.filter((id) => id !== elementId);
      }
    }

    delete window.appState.elements[elementId];
  },

  // ---------------------------------------------------------------------------
  // Delete buttons
  // ---------------------------------------------------------------------------

  addDeleteButton(node, id, kind) {
    const button = this.el("button", kind + "-delete-button");
    const element = window.appState.elements[id];
    const typeDef = element ? window.BundleTypes.get(element.type) : null;

    if (kind === "tab") {
      button.title = "Delete this tab and everything in it";
    } else if (kind === "panel") {
      button.title = "Delete this panel and everything in it";
    } else {
      button.title =
        "Remove this " +
        ((typeDef && typeDef.label) || "element").toLowerCase() +
        (element && element.name ? ' "' + element.name + '"' : "");
    }
    button.setAttribute("aria-label", button.title);

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleDelete(id, kind);
    });
    node.appendChild(button);
  },

  handleDelete(id, kind) {
    if (kind === "tab") {
      if (Object.keys(window.appState.tabs).length <= 1) {
        alert("Cannot delete the last tab. Add another tab first.");
        return;
      }
      const tab = window.appState.tabs[id];
      (tab.panels || []).forEach((panelId) => {
        const panel = window.appState.panels[panelId];
        if (!panel) return;
        (panel.elements || []).forEach((elementId) => {
          this.removeElementRecursive(elementId);
        });
        delete window.appState.panels[panelId];
      });
      delete window.appState.tabs[id];

      const remaining = Object.keys(window.appState.tabs);
      if (remaining.length) window.EventHandlers.activateTab(remaining[0]);
      window.FolderStructure.updateFolderPreview();
      return;
    }

    if (kind === "panel") {
      const panel = window.appState.panels[id];
      if (!panel) return;
      const tab = window.appState.tabs[panel.tabId];
      if (tab && tab.panels.length <= 1) {
        alert(
          "Cannot delete the last panel in a tab. Add another panel first or delete the entire tab."
        );
        return;
      }
      (panel.elements || []).forEach((elementId) => {
        this.removeElementRecursive(elementId);
      });
      if (tab) tab.panels = tab.panels.filter((pid) => pid !== id);
      delete window.appState.panels[id];
    } else {
      const element = window.appState.elements[id];
      const def = element ? window.BundleTypes.get(element.type) : null;
      if (def && def.container && (element.children || []).length) {
        const kindLabel = def.label.toLowerCase();
        if (
          !confirm(
            "This " +
              kindLabel +
              " contains " +
              element.children.length +
              " command(s). Delete them too?"
          )
        ) {
          return;
        }
      }
      this.removeElementRecursive(id);
    }

    this.closeGroupEditor();
    window.UIElements.renderPanels();
    window.FolderStructure.updateFolderPreview();
  },

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  renderPanels() {
    const tabId = window.appState.activeTabId;
    const tab = window.appState.tabs[tabId];
    const ribbonContainer = document.getElementById("ribbonContainer");
    if (!tab || !ribbonContainer) return;

    this.closeGroupEditor();
    ribbonContainer.innerHTML = "";

    (tab.panels || []).forEach((panelId) => {
      const panel = window.appState.panels[panelId];
      if (!panel) return;
      ribbonContainer.appendChild(this.createPanelElement(panelId, panel));
    });
  },

  setupDocumentClickHandler() {
    document.addEventListener("click", (e) => {
      const container = document.getElementById("pulldownContentContainer");
      if (!container || container.style.display !== "block") return;
      if (container.contains(e.target)) return;
      if (e.target.closest(".group")) return;
      this.closeGroupEditor();
    });
  },
};

window.UIElements = UIElements;
