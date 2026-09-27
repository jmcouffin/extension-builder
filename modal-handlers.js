const ModalHandlers = {
  DEFAULT_ICON:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDAwIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==",

  // ---------------------------------------------------------------------------
  // Type picker, generated from BundleTypes
  // ---------------------------------------------------------------------------

  /**
   * Render one tile per type legal in the target container.
   *
   * mode "command"   -> every non-container type legal in the container.
   * mode "container" -> only the container types, for the +GROUP button. Without
   *                    this the pulldown / splitbutton / splitpushbutton /
   *                    combobox bundles could never be created.
   */
  buildTypePicker(containerKey, mode) {
    const host = document.getElementById("buttonTypeGrid");
    host.innerHTML = "";
    const wantContainers = mode === "container";

    const groups = new Map();
    window.BundleTypes.orderedIds().forEach((id) => {
      const def = window.BundleTypes.get(id);
      if (!!def.container !== wantContainers) return;
      if (window.BundleTypes.rejectionReason(containerKey, id)) return;
      if (!groups.has(def.group)) groups.set(def.group, []);
      groups.get(def.group).push({ id: id, def: def });
    });

    groups.forEach((items, label) => {
      const section = document.createElement("div");
      section.className = "type-group";
      const heading = document.createElement("h4");
      heading.textContent = label;
      section.appendChild(heading);

      const row = document.createElement("div");
      row.className = "button-types";
      items.forEach(({ id, def }) => {
        const tile = document.createElement("div");
        tile.className = "button-type";
        tile.dataset.type = id;
        tile.title = def.help || def.postfix;

        const glyph = document.createElement("div");
        glyph.className = "type-icon";
        glyph.textContent = def.glyph;
        tile.appendChild(glyph);

        const name = document.createElement("div");
        name.className = "type-name";
        name.textContent = def.label;
        tile.appendChild(name);

        const postfix = document.createElement("div");
        postfix.className = "type-postfix";
        postfix.textContent = def.postfix;
        tile.appendChild(postfix);

        tile.addEventListener("click", () => this.selectButtonType(tile));
        row.appendChild(tile);
      });
      section.appendChild(row);
      host.appendChild(section);
    });
  },

  selectButtonType(tile) {
    if (!tile) return;
    document.querySelectorAll(".button-type").forEach((t) => {
      t.classList.remove("selected");
    });
    tile.classList.add("selected");
    this.applyModeVisibility();
  },

  selectedType() {
    const tile = document.querySelector(".button-type.selected");
    return tile ? tile.dataset.type : null;
  },

  // ---------------------------------------------------------------------------
  // Advanced fields, declared by the type table
  // ---------------------------------------------------------------------------

  buildAdvancedFields() {
    const host = document.getElementById("advancedFields");
    host.innerHTML = "";
    this.fieldNodes = {};

    Object.keys(window.BundleTypes.FIELDS).forEach((key) => {
      const def = window.BundleTypes.FIELDS[key];
      const group = document.createElement("div");
      group.className = "form-group advanced-field";
      group.dataset.field = key;

      const label = document.createElement("label");
      label.setAttribute("for", "adv_" + key);
      label.textContent = def.label + (def.optional ? " (optional)" : "");
      group.appendChild(label);

      let input;
      if (def.input === "select") {
        input = document.createElement("select");
        def.options.forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        });
      } else if (def.input === "textarea") {
        input = document.createElement("textarea");
        input.rows = def.rows || 4;
      } else {
        input = document.createElement("input");
        input.type = def.input === "url" ? "url" : "text";
      }
      input.id = "adv_" + key;
      if (def.placeholder) input.placeholder = def.placeholder;
      group.appendChild(input);

      if (def.help) {
        const help = document.createElement("div");
        help.className = "field-help";
        help.textContent = def.help;
        group.appendChild(help);
      }

      this.fieldNodes[key] = { group: group, input: input, def: def };
      host.appendChild(group);
    });
  },

  /** Show only the fields the selected type declares, and nothing else. */
  syncAdvancedFields() {
    const typeId = this.selectedType();
    const typeDef = typeId ? window.BundleTypes.get(typeId) : null;
    if (!typeDef) return;

    let anyVisible = false;

    Object.keys(this.fieldNodes).forEach((key) => {
      const node = this.fieldNodes[key];
      const wanted = typeDef.fields.indexOf(key) !== -1;

      if (!wanted) {
        node.group.style.display = "none";
        return;
      }

      anyVisible = true;
      node.group.style.display = "block";
      node.input.disabled = false;

      if (typeDef.forcedContext && key === "context") {
        // pyRevit forces these to zero-doc regardless (genericcomps.py:633-635)
        node.input.value = typeDef.forcedContext;
        node.input.disabled = true;
      }
    });

    const disclosure = document.getElementById("advancedDisclosure");
    const body = document.getElementById("advancedBody");
    body.style.display = anyVisible ? "block" : "none";
    disclosure.style.display = anyVisible ? "block" : "none";
    if (!anyVisible) disclosure.open = false;

    // Extra icon slots only matter for some types.
    const onIconGroup = document.getElementById("onIconGroup");
    if (onIconGroup) onIconGroup.style.display = typeDef.toggle ? "block" : "none";
  },

  readAdvancedFields() {
    const values = {};
    const typeId = this.selectedType();
    const typeDef = typeId ? window.BundleTypes.get(typeId) : null;
    if (!typeDef) return values;

    typeDef.fields.forEach((key) => {
      const node = this.fieldNodes[key];
      if (!node) return;
      values[key] = node.input.value.trim();
    });
    return values;
  },

  setAdvancedFields(element, typeDef) {
    Object.keys(this.fieldNodes).forEach((key) => {
      const node = this.fieldNodes[key];
      const value = element ? element[key] : "";
      node.input.value =
        typeDef.forcedContext && key === "context"
          ? typeDef.forcedContext
          : value || "";
    });
  },

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  openButtonModal(target, containerId, presetType) {
    const modal = document.getElementById("buttonModal");
    modal.dataset.target = target;
    modal.dataset.containerId = containerId;
    modal.dataset.mode = "command";
    delete modal.dataset.elementId;
    delete modal.dataset.originalType;

    const containerKey = target === "panel" ? "panel" : target;

    this.resetCommonFields();
    this.buildTypePicker(containerKey, "command");
    this.buildAdvancedFields();

    const first = presetType
      ? document.querySelector('.button-type[data-type="' + presetType + '"]')
      : document.querySelector(".button-type");
    this.selectButtonType(first || document.querySelector(".button-type"));

    document.getElementById("modalTitle").textContent = "New Command";
    document.getElementById("createButton").textContent = "Create";
    this.applyModeVisibility();
    modal.style.display = "block";
  },

  /** +GROUP: pick a container type, hide the fields a container cannot use. */
  openGroupModal(containerId) {
    const modal = document.getElementById("buttonModal");
    modal.dataset.target = "panel";
    modal.dataset.containerId = containerId;
    modal.dataset.mode = "container";
    delete modal.dataset.elementId;
    delete modal.dataset.originalType;

    this.resetCommonFields();
    this.buildTypePicker("panel", "container");
    this.buildAdvancedFields();
    this.selectButtonType(document.querySelector(".button-type"));

    document.getElementById("modalTitle").textContent = "New Group";
    document.getElementById("createButton").textContent = "Create";
    this.applyModeVisibility();
    modal.style.display = "block";
  },

  resetCommonFields() {
    document.getElementById("buttonName").value = this.nextDefaultGroupName();
    document.getElementById("buttonTitle").value = "";
    document.getElementById("buttonTooltip").value = "";
    document.getElementById("buttonCode").value = "";
    document.getElementById("buttonIcon").value = "";
    document.getElementById("buttonDarkIcon").value = "";
    document.getElementById("buttonOnIcon").value = "";
    const host = document.getElementById("iconPreview");
    host.innerHTML = "";
    const img = document.createElement("img");
    img.src = this.DEFAULT_ICON;
    img.alt = "Default Icon";
    host.appendChild(img);
    const note = document.getElementById("typeNote");
    note.style.display = "none";
    note.textContent = "";
  },

  nextDefaultGroupName() {
    const taken = Object.keys(window.appState.elements)
      .map((k) => window.appState.elements[k])
      .filter((e) => e && window.BundleTypes.get(e.type).container)
      .map((e) => e.name);
    if (taken.indexOf("NEW GROUP") === -1) return "NEW GROUP";
    let n = 1;
    while (taken.indexOf("NEW GROUP " + n) !== -1) n++;
    return "NEW GROUP " + n;
  },

  /** Containers have no script, so those fields go away for them. */
  applyModeVisibility() {
    const typeId = this.selectedType();
    const typeDef = typeId ? window.BundleTypes.get(typeId) : null;
    const isCommand = !!(typeDef && typeDef.script);

    document.getElementById("buttonCodeGroup").style.display = isCommand
      ? "block"
      : "none";
    document.getElementById("buttonTitle").disabled = !typeDef || !typeDef.script;
    document.getElementById("buttonTooltip").disabled = !typeDef || !typeDef.script;

    const iconGroup = document.getElementById("buttonIconGroup");
    if (iconGroup) {
      iconGroup.style.display = typeDef && (typeDef.icons || []).length ? "block" : "none";
    }

    const onIconGroup = document.getElementById("onIconGroup");
    if (onIconGroup) onIconGroup.style.display = typeDef && typeDef.toggle ? "block" : "none";

    this.syncAdvancedFields();
  },

  editElement(elementId) {
    const element = window.appState.elements[elementId];
    if (!element) return;

    const typeDef = window.BundleTypes.get(element.type);
    if (!typeDef) {
      alert(
        'Element "' +
          element.name +
          '" has an unrecognised type (' +
          element.type +
          "). It cannot be edited."
      );
      return;
    }

    const modal = document.getElementById("buttonModal");
    modal.dataset.target = "edit";
    modal.dataset.containerId = element.panelId || element.parentId;
    modal.dataset.elementId = elementId;
    modal.dataset.originalType = element.type;

    document.getElementById("buttonName").value = element.name || "";
    document.getElementById("buttonTitle").value = element.title || "";
    document.getElementById("buttonTooltip").value = element.tooltip || "";
    document.getElementById("buttonCode").value = element.code || "";
    document.getElementById("buttonIcon").value = "";
    document.getElementById("buttonDarkIcon").value = "";
    document.getElementById("buttonOnIcon").value = "";

    const previewHost = document.getElementById("iconPreview");
    previewHost.innerHTML = "";
    const preview = document.createElement("img");
    preview.src = this.DEFAULT_ICON;
    if (element.iconData) {
      preview.src = element.iconData;
      preview.alt = "Current Icon";
    }
    previewHost.appendChild(preview);

    // The picker is scoped to the container this element already lives in, and
    // must offer the type it currently has.
    const containerKey = element.parentId
      ? window.appState.elements[element.parentId].type
      : "panel";
    const isContainer = !!typeDef.container;
    this.buildTypePicker(containerKey, isContainer ? "container" : "command");
    this.buildAdvancedFields();

    const tile = document.querySelector(
      '.button-type[data-type="' + element.type + '"]'
    );
    if (tile) {
      this.selectButtonType(tile);
    }

    const note = document.getElementById("typeNote");
    if (tile) {
      note.style.display = "none";
      note.textContent = "";
    } else {
      // Reached via an old layout: the type is legal in pyRevit but not
      // creatable in this container, so say so instead of crashing.
      note.textContent =
        "A " +
        typeDef.label +
        " (" +
        typeDef.postfix +
        ") already exists here, but it cannot be created from this container.";
      note.style.display = "block";
    }

    this.setAdvancedFields(element, typeDef);
    this.applyModeVisibility();

    document.getElementById("createButton").textContent = "Update";
    document.getElementById("modalTitle").textContent = "Edit " + typeDef.label;
    modal.style.display = "block";
  },

  closeModal() {
    document.getElementById("buttonModal").style.display = "none";
    document.getElementById("createButton").textContent = "Create";
  },

  // ---------------------------------------------------------------------------
  // Naming
  // ---------------------------------------------------------------------------

  /** Lowest unused "Button N" among a container's children. */
  nextDefaultName(containerId) {
    let siblings = [];
    const panel = window.appState.panels[containerId];
    if (panel) siblings = panel.elements || [];
    else {
      const container = window.appState.elements[containerId];
      if (container) siblings = container.children || [];
    }

    const used = siblings
      .map((id) => window.appState.elements[id])
      .filter((el) => el && /^Button \d+$/.test(el.name || ""))
      .map((el) => parseInt(el.name.replace("Button ", ""), 10));

    let n = 1;
    while (used.indexOf(n) !== -1) n++;
    return "Button " + n;
  },

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  bindIconInput(inputId, previewHostId) {
    const input = document.getElementById(inputId);
    const host = document.getElementById(previewHostId);
    if (!input || !host) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        host.innerHTML = "";
        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = "Icon Preview";
        host.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  },

  readFileAsDataUrl(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.files || !input.files.length) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(input.files[0]);
    });
  },

  // ---------------------------------------------------------------------------
  // Create / update
  // ---------------------------------------------------------------------------

  createNewElement() {
    const modal = document.getElementById("buttonModal");
    const newType = this.selectedType();
    if (!newType) {
      alert("Pick a command type first.");
      return;
    }

    const typeDef = window.BundleTypes.get(newType);
    const name = document.getElementById("buttonName").value.trim();
    if (!name) {
      alert("A name is required - it becomes the bundle folder name.");
      return;
    }

    const advanced = this.readAdvancedFields();

    // Required fields: without these pyRevit logs an error and the button
    // never binds.
    if (typeDef.required) {
      for (let i = 0; i < typeDef.required.length; i++) {
        const key = typeDef.required[i];
        if (!advanced[key]) {
          const fieldDef = window.BundleTypes.FIELDS[key];
          alert(
            (fieldDef ? fieldDef.label : key) + " is required for a " + typeDef.label + "."
          );
          this.openDisclosure();
          return;
        }
      }
    }

    const target = modal.dataset.target;
    const containerId = modal.dataset.containerId;

    Promise.all([
      this.readFileAsDataUrl("buttonIcon"),
      this.readFileAsDataUrl("buttonDarkIcon"),
      this.readFileAsDataUrl("buttonOnIcon"),
    ]).then(([iconData, iconDarkData, iconOnData]) => {
      const payload = {
        type: newType,
        name: name,
        title: document.getElementById("buttonTitle").value.trim(),
        tooltip: document.getElementById("buttonTooltip").value.trim(),
        code: document.getElementById("buttonCode").value,
        iconData: iconData,
        iconDarkData: iconDarkData,
        iconOnData: iconOnData,
      };
      Object.keys(advanced).forEach((k) => {
        payload[k] = advanced[k];
      });

      if (target === "edit") {
        this.applyEdit(modal.dataset.elementId, payload, modal.dataset.originalType);
      } else {
        this.applyCreate(payload, target, containerId);
      }
    });
  },

  openDisclosure() {
    const disclosure = document.getElementById("advancedDisclosure");
    if (disclosure) disclosure.open = true;
  },

  applyCreate(payload, target, containerId) {
    if (this.isDuplicateName(payload.name, containerId, target)) {
      alert(
        "A command with this name already exists in the same container. Please choose a different name."
      );
      return;
    }

    const elementId = "element" + window.appState.nextIds.element++;
    if (window.BundleTypes.get(payload.type).container) payload.children = [];
    window.appState.elements[elementId] = payload;

    if (target === "panel") {
      window.appState.panels[containerId].elements.push(elementId);
      payload.panelId = containerId;
    } else {
      const container = window.appState.elements[containerId];
      if (!container.children) container.children = [];
      container.children.push(elementId);
      payload.parentId = containerId;
    }

    this.closeModal();
    this.afterMutation();
  },

  applyEdit(elementId, payload, originalType) {
    const element = window.appState.elements[elementId];
    if (!element) return;

    const originalDef = window.BundleTypes.get(originalType);
    const newDef = window.BundleTypes.get(payload.type);

    if (originalType !== payload.type) {
      const originalChildren = (element.children || []).length;
      const wasContainer = originalDef && originalDef.container;
      const isContainer = newDef.container;

      if (wasContainer && !isContainer) {
        if (originalChildren) {
          if (
            !confirm(
              "This " +
                originalDef.label.toLowerCase() +
                " contains " +
                originalChildren +
                " command(s). Changing it to a " +
                newDef.label.toLowerCase() +
                " will delete them. Continue?"
            )
          ) {
            this.closeModal();
            return;
          }
          element.children.forEach((childId) => {
            window.UIElements.removeElementRecursive(childId);
          });
        }
        delete element.children;
        delete payload.children;
      } else if (!wasContainer && isContainer) {
        payload.children = [];
      }
    }

    // A container keeps its children; a leaf must never carry any, because
    // FolderStructure would otherwise recurse into folders pyRevit ignores.
    if (newDef.container) {
      payload.children = element.children || [];
    } else {
      delete payload.children;
    }

    // Icon fields: an empty upload means "keep what is there".
    if (!payload.iconData) payload.iconData = element.iconData || null;
    if (!payload.iconDarkData) payload.iconDarkData = element.iconDarkData || null;
    if (!payload.iconOnData) payload.iconOnData = element.iconOnData || null;

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete element[key];
      } else {
        element[key] = payload[key];
      }
    });

    this.closeModal();
    this.afterMutation();
  },

  afterMutation() {
    window.UIElements.renderPanels();
    window.FolderStructure.updateFolderPreview();
  },

  isDuplicateName(name, containerId, target) {
    const lowered = name.toLowerCase();
    let siblings = [];
    if (target === "panel") {
      const panel = window.appState.panels[containerId];
      siblings = panel ? panel.elements || [] : [];
    } else {
      const container = window.appState.elements[containerId];
      siblings = container ? container.children || [] : [];
    }
    return siblings.some((id) => {
      const el = window.appState.elements[id];
      return el && (el.name || "").toLowerCase() === lowered;
    });
  },
};

window.ModalHandlers = ModalHandlers;
