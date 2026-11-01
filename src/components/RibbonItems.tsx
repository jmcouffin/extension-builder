import { type RibbonItemPlace, useContainerDrop, useRibbonItemDnd } from "../dnd/hooks";
import { TYPES } from "../domain/bundleTypes";
import type { Element } from "../domain/model";
import type { DropTarget } from "../domain/rules";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { showConfirm } from "../state/dialogs";
import { useStore } from "../state/store";
import { useIcons } from "./IconsContext";
import { EditableLabel } from "./inputs";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function Icon({ element }: { element: Element }) {
  const defaults = useIcons();
  return (
    <div className="button-icon">
      <img src={element.iconData || defaults.light || FALLBACK_ICON} alt="Icon" />
    </div>
  );
}

export function DeleteButton({
  className,
  title,
  onDelete,
}: {
  className: string;
  title: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    />
  );
}

function ElementDelete({ elementId, element }: { elementId: string; element: Element }) {
  const def = TYPES[element.type];
  const title = `Remove this ${def.label.toLowerCase()}${element.name ? ` "${element.name}"` : ""}`;
  return (
    <DeleteButton
      className="element-delete-button"
      title={title}
      onDelete={async () => {
        const count = element.children?.length ?? 0;
        if (def.container && count) {
          const ok = await showConfirm(
            `This ${def.label.toLowerCase()} contains ${count} command(s). Delete them too?`,
            { title: `Delete "${element.name}"?`, confirmLabel: "Delete", danger: true },
          );
          if (!ok) return;
        }
        useStore.getState().deleteElement(elementId);
      }}
    />
  );
}

function openEditor(elementId: string) {
  useStore.getState().openModal({ mode: "edit", elementId });
}

function renamer(elementId: string) {
  return (next: string) => useStore.getState().renameElement(elementId, next);
}

interface ItemProps {
  elementId: string;
  element: Element;
  place: RibbonItemPlace;
}

export function RibbonElement({ elementId, place }: { elementId: string; place: RibbonItemPlace }) {
  const element = useStore((s) => s.elements[elementId]);
  if (!element) return null;
  const props = { elementId, element, place };
  if (element.type === "stack") return <StackItem {...props} />;
  if (TYPES[element.type].container) return <GroupItem {...props} />;
  return <CommandItem {...props} />;
}

function CommandItem({ elementId, element, place }: ItemProps) {
  const def = TYPES[element.type];
  const dnd = useRibbonItemDnd(elementId, place);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role and tabIndex come from dnd-kit's attributes in dnd.props
    <div
      ref={dnd.ref}
      {...dnd.props}
      className={cx("button", def.postfix.slice(1), dnd.className)}
      data-type={element.type}
      data-button-id={elementId}
      data-name={element.name}
      title={`${def.label} - ${def.postfix}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openEditor(elementId);
      }}
    >
      <Icon element={element} />
      <EditableLabel className="button-name" value={element.name} onCommit={renamer(elementId)} />
      <ElementDelete elementId={elementId} element={element} />
    </div>
  );
}

function GroupItem({ elementId, element, place }: ItemProps) {
  const def = TYPES[element.type];
  const into: DropTarget = { kind: "element", elementId };
  const dnd = useRibbonItemDnd(elementId, place, into);
  const count = element.children?.length ?? 0;

  const open = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    useStore.getState().openGroupEditor({
      elementId,
      top: rect.bottom + window.scrollY + 5,
      left: Math.max(8, rect.left + window.scrollX),
    });
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: role and tabIndex come from dnd-kit's attributes in dnd.props; Enter starts a keyboard drag, so opening stays a pointer shortcut
    <div
      ref={dnd.ref}
      {...dnd.props}
      className={cx("group", def.postfix.slice(1), dnd.className)}
      data-type={element.type}
      data-button-id={elementId}
      data-name={element.name}
      title={`${def.label} - ${def.postfix} "${element.name}" with ${count} command(s). Click the icon to open them.`}
      onClick={(e) => open(e.currentTarget)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openEditor(elementId);
      }}
    >
      <div className="group-header">
        <Icon element={element} />
        <EditableLabel className="button-name" value={element.name} onCommit={renamer(elementId)} />
        <div className="group-caret" aria-hidden="true" />
      </div>
      <ElementDelete elementId={elementId} element={element} />
    </div>
  );
}

function StackItem({ elementId, element, place }: ItemProps) {
  const def = TYPES.stack;
  const children = element.children ?? [];
  const into: DropTarget = { kind: "element", elementId };
  const dnd = useRibbonItemDnd(elementId, place, into, { handle: true });
  const remaining = (def.maxChildren ?? 3) - children.length;
  const childPlace: RibbonItemPlace = { container: into, axis: "y", layer: place.layer };
  const add = () =>
    useStore.getState().openModal({ mode: "create", kind: "command", target: into });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role and tabIndex come from dnd-kit's attributes in dnd.props
    <div
      ref={dnd.ref}
      {...dnd.props}
      className={cx(
        "stack",
        children.length < (def.minChildren ?? 2) && "stack-invalid",
        dnd.className,
      )}
      data-type="stack"
      data-button-id={elementId}
      data-name={element.name}
      title={`Stack - ${def.postfix} "${element.name}" with ${children.length} command(s). Double-click to edit.`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openEditor(elementId);
      }}
    >
      <button
        type="button"
        {...dnd.handleProps}
        className="stack-grip"
        title={`Drag to move stack "${element.name}"`}
        aria-label={`Move stack ${element.name}`}
      />
      <div className="stack-items">
        {children.map((childId) => (
          <RibbonElement key={childId} elementId={childId} place={childPlace} />
        ))}
      </div>
      {remaining > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: styled as a stack row, not a button
        <div
          className="stack-add-button"
          role="button"
          tabIndex={0}
          title={`${remaining} slot${remaining === 1 ? "" : "s"} free - click to add a command`}
          aria-label={`Add a command to stack ${element.name}`}
          onClick={(e) => {
            e.stopPropagation();
            add();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            add();
          }}
        />
      )}
      <ElementDelete elementId={elementId} element={element} />
    </div>
  );
}

const EDITOR_LAYER = 1;

/** The floating list of a pulldown / split button's commands. */
export function GroupEditor() {
  const openGroup = useStore((s) => s.openGroup);
  const group = useStore((s) => (s.openGroup ? s.elements[s.openGroup.elementId] : undefined));
  if (!openGroup || !group) return null;
  return <GroupEditorBody groupId={openGroup.elementId} group={group} {...openGroup} />;
}

function GroupEditorBody({
  groupId,
  group,
  top,
  left,
}: {
  groupId: string;
  group: Element;
  top: number;
  left: number;
}) {
  const target: DropTarget = { kind: "element", elementId: groupId };
  const drop = useContainerDrop(target, EDITOR_LAYER);
  const place: RibbonItemPlace = { container: target, axis: "y", layer: EDITOR_LAYER };

  return (
    <div
      className="pulldown-content-container"
      data-testid="group-editor"
      style={{ display: "block", position: "absolute", top, left, zIndex: 1000 }}
    >
      <div ref={drop.ref} className={cx("pulldown-content", drop.className)}>
        <div className="pulldown-label">{group.name.toUpperCase()}</div>
        {(group.children ?? []).map((childId) => (
          <RibbonElement key={childId} elementId={childId} place={place} />
        ))}
        <button
          type="button"
          className="add-button group-editor-add"
          onClick={(e) => {
            e.stopPropagation();
            useStore.getState().openModal({ mode: "create", kind: "command", target });
          }}
        >
          <span className="plus">+</span> ADD COMMAND
        </button>
        <button
          type="button"
          className="add-button"
          style={{ marginTop: 10 }}
          onClick={(e) => {
            e.stopPropagation();
            useStore.getState().closeGroupEditor();
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
