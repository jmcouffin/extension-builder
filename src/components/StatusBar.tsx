import { useMemo } from "react";
import { TYPES } from "../domain/bundleTypes";
import { validate } from "../domain/tree";
import { useStore } from "../state/store";

/** Revit's status bar: what a click will do, and whether the extension is sound. */
export function StatusBar() {
  const extensionName = useStore((s) => s.extensionName);
  const tabs = useStore((s) => s.tabs);
  const panels = useStore((s) => s.panels);
  const elements = useStore((s) => s.elements);
  const selected = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  const problems = useMemo(
    () => validate({ extensionName, tabs, panels, elements }).length,
    [extensionName, tabs, panels, elements],
  );

  const hint = selected
    ? `${TYPES[selected.type].label} "${selected.name}" selected. Edit it in Properties, drag to move, double-click for Edit Type.`
    : "Click a button to select it. Drag to reorder. Double-click to edit everything.";

  return (
    <footer className="status-bar" id="statusBar">
      <span className="status-hint">{hint}</span>
      <span className={problems ? "status-problems has-problems" : "status-problems"}>
        {problems ? `⚠ ${problems} to fix before download` : "Ready to download"}
      </span>
    </footer>
  );
}
