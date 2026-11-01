import { ChevronDownIcon, ChevronsDownIcon, ChevronsUpIcon, SquarePenIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  FIELDS,
  type FieldKey,
  ORDER,
  rejectionReason,
  TYPES,
  type TypeId,
} from "../domain/bundleTypes";
import type { Element } from "../domain/model";
import { sanitizeFileName } from "../domain/templates";
import { readFileAsDataUrl } from "../domain/zip";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { showConfirm } from "../state/dialogs";
import { type ElementPayload, useStore } from "../state/store";
import { useIcons } from "./IconsContext";
import { openEditor } from "./RibbonItems";

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/bmp,image/svg+xml";

/**
 * The palette's "a value is being edited" flag: Revit greys Apply out until a
 * value changes. Rows report into it; the footer's Apply reads it.
 */
const DirtyContext = createContext<(dirty: boolean) => void>(() => {});

function payloadOf(element: Element): ElementPayload {
  const { children: _c, panelId: _p, parentId: _q, ...rest } = element;
  return rest;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="prop-row">
      {htmlFor ? (
        <label className="prop-name" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="prop-name">{label}</span>
      )}
      <div className="prop-value">{children}</div>
    </div>
  );
}

/** A value Revit shows but does not let you edit: grey text on the palette. */
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <Row label={label}>
      <span className="prop-readonly" title={value}>
        {value}
      </span>
    </Row>
  );
}

/**
 * A text value, applied when you leave the cell or press Enter, as in Revit.
 * Escape puts the last applied value back.
 */
function TextProp({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const id = useId();
  const setDirty = useContext(DirtyContext);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    setDirty(false);
    if (draft !== value) onCommit(draft);
  };
  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        className="prop-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setDirty(false);
          }
        }}
      />
    </Row>
  );
}

function SelectProp({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (next: string) => void;
}) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <select
        id={id}
        className="prop-input"
        value={value}
        onChange={(e) => onCommit(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

/** An image value: a thumbnail, its file name, and Revit's "..." browse button. */
function IconProp({
  label,
  fileName,
  data,
  fallback,
  onPick,
}: {
  label: string;
  fileName: string;
  data: string | null | undefined;
  fallback: string;
  onPick: (dataUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row label={label}>
      <span className="prop-icon">
        <img src={data || fallback} alt="" />
        <span className="prop-icon-name">{data ? fileName : "Default"}</span>
        <button
          type="button"
          className="prop-browse"
          aria-label={`Browse for ${label.toLowerCase()}`}
          title="Browse..."
          onClick={() => input.current?.click()}
        >
          ...
        </button>
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES}
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const url = await readFileAsDataUrl(file);
            if (url) onPick(url);
          }}
        />
      </span>
    </Row>
  );
}

/** A value edited in the full dialog, like Revit's "Edit..." cells. */
function DialogProp({
  label,
  value,
  onOpen,
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <Row label={label}>
      <span className="prop-icon">
        <span className="prop-readonly prop-dialog-value" title={value}>
          {value}
        </span>
        <button
          type="button"
          className="prop-browse"
          aria-label={`Edit ${label.toLowerCase()}`}
          title="Edit..."
          onClick={onOpen}
        >
          ...
        </button>
      </span>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** A parameter group with Revit's collapse chevrons on the right. */
function Group({
  name,
  collapsed,
  onToggle,
  children,
}: {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="prop-group" data-group={name}>
      <button
        type="button"
        className="prop-group-head"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span>{name}</span>
        {collapsed ? (
          <ChevronsDownIcon aria-hidden="true" />
        ) : (
          <ChevronsUpIcon aria-hidden="true" />
        )}
      </button>
      {!collapsed && children}
    </div>
  );
}

function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  return {
    is: (name: string) => collapsed.has(name),
    toggle: (name: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }),
  };
}

// ---------------------------------------------------------------------------
// Type selector
// ---------------------------------------------------------------------------

function containerKeyFor(elementId: string) {
  const s = useStore.getState();
  const element = s.elements[elementId];
  const parent = element?.parentId ? s.elements[element.parentId] : undefined;
  return parent ? parent.type : "panel";
}

/**
 * Revit's Type Selector: the big box at the top of the palette, with the
 * family in bold and the type under it. A native select lies over it, so it
 * opens the system list and works from the keyboard.
 */
function TypeSelector({
  icon,
  family,
  type,
  select,
}: {
  icon: string;
  family: string;
  type: string;
  select?: ReactNode;
}) {
  return (
    <div className="type-selector">
      <img className="type-selector-icon" src={icon} alt="" />
      <span className="type-selector-text">
        <strong>{family}</strong>
        <span>{type}</span>
      </span>
      <ChevronDownIcon className="type-selector-caret" aria-hidden="true" />
      {select}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------

function ElementProperties({ elementId, element }: { elementId: string; element: Element }) {
  const def = TYPES[element.type];
  const defaults = useIcons();
  const groups = useCollapsed();
  const update = (patch: Partial<ElementPayload>) =>
    useStore.getState().updateElement(elementId, { ...payloadOf(element), ...patch });
  const containerKey = containerKeyFor(elementId);
  const choices = ORDER.filter(
    (id) =>
      TYPES[id].container === def.container &&
      !rejectionReason(containerKey, id) &&
      (id !== "stack") === (element.type !== "stack"),
  );
  const changeType = async (next: TypeId) => {
    if (next === element.type) return;
    const nextDef = TYPES[next];
    const children = element.children?.length ?? 0;
    if (def.container && !nextDef.container && children) {
      const ok = await showConfirm(
        `This ${def.label.toLowerCase()} contains ${children} command(s). Changing it to a ${nextDef.label.toLowerCase()} will delete them.`,
        { title: "Delete its commands?", confirmLabel: "Change type", danger: true },
      );
      if (!ok) return;
    }
    update({ type: next });
  };

  const isStack = element.type === "stack";
  const fields = def.fields.filter((k) => k !== "context");
  const fieldValue = (k: FieldKey) => element[k] ?? "";
  const bundle = `${sanitizeFileName(element.name)}${def.postfix}`;
  const icon = element.iconData || defaults.light || FALLBACK_ICON;

  return (
    <>
      <TypeSelector
        icon={icon}
        family={def.label}
        type={def.postfix}
        select={
          choices.length > 1 ? (
            <select
              className="type-selector-native"
              aria-label="Bundle type"
              value={element.type}
              onChange={(e) => void changeType(e.target.value as TypeId)}
            >
              {choices.map((id) => (
                <option key={id} value={id}>
                  {TYPES[id].label} ({TYPES[id].postfix})
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      <div className="type-filter-row">
        <span className="type-filter" title="What the palette shows: the selected bundle">
          {def.label} (1)
          <ChevronDownIcon aria-hidden="true" />
        </span>
        <button
          type="button"
          className="edit-type"
          id="editType"
          onClick={() => openEditor(elementId)}
        >
          <SquarePenIcon aria-hidden="true" />
          Edit Type
        </button>
      </div>
      <div className="prop-grid">
        <Group
          name="Identity Data"
          collapsed={groups.is("Identity Data")}
          onToggle={() => groups.toggle("Identity Data")}
        >
          <TextProp
            label="Name"
            value={element.name}
            onCommit={(v) => useStore.getState().renameElement(elementId, v)}
          />
          {!isStack && (
            <>
              <TextProp
                label="Title"
                value={element.title ?? ""}
                placeholder={element.name}
                onCommit={(v) => update({ title: v.trim() })}
              />
              <TextProp
                label="Tooltip"
                value={element.tooltip ?? ""}
                onCommit={(v) => update({ tooltip: v.trim() })}
              />
            </>
          )}
        </Group>

        {def.fields.includes("context") && (
          <Group
            name="Constraints"
            collapsed={groups.is("Constraints")}
            onToggle={() => groups.toggle("Constraints")}
          >
            {def.forcedContext ? (
              <ReadOnly label="Context" value={def.forcedContext} />
            ) : (
              <SelectProp
                label="Context"
                value={element.context ?? ""}
                options={FIELDS.context.options ?? []}
                onCommit={(v) => update({ context: v })}
              />
            )}
          </Group>
        )}

        {fields.length > 0 && (
          <Group name="Data" collapsed={groups.is("Data")} onToggle={() => groups.toggle("Data")}>
            {fields.map((k) =>
              FIELDS[k].input === "textarea" ? (
                <DialogProp
                  key={k}
                  label={FIELDS[k].label}
                  value={fieldValue(k) ? `${fieldValue(k).split("\n").length} line(s)` : "(none)"}
                  onOpen={() => openEditor(elementId)}
                />
              ) : (
                <TextProp
                  key={k}
                  label={FIELDS[k].label}
                  value={fieldValue(k)}
                  placeholder={def.required?.includes(k) ? "Required" : undefined}
                  onCommit={(v) => update({ [k]: v.trim() })}
                />
              ),
            )}
          </Group>
        )}

        {(!!def.icons?.length || !!def.script) && (
          <Group
            name="Graphics"
            collapsed={groups.is("Graphics")}
            onToggle={() => groups.toggle("Graphics")}
          >
            {(def.icons?.length ?? 0) > 0 && (
              <IconProp
                label="Icon"
                fileName="icon.png"
                data={element.iconData}
                fallback={defaults.light || FALLBACK_ICON}
                onPick={(url) => update({ iconData: url })}
              />
            )}
            {(def.darkIcons?.length ?? 0) > 0 && (
              <IconProp
                label="Dark Icon"
                fileName="icon.dark.png"
                data={element.iconDarkData}
                fallback={element.iconData || defaults.dark || defaults.light || FALLBACK_ICON}
                onPick={(url) => update({ iconDarkData: url })}
              />
            )}
            {def.toggle && (
              <IconProp
                label="On Icon"
                fileName="on.png"
                data={element.iconOnData}
                fallback={element.iconData || defaults.light || FALLBACK_ICON}
                onPick={(url) => update({ iconOnData: url })}
              />
            )}
            {def.script && (
              <DialogProp
                label="Script"
                value={element.code ? "script.py (edited)" : "script.py (starter)"}
                onOpen={() => openEditor(elementId)}
              />
            )}
          </Group>
        )}

        <Group
          name="Folder"
          collapsed={groups.is("Folder")}
          onToggle={() => groups.toggle("Folder")}
        >
          <ReadOnly label="Bundle" value={bundle} />
          {def.container && (
            <ReadOnly label="Commands" value={String(element.children?.length ?? 0)} />
          )}
        </Group>
      </div>
    </>
  );
}

function ExtensionProperties() {
  const name = useStore((s) => s.extensionName);
  const counts = useStore(
    (s) =>
      `${Object.keys(s.tabs).length}|${Object.keys(s.panels).length}|${Object.keys(s.elements).length}`,
  );
  const [tabs, panels, bundles] = counts.split("|");
  const groups = useCollapsed();
  const folder = `${sanitizeFileName(name.trim() || "My Extension")}.extension`;
  const logo = `${import.meta.env.BASE_URL}icon.png`;
  return (
    <>
      <TypeSelector icon={logo} family="pyRevit Extension" type={folder} />
      <div className="type-filter-row">
        <span className="type-filter" title="Nothing is selected: the palette shows the extension">
          Extension (1)
          <ChevronDownIcon aria-hidden="true" />
        </span>
        <button type="button" className="edit-type" disabled>
          <SquarePenIcon aria-hidden="true" />
          Edit Type
        </button>
      </div>
      <div className="prop-grid">
        <Group
          name="Identity Data"
          collapsed={groups.is("Identity Data")}
          onToggle={() => groups.toggle("Identity Data")}
        >
          <TextProp
            label="Name"
            value={name}
            onCommit={(v) => useStore.getState().setExtensionName(v.trim() || name)}
          />
        </Group>
        <Group
          name="Folder"
          collapsed={groups.is("Folder")}
          onToggle={() => groups.toggle("Folder")}
        >
          <ReadOnly label="Folder" value={folder} />
          <ReadOnly label="Tabs" value={tabs ?? "0"} />
          <ReadOnly label="Panels" value={panels ?? "0"} />
          <ReadOnly label="Bundles" value={bundles ?? "0"} />
        </Group>
      </div>
    </>
  );
}

/**
 * Revit's Properties palette, for the selected bundle - or for the extension
 * when nothing is selected, as Revit shows the view's properties.
 */
export function PropertiesPalette() {
  const selectedId = useStore((s) => s.selectedId);
  const element = useStore((s) => (s.selectedId ? s.elements[s.selectedId] : undefined));
  const [dirty, setDirty] = useState(false);
  const root = useRef<HTMLElement>(null);

  return (
    <section
      ref={root}
      className="palette properties-palette"
      id="propertiesPalette"
      aria-label="Properties"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !(e.target as HTMLElement).matches("input, select")) {
          useStore.getState().select(null);
        }
      }}
    >
      <div className="palette-title">Properties</div>
      <div className="palette-body">
        <DirtyContext.Provider value={setDirty}>
          {element && selectedId ? (
            <ElementProperties key={selectedId} elementId={selectedId} element={element} />
          ) : (
            <ExtensionProperties />
          )}
        </DirtyContext.Provider>
      </div>
      <div className="palette-footer">
        <a
          className="palette-help"
          href="https://pyrevitlabs.notion.site/"
          target="_blank"
          rel="noreferrer"
        >
          Properties help
        </a>
        <button
          type="button"
          className="palette-apply"
          disabled={!dirty}
          onClick={() => {
            const active = document.activeElement as HTMLElement | null;
            if (active && root.current?.contains(active)) active.blur();
            setDirty(false);
          }}
        >
          Apply
        </button>
      </div>
    </section>
  );
}
