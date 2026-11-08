import { useMemo } from "react";
import { TYPES } from "../domain/bundleTypes";
import { brokenButtons, sampleValues, validate } from "../domain/tree";
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
  const broken = useMemo(
    () => brokenButtons({ extensionName, tabs, panels, elements }),
    [extensionName, tabs, panels, elements],
  );
  const samples = useMemo(
    () => sampleValues({ extensionName, tabs, panels, elements }),
    [extensionName, tabs, panels, elements],
  );

  const hint = selected
    ? `${TYPES[selected.type].label} "${selected.name}" selected. Edit it in Properties; drag to move it.`
    : "Add bundles from a panel's BUTTON, STACK and GROUP. Click one to edit it in Properties; drag to reorder.";

  return (
    <footer className="status-bar" id="statusBar">
      <span className="status-hint">{hint}</span>
      {broken.length > 0 && (
        <span className="status-samples status-broken" title={broken.join("\n")}>
          {broken.length === 1 ? "1 button won't work" : `${broken.length} buttons won't work`}
        </span>
      )}
      {samples.length > 0 && (
        <span className="status-samples" title={samples.join("\n")}>
          {samples.length} sample value{samples.length === 1 ? "" : "s"} to replace
        </span>
      )}
      <span className={problems ? "status-problems has-problems" : "status-problems"}>
        {problems ? `⚠ ${problems} to fix before download` : "Ready to download"}
      </span>
    </footer>
  );
}
