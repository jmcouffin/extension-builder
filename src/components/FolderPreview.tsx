import { useMemo, useState } from "react";
import type { TreeNode } from "../domain/templates";
import { buildFolderStructure, countNodes, validate } from "../domain/tree";
import { readPref, writePref } from "../state/persistence";
import { useStore } from "../state/store";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const base = import.meta.env.BASE_URL;

interface Row {
  key: string;
  depth: number;
  name: string;
  folder: boolean;
  hasChildren: boolean;
  elementId?: string;
}

function flatten(node: TreeNode, collapsed: Set<string>, path = "", depth = 0, out: Row[] = []) {
  const key = path ? `${path}/${node.name}` : node.name;
  const folder = node.type === "folder";
  const children = folder ? node.children : [];
  out.push({
    key,
    depth,
    name: node.name,
    folder,
    hasChildren: children.length > 0,
    elementId: folder ? node.elementId : undefined,
  });
  if (folder && !collapsed.has(key)) {
    for (const child of children) flatten(child, collapsed, key, depth + 1, out);
  }
  return out;
}

/**
 * Revit's Project Browser, showing the folder tree the ZIP will contain. A
 * bundle row selects its bundle, and the selected bundle's row is marked.
 * The palette can be folded away; that choice is a view preference, kept
 * apart from the draft.
 */
export function FolderPreview() {
  const extensionName = useStore((s) => s.extensionName);
  const tabs = useStore((s) => s.tabs);
  const panels = useStore((s) => s.panels);
  const elements = useStore((s) => s.elements);
  const selectedId = useStore((s) => s.selectedId);
  const [open, setOpen] = useState(() => readPref("previewOpen", true));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const { tree, meta } = useMemo(() => {
    const layout = { extensionName, tabs, panels, elements };
    const root = buildFolderStructure(layout);
    const counts = countNodes(root);
    const problems = validate(layout).length;
    return {
      tree: root,
      meta: `${plural(counts.folders, "folder")}, ${plural(counts.files, "file")}${problems ? `  ⚠ ${problems} to fix` : ""}`,
    };
  }, [extensionName, tabs, panels, elements]);

  const rows = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="preview-panel palette project-browser" id="previewDisclosure" data-open={open}>
      <button
        type="button"
        className="palette-title preview-toggle"
        id="previewToggle"
        aria-expanded={open}
        aria-controls="folderPreview"
        onClick={() => {
          setOpen(!open);
          writePref("previewOpen", !open);
        }}
      >
        <span className="preview-title">Project Browser - {tree.name}</span>
      </button>
      {open && (
        <>
          <div
            className="preview-content"
            id="folderPreview"
            role="tree"
            aria-label="Extension folders"
          >
            {rows.map((row) => {
              const selected = !!row.elementId && row.elementId === selectedId;
              return (
                <div
                  key={row.key}
                  role="treeitem"
                  tabIndex={-1}
                  aria-level={row.depth + 1}
                  aria-selected={selected}
                  aria-expanded={row.hasChildren ? !collapsed.has(row.key) : undefined}
                  className={selected ? "tree-row is-selected" : "tree-row"}
                  style={{ paddingLeft: 4 + row.depth * 14 }}
                  title={row.name}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className="tree-twist"
                      aria-label={`${collapsed.has(row.key) ? "Expand" : "Collapse"} ${row.name}`}
                      onClick={() => toggle(row.key)}
                    >
                      {collapsed.has(row.key) ? "+" : "−"}
                    </button>
                  ) : (
                    <span className="tree-twist-none" />
                  )}
                  <img
                    className="tree-icon"
                    src={`${base}${row.folder ? "tree-folder.svg" : "tree-file.svg"}`}
                    alt=""
                  />
                  {row.elementId ? (
                    <button
                      type="button"
                      className="tree-name tree-link"
                      onClick={() => useStore.getState().select(row.elementId ?? null)}
                    >
                      {row.name}
                    </button>
                  ) : (
                    <span className="tree-name">{row.name}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="preview-summary-meta" id="previewSummaryMeta">
            {meta}
          </div>
        </>
      )}
    </div>
  );
}
