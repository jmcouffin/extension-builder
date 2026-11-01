import { temporal } from "zundo";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { rejectionReason, TYPES } from "../domain/bundleTypes";
import { type Element, initialLayout, type Layout } from "../domain/model";
import {
  duplicateName,
  duplicateRejection,
  nameIn,
  stackPartnerName,
  tabOf,
  ungroupRejection,
  type Wrapper,
  wrapRejection,
} from "../domain/modify";
import {
  containerKeyOf,
  type DropTarget,
  hasSiblingNamed,
  isSameContainer,
  moveRejection,
  newPushButton,
  nextDefaultButtonName,
  nextDefaultGroupName,
  siblingsOf,
  uniqueName,
} from "../domain/rules";

export interface OpenGroup {
  elementId: string;
  top: number;
  left: number;
}

export type ElementPayload = Omit<Element, "children" | "panelId" | "parentId">;

/** What the ribbon shows: the active tab, or the "Modify | <type>" context tab. */
export type RibbonMode = "tab" | "modify";

interface Ui {
  openGroup: OpenGroup | null;
  /** The bundle the Properties palette edits, as in Revit's selection. */
  selectedId: string | null;
  ribbonMode: RibbonMode;
  /** The drawing area's open view tab. */
  drawingView: DrawingView;
}

export type DrawingView = "preview" | "yaml" | "script";

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
  /**
   * Add a Push Button to a panel, stack or group, named "Button N", and
   * select it. Returns the reason when the container cannot take one.
   */
  addCommand(target: DropTarget): string | null;
  /** Add a Pulldown holding one Push Button to a panel, and select it. */
  addGroup(panelId: string): void;
  setDrawingView(view: DrawingView): void;
  openGroupEditor(group: OpenGroup): void;
  closeGroupEditor(): void;
  select(elementId: string | null): void;
  setRibbonMode(mode: RibbonMode): void;
  /** Move a bundle one slot earlier (-1) or later (+1) in its container. */
  nudgeElement(elementId: string, step: -1 | 1): void;
  /** Copy a bundle, with its children, right after itself; selects the copy. */
  duplicateElement(elementId: string): string | null;
  /**
   * Send a bundle to the end of another panel, stack or group, on any tab,
   * renaming it there if its name is taken.
   */
  moveElementTo(elementId: string, target: DropTarget): string | null;
  /** Put a bundle in a new stack (with a second command) or pulldown, in its place. */
  wrapElement(elementId: string, wrapper: Wrapper): string | null;
  /** Put a stack's or group's commands in its place, and remove it. */
  ungroupElement(elementId: string): string | null;
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

/** Copy a bundle and its children under new ids; the copy is not attached. */
function cloneElement(s: Layout, elementId: string, parentId?: string): string {
  const {
    children,
    panelId: _panel,
    parentId: _parent,
    ...fields
  } = s.elements[elementId] as Element;
  const copyId = `element${s.nextIds.element++}`;
  const copy: Element = { ...fields };
  if (parentId) copy.parentId = parentId;
  s.elements[copyId] = copy;
  if (children) copy.children = children.map((childId) => cloneElement(s, childId, copyId));
  return copyId;
}

function containerOf(element: Element): DropTarget | null {
  if (element.panelId) return { kind: "panel", panelId: element.panelId };
  if (element.parentId) return { kind: "element", elementId: element.parentId };
  return null;
}

/** Whether a bundle sits, at any depth, in a panel of the given tab. */
function isOnTab(s: Layout, elementId: string, tabId: string): boolean {
  let element = s.elements[elementId];
  while (element?.parentId) element = s.elements[element.parentId];
  return !!element?.panelId && s.panels[element.panelId]?.tabId === tabId;
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
      drawingView: "preview",
      openGroup: null,
      selectedId: null,
      ribbonMode: "tab",

      setExtensionName: (name) =>
        set((s) => {
          s.extensionName = name;
        }),

      activateTab: (tabId) =>
        set((s) => {
          if (!s.tabs[tabId]) return;
          s.activeTabId = tabId;
          s.openGroup = null;
          s.ribbonMode = "tab";
          if (s.selectedId && !isOnTab(s, s.selectedId, tabId)) s.selectedId = null;
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
          s.selectedId = stackId;
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
          if (s.selectedId && !s.elements[s.selectedId]) {
            s.selectedId = null;
            s.ribbonMode = "tab";
          }
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
          s.selectedId = null;
          s.ribbonMode = "tab";
        }),

      reset: () =>
        set((s) => {
          Object.assign(s, initialLayout());
          s.openGroup = null;
          s.selectedId = null;
          s.ribbonMode = "tab";
        }),

      addCommand: (target) => {
        const layout = get();
        const container = containerKeyOf(layout, target);
        if (!container) return "That container no longer exists.";
        const reason = rejectionReason(container, "pushbutton");
        if (reason) return reason;
        if (target.kind === "element") {
          const max = TYPES[layout.elements[target.elementId]?.type ?? "pushbutton"].maxChildren;
          if (max !== undefined && siblingsOf(layout, target).length >= max) {
            return `A stack holds at most ${max} commands.`;
          }
        }
        const name = nextDefaultButtonName(layout, target);
        set((s) => {
          const elementId = `element${s.nextIds.element++}`;
          s.elements[elementId] = newPushButton(name, {});
          attach(s, elementId, target);
          s.selectedId = elementId;
        });
        return null;
      },

      addGroup: (panelId) =>
        set((s) => {
          if (!s.panels[panelId]) return;
          const groupId = `element${s.nextIds.element++}`;
          const childId = `element${s.nextIds.element++}`;
          s.elements[childId] = newPushButton("Button 1", { parentId: groupId });
          s.elements[groupId] = {
            type: "pulldown",
            name: nextDefaultGroupName(s),
            title: "",
            tooltip: "",
            iconData: null,
            iconDarkData: null,
            iconOnData: null,
            children: [childId],
          };
          attach(s, groupId, { kind: "panel", panelId });
          s.selectedId = groupId;
        }),

      setDrawingView: (view) =>
        set((s) => {
          s.drawingView = view;
        }),

      openGroupEditor: (group) =>
        set((s) => {
          s.openGroup = group;
        }),

      closeGroupEditor: () =>
        set((s) => {
          s.openGroup = null;
        }),

      select: (elementId) =>
        set((s) => {
          const next = elementId && s.elements[elementId] ? elementId : null;
          if (next === s.selectedId) return;
          s.selectedId = next;
          if (!next) s.ribbonMode = "tab";
        }),

      setRibbonMode: (mode) =>
        set((s) => {
          s.ribbonMode = mode === "modify" && s.selectedId ? "modify" : "tab";
        }),

      nudgeElement: (elementId, step) => {
        const layout = get();
        const element = layout.elements[elementId];
        if (!element) return;
        const target = containerOf(element);
        if (!target) return;
        const from = siblingsOf(layout, target).indexOf(elementId);
        if (from === -1) return;
        const to = from + step;
        if (to < 0 || to >= siblingsOf(layout, target).length) return;
        // moveElement takes a slot in the container as it is now.
        get().moveElement(elementId, target, step > 0 ? to + 1 : to);
      },

      duplicateElement: (elementId) => {
        const layout = get();
        const reason = duplicateRejection(layout, elementId);
        if (reason) return reason;
        const name = duplicateName(layout, elementId);
        set((s) => {
          const element = s.elements[elementId];
          const target = element && containerOf(element);
          if (!target) return;
          const copyId = cloneElement(s, elementId);
          const copy = s.elements[copyId];
          if (copy) copy.name = name;
          attach(s, copyId, target, siblingsOf(s, target).indexOf(elementId) + 1);
          s.selectedId = copyId;
        });
        return null;
      },

      moveElementTo: (elementId, target) => {
        const layout = get();
        const reason = moveRejection(layout, elementId, target, { allowNameClash: true });
        if (reason) return reason;
        const tabId = tabOf(layout, target);
        const name = nameIn(layout, elementId, target);
        // One change, so one undo step: the move, and the tab it lands on.
        set((s) => {
          detach(s, elementId);
          attach(s, elementId, target);
          const element = s.elements[elementId];
          if (element) element.name = name;
          if (tabId) s.activeTabId = tabId;
          s.openGroup = null;
          s.selectedId = elementId;
        });
        return null;
      },

      wrapElement: (elementId, wrapper) => {
        const layout = get();
        const reason = wrapRejection(layout, elementId, wrapper);
        if (reason) return reason;
        set((s) => {
          const element = s.elements[elementId];
          const target = element && containerOf(element);
          if (!element || !target) return;
          const index = siblingsOf(s, target).indexOf(elementId);
          const wrapperId = `element${s.nextIds.element++}`;
          const taken = siblingsOf(s, target).map((id) => s.elements[id]?.name ?? "");
          detach(s, elementId);
          const children = [elementId];
          element.parentId = wrapperId;
          if (wrapper === "stack") {
            // pyRevit skips a one-command stack, so the stack gets a second one.
            const partnerId = `element${s.nextIds.element++}`;
            s.elements[partnerId] = newPushButton(stackPartnerName(element.name), {
              parentId: wrapperId,
            });
            children.push(partnerId);
          }
          s.elements[wrapperId] = {
            type: wrapper,
            name: wrapper === "stack" ? uniqueName("NEW STACK", taken) : nextDefaultGroupName(s),
            title: "",
            tooltip: "",
            iconData: null,
            iconDarkData: null,
            iconOnData: null,
            children,
          };
          attach(s, wrapperId, target, index);
          s.openGroup = null;
          s.selectedId = wrapperId;
        });
        return null;
      },

      ungroupElement: (elementId) => {
        const layout = get();
        const reason = ungroupRejection(layout, elementId);
        if (reason) return reason;
        set((s) => {
          const group = s.elements[elementId];
          const target = group && containerOf(group);
          if (!group || !target) return;
          let index = siblingsOf(s, target).indexOf(elementId);
          const children = (group.children ?? []).slice();
          group.children = [];
          detach(s, elementId);
          delete s.elements[elementId];
          for (const childId of children) {
            const child = s.elements[childId];
            if (!child) continue;
            delete child.parentId;
            // Two bundles with one name would be one folder.
            const taken = siblingsOf(s, target).map((id) => s.elements[id]?.name ?? "");
            child.name = uniqueName(child.name, taken);
            attach(s, childId, target, index++);
          }
          s.openGroup = null;
          s.selectedId = children[0] ?? null;
          if (!s.selectedId) s.ribbonMode = "tab";
        });
        return null;
      },
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
