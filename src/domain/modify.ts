import { rejectionReason, TYPES } from "./bundleTypes";
import type { Layout } from "./model";
import {
  containerKeyOf,
  type DropTarget,
  hasSiblingNamed,
  moveRejection,
  siblingsOf,
  uniqueName,
} from "./rules";

type Parts = Pick<Layout, "tabs" | "panels" | "elements">;

/**
 * The Modify tab's commands, as rules. Each `...Rejection` returns why the
 * command cannot run on a bundle, or null when it can; the store runs the
 * same checks, so a button is never enabled for a change the store refuses.
 */

export function containerOfId(layout: Parts, elementId: string): DropTarget | null {
  const element = layout.elements[elementId];
  if (element?.panelId) return { kind: "panel", panelId: element.panelId };
  if (element?.parentId) return { kind: "element", elementId: element.parentId };
  return null;
}

function stackMax(): number {
  return TYPES.stack.maxChildren ?? 3;
}

function isStack(layout: Parts, target: DropTarget): boolean {
  return target.kind === "element" && layout.elements[target.elementId]?.type === "stack";
}

export function duplicateRejection(layout: Parts, elementId: string): string | null {
  const target = containerOfId(layout, elementId);
  if (!target) return "That bundle no longer exists.";
  if (isStack(layout, target) && siblingsOf(layout, target).length >= stackMax()) {
    return `The stack is full: Revit stacks hold at most ${stackMax()} commands.`;
  }
  return null;
}

/** "Tool copy", then "Tool copy 1"..., free among the bundle's siblings. */
export function duplicateName(layout: Parts, elementId: string): string {
  const target = containerOfId(layout, elementId);
  const taken = target
    ? siblingsOf(layout, target).map((id) => layout.elements[id]?.name ?? "")
    : [];
  return uniqueName(`${layout.elements[elementId]?.name ?? "Button"} copy`, taken);
}

export type Wrapper = "stack" | "pulldown";

export function wrapRejection(layout: Parts, elementId: string, wrapper: Wrapper): string | null {
  const element = layout.elements[elementId];
  const target = containerOfId(layout, elementId);
  if (!element || !target) return "That bundle no longer exists.";
  const label = TYPES[element.type].label;
  if (wrapper === "stack") {
    if (target.kind !== "panel") return "A stack sits directly in a panel.";
    if (rejectionReason("stack", element.type)) return `A ${label} can't go in a stack.`;
    return null;
  }
  const containerKey = containerKeyOf(layout, target);
  if (!containerKey || rejectionReason(containerKey, "pulldown")) {
    return "A pulldown sits in a panel or a stack, not in another group.";
  }
  if (rejectionReason("pulldown", element.type)) return `A ${label} can't go in a pulldown.`;
  return null;
}

/** "Button N" for the command a new stack gets beside the wrapped one. */
export function stackPartnerName(takenName: string): string {
  let n = 1;
  while (`Button ${n}`.toLowerCase() === takenName.toLowerCase()) n++;
  return `Button ${n}`;
}

export function ungroupRejection(layout: Parts, elementId: string): string | null {
  const element = layout.elements[elementId];
  const target = containerOfId(layout, elementId);
  if (!element || !target) return "That bundle no longer exists.";
  if (!TYPES[element.type].container) return "Only a stack or a group can be ungrouped.";
  const containerKey = containerKeyOf(layout, target);
  if (!containerKey) return "Unknown container.";
  const children = element.children ?? [];
  for (const childId of children) {
    const child = layout.elements[childId];
    if (child && rejectionReason(containerKey, child.type)) {
      return `"${child.name}" (${TYPES[child.type].label}) can't go in the stack this group sits in.`;
    }
  }
  if (isStack(layout, target)) {
    const count = siblingsOf(layout, target).length - 1 + children.length;
    if (count > stackMax()) {
      return `Its commands would make the stack hold ${count}; Revit stacks hold at most ${stackMax()}.`;
    }
  }
  return null;
}

export interface Destination {
  target: DropTarget;
  /** The panel or group name. */
  label: string;
  tabId: string;
  tabName: string;
  /** 0 for a panel, 1 for a stack or group in it, 2 for a group in a stack. */
  depth: number;
  /** Why the bundle can't go there, or null. */
  reason: string | null;
  /** The name it takes there when its own is taken, or null. */
  rename: string | null;
}

/** The bundle's name in `target`: its own, or the first free one. */
export function nameIn(layout: Parts, elementId: string, target: DropTarget): string {
  const name = layout.elements[elementId]?.name ?? "";
  const taken = siblingsOf(layout, target)
    .filter((id) => id !== elementId)
    .map((id) => layout.elements[id]?.name ?? "");
  return uniqueName(name, taken);
}

/**
 * Every panel, stack and group in the extension the bundle could be sent to,
 * tab by tab, minus the container it is already in. A name already taken
 * there doesn't stop it: the bundle takes the first free name instead, as
 * every new panel and stack starts with a "Button 1".
 */
export function moveDestinations(layout: Parts, elementId: string): Destination[] {
  const element = layout.elements[elementId];
  if (!element) return [];
  const out: Destination[] = [];
  const add = (target: DropTarget, label: string, tabId: string, depth: number) => {
    const here =
      target.kind === "panel"
        ? element.panelId === target.panelId
        : element.parentId === target.elementId;
    if (here) return;
    if (target.kind === "element" && target.elementId === elementId) return;
    out.push({
      target,
      label,
      tabId,
      tabName: layout.tabs[tabId]?.name ?? "",
      depth,
      reason: moveRejection(layout, elementId, target, { allowNameClash: true }),
      rename: hasSiblingNamed(layout, target, element.name, elementId)
        ? nameIn(layout, elementId, target)
        : null,
    });
  };
  const walk = (ids: string[], tabId: string, depth: number) => {
    for (const id of ids) {
      const child = layout.elements[id];
      if (!child || !TYPES[child.type].container || id === elementId) continue;
      add({ kind: "element", elementId: id }, child.name, tabId, depth);
      walk(child.children ?? [], tabId, depth + 1);
    }
  };
  for (const [tabId, tab] of Object.entries(layout.tabs)) {
    for (const panelId of tab.panels) {
      const panel = layout.panels[panelId];
      if (!panel) continue;
      add({ kind: "panel", panelId }, panel.name, tabId, 0);
      walk(panel.elements, tabId, 1);
    }
  }
  return out;
}

/** The tab a container lives on. */
export function tabOf(layout: Parts, target: DropTarget): string | null {
  let panelId: string | undefined;
  if (target.kind === "panel") panelId = target.panelId;
  else {
    let element = layout.elements[target.elementId];
    while (element?.parentId) element = layout.elements[element.parentId];
    panelId = element?.panelId;
  }
  return panelId ? (layout.panels[panelId]?.tabId ?? null) : null;
}
