import { useEffect, useState } from "react";
import { TYPES } from "../domain/bundleTypes";
import type { Element } from "../domain/model";
import { buildYaml, defaultScript } from "../domain/templates";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { type DrawingView, useStore } from "../state/store";
import { useIcons } from "./IconsContext";

type View = DrawingView;

function Slice({
  tone,
  size,
  icon,
  label,
  panel,
}: {
  tone: "light" | "dark";
  size: "large" | "small";
  icon: string;
  label: string;
  panel: string;
}) {
  return (
    <figure className="preview-card">
      <div className={`preview-ribbon preview-${tone}`}>
        <div className="preview-ribbon-body">
          {size === "large" ? (
            <span className="preview-large">
              <img src={icon} alt="" />
              <span>{label}</span>
            </span>
          ) : (
            <span className="preview-small">
              <img src={icon} alt="" />
              <span>{label}</span>
            </span>
          )}
        </div>
        <div className="preview-ribbon-title">{panel}</div>
      </div>
      <figcaption>
        {tone === "light" ? "Light" : "Dark"} ribbon, {size === "large" ? "large" : "in a stack"}
      </figcaption>
    </figure>
  );
}

/** The name of the panel a bundle sits in, at any depth; reactive, so a rename shows. */
function usePanelName(elementId: string): string {
  return useStore((s) => {
    let element = s.elements[elementId];
    while (element?.parentId) element = s.elements[element.parentId];
    return (element?.panelId && s.panels[element.panelId]?.name) || "";
  });
}

function Preview({ elementId, element }: { elementId: string; element: Element }) {
  const defaults = useIcons();
  const light = element.iconData || defaults.light || FALLBACK_ICON;
  const dark = element.iconDarkData || element.iconData || defaults.dark || light;
  const label = element.title || element.name;
  const panel = usePanelName(elementId);
  return (
    <div className="preview-grid" data-testid="ribbon-preview">
      <Slice tone="light" size="large" icon={light} label={label} panel={panel} />
      <Slice tone="light" size="small" icon={light} label={label} panel={panel} />
      <Slice tone="dark" size="large" icon={dark} label={label} panel={panel} />
      <Slice tone="dark" size="small" icon={dark} label={label} panel={panel} />
    </div>
  );
}

/**
 * The script.py editor. The starter script follows the bundle's title and
 * author until it is edited; an edit is kept from then on, and clearing it
 * brings the starter back. Applied when focus leaves the editor.
 */
function ScriptEditor({ elementId, element }: { elementId: string; element: Element }) {
  const def = TYPES[element.type];
  const starter = defaultScript(element, def);
  const value = element.code || starter;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim() === "" || draft === starter ? "" : draft;
    if (next === (element.code ?? "")) return;
    const { children: _c, panelId: _p, parentId: _q, ...payload } = element;
    useStore.getState().updateElement(elementId, { ...payload, code: next });
  };
  return (
    <textarea
      className="code-editor"
      aria-label={`script.py of ${element.name}`}
      value={draft}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const el = e.currentTarget;
        const { selectionStart: start, selectionEnd: end } = el;
        const next = `${draft.slice(0, start)}    ${draft.slice(end)}`;
        setDraft(next);
        requestAnimationFrame(() => el.setSelectionRange(start + 4, start + 4));
      }}
    />
  );
}

/**
 * Revit's drawing area, with its view tabs: how the selected bundle will look
 * on a light and a dark ribbon, its bundle.yaml, and its script, which is
 * edited here.
 */
export function DrawingArea() {
  const selectedId = useStore((s) => s.selectedId);
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  const view = useStore((s) => s.drawingView);
  const setView = useStore((s) => s.setDrawingView);
  const def = element ? TYPES[element.type] : undefined;
  const hasScript = !!def?.script;
  const shown: View = view === "script" && !hasScript ? "preview" : view;
  const name = element?.name ?? "";

  const tabs: { id: View; label: string }[] = [
    { id: "preview", label: element ? `Preview: ${name}` : "Preview" },
    { id: "yaml", label: "bundle.yaml" },
    ...(hasScript ? [{ id: "script" as const, label: "script.py" }] : []),
  ];

  return (
    <section className="drawing-area" aria-label="Drawing area">
      <div className="view-tabs" role="tablist" aria-label="Views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={shown === t.id}
            className={shown === t.id ? "view-tab active" : "view-tab"}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="view-canvas" role="tabpanel">
        {!element || !selectedId || !def ? (
          <p className="view-empty">
            Select a button on the ribbon to see how it will look in Revit, and the files it makes.
          </p>
        ) : shown === "preview" ? (
          <Preview elementId={selectedId} element={element} />
        ) : (
          <div className={shown === "script" ? "code-sheet code-sheet-edit" : "code-sheet"}>
            <div className="code-path">
              {`${name}${def.postfix}/${shown === "yaml" ? "bundle.yaml" : "script.py"}`}
              {shown === "script" && (
                <span className="code-hint">
                  {element.code
                    ? "Edited. Clear it to get the starter back."
                    : "Starter script: edit it here."}
                </span>
              )}
            </div>
            {shown === "yaml" ? (
              <pre>
                {buildYaml(element, def) || "# nothing to set: pyRevit uses the folder name"}
              </pre>
            ) : (
              <ScriptEditor key={selectedId} elementId={selectedId} element={element} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
