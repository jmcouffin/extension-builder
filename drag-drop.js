// Drag and drop, with the legal-nesting rules read from BundleTypes.
const DragDrop = {
  dragged: null,

  setupDragAndDrop() {
    if (this._bound) return;
    this._bound = true;

    document.addEventListener("dragstart", (e) => {
      const node = e.target.closest && e.target.closest("[data-button-id]");
      if (!node) return;
      this.dragged = node;
    });

    document.addEventListener("dragover", (e) => {
      if (!this.dragged) return;
      const target = this.findDropTarget(e.target);
      if (target) {
        // Only claim the event when the drop would actually be legal, so the
        // cursor still shows "no drop" over an illegal target.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        this.clearHighlight();
        target.classList.add("drag-over");
      }
    });

    // dragleave does not bubble, so cleanup lives on dragend instead.
    document.addEventListener("dragend", () => {
      this.dragged = null;
      this.clearHighlight();
    });

    document.addEventListener("drop", (e) => {
      this.clearHighlight();
      const draggedNode = this.dragged;
      this.dragged = null;
      if (!draggedNode) return;

      const target = this.findDropTarget(e.target);
      if (!target) return;
      e.preventDefault();

      const elementId = draggedNode.dataset.buttonId;
      const element = window.appState.elements[elementId];
      if (!element) return;

      const containerId = target.classList.contains("stack")
        ? "stack"
        : target.classList.contains("group")
        ? window.appState.elements[target.dataset.buttonId].type
        : "panel";

      const verdict = this.canMove(element, elementId, containerId, target);
      if (!verdict.ok) {
        alert(verdict.reason);
        return;
      }

      this.move(elementId, element, containerId, target);

      window.UIElements.renderPanels();
      window.FolderStructure.updateFolderPreview();
    });
  },

  clearHighlight() {
    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  },

  setupElementDragEvents(element) {
    element.addEventListener("dragstart", (e) => {
      this.dragged = element;
      element.classList.add("dragging", "no-select");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", element.dataset.buttonId || "");
    });
    element.addEventListener("dragend", () => {
      element.classList.remove("dragging", "no-select");
      this.dragged = null;
      this.clearHighlight();
    });
  },

  findDropTarget(target) {
    let node = target;
    while (node && node !== document.body) {
      if (node.classList) {
        if (node.classList.contains("panel-content")) return node;
        if (node.classList.contains("stack")) return node;
        if (node.classList.contains("group-body")) return node;
      }
      node = node.parentElement;
    }
    return null;
  },

  /**
   * Everything that must hold before a drop is allowed, gathered in one place
   * so the modal and the drag path can never disagree.
   */
  canMove(element, elementId, containerId, targetNode) {
    const targetId = targetNode.dataset.buttonId;

    if (targetId === elementId) {
      return { ok: false, reason: "A bundle cannot contain itself." };
    }

    if (element.panelId === targetId || element.parentId === targetId) {
      return { ok: false, reason: "It is already in that container." };
    }

    const reason = window.BundleTypes.rejectionReason(containerId, element.type);
    if (reason) return { ok: false, reason: reason };

    // Cycle guard: never move a container into its own descendant.
    if (element.children) {
      if (this.isDescendant(targetId, element.children, elementId)) {
        return {
          ok: false,
          reason: "That would put the group inside one of its own commands.",
        };
      }
    }

    if (containerId === "stack") {
      const def = window.BundleTypes.get("stack");
      const stack = window.appState.elements[targetId];
      if (stack && (stack.children || []).length >= def.maxChildren) {
        return {
          ok: false,
          reason:
            "A stack holds at most " + def.maxChildren + " commands in Revit.",
        };
      }
    }

    if (this.isDuplicateName(element, elementId, containerId, targetId)) {
      return {
        ok: false,
        reason:
          'A command called "' +
          element.name +
          '" already exists in that container.',
      };
    }

    return { ok: true };
  },

  isDescendant(candidateId, children, rootId) {
    const stack = (children || []).slice();
    while (stack.length) {
      const id = stack.shift();
      if (id === candidateId) return true;
      const node = window.appState.elements[id];
      if (node && node.children) stack.push.apply(stack, node.children);
    }
    return false;
  },

  isDuplicateName(element, elementId, containerId, targetId) {
    let siblings = [];
    if (containerId === "panel") {
      const panel = window.appState.panels[targetId];
      siblings = panel ? panel.elements || [] : [];
    } else {
      const container = window.appState.elements[targetId];
      siblings = container ? container.children || [] : [];
    }
    const lowered = (element.name || "").toLowerCase();
    return siblings.some((id) => {
      if (id === elementId) return false;
      const el = window.appState.elements[id];
      return el && (el.name || "").toLowerCase() === lowered;
    });
  },

  move(elementId, element, containerId, targetNode) {
    // Detach from the old owner.
    if (element.panelId) {
      const panel = window.appState.panels[element.panelId];
      if (panel) panel.elements = panel.elements.filter((id) => id !== elementId);
      delete element.panelId;
    } else if (element.parentId) {
      const parent = window.appState.elements[element.parentId];
      if (parent && parent.children) {
        parent.children = parent.children.filter((id) => id !== elementId);
      }
      delete element.parentId;
    }

    if (containerId === "panel") {
      const panelId = targetNode.closest(".panel").dataset.panelId;
      window.appState.panels[panelId].elements.push(elementId);
      element.panelId = panelId;
      return;
    }

    const containerId_ = targetNode.dataset.buttonId;
    const container = window.appState.elements[containerId_];
    if (!container.children) container.children = [];
    container.children.push(elementId);
    element.parentId = containerId_;
  },
};

window.DragDrop = DragDrop;
