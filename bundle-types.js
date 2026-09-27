// Single source of truth for every bundle type the builder can produce.
//
// Every folder postfix below is transcribed from pyRevit's own parser:
//   dev/pyRevitLoader/pyRevitExtensionParser/ExtensionParser.cs:2465-2486
//     CommandComponentTypeExtensions.FromExtension
// Anything NOT in that switch is silently skipped at ExtensionParser.cs:1032-1035,
// so a type added here without a matching postfix is a type that never appears in Revit.
//
// Nesting rules are transcribed from:
//   pyrevitlib/pyrevit/extensions/components.py  (allowed_sub_cmps whitelists)
//   dev/pyRevitLoader/pyRevitAssemblyBuilder/UIManager/Builders/StackBuilder.cs:80,107-138
//     (.stack needs >= 2 visible children; Revit caps a stack at 3)
//   dev/.../ExtensionParser.cs:1037-1038
//     (DisplayName = folder basename incl. spaces, Name = same with spaces removed)

const BundleTypes = {
  VERSION: 2,

  // ---------------------------------------------------------------------------
  // Field definitions for the Advanced section of the modal.
  // `yamlKey` is the key pyRevit actually reads (BundleParser.cs:114-215).
  // ---------------------------------------------------------------------------
  FIELDS: {
    context: {
      label: "Context",
      input: "select",
      options: [
        { value: "", label: "(none - always enabled)" },
        { value: "zero-doc", label: "zero-doc (enabled with no document)" },
        { value: "selection", label: "selection (needs a selection)" },
        { value: "doc-project", label: "doc-project" },
        { value: "doc-family", label: "doc-family" },
        { value: "active-floor-plan", label: "active-floor-plan" },
        { value: "active-3d-view", label: "active-3d-view" },
        { value: "active-detail-view", label: "active-detail-view" },
        { value: "active-drafting-view", label: "active-drafting-view" },
      ],
      help: "No availability class is generated, so the button is always enabled.",
    },
    hyperlink: {
      label: "Hyperlink",
      input: "url",
      placeholder: "https://pyrevitlabs.io",
      help: "Opens in a browser. The only key a .urlbutton needs.",
    },
    assembly: {
      label: "Assembly",
      input: "text",
      placeholder: "MyCommands",
      help: "Compiled DLL name (no .dll), resolved from this bundle's bin/.",
    },
    command_class: {
      label: "Command Class",
      input: "text",
      placeholder: "MyCommand",
      help: "Namespace-qualified class implementing the command.",
    },
    availability_class: {
      label: "Availability Class",
      input: "text",
      placeholder: "MyCommandAvail",
      optional: true,
      help: "IExternalCommand deciding whether the button is enabled.",
    },
    members: {
      label: "ComboBox Members",
      input: "textarea",
      rows: 4,
      placeholder:
        "- id: first\n  text: First Item\n  group: Group A",
      help: "YAML list; each item needs an id and a text.",
    },
  },

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  // group:      picker section
  // container:  may hold children
  // accepts:    which child types are legal here ([] for leaves)
  // script:     emits a script file
  // advanced:   hide behind the Advanced disclosure
  // icons:      light icon files to emit
  // darkIcons:  dark-theme variants, emitted only when one is uploaded
  //
  // pyRevit collects every icon-like file in the bundle folder and sorts light
  // before dark (ExtensionParser.cs:2226-2240, GetIconTypePriority), so a
  // missing dark variant simply falls back to the light one. We therefore never
  // emit a dark file unless the user actually uploaded one.
  // ---------------------------------------------------------------------------
  types: {
    pushbutton: {
      postfix: ".pushbutton",
      label: "Push Button",
      glyph: "P",
      group: "Commands",
      script: true,
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      fields: ["context"],
    },

    toggle: {
      // A pyRevit toggle IS a smartbutton with on/off icons. There is no
      // .togglebutton postfix -- see PyRevitConsts.cs BundleToggleButtonPostfix,
      // which is dead code with no case in FromExtension.
      postfix: ".smartbutton",
      label: "Toggle",
      glyph: "T",
      group: "Commands",
      script: true,
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      toggle: true,
      fields: ["context"],
    },

    panelbutton: {
      postfix: ".panelbutton",
      label: "Panel Button",
      glyph: "P",
      group: "Commands",
      script: true,
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      // pyRevit forces these to zero-doc (genericcomps.py:633-635)
      forcedContext: "zero-doc",
      fields: ["context"],
    },

    urlbutton: {
      postfix: ".urlbutton",
      label: "URL Button",
      glyph: "U",
      group: "Links",
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      required: ["hyperlink"],
      fields: ["hyperlink", "context"],
    },

    content: {
      postfix: ".content",
      label: "Content Button",
      glyph: "R",
      group: "Links",
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      contentFile: "content.rfa",
      help: "Needs a content.rfa family in this folder.",
      fields: ["context"],
    },

    linkbutton: {
      postfix: ".linkbutton",
      label: "Link Button",
      glyph: "L",
      group: ".NET",
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      required: ["assembly", "command_class"],
      advanced: true,
      fields: ["assembly", "command_class", "availability_class"],
      help: "Binds to a .NET class. For links, use URL Button.",
    },

    invokebutton: {
      postfix: ".invokebutton",
      label: "Invoke Button",
      glyph: "I",
      group: ".NET",
      container: false,
      accepts: [],
      icons: ["icon.png"],
      darkIcons: ["icon.dark.png"],
      required: ["assembly", "command_class"],
      advanced: true,
      fields: ["assembly", "command_class", "availability_class"],
    },

    stack: {
      postfix: ".stack",
      label: "Stack",
      glyph: "S",
      group: "Groups",
      container: true,
      // StackBuilder.cs:107-138 renders exactly these and nothing else.
      accepts: [
        "pushbutton",
        "toggle",
        "urlbutton",
        "content",
        "linkbutton",
        "invokebutton",
        "pulldown",
        "splitbutton",
        "splitpushbutton",
      ],
      minChildren: 2, // StackBuilder.cs:80 - a 1-child stack silently vanishes
      maxChildren: 3, // AddStackedItems takes 2 or 3
      fields: [],
    },

    pulldown: {
      postfix: ".pulldown",
      label: "Pulldown",
      glyph: "D",
      group: "Groups",
      container: true,
      // GenericUICommandGroup.allowed_sub_cmps = [GenericUICommand, NoScriptButton]
      //   -> leaves only. No nested groups, no stacks.
      accepts: [
        "pushbutton",
        "toggle",
        "panelbutton",
        "urlbutton",
        "content",
        "linkbutton",
        "invokebutton",
        "nobutton",
      ],
      fields: ["context"],
    },

    splitbutton: {
      postfix: ".splitbutton",
      label: "Split Button",
      glyph: "X",
      group: "Groups",
      container: true,
      accepts: [
        "pushbutton",
        "toggle",
        "panelbutton",
        "urlbutton",
        "content",
        "linkbutton",
        "invokebutton",
        "nobutton",
      ],
      fields: ["context"],
    },

    splitpushbutton: {
      postfix: ".splitpushbutton",
      label: "Split Push Button",
      glyph: "X",
      group: "Groups",
      container: true,
      accepts: [
        "pushbutton",
        "toggle",
        "panelbutton",
        "urlbutton",
        "content",
        "linkbutton",
        "invokebutton",
        "nobutton",
      ],
      fields: ["context"],
    },

    combobox: {
      postfix: ".combobox",
      label: "Combo Box",
      glyph: "C",
      group: "Groups",
      container: false,
      // ComboBoxBuilder has no child handling at all; content comes from members:
      accepts: [],
      icons: [],
      required: ["members"],
      fields: ["members"],
    },

    nobutton: {
      postfix: ".nobutton",
      label: "No Button",
      glyph: "N",
      group: "Advanced",
      container: false,
      accepts: [],
      icons: [],
      advanced: true,
      fields: [],
      help: "A script bundle with no ribbon button.",
    },
  },

  // Order used by the modal picker. Anything absent is appended alphabetically.
  ORDER: [
    "pushbutton",
    "toggle",
    "panelbutton",
    "urlbutton",
    "content",
    "pulldown",
    "splitbutton",
    "splitpushbutton",
    "stack",
    "combobox",
    "linkbutton",
    "invokebutton",
    "nobutton",
  ],

  // Legacy id -> current id, used by save-load.js migrations.
  LEGACY: {
    togglebutton: "toggle",
  },

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

  get(id) {
    return this.types[id] || null;
  },

  exists(id) {
    return Object.prototype.hasOwnProperty.call(this.types, id);
  },

  // Every postfix pyRevit's CommandComponentTypeExtensions.FromExtension knows.
  // A type whose postfix is missing here would be skipped silently on load.
  KNOWN_POSTFIXES: [
    ".tab",
    ".panel",
    ".pushbutton",
    ".pulldown",
    ".splitbutton",
    ".splitpushbutton",
    ".stack",
    ".smartbutton",
    ".panelbutton",
    ".linkbutton",
    ".invokebutton",
    ".urlbutton",
    ".content",
    ".nobutton",
    ".combobox",
  ],

  /**
   * Does pyRevit's parser know this postfix? Guards against a typo in the table
   * above silently producing a folder Revit will never load.
   */
  isRealPostfix(postfix) {
    return this.KNOWN_POSTFIXES.indexOf(postfix) !== -1;
  },

  /**
   * Ordered list of type ids for the picker. `includeAdvanced` is for internal
   * use; the modal passes its own `container` filter and shows advanced types
   * under their own heading, so they stay reachable.
   */
  orderedIds(options) {
    const opts = options || {};
    const all = this.ORDER.filter((id) => this.exists(id));
    Object.keys(this.types).forEach((id) => {
      if (all.indexOf(id) === -1) all.push(id);
    });
    return opts.includeAdvanced === false
      ? all.filter((id) => !this.types[id].advanced)
      : all;
  },

  /** Child types legal inside `containerId`, honouring the nesting whitelist. */
  accepts(containerId) {
    if (containerId === "panel") {
      return this.orderedIds({ includeAdvanced: true }).filter(
        (id) => this.types[id].postfix !== ".nobutton"
      );
    }
    const def = this.get(containerId);
    return def && def.accepts ? def.accepts.slice() : [];
  },

  /**
   * Why a child type is illegal in a container, or null when it is fine.
   * Returns a human-readable reason so the UI never has to guess.
   */
  rejectionReason(containerId, childTypeId) {
    const child = this.get(childTypeId);
    if (!child) return "Unknown bundle type.";

    if (containerId === "panel") {
      return null;
    }
    if (containerId === "tab") {
      return "A tab can only contain panels.";
    }
    if (containerId === "extension") {
      return "An extension can only contain tabs.";
    }

    const container = this.get(containerId);
    if (!container) return "Unknown container.";
    if (!container.container) {
      return `${container.label} is a command, not a container.`;
    }
    if (container.accepts.indexOf(childTypeId) === -1) {
      const allowed = container.accepts
        .map((id) => this.types[id].label)
        .join(", ");
      return `${container.label} cannot contain ${child.label}. Allowed: ${allowed}.`;
    }
    return null;
  },

  /** Postfix -> id, used when walking a tree we did not build. */
  idForPostfix(postfix) {
    const found = Object.keys(this.types).find(
      (id) => this.types[id].postfix === postfix
    );
    return found || null;
  },
};

window.BundleTypes = BundleTypes;
