import { create } from "zustand";
import { parseLayout, snapshot } from "../domain/layoutFile";
import type { Layout } from "../domain/model";

const SAVES_KEY = "pyrevit-extension-builder:saves:v1";

export interface SavedLayout {
  id: string;
  name: string;
  savedAt: number;
  panels: number;
  commands: number;
  data: ReturnType<typeof snapshot>;
}

function read(): SavedLayout[] {
  try {
    const raw = window.localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedLayout[]) : [];
  } catch {
    return [];
  }
}

function write(list: SavedLayout[]): string | null {
  try {
    window.localStorage.setItem(SAVES_KEY, JSON.stringify(list));
    return null;
  } catch {
    return "The browser has no room left to keep this layout. Delete an older save, or export it to a file.";
  }
}

interface SavesState {
  saves: SavedLayout[];
  managerOpen: boolean;
  openManager(): void;
  closeManager(): void;
  save(layout: Layout): { error: string | null; replaced: boolean };
  remove(id: string): void;
  read(id: string): Layout | null;
}

export const useSaves = create<SavesState>((set, get) => ({
  saves: read(),
  managerOpen: false,
  openManager: () => set({ managerOpen: true, saves: read() }),
  closeManager: () => set({ managerOpen: false }),

  save: (layout) => {
    const name = layout.extensionName.trim() || "Untitled";
    const current = read();
    const existing = current.find((s) => s.name.toLowerCase() === name.toLowerCase());
    const entry: SavedLayout = {
      id: existing?.id ?? `save-${Date.now().toString(36)}`,
      name,
      savedAt: Date.now(),
      panels: Object.keys(layout.panels).length,
      commands: Object.keys(layout.elements).length,
      data: snapshot(layout),
    };
    const next = [entry, ...current.filter((s) => s.id !== entry.id)];
    const error = write(next);
    if (!error) set({ saves: next });
    return { error, replaced: !!existing };
  },

  remove: (id) => {
    const next = read().filter((s) => s.id !== id);
    write(next);
    set({ saves: next });
  },

  read: (id) => {
    const found = get().saves.find((s) => s.id === id);
    if (!found) return null;
    try {
      return parseLayout(JSON.stringify(found.data));
    } catch {
      return null;
    }
  },
}));
