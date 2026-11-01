import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyPlusIcon,
  FolderInputIcon,
  Layers2Icon,
  SquareChevronDownIcon,
  Trash2Icon,
  UngroupIcon,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { TYPES } from "../domain/bundleTypes";
import {
  duplicateRejection,
  moveDestinations,
  ungroupRejection,
  wrapRejection,
} from "../domain/modify";
import { siblingsOf } from "../domain/rules";
import { showAlert } from "../state/dialogs";
import { useStore } from "../state/store";
import { deleteAsking } from "./RibbonItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="context-panel" aria-label={title}>
      <div className="context-panel-body">{children}</div>
      <div className="context-panel-title">{title}</div>
    </section>
  );
}

interface ButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Why the command can't run now; disables the button and is its tooltip. */
  reason?: string | null;
  help?: string;
}

function Large({ label, icon, onClick, reason, help, danger }: ButtonProps & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={danger ? "ctx-large ctx-danger" : "ctx-large"}
      onClick={onClick}
      disabled={!!reason}
      title={reason ?? help}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Small({ label, icon, onClick, reason, help }: ButtonProps) {
  return (
    <button
      type="button"
      className="ctx-small"
      onClick={onClick}
      disabled={!!reason}
      title={reason ?? help}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Runs a store command and shows its refusal, if any, in an app dialog. */
function run(result: string | null, title: string) {
  if (result) void showAlert(result, { title });
}

/**
 * "Move to": every panel, stack and group of the extension, tab by tab. One
 * that can't take the bundle is listed greyed, with the reason under it; one
 * where its name is taken says what it will be called there.
 */
function MoveTo({ elementId }: { elementId: string }) {
  const tabs = useStore((s) => s.tabs);
  const panels = useStore((s) => s.panels);
  const elements = useStore((s) => s.elements);
  const destinations = useMemo(
    () => moveDestinations({ tabs, panels, elements }, elementId),
    [tabs, panels, elements, elementId],
  );
  const open = destinations.length > 0;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ctx-large"
          id="moveToButton"
          disabled={!open}
          title={
            open
              ? "Send it to another panel, stack or group, on any tab"
              : "Nowhere else can take it"
          }
        >
          <FolderInputIcon aria-hidden="true" />
          <span>
            Move to <ChevronDownIcon aria-hidden="true" className="ctx-caret" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="move-menu" data-testid="move-menu">
        {destinations.map((d, i) => (
          <MoveItem
            key={`${d.tabId}-${d.target.kind === "panel" ? d.target.panelId : d.target.elementId}`}
            showTab={i === 0 || destinations[i - 1]?.tabId !== d.tabId}
            destination={d}
            elementId={elementId}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoveItem({
  destination: d,
  showTab,
  elementId,
}: {
  destination: ReturnType<typeof moveDestinations>[number];
  showTab: boolean;
  elementId: string;
}) {
  const kind =
    d.target.kind === "panel"
      ? "Panel"
      : TYPES[useStore.getState().elements[d.target.elementId]?.type ?? "stack"].label;
  return (
    <>
      {showTab && <DropdownMenuLabel className="move-menu-tab">{d.tabName}</DropdownMenuLabel>}
      <DropdownMenuItem
        className="move-menu-item"
        style={{ paddingLeft: 10 + d.depth * 16 }}
        disabled={!!d.reason}
        onSelect={() =>
          run(useStore.getState().moveElementTo(elementId, d.target), "Can't move it there")
        }
      >
        <span className="move-menu-text">
          <span className="move-menu-name">{d.label}</span>
          {d.reason && <span className="move-menu-reason">{d.reason}</span>}
          {!d.reason && d.rename && (
            <span className="move-menu-reason">as “{d.rename}”, its name is taken there</span>
          )}
        </span>
        <span className="move-menu-kind">{kind}</span>
      </DropdownMenuItem>
    </>
  );
}

/**
 * The ribbon of Revit's "Modify | <type>" tab, for the selected bundle. Its
 * commands are the ones Properties and drag-and-drop don't cover: copy a
 * bundle, send it to another tab, wrap it in a stack or a pulldown, or take
 * a group apart. Move Left/Right and Delete stay for touch screens.
 */
export function ContextPanels() {
  const selectedId = useStore((s) => s.selectedId);
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  // Strings, not objects: a selector must return the same value for the same
  // state, or the component re-renders forever.
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
  const duplicate = useStore((s) => (s.selectedId ? duplicateRejection(s, s.selectedId) : ""));
  const stack = useStore((s) => (s.selectedId ? wrapRejection(s, s.selectedId, "stack") : ""));
  const pulldown = useStore((s) =>
    s.selectedId ? wrapRejection(s, s.selectedId, "pulldown") : "",
  );
  const ungroup = useStore((s) => (s.selectedId ? ungroupRejection(s, s.selectedId) : ""));
  if (!element || !selectedId) return null;
  const store = useStore.getState();
  const label = TYPES[element.type].label;

  return (
    <>
      <Panel title="Modify">
        <Large
          label="Duplicate"
          icon={<CopyPlusIcon aria-hidden="true" />}
          reason={duplicate}
          help={`Copy this ${label}, with its parameters, icons and script, next to it`}
          onClick={() => run(store.duplicateElement(selectedId), "Can't duplicate it")}
        />
        <MoveTo elementId={selectedId} />
        <Large
          label="Delete"
          icon={<Trash2Icon aria-hidden="true" />}
          danger
          onClick={() => void deleteAsking(selectedId)}
        />
      </Panel>
      <Panel title="Arrange">
        <div className="ctx-stack">
          <Small
            label="Move Left"
            icon={<ChevronLeftIcon aria-hidden="true" />}
            reason={edge.includes("first") ? "Already first" : null}
            onClick={() => store.nudgeElement(selectedId, -1)}
          />
          <Small
            label="Move Right"
            icon={<ChevronRightIcon aria-hidden="true" />}
            reason={edge.includes("last") ? "Already last" : null}
            onClick={() => store.nudgeElement(selectedId, 1)}
          />
        </div>
      </Panel>
      <Panel title="Group">
        <div className="ctx-stack">
          <Small
            label="Wrap in Stack"
            icon={<Layers2Icon aria-hidden="true" />}
            reason={stack}
            help="Put it in a new stack, with a second command (a stack needs two)"
            onClick={() => run(store.wrapElement(selectedId, "stack"), "Can't wrap it")}
          />
          <Small
            label="Wrap in Pulldown"
            icon={<SquareChevronDownIcon aria-hidden="true" />}
            reason={pulldown}
            help="Put it in a new pulldown, in its place"
            onClick={() => run(store.wrapElement(selectedId, "pulldown"), "Can't wrap it")}
          />
          <Small
            label="Ungroup"
            icon={<UngroupIcon aria-hidden="true" />}
            reason={ungroup}
            help={`Put the ${label}'s commands in its place, and remove the ${label}`}
            onClick={() => run(store.ungroupElement(selectedId), "Can't ungroup it")}
          />
        </div>
      </Panel>
    </>
  );
}
