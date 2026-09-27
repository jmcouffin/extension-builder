// Folder structure generation, validation and ZIP export.
const FolderStructure = {
  // Icons loaded from the app root, used when an element has no upload.
  defaultIconData: null,
  defaultDarkIconData: null,

  // 1x1 transparent PNG, used when nothing at all is available.
  PLACEHOLDER_PNG:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",

  // ---------------------------------------------------------------------------
  // Tree building
  // ---------------------------------------------------------------------------

  updateFolderPreview() {
    const structure = this.buildFolderStructure(this.extensionName());
    document.getElementById("folderPreview").textContent =
      this.formatFolderStructure(structure);
    this.updateExtensionNameHint();
    // Every mutation in the app already routes through here - adding, deleting,
    // renaming, dragging, loading. That makes it the one place the draft can
    // be written from without a dozen call sites that would eventually miss
    // one and silently stop persisting.
    if (window.Draft) window.Draft.save();
    if (window.UIElements && window.UIElements.updatePreviewSummary) {
      window.UIElements.updatePreviewSummary();
    }
  },

  /**
   * Warn only when the extension name cannot be used as-is. The resulting
   * folder name is deliberately NOT echoed here - it is the first line of the
   * folder tree, and repeating it beside the field was just noise.
   */
  updateExtensionNameHint() {
    const hint = document.getElementById("extensionNameHint");
    if (!hint) return;

    const raw = this.extensionName();
    const folder = window.templates.sanitizeFileName(raw);
    hint.innerHTML = "";

    const warn = (text) => {
      const span = document.createElement("span");
      span.className = "hint-warn";
      span.textContent = text;
      hint.appendChild(span);
    };

    if (!raw.trim()) {
      warn("Give the extension a name");
    } else if (folder === "Untitled") {
      warn("No usable folder characters in this name");
    } else if (folder !== raw.trim()) {
      // Spaces are legal in a pyRevit folder, but control characters and a
      // leading dot are not, so the name gets rewritten on save.
      warn("Saved as " + folder + ".extension");
    }
  },

  extensionName() {
    const input = document.getElementById("extensionName");
    return input ? input.value : "";
  },

  /**
   * Build the whole virtual file tree from appState.
   *
   * One recursive walk driven by BundleTypes. There is no per-type switch
   * anywhere, so a new type cannot be forgotten in one place but not another.
   */
  buildFolderStructure(extensionName) {
    const extension = window.templates.extensionStructure(extensionName);

    Object.keys(window.appState.tabs).forEach((tabId) => {
      const tab = window.appState.tabs[tabId];
      const tabFolder = window.templates.tab(tab.name);

      tab.panels.forEach((panelId) => {
        const panel = window.appState.panels[panelId];
        if (!panel) return;
        tabFolder.children.push(this.buildPanel(panelId, panel));
      });

      extension.children.push(tabFolder);
    });

    return extension;
  },

  buildPanel(panelId, panel) {
    const panelFolder = window.templates.panel(panel.name);
    const childNames = [];

    (panel.elements || []).forEach((elementId) => {
      const element = window.appState.elements[elementId];
      if (!element) return;
      const folder = this.buildElement(elementId, element, "panel");
      if (folder) {
        panelFolder.children.push(folder);
        childNames.push(folder.name.slice(0, -folder.postfix.length));
      }
    });

    // Preserve the order the user built, so pyRevit does not re-sort the panel
    // alphabetically. Only emitted when the orders actually differ.
    const layout = window.templates.buildLayoutYaml(childNames);
    const title = window.templates.yamlLine("title", panel.name);
    const yaml = title + layout;
    if (yaml.trim()) {
      panelFolder.children.unshift({
        name: "bundle.yaml",
        type: "file",
        content: yaml,
      });
    }

    return panelFolder;
  },

  /**
   * Build one element bundle and recurse into its children.
   * `containerId` is "panel" or a bundle type id, and decides what is legal
   * inside (BundleTypes.accepts).
   */
  buildElement(elementId, element, containerId) {
    const typeDef = window.BundleTypes.get(element.type);
    if (!typeDef) return null;

    const reason = window.BundleTypes.rejectionReason(containerId, element.type);
    if (reason) {
      this.rejected = this.rejected || [];
      this.rejected.push({
        element: element,
        container: containerId,
        reason: reason,
      });
      return null;
    }

    const folder = window.templates.buildBundle(element.type, element, elementId);
    if (!folder) return null;

    if (typeDef.container && element.children) {
      element.children.forEach((childId) => {
        const child = window.appState.elements[childId];
        if (!child) return;
        const childFolder = this.buildElement(childId, child, element.type);
        if (childFolder) folder.children.push(childFolder);
      });
    }

    return folder;
  },

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Everything that would produce a bundle pyRevit silently ignores, or a
   * folder collision in the ZIP. Returns [] when the extension is sound.
   */
  validate() {
    const problems = [];
    const seenFolders = {};

    const walk = (node, parentPath) => {
      if (node.type !== "folder") return;

      const full = parentPath ? parentPath + "/" + node.name : node.name;
      const key = full.toLowerCase();

      if (seenFolders[key]) {
        problems.push(
          "Two bundles map to the same folder: " +
            seenFolders[key] +
            " and " +
            full +
            ' ("My Button" and "my button" sanitise identically.)'
        );
      } else {
        seenFolders[key] = full;
      }

      if (node.contentFile) {
        problems.push(
          full +
            " is a " +
            node.postfix.replace(".", "") +
            " bundle and needs a " +
            node.contentFile +
            " family file. Add your own .rfa into that folder after unzipping."
        );
      }

      // A stack with fewer than minChildren is skipped by pyRevit
      // (StackBuilder.cs:80), so it is worse than useless: it looks fine in the
      // preview and produces no button at all.
      if (node.postfix === ".stack") {
        const min = window.BundleTypes.get("stack").minChildren;
        const childFolders = (node.children || []).filter(
          (c) => c.type === "folder"
        ).length;
        if (childFolders < min) {
          problems.push(
            full +
              " is a stack with " +
              childFolders +
              " command" +
              (childFolders === 1 ? "" : "s") +
              ". pyRevit needs at least " +
              min +
              " or it will not appear at all."
          );
        }
      }

      (node.children || []).forEach((child) => walk(child, full));
    };

    this.rejected = [];
    walk(this.buildFolderStructure(this.extensionName()), "");

    (this.rejected || []).forEach((r) => {
      problems.push('Element "' + r.element.name + '" was skipped: ' + r.reason);
    });
    this.rejected = [];

    // Required bundle.yaml keys. Without them pyRevit logs an error and the
    // command never binds to anything.
    Object.keys(window.appState.elements).forEach((id) => {
      const element = window.appState.elements[id];
      const typeDef = window.BundleTypes.get(element.type);
      if (!typeDef || !typeDef.required) return;
      const missing = typeDef.required.filter((key) => !element[key]);
      if (missing.length) {
        problems.push(
          typeDef.label +
            ' "' +
            element.name +
            '" is missing: ' +
            missing
              .map((k) => (window.BundleTypes.FIELDS[k] || {}).label || k)
              .join(", ") +
            ". Put them in the Advanced section."
        );
      }
    });

    Object.keys(window.appState.tabs).forEach((tabId) => {
      const tab = window.appState.tabs[tabId];
      if (!tab.panels || tab.panels.length === 0) {
        problems.push('Tab "' + tab.name + '" has no panels and will not appear.');
      }
    });

    const raw = this.extensionName();
    if (!raw.trim()) {
      problems.push("The extension has no name.");
    } else if (window.templates.sanitizeExtensionName(raw) === "Untitled") {
      problems.push(
        'The extension name "' + raw + '" has no characters usable in a folder name.'
      );
    }

    return problems;
  },

  // ---------------------------------------------------------------------------
  // Tree preview
  // ---------------------------------------------------------------------------

  formatFolderStructure(structure, prefix, isLast) {
    const line = "│   ";
    const corner = "└── ";
    const tee = "├── ";
    const blank = "    ";

    let output = (prefix || "") + (isLast === false ? tee : corner) + structure.name + "\n";
    const childPrefix = (prefix || "") + (isLast === false ? line : blank);

    (structure.children || []).forEach((child, index) => {
      output += this.formatFolderStructure(
        child,
        childPrefix,
        index === structure.children.length - 1
      );
    });

    return output;
  },

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  loadDefaultIcons() {
    return Promise.all([
      this.fetchDataUrl("icon.png"),
      this.fetchDataUrl("icon.dark.png"),
    ]).then((res) => {
      this.defaultIconData = res[0];
      this.defaultDarkIconData = res[1];
    });
  },

  fetchDataUrl(filename) {
    return fetch(filename)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return null;
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      })
      .catch(() => null);
  },

  /**
   * Base64 payload for an icon file, or null to fall back to the default.
   * An element with no upload must still get the bundled icon, not a blank
   * pixel, so every level falls through rather than returning early.
   */
  resolveIconData(node) {
    const element = node.elementId
      ? window.appState.elements[node.elementId]
      : null;
    const isDark = node.iconKey.indexOf(".dark.") !== -1;

    if (element) {
      if (isDark) {
        if (element.iconDarkData) return element.iconDarkData;
      } else if (node.iconKey === "on.png") {
        if (element.iconOnData) return element.iconOnData;
      } else if (node.iconKey === "off.png") {
        if (element.iconData) return element.iconData;
      } else if (element.iconData) {
        return element.iconData;
      }
    }

    // Nothing uploaded: use the icon bundled with the app. A dark variant
    // falls back to the light one, which is what pyRevit would do anyway.
    if (isDark) return this.defaultDarkIconData || this.defaultIconData || null;
    return this.defaultIconData || null;
  },

  // ---------------------------------------------------------------------------
  // ZIP
  // ---------------------------------------------------------------------------

  generateZipFile() {
    if (typeof JSZip === "undefined") {
      alert("Error: JSZip library not found. Cannot create ZIP file.");
      return;
    }

    const problems = this.validate();
    if (problems.length) {
      this.reportProblems(problems);
      return;
    }

    const downloadBtn = document.getElementById("downloadZip");
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = "CREATING ZIP FILE...";
    downloadBtn.disabled = true;

    this.loadDefaultIcons()
      .then(() => {
        const structure = this.buildFolderStructure(this.extensionName());
        const zip = new JSZip();
        this.addFolderToZip(zip, structure);
        return zip
          .generateAsync({ type: "blob", compression: "DEFLATE" })
          .then((blob) => ({ blob: blob, structure: structure }));
      })
      .then(({ blob, structure }) => {
        this.downloadBlob(blob, structure.name + ".zip");
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
      })
      .catch((error) => {
        console.error("Error creating ZIP:", error);
        alert("Failed to create ZIP file: " + error.message);
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
      });
  },

  reportProblems(problems) {
    const lines = problems
      .slice(0, 12)
      .map((p, i) => (i + 1) + ". " + p)
      .join("\n");
    const more =
      problems.length > 12 ? "\n...and " + (problems.length - 12) + " more." : "";
    alert(
      "This extension will not work as built:\n\n" +
        lines +
        more +
        "\n\nFix these and try again."
    );
  },

  downloadBlob(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentElement) link.parentElement.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 1000);
  },

  addFolderToZip(zip, folder, path) {
    const folderPath = path ? path + "/" + folder.name : folder.name;
    zip.folder(folderPath);

    (folder.children || []).forEach((child) => {
      if (child.type === "folder") {
        this.addFolderToZip(zip, child, folderPath);
      } else if (child.type === "file") {
        this.addFileToZip(zip, child, folderPath);
      }
    });
  },

  addFileToZip(zip, file, folderPath) {
    const filePath = folderPath + "/" + file.name;

    if (file.binary) {
      const data = this.resolveIconData(file);
      zip.file(filePath, data ? data.split(",")[1] : this.PLACEHOLDER_PNG, {
        base64: true,
      });
      return;
    }

    zip.file(filePath, file.content || "");
  },
};

window.FolderStructure = FolderStructure;
