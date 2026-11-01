import type { ClientRect } from "@dnd-kit/core";
import type { Coordinates } from "@dnd-kit/utilities";
import { create } from "zustand";
import type { Layout } from "../domain/model";
import { type DropTarget, moveRejection, siblingsOf } from "../domain/rules";

export type Axis = "x" | "y";

/**
 * What a droppable is. A `container` is somewhere to append (a panel's item
 * row, a group's open list). An `item` is a bundle already in a container:
 * dropping on it inserts before or after it, and when it is itself a
 * container (`into`), dropping on its middle puts the bundle inside.
 * `layer` lifts droppables that float over the ribbon, so the group editor
 * wins over the ribbon items underneath it.
 */
export type DropData =
  | { kind: "container"; target: DropTarget; layer: number }
  | {
      kind: "item";
      elementId: string;
      container: DropTarget;
      axis: Axis;
      into?: DropTarget;
      layer: number;
    };

export interface DropIntent {
  overId: string;
  mode: "before" | "after" | "into";
  axis: Axis;
  target: DropTarget;
  index?: number;
  reason: string | null;
}

interface DndState {
  activeId: string | null;
  intent: DropIntent | null;
}

export const useDnd = create<DndState>(() => ({ activeId: null, intent: null }));

export const dragId = (elementId: string) => `drag:${elementId}`;
export const itemDropId = (elementId: string) => `item:${elementId}`;
export const containerDropId = (target: DropTarget, layer: number) =>
  `box:${layer}:${target.kind === "panel" ? `panel:${target.panelId}` : `el:${target.elementId}`}`;

/** Fraction of a container item's length, at each end, that means "beside it". */
const EDGE = 0.25;

/** The bundle and everything nested in it: none of them can receive it. */
export function selfAndDescendants(
  layout: Pick<Layout, "elements">,
  elementId: string,
): Set<string> {
  const out = new Set<string>();
  const queue = [elementId];
  while (queue.length) {
    const id = queue.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    queue.push(...(layout.elements[id]?.children ?? []));
  }
  return out;
}

export function resolveIntent(
  layout: Pick<Layout, "tabs" | "panels" | "elements">,
  activeId: string,
  overId: string,
  data: DropData,
  rect: ClientRect,
  point: Coordinates,
): DropIntent {
  if (data.kind === "container") {
    return {
      overId,
      mode: "into",
      axis: "x",
      target: data.target,
      reason: moveRejection(layout, activeId, data.target),
    };
  }

  const along =
    data.axis === "x" ? (point.x - rect.left) / rect.width : (point.y - rect.top) / rect.height;

  if (data.into && along >= EDGE && along <= 1 - EDGE) {
    return {
      overId,
      mode: "into",
      axis: data.axis,
      target: data.into,
      reason: moveRejection(layout, activeId, data.into),
    };
  }

  const position = siblingsOf(layout, data.container).indexOf(data.elementId);
  const after = along > 0.5;
  return {
    overId,
    mode: after ? "after" : "before",
    axis: data.axis,
    target: data.container,
    index: position === -1 ? undefined : position + (after ? 1 : 0),
    reason: moveRejection(layout, activeId, data.container),
  };
}
