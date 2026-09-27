// Draft persistence.
//
// The ribbon is a workbench, so an in-progress extension should survive a
// reload without asking the user to save a file first. Every mutation already
// routes through FolderStructure.updateFolderPreview(), so that is where the
// draft is written from - one hook instead of a dozen call sites that would
// eventually miss one.
//
// This is deliberately separate from SaveLoad, which is the explicit
// save-to-file / load-from-file feature. The draft is a convenience; the file
// is the artefact.
const Draft = {
  KEY: "pyrevit-extension-builder:draft:v2",
  timer: null,

  // Set while we are deliberately discarding everything. The pagehide and
  // beforeunload flushes would otherwise write the old state straight back
  // after a clear, which is exactly what a reset must not do.
  suspended: false,

  available() {
    try {
      const probe = "__draft_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      // Private mode, or storage disabled. The builder still works, it just
      // will not remember anything between reloads.
      return false;
    }
  },

  snapshot() {
    return {
      version: window.BundleTypes.VERSION,
      extensionName: document.getElementById("extensionName").value,
      tabs: window.appState.tabs,
      panels: window.appState.panels,
      elements: window.appState.elements,
      activeTabId: window.appState.activeTabId,
      nextIds: window.appState.nextIds,
    };
  },

  /** Debounced: a rename fires on every keystroke commit. */
  save() {
    if (this.suspended || !this.available()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        window.localStorage.setItem(this.KEY, JSON.stringify(this.snapshot()));
      } catch (error) {
        // Most likely a quota error from the base64 icons. Losing the draft is
        // survivable; throwing during a render would not be.
        console.warn("Could not save the draft:", error);
      }
    }, 250);
  },

  /** Flush any pending write immediately, e.g. before the page unloads. */
  saveNow() {
    if (this.suspended) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.available()) return;
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(this.snapshot()));
    } catch (error) {
      console.warn("Could not save the draft:", error);
    }
  },

  read() {
    if (!this.available()) return null;
    try {
      const raw = window.localStorage.getItem(this.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Ignoring an unreadable draft:", error);
      return null;
    }
  },

  /**
   * Restore the draft, if there is a usable one. Returns true when it applied.
   * Validation and migration are SaveLoad's, so a draft can never introduce a
   * shape the file loader would reject.
   */
  restore() {
    const raw = this.read();
    if (!raw) return false;

    const problem = window.SaveLoad.validateLoadedState(raw);
    if (problem) {
      console.info("Discarding the saved draft:", problem);
      this.clear();
      return false;
    }

    try {
      window.SaveLoad.applyLoadedState(window.SaveLoad.migrate(raw));
      return true;
    } catch (error) {
      console.warn("Could not restore the draft:", error);
      this.clear();
      return false;
    }
  },

  clear() {
    if (!this.available()) return;
    try {
      window.localStorage.removeItem(this.KEY);
    } catch (error) {
      console.warn("Could not clear the draft:", error);
    }
  },

  /** Wipe the draft and return the app to a single empty tab/panel/command. */
  reset() {
    this.suspended = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clear();
    window.location.reload();
  },
};

window.Draft = Draft;
