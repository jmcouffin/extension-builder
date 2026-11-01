import { useContainerDrop } from "../dnd/hooks";
import { showAlert } from "../state/dialogs";
import { useStore } from "../state/store";
import { CommitInput } from "./inputs";
import { DeleteButton, RibbonElement } from "./RibbonItems";

function TabStrip() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const { activateTab, renameTab, deleteTab, addTab } = useStore.getState();

  return (
    <div className="tabs-container">
      <div className="tabs" id="tabsContainer">
        {Object.entries(tabs).map(([tabId, tab]) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the tab's input is the focusable part
          <div
            key={tabId}
            className={tabId === activeTabId ? "tab active" : "tab"}
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
  const { openModal, addStack, addPanel, renamePanel, deletePanel } = useStore.getState();

  const actions = [
    {
      label: "BUTTON",
      title: "Add a command",
      run: () => openModal({ mode: "create", kind: "command", target }),
    },
    { label: "STACK", title: "Add a stack of 2-3 commands", run: () => addStack(panelId) },
    {
      label: "GROUP",
      title: "Add a pulldown or split button",
      run: () => openModal({ mode: "create", kind: "container", target }),
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
      </div>
      <div className="panel-footer">
        <CommitInput
          className="panel-name"
          value={panel.name}
          title="Panel name - becomes the folder in your extension"
          onCommit={(next) => renamePanel(panelId, next)}
        />
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
  return (
    <div className="ribbon-container surface">
      <TabStrip />
      <div className="ribbon" id="ribbonContainer">
        {panels.map((panelId) => (
          <RibbonPanel key={panelId} panelId={panelId} />
        ))}
      </div>
    </div>
  );
}
