import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { parseLayout } from "../domain/layoutFile";
import { sanitizeFileName } from "../domain/templates";
import { downloadBlob } from "../domain/zip";
import { showAlert, showConfirm } from "../state/dialogs";
import { type SavedLayout, useSaves } from "../state/saves";
import { useStore } from "../state/store";

function when(ms: number) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function exportFile(save: SavedLayout) {
  const blob = new Blob([JSON.stringify(save.data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${sanitizeFileName(save.name)}_layout.json`);
}

function importFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      useStore.getState().loadLayout(parseLayout(await file.text()));
      useSaves.getState().closeManager();
    } catch (error) {
      void showAlert((error as Error).message, { title: "Could not load that layout" });
    }
  });
  input.click();
}

export function SavedLayouts() {
  const open = useSaves((s) => s.managerOpen);
  const saves = useSaves((s) => s.saves);
  const { closeManager, read, remove } = useSaves.getState();

  const load = (id: string) => {
    const layout = read(id);
    if (!layout) {
      void showAlert("This save is damaged and cannot be opened. Delete it and save again.", {
        title: "Could not load that layout",
      });
      return;
    }
    useStore.getState().loadLayout(layout);
    closeManager();
  };

  const erase = async (id: string, name: string) => {
    const ok = await showConfirm(`"${name}" will be removed from this browser.`, {
      title: "Delete this save?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove(id);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeManager()}>
      <DialogContent
        className="modal-content"
        overlayProps={{ id: "savedLayouts", className: "modal" }}
        data-testid="saved-layouts"
      >
        <DialogTitle className="modal-title text-[1.5em] leading-[inherit] font-bold">
          Saved layouts
        </DialogTitle>
        <DialogDescription className="saved-hint">
          Kept in this browser. Loading one replaces the ribbon; undo brings yours back.
        </DialogDescription>
        {saves.length === 0 ? (
          <p className="saved-empty">
            Nothing saved yet. Press Save layout to keep the current ribbon here.
          </p>
        ) : (
          <ul className="saved-list">
            {saves.map((s) => (
              <li className="saved-row" key={s.id} data-save-name={s.name}>
                <div className="saved-info">
                  <strong className="saved-name">{s.name}</strong>
                  <span className="saved-meta">
                    {when(s.savedAt)} · {s.panels} panel{s.panels === 1 ? "" : "s"}, {s.commands}{" "}
                    command{s.commands === 1 ? "" : "s"}
                  </span>
                </div>
                <Button variant="dialog-primary" size="dialog" onClick={() => load(s.id)}>
                  Load
                </Button>
                <Button
                  variant="dialog"
                  size="dialog"
                  aria-label={`Export ${s.name} to a file`}
                  onClick={() => exportFile(s)}
                >
                  Export
                </Button>
                <Button
                  variant="dialog"
                  size="dialog"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => void erase(s.id, s.name)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <Button variant="dialog" size="dialog" onClick={importFile}>
            Import from file
          </Button>
          <Button variant="dialog" size="dialog" onClick={closeManager}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
