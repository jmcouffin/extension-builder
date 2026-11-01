import { useState } from "react";
import { Button } from "@/components/ui/button";
import logoUrl from "../assets/logo.svg";
import { validate } from "../domain/tree";
import { buildZip, downloadBlob } from "../domain/zip";
import { loadDefaultIcons } from "../state/defaultIcons";
import { showAlert, showConfirm } from "../state/dialogs";
import { clearDraft } from "../state/persistence";
import { useSaves } from "../state/saves";
import { layoutOf, useStore } from "../state/store";
import { HistoryControls } from "./HistoryControls";
import { MusicControl } from "./MusicControl";
import { ThemeSwitcher } from "./ThemeSwitcher";

function reportProblems(problems: string[]) {
  const shown = problems.slice(0, 12);
  const hidden = problems.length - shown.length;
  void showAlert(`Fix these and try again.${hidden ? ` ...and ${hidden} more.` : ""}`, {
    title: "This extension will not work as built",
    details: shown,
  });
}

function saveLayout() {
  const { error, replaced } = useSaves.getState().save(layoutOf(useStore.getState()));
  const name = useStore.getState().extensionName.trim() || "Untitled";
  if (error) {
    void showAlert(error, { title: "Could not save the layout" });
    return;
  }
  void showAlert(
    replaced
      ? `"${name}" was updated. Press Load layout to open it later.`
      : `"${name}" was kept in this browser. Press Load layout to open it later.`,
    { title: "Layout saved" },
  );
}

function loadLayout() {
  useSaves.getState().openManager();
}

async function resetLayout() {
  const { elements, panels } = useStore.getState();
  const ok = await showConfirm(
    `${Object.keys(panels).length} panel(s) and ${Object.keys(elements).length} command(s) will be removed, and the saved draft deleted.\n\nUndo brings it back until you leave the page. Save a layout to keep it.`,
    { title: "Discard the whole toolbar?", confirmLabel: "Reset", danger: true },
  );
  if (!ok) return;
  clearDraft();
  useStore.getState().reset();
}

export function Header() {
  const [zipping, setZipping] = useState(false);

  const download = async () => {
    const layout = layoutOf(useStore.getState());
    const problems = validate(layout);
    if (problems.length) {
      reportProblems(problems);
      return;
    }
    setZipping(true);
    try {
      const { blob, name } = await buildZip(layout, await loadDefaultIcons());
      downloadBlob(blob, name);
    } catch (error) {
      console.error("Error creating ZIP:", error);
      void showAlert((error as Error).message, { title: "Failed to create the ZIP file" });
    } finally {
      setZipping(false);
    }
  };

  return (
    <header>
      <div className="logo">
        <img className="logo-mark" src={logoUrl} alt="pyRevit Logo" width="198" height="218" />
        <div className="logo-text">
          <h1 className="glowing-text-title">pyRevit</h1>
          <span className="glowing-text-title">extension builder</span>
        </div>
      </div>
      <div className="download-button">
        <MusicControl />
        <ThemeSwitcher />
        <HistoryControls />
        <Button variant="toolbar" size="toolbar" id="loadConfig" onClick={loadLayout}>
          <span className="toolbar-action-label">Load layout</span>
        </Button>
        <Button variant="toolbar" size="toolbar" id="saveConfig" onClick={saveLayout}>
          <span className="toolbar-action-label">Save layout</span>
        </Button>
        <Button
          variant="toolbar-danger"
          size="toolbar"
          id="resetToolbar"
          onClick={() => void resetLayout()}
        >
          <span className="toolbar-action-label">Reset</span>
        </Button>
        <Button
          variant="toolbar-primary"
          size="toolbar"
          id="downloadZip"
          disabled={zipping}
          onClick={() => void download()}
        >
          <span className="toolbar-action-label">
            {zipping ? "Creating ZIP file..." : "Download"}
          </span>
        </Button>
      </div>
    </header>
  );
}
