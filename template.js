// Template generation for pyRevit extension files.
//
// Every bundle folder is produced by buildBundle(), which reads its shape from
// window.BundleTypes. Adding a type means adding one row to that table.

const templates = {
  // ---------------------------------------------------------------------------
  // Names
  // ---------------------------------------------------------------------------

  /**
   * Folder-name sanitiser.
   *
   * pyRevit derives a button's DisplayName from the folder basename including
   * spaces (ExtensionParser.cs:1037-1038) and its own bundled extensions use
   * spaces freely -- "Packages & Tags.panel", "pyRevit Bundles Creator.tab".
   * So spaces are KEPT. What we must remove:
   *   - characters Windows forbids in a folder name
   *   - a leading "." or "_", which pyRevit skips entirely (parser.py:60-65)
   *   - trailing dots and spaces, which Windows silently strips
   */
  sanitizeFileName(name) {
    let out = String(name == null ? "" : name);

    // Windows-illegal path characters and control codes become a space.
    // Hyphens, ampersands and underscores are legal and are left alone.
    out = out.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ");
    // Collapse runs of whitespace to a single space.
    out = out.replace(/\s+/g, " ").trim();
    // A leading . or _ makes pyRevit ignore the folder entirely.
    out = out.replace(/^[.\s]+/, "");
    // Windows strips trailing dots and spaces; do it ourselves so the name we
    // show in the preview matches the name on disk.
    out = out.replace(/[.\s]+$/, "");

    return out || "Untitled";
  },

  /**
   * Same, but for the extension folder where the ".extension" postfix is
   * appended separately.
   */
  sanitizeExtensionName(name) {
    return this.sanitizeFileName(name);
  },

  // ---------------------------------------------------------------------------
  // YAML
  // ---------------------------------------------------------------------------

  /**
   * Emit a YAML value. Strings are ALWAYS double-quoted, which removes the
   * entire class of bug where a title containing ": " or " #" silently
   * truncates. Booleans and numbers stay unquoted because pyRevit type-checks
   * them (is_beta, highlight).
   */
  yamlValue(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number" && isFinite(value)) return String(value);

    const str = String(value == null ? "" : value);
    const escaped = str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/\t/g, "\\t");

    return '"' + escaped + '"';
  },

  /** key: value line, omitted entirely when the value is empty. */
  yamlLine(key, value) {
    if (value === undefined || value === null || value === "") return "";
    return key + ": " + this.yamlValue(value) + "\n";
  },

  /**
   * Build a bundle.yaml for one element.
   * Only keys pyRevit actually reads (BundleParser.cs:114-215) are emitted.
   */
  buildYaml(element, typeDef) {
    let yaml = "";

    yaml += this.yamlLine("title", element.title || element.name);
    yaml += this.yamlLine("tooltip", element.tooltip);

    // context drives availability-class generation; without it the button is
    // always enabled (ExtensionParser.cs:1351-1370).
    const context = typeDef.forcedContext || element.context;
    if (typeDef.fields.indexOf("context") !== -1 && context) {
      yaml += this.yamlLine("context", context);
    }

    if (typeDef.required) {
      typeDef.required.forEach((key) => {
        yaml = this.yamlField(yaml, key, element[key]);
      });
    }

    typeDef.fields.forEach((key) => {
      if (typeDef.required && typeDef.required.indexOf(key) !== -1) return;
      yaml = this.yamlField(yaml, key, element[key]);
    });

    return yaml;
  },

  /**
   * Append one field. A textarea field (only `members` today) is a YAML block
   * the user authored; everything else is a quoted scalar.
   */
  yamlField(yaml, key, value) {
    if (value === undefined || value === null || value === "") return yaml;
    const def = window.BundleTypes.FIELDS[key];
    if (def && def.input === "textarea") {
      return yaml + key + ":\n" + this.indent(value, 2) + "\n";
    }
    return yaml + this.yamlLine(key, value);
  },

  indent(text, spaces) {
    const pad = " ".repeat(spaces);
    return String(text)
      .replace(/\r\n|\r|\n/g, "\n")
      .split("\n")
      .map((line) => (line.length ? pad + line : line))
      .join("\n");
  },

  /**
   * A panel-level layout: list children in the order the user built them so
   * pyRevit does not re-sort them alphabetically (ExtensionParser.cs:679-738).
   * Returns null when alphabetical order already matches, so we do not emit a
   * redundant key.
   */
  buildLayoutYaml(childDisplayNames) {
    if (!childDisplayNames || childDisplayNames.length < 2) return "";
    const alpha = childDisplayNames.slice().sort();
    const same = alpha.every((n, i) => n === childDisplayNames[i]);
    if (same) return "";

    let yaml = "layout:\n";
    childDisplayNames.forEach((name) => {
      // "[" starts a [title:...] directive in BundleParser.cs:317-334.
      yaml += "  - " + this.yamlValue(name) + "\n";
    });
    return yaml;
  },

  buildExtensionJson(name, author) {
    const data = {
      type: "extension",
      name: name,
      description: "Generated with the pyRevit Extension Builder",
    };
    if (author) data.author = author;
    data.default_enabled = "True";
    return JSON.stringify(data, null, 4) + "\n";
  },

  buildInstallReadme(extensionName) {
    return [
      "pyRevit Extension - " + extensionName,
      "=======================================",
      "",
      "INSTALL",
      "------",
      "1. Unzip this archive anywhere.",
      "2. Copy the '" + extensionName + ".extension' folder into:",
      "",
      "     %APPDATA%\\pyRevit\\Extensions",
      "",
      "   (In Revit this is the folder behind pyRevit's 'Extensions' tab, or",
      "    the path shown in pyRevit settings under 'User Extensions'.)",
      "",
      "3. Reload pyRevit, or restart Revit. pyRevit caches bundle.yaml by",
      "   file timestamp, so edits are not picked up until a reload.",
      "",
      "FOLDER NAMING",
      "-------------",
      "The suffix on each folder is how pyRevit identifies the bundle type:",
      "",
      "  .extension  the extension root",
      "  .tab        a ribbon tab",
      "  .panel      a ribbon panel",
      "  .stack      2-3 buttons shown side by side (needs at least 2)",
      "  .pulldown   a drop-down list of commands",
      "",
      "A folder whose suffix pyRevit does not recognise is skipped silently,",
      "so do not rename these suffixes.",
      "",
      "COMMAND FILES",
      "-------------",
      "  script.py    the entry point. pyRevit picks the script engine from",
      "               the file extension (.py, .cs, .vb, .rb, .dyn, .gh, .ghx).",
      "  bundle.yaml  optional metadata; a missing file is fine.",
      "  icon.png     button icon (icon.dark.png for the dark theme).",
      "  on.png / off.png   the two states of a Toggle (a .smartbutton).",
      "  config.py    optional; runs on shift-click instead of script.py.",
      "",
      "  Add a lib/ folder to a bundle to make extra Python modules importable",
      "  from its script. bin/ works the same way for compiled assemblies.",
      "",
    ].join("\n");
  },

  // ---------------------------------------------------------------------------
  // Default scripts
  // ---------------------------------------------------------------------------

  defaultScript(element, typeDef) {
    const name = element.name || "Untitled";
    const title = element.title || name;
    const author = element.author || "pyRevit Extension Builder";

    if (typeDef.toggle) return this.toggleScript(title, author);
    return this.commandScript(title, author);
  },

  commandScript(title, author) {
    return `# -*- coding: utf-8 -*-
"""${title}

Created with the pyRevit Extension Builder.
"""
__title__ = "${title}"
__author__ = "${author}"

from pyrevit import revit, DB, UI, script, forms

output = script.get_output()
doc = revit.doc

# ---------------------------------------------------------------------------
# Your command goes here.
#
# Anything a pyRevit command changes in the model must run inside a
# transaction:
#
#     with revit.Transaction("My change"):
#         ...
#
# ---------------------------------------------------------------------------

if doc:
    output.print_md("# " + __title__)
    output.print_md("Document: **{}**".format(doc.Title))
    if doc.PathName:
        output.print_md("Path: " + doc.PathName)
    output.print_md("Active view: **{}**".format(doc.ActiveView.Name))
else:
    output.print_md("No document is open.")
`;
  },

  /**
   * The canonical pyRevit toggle: a .smartbutton with on.png/off.png, its state
   * held in an env var, and script.toggle_icon() swapping the icon. See
   * script.py:467 for toggle_icon and script.py:580/603 for the env vars.
   */
  toggleScript(title, author) {
    return `# -*- coding: utf-8 -*-
"""${title}

A toggle button: a pyRevit smartbutton with on.png / off.png icons whose
state survives between runs.

Created with the pyRevit Extension Builder.
"""
__title__ = "${title}"
__author__ = "${author}"

from pyrevit import revit, DB, UI, script, forms

# Env var name for this toggle's state. Change it to keep two toggles separate.
ENV_VAR = "${title}".replace(" ", "_").upper() + "_ENABLED"

# Flip the state and tell the button which icon to show.
enabled = not script.get_envvar(ENV_VAR)
script.set_envvar(ENV_VAR, enabled)
script.toggle_icon(enabled)

output = script.get_output()
output.print_md("# " + __title__)
output.print_md("State: **{}**".format("ON" if enabled else "OFF"))

# ---------------------------------------------------------------------------
# Do the actual work. Branch on \`enabled\`.
# ---------------------------------------------------------------------------
`;
  },

  // ---------------------------------------------------------------------------
  // Bundle construction
  // ---------------------------------------------------------------------------

  extensionStructure(extensionName, options) {
    const opts = options || {};
    const safe = this.sanitizeExtensionName(extensionName);

    return {
      name: safe + ".extension",
      type: "folder",
      children: [
        {
          name: "extension.json",
          type: "file",
          content: this.buildExtensionJson(safe, opts.author || ""),
        },
        {
          name: "INSTALL.txt",
          type: "file",
          content: this.buildInstallReadme(safe),
        },
      ],
    };
  },

  tab(tabName) {
    return {
      name: this.sanitizeFileName(tabName) + ".tab",
      type: "folder",
      children: [],
    };
  },

  panel(panelName) {
    return {
      name: this.sanitizeFileName(panelName) + ".panel",
      type: "folder",
      children: [],
    };
  },

  /**
   * Build the folder for one element bundle. Child ELEMENTS are not added
   * here; FolderStructure walks them recursively so the nesting rules live in
   * one place.
   */
  buildBundle(typeId, element, elementId) {
    const typeDef = window.BundleTypes.get(typeId);
    if (!typeDef) return null;

    const folder = {
      name: this.sanitizeFileName(element.name) + typeDef.postfix,
      type: "folder",
      postfix: typeDef.postfix,
      children: [],
    };

    // bundle.yaml, when the type has anything worth saying.
    const yaml = this.buildYaml(element, typeDef);
    if (yaml.trim()) {
      folder.children.push({ name: "bundle.yaml", type: "file", content: yaml });
    }

    if (typeDef.script) {
      folder.children.push({
        name: "script.py",
        type: "file",
        content: element.code || this.defaultScript(element, typeDef),
      });
    }

    if (typeDef.contentFile) {
      // pyRevit looks for content.rfa / content_<year>.rfa / any *.rfa
      // (ExtensionParser.cs:1149-1225). The user drops their own in.
      folder.contentFile = typeDef.contentFile;
    }

    // Icons. Only files we can actually fill get emitted: pyRevit falls back to
    // the light icon when a dark variant is absent, and a toggle with on.png ==
    // off.png would just look broken.
    const addIcon = (iconName) => {
      folder.children.push({
        name: iconName,
        type: "file",
        binary: true,
        iconKey: iconName,
        elementId: elementId,
      });
    };

    (typeDef.icons || []).forEach(addIcon);
    if (element.iconDarkData) {
      (typeDef.darkIcons || []).forEach(addIcon);
    }
    if (typeDef.toggle && element.iconOnData) {
      addIcon("on.png");
      addIcon("off.png");
    }

    return folder;
  },
};

window.templates = templates;
