import { useContainerDrop } from "../dnd/hooks";
import { TYPES } from "../domain/bundleTypes";
import { showAlert } from "../state/dialogs";
import { useStore } from "../state/store";
import { ContextPanels } from "./ContextPanels";
import { CommitInput } from "./inputs";
import { addCommandTo, DeleteButton, RibbonElement } from "./RibbonItems";

/** Revit's green "Modify | <type>" tab, there while something is selected. */
function ContextTab() {
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  const active = useStore((s) => s.ribbonMode === "modify");
  if (!element) return null;
  return (
    <button
      type="button"
      className={active ? "context-tab active" : "context-tab"}
      id="contextTab"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        useStore.getState().setRibbonMode(active ? "tab" : "modify");
      }}
    >
      Modify | {TYPES[element.type].label}
    </button>
  );
}

function TabStrip() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const modify = useStore((s) => s.ribbonMode === "modify" && !!s.selectedId);
  const { activateTab, renameTab, deleteTab, addTab } = useStore.getState();

  return (
    <div className="tabs-container">
      <div className="tabs" id="tabsContainer">
        {Object.entries(tabs).map(([tabId, tab]) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the tab's input is the focusable part
          <div
            key={tabId}
            className={tabId === activeTabId && !modify ? "tab active" : "tab"}
            data-tab-id={tabId}
            style={{ position: "relative" }}
            onClick={() => activateTab(tabId)}
          >
            <CommitInput
              className="tab-name"
              value={tab.name}
              onCommit={(next) => renameTab(tabId, next)}
            />
            <DeleteButton
              className="tab-delete-button"
              title="Delete Tab"
              onDelete={() => {
                const error = deleteTab(tabId);
                if (error) void showAlert(error, { title: "Can't delete that tab" });
              }}
            />
          </div>
        ))}
        <ContextTab />
      </div>
      <button
        type="button"
        className="add-button add-tab-inline control"
        id="addTab"
        title="Add a tab"
        aria-label="Add a tab"
        onClick={addTab}
      />
    </div>
  );
}

function RibbonPanel({ panelId }: { panelId: string }) {
  const panel = useStore((s) => s.panels[panelId]);
  const target = { kind: "panel", panelId } as const;
  const drop = useContainerDrop(target, 0);
  if (!panel) return null;
  const { addGroup, addStack, addPanel, renamePanel, deletePanel } = useStore.getState();

  const actions = [
    {
      label: "BUTTON",
      title: "Add a command",
      run: () => addCommandTo(target),
    },
    { label: "STACK", title: "Add a stack of 2-3 commands", run: () => addStack(panelId) },
    {
      label: "GROUP",
      title: "Add a pulldown or split button",
      run: () => addGroup(panelId),
    },
  ];

  return (
    <div
      className="panel"
      data-panel-id={panelId}
      data-tab-id={panel.tabId}
      style={{ position: "relative" }}
    >
      <div
        ref={drop.ref}
        className={drop.className ? `panel-content ${drop.className}` : "panel-content"}
      >
        {panel.elements.map((elementId) => (
          <RibbonElement
            key={elementId}
            elementId={elementId}
            place={{ container: target, axis: "x", layer: 0 }}
          />
        ))}
        {/* What the panel can take, as a column of small buttons at its end,
            where the next bundle will land. */}
        <div className="panel-controls">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="add-button control"
              title={a.title}
              onClick={a.run}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-footer">
        <CommitInput
          className="panel-name"
          value={panel.name}
          title="Panel name - becomes the folder in your extension"
          onCommit={(next) => renamePanel(panelId, next)}
        />
        <button
          type="button"
          className="add-button add-panel-inline control"
          title="Add another panel to this tab"
          aria-label="Add another panel to this tab"
          onClick={(e) => {
            e.stopPropagation();
            addPanel(panelId);
          }}
        />
      </div>
      <DeleteButton
        className="panel-delete-button"
        title="Delete this panel and everything in it"
        onDelete={() => {
          const error = deletePanel(panelId);
          if (error) void showAlert(error, { title: "Can't delete that panel" });
        }}
      />
    </div>
  );
}

const NO_PANELS: string[] = [];

export function Ribbon() {
  const panels = useStore((s) => s.tabs[s.activeTabId]?.panels ?? NO_PANELS);
  const modify = useStore((s) => s.ribbonMode === "modify" && !!s.selectedId);
  return (
    <div className="ribbon-container surface">
      <TabStrip />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a click on empty ribbon clears the selection, as in Revit; Escape in the Properties palette does the same from the keyboard */}
      <div
        className={modify ? "ribbon ribbon-modify" : "ribbon"}
        id="ribbonContainer"
        onClick={(e) => {
          const hit = e.target as HTMLElement;
          // React bubbles clicks from portaled menus here too, and from a menu
          // item a command just removed: only a click in the ribbon itself counts.
          if (!e.currentTarget.contains(hit)) return;
          if (hit.closest("[data-button-id], button, input, .context-panel")) return;
          useStore.getState().select(null);
        }}
      >
        {/* The Modify tab's panels come first, as in Revit; the tab's own panels
            stay beside them, so a move or a rename is seen as it happens. */}
        {modify && <ContextPanels />}
        {panels.map((panelId) => (
          <RibbonPanel key={panelId} panelId={panelId} />
        ))}
      </div>
    </div>
  );
}
