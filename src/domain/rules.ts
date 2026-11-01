import { type ContainerKey, rejectionReason, TYPES } from "./bundleTypes";
import type { Element, Layout } from "./model";

type Parts = Pick<Layout, "tabs" | "panels" | "elements">;

export type DropTarget =
  | { kind: "panel"; panelId: string }
  | { kind: "element"; elementId: string };

export function siblingsOf(layout: Parts, target: DropTarget): string[] {
  if (target.kind === "panel") return layout.panels[target.panelId]?.elements ?? [];
  return layout.elements[target.elementId]?.children ?? [];
}

export function containerKeyOf(layout: Parts, target: DropTarget): ContainerKey | null {
  if (target.kind === "panel") return "panel";
  return layout.elements[target.elementId]?.type ?? null;
}

export function hasSiblingNamed(
  layout: Parts,
  target: DropTarget,
  name: string,
  exceptId?: string,
): boolean {
  const lowered = name.toLowerCase();
  return siblingsOf(layout, target).some((id) => {
    if (id === exceptId) return false;
    return (layout.elements[id]?.name ?? "").toLowerCase() === lowered;
  });
}

function isDescendant(layout: Parts, candidateId: string, children: string[]): boolean {
  const queue = children.slice();
  while (queue.length) {
    const id = queue.shift() as string;
    if (id === candidateId) return true;
    queue.push(...(layout.elements[id]?.children ?? []));
  }
  return false;
}

export function targetIdOf(target: DropTarget): string {
  return target.kind === "panel" ? target.panelId : target.elementId;
}

export function isSameContainer(element: Element, target: DropTarget): boolean {
  return target.kind === "panel"
    ? element.panelId === target.panelId
    : element.parentId === target.elementId;
}

/**
 * Everything that must hold before a drop is allowed, gathered in one place
 * so the modal and the drag path can never disagree. Returns a reason, or
 * null when the move is legal. A move within the container the bundle is
 * already in is a reorder, and is always legal.
 */
export function moveRejection(layout: Parts, elementId: string, target: DropTarget): string | null {
  const element = layout.elements[elementId];
  if (!element) return "That bundle no longer exists.";
  const targetId = targetIdOf(target);

  if (targetId === elementId) return "A bundle cannot contain itself.";
  if (isSameContainer(element, target)) return null;

  const containerKey = containerKeyOf(layout, target);
  if (!containerKey) return "Unknown container.";
  const reason = rejectionReason(containerKey, element.type);
  if (reason) return reason;

  if (element.children && isDescendant(layout, targetId, element.children)) {
    return "That would put the group inside one of its own commands.";
  }

  if (containerKey === "stack") {
    const max = TYPES.stack.maxChildren ?? 3;
    if (siblingsOf(layout, target).length >= max) {
      return `A stack holds at most ${max} commands in Revit.`;
    }
  }

  if (hasSiblingNamed(layout, target, element.name, elementId)) {
    return `A command called "${element.name}" already exists in that container.`;
  }

  return null;
}

/** First free "NAME", "NAME 1", "NAME 2"... among `taken` (case-insensitive). */
export function uniqueName(base: string, taken: string[]): string {
  const lowered = new Set(taken.map((t) => t.toLowerCase()));
  if (!lowered.has(base.toLowerCase())) return base;
  let n = 1;
  while (lowered.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}

/** Lowest unused "Button N" among a container's children. */
export function nextDefaultButtonName(layout: Parts, target: DropTarget): string {
  const used = new Set(
    siblingsOf(layout, target)
      .map((id) => layout.elements[id]?.name ?? "")
      .filter((name) => /^Button \d+$/.test(name))
      .map((name) => Number.parseInt(name.slice("Button ".length), 10)),
  );
  let n = 1;
  while (used.has(n)) n++;
  return `Button ${n}`;
}

export function nextDefaultGroupName(layout: Parts): string {
  const taken = Object.values(layout.elements)
    .filter((e) => TYPES[e.type]?.container)
    .map((e) => e.name);
  if (!taken.includes("NEW GROUP")) return "NEW GROUP";
  let n = 1;
  while (taken.includes(`NEW GROUP ${n}`)) n++;
  return `NEW GROUP ${n}`;
}

export function newPushButton(name: string, owner: Partial<Element>): Element {
  return {
    type: "pushbutton",
    name,
    title: "",
    tooltip: "",
    code: "",
    iconData: null,
    iconDarkData: null,
    iconOnData: null,
    ...owner,
  };
}
