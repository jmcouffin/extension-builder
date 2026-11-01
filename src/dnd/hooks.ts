import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { KeyboardEvent, PointerEvent } from "react";
import type { DropTarget } from "../domain/rules";
import { type Axis, containerDropId, type DropData, dragId, itemDropId, useDnd } from "./model";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Only the item itself starts a drag. Pressing Enter on its delete button or
 * dragging to select text in its rename input must not pick the item up.
 */
function fromNestedControl(e: { target: EventTarget; currentTarget: EventTarget }): boolean {
  const hit = (e.target as HTMLElement).closest?.("input, textarea, select, button, [role=button]");
  return !!hit && hit !== e.currentTarget;
}

export interface RibbonItemPlace {
  container: DropTarget;
  axis: Axis;
  layer: number;
}

/**
 * Makes a ribbon item both draggable and a drop point for other items. With
 * `handle`, only the element given `handleProps` starts a drag - for a stack,
 * whose every pixel is otherwise one of its own rows.
 */
export function useRibbonItemDnd(
  elementId: string,
  place: RibbonItemPlace,
  into?: DropTarget,
  options: { handle?: boolean } = {},
) {
  const data: DropData = { kind: "item", elementId, into, ...place };
  const draggable = useDraggable({ id: dragId(elementId), data });
  const droppable = useDroppable({ id: itemDropId(elementId), data });
  const isSource = useDnd((s) => s.activeId === elementId);
  const intent = useDnd((s) => (s.intent?.overId === itemDropId(elementId) ? s.intent : null));

  const { onPointerDown, onKeyDown } = (draggable.listeners ?? {}) as {
    onPointerDown?: (e: PointerEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
  };

  const activator = {
    ...draggable.attributes,
    "aria-roledescription": "draggable ribbon item",
    onPointerDown: (e: PointerEvent) => {
      if (!fromNestedControl(e)) onPointerDown?.(e);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (!fromNestedControl(e)) onKeyDown?.(e);
    },
  };

  return {
    ref: (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    props: options.handle ? {} : activator,
    handleProps: { ...activator, ref: draggable.setActivatorNodeRef },
    className: cx(
      isSource && "dnd-source",
      intent && `drop-axis-${intent.axis}`,
      intent && `drop-${intent.mode}`,
      intent?.reason && "drop-invalid",
    ),
  };
}

/** A place to append to: a panel's row of items, or a group's open list. */
export function useContainerDrop(target: DropTarget, layer: number) {
  const id = containerDropId(target, layer);
  const { setNodeRef } = useDroppable({ id, data: { kind: "container", target, layer } });
  const intent = useDnd((s) => (s.intent?.overId === id ? s.intent : null));
  return {
    ref: setNodeRef,
    className: cx(intent && "drop-into", intent?.reason && "drop-invalid"),
  };
}
