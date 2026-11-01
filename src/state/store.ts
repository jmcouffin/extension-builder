import { temporal } from "zundo";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { TYPES, type TypeId } from "../domain/bundleTypes";
import { type Element, initialLayout, type Layout } from "../domain/model";
import {
  type DropTarget,
  hasSiblingNamed,
  isSameContainer,
  moveRejection,
  newPushButton,
  siblingsOf,
  uniqueName,
} from "../domain/rules";

export type ModalRequest =
  | { mode: "create"; kind: "command" | "container"; target: DropTarget; presetType?: TypeId }
  | { mode: "edit"; elementId: string };

export interface OpenGroup {
  elementId: string;
  top: number;
  left: number;
}

export type ElementPayload = Omit<Element, "children" | "panelId" | "parentId">;

interface Ui {
  modal: ModalRequest | null;
  openGroup: OpenGroup | null;
}

interface Actions {
  setExtensionName(name: string): void;
  activateTab(tabId: string): void;
  addTab(): void;
  renameTab(tabId: string, name: string): string | null;
  deleteTab(tabId: string): string | null;
  addPanel(sourcePanelId?: string): void;
  renamePanel(panelId: string, name: string): string | null;
  deletePanel(panelId: string): string | null;
  addStack(panelId: string): void;
  renameElement(elementId: string, name: string): void;
  deleteElement(elementId: string): void;
  createElement(payload: ElementPayload, target: DropTarget): string | null;
  updateElement(elementId: string, payload: ElementPayload): void;
  moveElement(elementId: string, target: DropTarget, index?: number): string | null;
  loadLayout(layout: Layout): void;
  reset(): void;
  openModal(request: ModalRequest): void;
  closeModal(): void;
  openGroupEditor(group: OpenGroup): void;
  closeGroupEditor(): void;
}

export type Store = Layout & Ui & Actions;

export function layoutOf(s: Layout): Layout {
  return {
    extensionName: s.extensionName,
    tabs: s.tabs,
    panels: s.panels,
    elements: s.elements,
    activeTabId: s.activeTabId,
    nextIds: s.nextIds,
  };
}

function removeElementRecursive(s: Layout, elementId: string) {
  const element = s.elements[elementId];
  if (!element) return;
  for (const childId of element.children ?? []) removeElementRecursive(s, childId);

  if (element.panelId) {
    const panel = s.panels[element.panelId];
    if (panel) panel.elements = panel.elements.filter((id) => id !== elementId);
  } else if (element.parentId) {
    const parent = s.elements[element.parentId];
    if (parent?.children) parent.children = parent.children.filter((id) => id !== elementId);
  }
  delete s.elements[elementId];
}

function detach(s: Layout, elementId: string) {
  const element = s.elements[elementId];
  if (!element) return;
  if (element.panelId) {
    const panel = s.panels[element.panelId];
    if (panel) panel.elements = panel.elements.filter((id) => id !== elementId);
    delete element.panelId;
  } else if (element.parentId) {
    const parent = s.elements[element.parentId];
    if (parent?.children) parent.children = parent.children.filter((id) => id !== elementId);
    delete element.parentId;
  }
}

function insertAt(list: string[], id: string, index?: number) {
  if (index === undefined || index < 0 || index > list.length) list.push(id);
  else list.splice(index, 0, id);
}

function attach(s: Layout, elementId: string, target: DropTarget, index?: number) {
  const element = s.elements[elementId];
  if (!element) return;
  if (target.kind === "panel") {
    const panel = s.panels[target.panelId];
    if (!panel) return;
    insertAt(panel.elements, elementId, index);
    element.panelId = target.panelId;
  } else {
    const container = s.elements[target.elementId];
    if (!container) return;
    container.children ??= [];
    insertAt(container.children, elementId, index);
    element.parentId = target.elementId;
  }
}

function addPanelTo(s: Layout, tabId: string, name: string) {
  const panelId = `panel${s.nextIds.panel++}`;
  const buttonId = `element${s.nextIds.element++}`;
  s.panels[panelId] = { name, elements: [buttonId], tabId };
  s.elements[buttonId] = newPushButton("Button 1", { panelId });
  s.tabs[tabId]?.panels.push(panelId);
}

const HISTORY_LIMIT = 100;
const TYPING_PAUSE_MS = 600;

function onlyRenamed(past: Layout, current: Layout) {
  return (
    past.extensionName !== current.extensionName &&
    past.tabs === current.tabs &&
    past.panels === current.panels &&
    past.elements === current.elements &&
    past.activeTabId === current.activeTabId
  );
}

type Recorder = (past: Layout, replace: true, current: Layout) => void;

function coalesceTyping(record: (past: Layout) => void): Recorder {
  let last = 0;
  return (past, _replace, current) => {
    const now = Date.now();
    const typing = onlyRenamed(past, current);
    if (!typing || now - last > TYPING_PAUSE_MS) record(past);
    last = typing ? now : 0;
  };
}

export const useStore = create<Store>()(
  temporal(
    immer((set, get) => ({
      ...initialLayout(),
      modal: null,
      openGroup: null,

      setExtensionName: (name) =>
        set((s) => {
          s.extensionName = name;
        }),

      activateTab: (tabId) =>
        set((s) => {
          if (!s.tabs[tabId]) return;
          s.activeTabId = tabId;
          s.openGroup = null;
        }),

      addTab: () =>
        set((s) => {
          const tabId = `tab${s.nextIds.tab++}`;
          const taken = Object.values(s.tabs).map((t) => t.name);
          s.tabs[tabId] = { name: uniqueName("NEW TAB", taken), panels: [] };
          // Every tab needs a panel; an empty tab never appears in pyRevit.
          addPanelTo(s, tabId, "NEW PANEL");
          s.activeTabId = tabId;
          s.openGroup = null;
        }),

      renameTab: (tabId, name) => {
        const next = name.trim();
        if (!next) return "";
        const clash = Object.entries(get().tabs).some(
          ([id, t]) => id !== tabId && t.name.toLowerCase() === next.toLowerCase(),
        );
        if (clash) return "Tab name already exists. Please choose a different name.";
        set((s) => {
          const tab = s.tabs[tabId];
          if (tab) tab.name = next;
        });
        return null;
      },

      deleteTab: (tabId) => {
        if (Object.keys(get().tabs).length <= 1) {
          return "Cannot delete the last tab. Add another tab first.";
        }
        set((s) => {
          const tab = s.tabs[tabId];
          if (!tab) return;
          for (const panelId of tab.panels) {
            for (const elementId of s.panels[panelId]?.elements.slice() ?? []) {
              removeElementRecursive(s, elementId);
            }
            delete s.panels[panelId];
          }
          delete s.tabs[tabId];
          if (s.activeTabId === tabId) s.activeTabId = Object.keys(s.tabs)[0] ?? "";
          s.openGroup = null;
        });
        return null;
      },

      addPanel: (sourcePanelId) =>
        set((s) => {
          const source = sourcePanelId ? s.panels[sourcePanelId] : undefined;
          const tabId = source ? source.tabId : s.activeTabId;
          const tab = s.tabs[tabId];
          if (!tab) return;
          // Two panels with the same name in one tab become the same folder.
          const taken = tab.panels.map((pid) => s.panels[pid]?.name ?? "");
          addPanelTo(s, tabId, uniqueName("NEW PANEL", taken));
          s.activeTabId = tabId;
        }),

      renamePanel: (panelId, name) => {
        const next = name.trim();
        const { panels, tabs } = get();
        const panel = panels[panelId];
        if (!next || !panel) return "";
        const clash = (tabs[panel.tabId]?.panels ?? []).some(
          (pid) =>
            pid !== panelId && (panels[pid]?.name ?? "").toLowerCase() === next.toLowerCase(),
        );
        if (clash) return "Panel name already exists in this tab. Please choose a different name.";
        set((s) => {
          const p = s.panels[panelId];
          if (p) p.name = next;
        });
        return null;
      },

      deletePanel: (panelId) => {
        const { panels, tabs } = get();
        const panel = panels[panelId];
        if (!panel) return null;
        if ((tabs[panel.tabId]?.panels.length ?? 0) <= 1) {
          return "Cannot delete the last panel in a tab. Add another panel first or delete the entire tab.";
        }
        set((s) => {
          for (const elementId of s.panels[panelId]?.elements.slice() ?? []) {
            removeElementRecursive(s, elementId);
          }
          const tab = s.tabs[panel.tabId];
          if (tab) tab.panels = tab.panels.filter((pid) => pid !== panelId);
          delete s.panels[panelId];
          s.openGroup = null;
        });
        return null;
      },

      // A stack starts life with the two commands pyRevit needs to render it at
      // all (StackBuilder.cs:80 skips a stack with fewer than 2 visible children).
      addStack: (panelId) =>
        set((s) => {
          const panel = s.panels[panelId];
          if (!panel) return;
          const stackId = `element${s.nextIds.element++}`;
          const taken = panel.elements.map((id) => s.elements[id]?.name ?? "");
          const children: string[] = [];
          for (let i = 0; i < (TYPES.stack.minChildren ?? 2); i++) {
            const childId = `element${s.nextIds.element++}`;
            s.elements[childId] = newPushButton(`Button ${i + 1}`, { parentId: stackId });
            children.push(childId);
          }
          s.elements[stackId] = {
            type: "stack",
            name: uniqueName("NEW STACK", taken),
            title: "",
            tooltip: "",
            iconData: null,
            children,
            panelId,
          };
          panel.elements.push(stackId);
        }),

      renameElement: (elementId, name) =>
        set((s) => {
          const element = s.elements[elementId];
          const next = name.trim();
          if (element && next) element.name = next;
        }),

      deleteElement: (elementId) =>
        set((s) => {
          removeElementRecursive(s, elementId);
          s.openGroup = null;
        }),

      createElement: (payload, target) => {
        if (hasSiblingNamed(get(), target, payload.name)) {
          return "A command with this name already exists in the same container. Please choose a different name.";
        }
        set((s) => {
          const elementId = `element${s.nextIds.element++}`;
          s.elements[elementId] = TYPES[payload.type].container
            ? { ...payload, children: [] }
            : { ...payload };
          attach(s, elementId, target);
        });
        return null;
      },

      updateElement: (elementId, payload) =>
        set((s) => {
          const element = s.elements[elementId];
          if (!element) return;
          const isContainer = TYPES[payload.type].container;
          // A container keeps its children; a leaf must never carry any, because
          // the tree walker would otherwise recurse into folders pyRevit ignores.
          const children = element.children ?? [];
          if (!isContainer) {
            for (const childId of children.slice()) removeElementRecursive(s, childId);
          }

          const next: Element = {
            ...element,
            ...payload,
            // An empty upload means "keep what is there".
            iconData: payload.iconData || element.iconData || null,
            iconDarkData: payload.iconDarkData || element.iconDarkData || null,
            iconOnData: payload.iconOnData || element.iconOnData || null,
          };
          if (isContainer) next.children = s.elements[elementId]?.children ?? [];
          else delete next.children;
          s.elements[elementId] = next;
        }),

      moveElement: (elementId, target, index) => {
        const layout = get();
        const reason = moveRejection(layout, elementId, target);
        if (reason) return reason;
        const element = layout.elements[elementId];
        let at = index;
        // `index` is a slot in the container as it is now. Taking the bundle
        // out of the same container first shifts every later slot down by one.
        if (element && at !== undefined && isSameContainer(element, target)) {
          const from = siblingsOf(layout, target).indexOf(elementId);
          if (from !== -1 && from < at) at -= 1;
          if (from === at) return null;
        }
        set((s) => {
          detach(s, elementId);
          attach(s, elementId, target, at);
        });
        return null;
      },

      loadLayout: (layout) =>
        set((s) => {
          Object.assign(s, layout);
          s.openGroup = null;
          s.modal = null;
        }),

      reset: () =>
        set((s) => {
          Object.assign(s, initialLayout());
          s.openGroup = null;
          s.modal = null;
        }),

      openModal: (request) =>
        set((s) => {
          s.modal = request;
        }),

      closeModal: () =>
        set((s) => {
          s.modal = null;
        }),

      openGroupEditor: (group) =>
        set((s) => {
          s.openGroup = group;
        }),

      closeGroupEditor: () =>
        set((s) => {
          s.openGroup = null;
        }),
    })),
    {
      limit: HISTORY_LIMIT,
      partialize: (s): Layout => layoutOf(s),
      equality: (past, current) =>
        past.extensionName === current.extensionName &&
        past.tabs === current.tabs &&
        past.panels === current.panels &&
        past.elements === current.elements &&
        past.activeTabId === current.activeTabId,
      handleSet: (handleSet) =>
        coalesceTyping((past) => (handleSet as unknown as (p: Layout) => void)(past)) as never,
    },
  ),
);

export function undo() {
  useStore.temporal.getState().undo();
}

export function redo() {
  useStore.temporal.getState().redo();
}

export function clearHistory() {
  useStore.temporal.getState().clear();
}
