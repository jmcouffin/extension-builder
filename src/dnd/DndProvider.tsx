import {
  type ClientRect,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Coordinates } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { TYPES } from "../domain/bundleTypes";
import { showAlert } from "../state/dialogs";
import { useStore } from "../state/store";
import { DragGhost } from "./DragGhost";
import { type DropData, resolveIntent, selfAndDescendants, useDnd } from "./model";

function elementIdOf(activeId: string | number): string {
  return String(activeId).replace(/^drag:/, "");
}

function area(rect: ClientRect | undefined): number {
  return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
}

/**
 * The innermost droppable under the pointer wins, so a stack row beats the
 * stack, and the stack beats the panel. Floating layers (the group editor)
 * beat anything in the ribbon underneath them. A bundle can never be dropped
 * on itself or anything nested inside it.
 */
const collisionDetection: CollisionDetection = (args) => {
  const blocked = selfAndDescendants(useStore.getState(), elementIdOf(args.active.id));
  const droppableContainers = args.droppableContainers.filter((c) => {
    const data = c.data.current as DropData | undefined;
    if (!data) return false;
    if (data.kind === "item") return !blocked.has(data.elementId);
    return data.target.kind === "panel" || !blocked.has(data.target.elementId);
  });
  const hits = args.pointerCoordinates
    ? pointerWithin({ ...args, droppableContainers })
    : rectIntersection({ ...args, droppableContainers });

  const layerOf = (id: string | number) =>
    (droppableContainers.find((c) => c.id === id)?.data.current as DropData | undefined)?.layer ??
    0;

  return hits
    .slice()
    .sort(
      (a, b) =>
        layerOf(b.id) - layerOf(a.id) ||
        area(args.droppableRects.get(a.id)) - area(args.droppableRects.get(b.id)),
    )
    .slice(0, 1);
};

function pointerOf(event: DragMoveEvent): Coordinates | null {
  const e = event.activatorEvent;
  if (typeof PointerEvent !== "undefined" && e instanceof PointerEvent) {
    return { x: e.clientX + event.delta.x, y: e.clientY + event.delta.y };
  }
  if (e instanceof MouseEvent) {
    return { x: e.clientX + event.delta.x, y: e.clientY + event.delta.y };
  }
  const rect = event.active.rect.current.translated;
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
}

function updateIntent(event: DragMoveEvent) {
  const { over } = event;
  const data = over?.data.current as DropData | undefined;
  const point = pointerOf(event);
  if (!over || !data || !point) {
    if (useDnd.getState().intent) useDnd.setState({ intent: null });
    return;
  }
  const intent = resolveIntent(
    useStore.getState(),
    elementIdOf(event.active.id),
    String(over.id),
    data,
    over.rect,
    point,
  );
  const current = useDnd.getState().intent;
  if (
    current?.overId !== intent.overId ||
    current.mode !== intent.mode ||
    current.reason !== intent.reason
  ) {
    useDnd.setState({ intent });
  }
}

function setDragging(on: boolean) {
  document.body.classList.toggle("is-dragging", on);
}

function finish(event: DragEndEvent) {
  setDragging(false);
  updateIntent(event);
  const { intent } = useDnd.getState();
  const elementId = elementIdOf(event.active.id);
  useDnd.setState({ activeId: null, intent: null });
  if (!intent) return;
  if (intent.reason) {
    const element = useStore.getState().elements[elementId];
    const label = element ? `${TYPES[element.type].label} "${element.name}"` : "That bundle";
    void showAlert(intent.reason, { title: `${label} can't go there` });
    return;
  }
  useStore.getState().moveElement(elementId, intent.target, intent.index);
}

export function DndProvider({ children }: { children: ReactNode }) {
  const activeId = useDnd((s) => s.activeId);
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so click (open a group),
    // click-to-rename and double-click (edit) keep working on the same item.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e) => {
        setDragging(true);
        useDnd.setState({ activeId: elementIdOf(e.active.id), intent: null });
      }}
      onDragMove={updateIntent}
      onDragOver={updateIntent}
      onDragEnd={finish}
      onDragCancel={() => {
        setDragging(false);
        useDnd.setState({ activeId: null, intent: null });
      }}
    >
      {children}
      <DragOverlay dropAnimation={null} className="drag-overlay">
        {activeId ? <DragGhost elementId={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
