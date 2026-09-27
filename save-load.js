// Save / Load for pyRevit Extension Builder
const SaveLoad = {
  VERSION: "2.0",

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  saveExtension() {
    const extensionName = document.getElementById("extensionName").value;

    const snapshot = {
      version: this.VERSION,
      extensionName: extensionName,
      tabs: window.appState.tabs,
      panels: window.appState.panels,
      elements: window.appState.elements,
      activeTabId: window.appState.activeTabId,
      nextIds: window.appState.nextIds,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const fileName =
      window.templates.sanitizeFileName(extensionName) + "_layout.json";

    this.downloadBlob(blob, fileName);
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentElement) link.parentElement.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  },

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  loadExtension(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        let parsed;
        try {
          parsed = JSON.parse(event.target.result);
        } catch (error) {
          reject(new Error("That file is not valid JSON."));
          return;
        }

        const problem = this.validateLoadedState(parsed);
        if (problem) {
          reject(new Error(problem));
          return;
        }

        try {
          this.applyLoadedState(this.migrate(parsed));
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsText(file);
    });
  },

  validateLoadedState(state) {
    if (!state || typeof state !== "object") {
      return "That file is not an extension layout.";
    }
    const required = ["tabs", "panels", "elements", "extensionName"];
    for (let i = 0; i < required.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(state, required[i])) {
        return "Missing '" + required[i] + "' in that file.";
      }
    }
    if (typeof state.tabs !== "object" || !Object.keys(state.tabs).length) {
      return "That layout has no tabs.";
    }
    if (typeof state.panels !== "object" || !Object.keys(state.panels).length) {
      return "That layout has no panels.";
    }
    if (typeof state.elements !== "object") {
      return "That layout has an invalid element list.";
    }
    const version = state.version || "1.0";
    const major = parseInt(String(version).split(".")[0], 10);
    if (!(major === 1 || major === 2)) {
      return (
        "That layout is version " +
        version +
        ", which this builder cannot read. Rebuild it here instead."
      );
    }
    return null;
  },

  // ---------------------------------------------------------------------------
  // Migration
  // ---------------------------------------------------------------------------

  /**
   * Bring a loaded layout up to the current shape.
   *
   * v1 -> v2 changes that matter:
   *   togglebutton  -> toggle          (.togglebutton is not a pyRevit postfix)
   *   linkbutton+url-> urlbutton       (hyperlink: belongs to .urlbutton)
   *   invokebutton  -> keeps its type, but `command` becomes `command_class`
   *   iconData      -> split into iconData / iconDarkData / iconOnData
   *   context, panelId/parentId normalisation
   */
  migrate(state) {
    const version = state.version || "1.0";
    const major = parseInt(String(version).split(".")[0], 10);
    const out = {
      extensionName: state.extensionName,
      tabs: state.tabs || {},
      panels: state.panels || {},
      elements: state.elements || {},
      activeTabId: state.activeTabId,
      nextIds: state.nextIds,
    };

    const notes = [];

    Object.keys(out.elements).forEach((id) => {
      const el = out.elements[id];
      if (!el || typeof el !== "object") {
        delete out.elements[id];
        return;
      }

      if (major === 1) {
        // togglebutton -> toggle
        if (el.type === "togglebutton") {
          el.type = "toggle";
          notes.push('"' + el.name + '": Toggle Button -> Toggle');
        }

        // linkbutton with only a URL was never a link button; pyRevit needs
        // assembly + command_class for .linkbutton, and hyperlink: for .urlbutton.
        if (el.type === "linkbutton") {
          if (el.url && !el.assembly) {
            el.type = "urlbutton";
            el.hyperlink = el.url;
            delete el.url;
            notes.push('"' + el.name + '": Link Button -> URL Button');
          } else {
            el.command_class = el.command_class || el.command || "";
            delete el.command;
          }
        }

        // invokebutton: `command` was never a pyRevit key.
        if (el.type === "invokebutton") {
          el.command_class = el.command_class || el.command || "";
          delete el.command;
        }
      }

      // Icon fields: v1 had a single iconData only.
      if (!Object.prototype.hasOwnProperty.call(el, "iconDarkData")) {
        el.iconDarkData = null;
      }
      if (!Object.prototype.hasOwnProperty.call(el, "iconOnData")) {
        el.iconOnData = null;
      }
      if (typeof el.iconData === "undefined") el.iconData = null;

      // Ownership must be exactly one of panelId / parentId.
      const containerType =
        el.parentId && out.elements[el.parentId]
          ? out.elements[el.parentId].type
          : null;

      if (containerType && !window.BundleTypes.get(containerType).container) {
        // Parent is not a container, so this is a leaf that lost its parent.
        delete el.parentId;
      }
      if (el.panelId && el.parentId) delete el.panelId;

      // A type this builder no longer knows would export as nothing.
      if (!window.BundleTypes.exists(el.type)) {
        notes.push(
          '"' + (el.name || id) + '": unknown type "' + el.type + '" was dropped'
        );
        delete out.elements[id];
      }
    });

    if (notes.length) {
      console.info("Layout upgraded from v" + version + ":", notes);
    }

    out.nextIds = this.rebuildNextIds(out);
    out.activeTabId =
      out.activeTabId && out.tabs[out.activeTabId]
        ? out.activeTabId
        : Object.keys(out.tabs)[0];

    return out;
  },

  /**
   * Derive nextIds from the ids actually present.
   *
   * v1 layouts were not consistent about id prefixes ("button1", "b1",
   * "element7"), so we take the trailing number rather than assuming a prefix.
   * The old code used Math.max over a possibly-empty array, which yields
   * -Infinity and produced ids like "element-Infinity".
   */
  rebuildNextIds(state) {
    const next = { tab: 1, panel: 1, element: 1 };
    const bump = (ids, key) => {
      ids.forEach((id) => {
        const match = String(id).match(/(\d+)\s*$/);
        if (!match) return;
        const n = parseInt(match[1], 10);
        if (n >= next[key]) next[key] = n + 1;
      });
    };
    bump(Object.keys(state.tabs), "tab");
    bump(Object.keys(state.panels), "panel");
    bump(Object.keys(state.elements), "element");
    return next;
  },

  // ---------------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------------

  applyLoadedState(state) {
    const input = document.getElementById("extensionName");
    if (input) input.value = state.extensionName || "Loaded Extension";

    window.appState.tabs = state.tabs;
    window.appState.panels = state.panels;
    window.appState.elements = state.elements;
    window.appState.nextIds = state.nextIds;
    window.appState.activeTabId = state.activeTabId;

    // A layout saved with a group open must not leave that group's editor
    // floating over the freshly loaded extension.
    window.UIElements.closeGroupEditor();

    window.EventHandlers.renderTabs();
    window.EventHandlers.activateTab(window.appState.activeTabId);
    window.FolderStructure.updateFolderPreview();
  },

  openFileSelector() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) {
        document.body.removeChild(input);
        return;
      }
      this.loadExtension(file)
        .then(() => alert("Layout loaded."))
        .catch((error) => alert("Could not load that layout: " + error.message))
        .then(() => document.body.removeChild(input));
    });

    input.click();
  },

  initialize() {
    const saveButton = document.getElementById("saveConfig");
    const loadButton = document.getElementById("loadConfig");
    if (saveButton) saveButton.addEventListener("click", () => this.saveExtension());
    if (loadButton) loadButton.addEventListener("click", () => this.openFileSelector());
  },
};

window.SaveLoad = SaveLoad;
