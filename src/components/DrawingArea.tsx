import { useState } from "react";
import { TYPES } from "../domain/bundleTypes";
import type { Element } from "../domain/model";
import { buildYaml, defaultScript } from "../domain/templates";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { useStore } from "../state/store";
import { useIcons } from "./IconsContext";

type View = "preview" | "yaml" | "script";

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

function panelNameOf(elementId: string): string {
  const s = useStore.getState();
  let element = s.elements[elementId];
  while (element?.parentId) element = s.elements[element.parentId];
  return (element?.panelId && s.panels[element.panelId]?.name) || "";
}

function Preview({ elementId, element }: { elementId: string; element: Element }) {
  const defaults = useIcons();
  const light = element.iconData || defaults.light || FALLBACK_ICON;
  const dark = element.iconDarkData || element.iconData || defaults.dark || light;
  const label = element.title || element.name;
  const panel = panelNameOf(elementId);
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
 * Revit's drawing area, with its view tabs: how the selected bundle will look
 * on a light and a dark ribbon, and the files it will produce.
 */
export function DrawingArea() {
  const selectedId = useStore((s) => s.selectedId);
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  const [view, setView] = useState<View>("preview");
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
          <div className="code-sheet">
            <div className="code-path">
              {`${name}${def.postfix}/${shown === "yaml" ? "bundle.yaml" : "script.py"}`}
            </div>
            <pre>
              {shown === "yaml"
                ? buildYaml(element, def) || "# nothing to set: pyRevit uses the folder name"
                : element.code || defaultScript(element, def)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
