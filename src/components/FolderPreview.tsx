import { useEffect, useMemo, useRef, useState } from "react";
import { buildFolderStructure, countNodes, formatFolderStructure, validate } from "../domain/tree";
import { readPref, writePref } from "../state/persistence";
import { useStore } from "../state/store";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The tree is collapsed by default and its state is remembered separately
 * from the draft, because it is a view preference rather than part of the
 * extension.
 */
export function FolderPreview() {
  const extensionName = useStore((s) => s.extensionName);
  const tabs = useStore((s) => s.tabs);
  const panels = useStore((s) => s.panels);
  const elements = useStore((s) => s.elements);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => readPref("previewOpen", false));

  const { text, meta } = useMemo(() => {
    const layout = { extensionName, tabs, panels, elements };
    const tree = buildFolderStructure(layout);
    const counts = countNodes(tree);
    const problems = validate(layout).length;
    return {
      text: formatFolderStructure(tree),
      meta: `${plural(counts.folders, "folder")}, ${plural(counts.files, "file")}${problems ? `  ⚠ ${problems} to fix` : ""}`,
    };
  }, [extensionName, tabs, panels, elements]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const fitToWindow = () => {
      const stacked = window.matchMedia?.("(max-width: 700px)").matches;
      const room = stacked ? 0 : (panel.parentElement?.clientHeight ?? 0);
      if (!room) {
        panel.style.removeProperty("--preview-max");
        panel.style.removeProperty("--preview-tree-max");
        return;
      }
      const heading = panel.querySelector("summary")?.getBoundingClientRect().height ?? 0;
      const frame = panel.offsetHeight - panel.clientHeight;
      panel.style.setProperty("--preview-max", `${Math.floor(room)}px`);
      panel.style.setProperty("--preview-tree-max", `${Math.floor(room - heading - frame)}px`);
    };
    fitToWindow();
    const observer = new ResizeObserver(fitToWindow);
    if (panel.parentElement) observer.observe(panel.parentElement);
    window.addEventListener("resize", fitToWindow);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitToWindow);
    };
  }, []);

  return (
    <div className="preview-panel surface" ref={panelRef}>
      <details
        className="preview-disclosure"
        id="previewDisclosure"
        open={open}
        onToggle={(e) => {
          const next = e.currentTarget.open;
          if (next === open) return;
          setOpen(next);
          writePref("previewOpen", next);
        }}
      >
        <summary className="surface-header">
          <span className="preview-title">Folder preview</span>
          <span className="preview-summary-meta" id="previewSummaryMeta">
            {open ? meta : ""}
          </span>
        </summary>
        <div className="preview-content surface-body" id="folderPreview">
          {text}
        </div>
      </details>
    </div>
  );
}
