// Draft persistence and view preferences.
//
// The ribbon is a workbench, so an in-progress extension should survive a
// reload without asking the user to save a file first. The draft is written
// from one store subscription rather than from each mutation, so no action can
// forget to persist.
//
// This is deliberately separate from Save/Load layout, which is the explicit
// file the user keeps. The draft is a convenience; the file is the artefact.

import { migrate, snapshot, validateLoadedState } from "../domain/layoutFile";
import type { Layout } from "../domain/model";
import { layoutOf, useStore } from "./store";

const DRAFT_KEY = "pyrevit-extension-builder:draft:v2";
const PREFS_KEY = "pyrevit-extension-builder:prefs:v1";

function storage(): Storage | null {
  try {
    const probe = "__draft_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft(): Layout | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const problem = validateLoadedState(parsed);
    if (problem) {
      console.info("Discarding the saved draft:", problem);
      store.removeItem(DRAFT_KEY);
      return null;
    }
    return migrate(parsed);
  } catch (error) {
    console.warn("Ignoring an unreadable draft:", error);
    store.removeItem(DRAFT_KEY);
    return null;
  }
}

function writeDraft(layout: Layout) {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(snapshot(layout)));
  } catch (error) {
    // Most likely a quota error from the base64 icons. Losing the draft is
    // survivable; throwing during a render would not be.
    console.warn("Could not save the draft:", error);
  }
}

export function clearDraft() {
  try {
    storage()?.removeItem(DRAFT_KEY);
  } catch (error) {
    console.warn("Could not clear the draft:", error);
  }
}

/**
 * Restore the draft into the store and keep it saved, debounced, on every
 * layout change. Returns an unsubscribe for tests and HMR.
 */
export function startDraftPersistence(): () => void {
  if (!storage()) {
    console.info("Local storage is unavailable, so this session will not be remembered.");
    return () => {};
  }

  const restored = readDraft();
  if (restored) {
    useStore.getState().loadLayout(restored);
    console.info("Restored your last draft. RESET discards it.");
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    writeDraft(layoutOf(useStore.getState()));
  };

  const unsubscribe = useStore.subscribe((state, prev) => {
    if (
      state.tabs === prev.tabs &&
      state.panels === prev.panels &&
      state.elements === prev.elements &&
      state.extensionName === prev.extensionName &&
      state.activeTabId === prev.activeTabId
    ) {
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 250);
  });

  // Do not lose the last few keystrokes to a closed tab.
  window.addEventListener("pagehide", flush);

  return () => {
    unsubscribe();
    window.removeEventListener("pagehide", flush);
    if (timer) clearTimeout(timer);
  };
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const prefs = JSON.parse(storage()?.getItem(PREFS_KEY) || "{}") as Record<string, unknown>;
    return key in prefs ? (prefs[key] as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  const store = storage();
  if (!store) return;
  try {
    const prefs = JSON.parse(store.getItem(PREFS_KEY) || "{}") as Record<string, unknown>;
    store.setItem(PREFS_KEY, JSON.stringify({ ...prefs, [key]: value }));
  } catch (error) {
    console.warn("Could not save preferences:", error);
  }
}
