import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { siblingsOf } from "../domain/rules";
import { useStore } from "../state/store";
import { deleteAsking } from "./RibbonItems";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="context-panel" aria-label={title}>
      <div className="context-panel-body">{children}</div>
      <div className="context-panel-title">{title}</div>
    </section>
  );
}

function Large({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={danger ? "ctx-large ctx-danger" : "ctx-large"}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Small({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="ctx-small" onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * The ribbon of Revit's "Modify | <type>" tab, for the selected bundle: what
 * the old per-item hover controls did, gathered where Revit puts them.
 */
export function ContextPanels() {
  const selectedId = useStore((s) => s.selectedId);
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  // A string, not an object: a selector must return the same value for the
  // same state, or the component re-renders forever.
  const edge = useStore((s) => {
    const el = s.selectedId ? s.elements[s.selectedId] : undefined;
    if (!el || !s.selectedId) return "first last";
    const target = el.panelId
      ? ({ kind: "panel", panelId: el.panelId } as const)
      : el.parentId
        ? ({ kind: "element", elementId: el.parentId } as const)
        : null;
    if (!target) return "first last";
    const list = siblingsOf(s, target);
    const i = list.indexOf(s.selectedId);
    return `${i <= 0 ? "first" : ""} ${i === -1 || i >= list.length - 1 ? "last" : ""}`;
  });
  const position = { first: edge.includes("first"), last: edge.includes("last") };
  if (!element || !selectedId) return null;
  const { nudgeElement } = useStore.getState();

  return (
    <>
      <Panel title="Arrange">
        <div className="ctx-stack">
          <Small
            label="Move Left"
            icon={<ChevronLeftIcon aria-hidden="true" />}
            disabled={position.first}
            onClick={() => nudgeElement(selectedId, -1)}
          />
          <Small
            label="Move Right"
            icon={<ChevronRightIcon aria-hidden="true" />}
            disabled={position.last}
            onClick={() => nudgeElement(selectedId, 1)}
          />
        </div>
      </Panel>
      <Panel title="Modify">
        <Large
          label="Delete"
          icon={<Trash2Icon aria-hidden="true" />}
          danger
          onClick={() => void deleteAsking(selectedId)}
        />
      </Panel>
    </>
  );
}
