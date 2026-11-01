import { ChevronDownIcon, ChevronsDownIcon, ChevronsUpIcon, CodeIcon } from "lucide-react";
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
  type FieldGroup,
  type FieldKey,
  GROUP_ORDER,
  ORDER,
  rejectionReason,
  TYPES,
  type TypeId,
  withDefaults,
} from "../domain/bundleTypes";
import type { Element } from "../domain/model";
import { sanitizeFileName } from "../domain/templates";
import { readFileAsDataUrl } from "../domain/zip";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { showConfirm } from "../state/dialogs";
import { type ElementPayload, useStore } from "../state/store";
import { useIcons } from "./IconsContext";

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

interface RowInfo {
  label: string;
  help?: string;
  required?: boolean;
  /** Required and still empty: the row is marked until it is filled. */
  missing?: boolean;
}

function Row({
  info,
  htmlFor,
  children,
}: {
  info: RowInfo;
  htmlFor?: string;
  children: ReactNode;
}) {
  const className = ["prop-row", info.required && "is-required", info.missing && "is-missing"]
    .filter(Boolean)
    .join(" ");
  const name = (
    <>
      {info.label}
      {info.required && (
        <span className="prop-required" title="Required">
          {" "}
          *
        </span>
      )}
    </>
  );
  return (
    <div className={className} title={info.help}>
      {htmlFor ? (
        <label className="prop-name" htmlFor={htmlFor}>
          {name}
        </label>
      ) : (
        <span className="prop-name">{name}</span>
      )}
      <div className="prop-value">{children}</div>
    </div>
  );
}

/** A value Revit shows but does not let you edit: grey text on the palette. */
function ReadOnly({ info, value }: { info: RowInfo; value: string }) {
  return (
    <Row info={info}>
      <span className="prop-readonly" title={value}>
        {value}
      </span>
    </Row>
  );
}

/**
 * A text value, applied when you leave the cell or press Enter, as in Revit.
 * Escape puts the last applied value back. A multi-line value (a textarea)
 * takes Enter as a new line, and applies on leaving.
 */
function TextProp({
  info,
  value,
  placeholder,
  multiline,
  rows,
  field,
  onCommit,
}: {
  info: RowInfo;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  field?: string;
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
  const common = {
    id,
    className: multiline ? "prop-input prop-textarea" : "prop-input",
    value: draft,
    placeholder,
    "data-field": field,
    onBlur: commit,
  };
  return (
    <Row info={info} htmlFor={id}>
      {multiline ? (
        <textarea
          {...common}
          rows={rows ?? 4}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(value);
              setDirty(false);
            }
          }}
        />
      ) : (
        <input
          {...common}
          type="text"
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
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
      )}
    </Row>
  );
}

function SelectProp({
  info,
  value,
  options,
  onCommit,
}: {
  info: RowInfo;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (next: string) => void;
}) {
  const id = useId();
  return (
    <Row info={info} htmlFor={id}>
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

/** A yes/no parameter: Revit's checkbox cell. Applies at once. */
function BoolProp({
  info,
  value,
  onCommit,
}: {
  info: RowInfo;
  value: boolean;
  onCommit: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <Row info={info} htmlFor={id}>
      <span className="prop-check">
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e) => onCommit(e.target.checked)}
        />
      </span>
    </Row>
  );
}

/** An image value: a thumbnail, its file name, and Revit's "..." browse button. */
function IconProp({
  info,
  fileName,
  data,
  fallback,
  onPick,
}: {
  info: RowInfo;
  fileName: string;
  data: string | null | undefined;
  fallback: string;
  onPick: (dataUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row info={info}>
      <span className="prop-icon">
        <img src={data || fallback} alt="" />
        <span className="prop-icon-name">{data ? fileName : "Default"}</span>
        <button
          type="button"
          className="prop-browse"
          aria-label={`Browse for ${info.label.toLowerCase()}`}
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

/** The script: edited in the drawing area's script.py view, a click away. */
function ScriptProp({ edited }: { edited: boolean }) {
  return (
    <Row info={{ label: "Script", help: "The bundle's script.py, edited in the drawing area." }}>
      <span className="prop-icon">
        <span className="prop-readonly prop-dialog-value">
          script.py {edited ? "(edited)" : "(starter)"}
        </span>
        <button
          type="button"
          className="prop-edit"
          onClick={() => {
            useStore.getState().setDrawingView("script");
            // On a phone the drawing area sits below the palettes.
            requestAnimationFrame(() => {
              const editor = document.querySelector<HTMLTextAreaElement>(".code-editor");
              editor?.scrollIntoView({ block: "nearest" });
              editor?.focus({ preventScroll: true });
            });
          }}
        >
          <CodeIcon aria-hidden="true" />
          Edit
        </button>
      </span>
    </Row>
  );
}

/**
 * One bundle.yaml parameter, drawn from its definition in the type table, so
 * a parameter added there appears here with no other change.
 */
function FieldProp({
  fieldKey,
  element,
  forcedContext,
  required,
  onCommit,
}: {
  fieldKey: FieldKey;
  element: Element;
  forcedContext?: string;
  required: boolean;
  onCommit: (key: FieldKey, value: string) => void;
}) {
  const def = FIELDS[fieldKey];
  const value = element[fieldKey] ?? "";
  const info: RowInfo = {
    label: def.label,
    help: def.help,
    required,
    missing: required && !value.trim(),
  };
  if (fieldKey === "context" && forcedContext) {
    return <ReadOnly info={info} value={`${forcedContext} (set by pyRevit)`} />;
  }
  if (def.input === "bool") {
    return (
      <BoolProp
        info={info}
        value={value === "true"}
        onCommit={(on) => onCommit(fieldKey, on ? "true" : "")}
      />
    );
  }
  if (def.input === "select" || def.input === "year") {
    return (
      <SelectProp
        info={info}
        value={value}
        options={def.options ?? []}
        onCommit={(v) => onCommit(fieldKey, v)}
      />
    );
  }
  return (
    <TextProp
      info={info}
      value={value}
      placeholder={required ? `Required - e.g. ${def.placeholder ?? ""}` : def.placeholder}
      multiline={def.input === "textarea"}
      rows={def.rows}
      field={fieldKey}
      onCommit={(v) => onCommit(fieldKey, def.input === "textarea" ? v.trimEnd() : v.trim())}
    />
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** A parameter group with Revit's collapse chevrons on the right. Open by default. */
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
  // Commands become commands, groups become groups (a stack included): the
  // same swap Revit's Type Selector makes within a category.
  const choices = ORDER.filter(
    (id) => TYPES[id].container === def.container && !rejectionReason(containerKey, id),
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
    update(withDefaults(next, { ...payloadOf(element), type: next }));
  };

  const required = def.required ?? [];
  const commit = (key: FieldKey, value: string) => update({ [key]: value });
  const fieldsIn = (group: FieldGroup) => {
    const keys = def.fields.filter((k) => FIELDS[k].group === group);
    // Required parameters first, so they are never below the fold.
    return [
      ...keys.filter((k) => required.includes(k)),
      ...keys.filter((k) => !required.includes(k)),
    ];
  };
  const bundle = `${sanitizeFileName(element.name)}${def.postfix}`;
  const icon = element.iconData || defaults.light || FALLBACK_ICON;
  const isStack = element.type === "stack";
  const hasIcons = (def.icons?.length ?? 0) > 0;

  const groupBody = (group: FieldGroup): ReactNode => {
    const fields = fieldsIn(group).map((k) => (
      <FieldProp
        key={k}
        fieldKey={k}
        element={element}
        forcedContext={def.forcedContext}
        required={required.includes(k)}
        onCommit={commit}
      />
    ));
    if (group === "Identity Data") {
      return (
        <>
          <TextProp
            info={{
              label: "Name",
              help: "The bundle's folder name, and its ribbon label unless Title is set.",
              required: true,
              missing: !element.name.trim(),
            }}
            value={element.name}
            field="name"
            onCommit={(v) => useStore.getState().renameElement(elementId, v)}
          />
          {!isStack && (
            <>
              <TextProp
                info={{ label: "Title", help: "The ribbon label. Defaults to the name." }}
                value={element.title ?? ""}
                placeholder={element.name}
                onCommit={(v) => update({ title: v.trim() })}
              />
              <TextProp
                info={{ label: "Tooltip", help: "Shown when the user hovers the button." }}
                value={element.tooltip ?? ""}
                placeholder="What the button does"
                onCommit={(v) => update({ tooltip: v.trim() })}
              />
            </>
          )}
          {fields}
        </>
      );
    }
    if (group === "Graphics") {
      return (
        <>
          {hasIcons && (
            <IconProp
              info={{ label: "Icon", help: "icon.png: the button's picture." }}
              fileName="icon.png"
              data={element.iconData}
              fallback={defaults.light || FALLBACK_ICON}
              onPick={(url) => update({ iconData: url })}
            />
          )}
          {(def.darkIcons?.length ?? 0) > 0 && (
            <IconProp
              info={{
                label: "Dark Icon",
                help: "icon.dark.png: used on Revit's dark theme; without it the icon is used.",
              }}
              fileName="icon.dark.png"
              data={element.iconDarkData}
              fallback={element.iconData || defaults.dark || defaults.light || FALLBACK_ICON}
              onPick={(url) => update({ iconDarkData: url })}
            />
          )}
          {def.toggle && (
            <IconProp
              info={{ label: "On Icon", help: "on.png: shown while the toggle is on." }}
              fileName="on.png"
              data={element.iconOnData}
              fallback={element.iconData || defaults.light || FALLBACK_ICON}
              onPick={(url) => update({ iconOnData: url })}
            />
          )}
          {def.script && <ScriptProp edited={!!element.code} />}
          {fields}
        </>
      );
    }
    return fields;
  };

  const hasGroup = (group: FieldGroup) =>
    group === "Identity Data" ||
    (group === "Graphics" && (hasIcons || !!def.script)) ||
    fieldsIn(group).length > 0;

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
      </div>
      {def.help && <p className="type-help">{def.help}</p>}
      <div className="prop-grid">
        {GROUP_ORDER.filter(hasGroup).map((group) => (
          <Group
            key={group}
            name={group}
            collapsed={groups.is(group)}
            onToggle={() => groups.toggle(group)}
          >
            {groupBody(group)}
          </Group>
        ))}
        <Group
          name="Folder"
          collapsed={groups.is("Folder")}
          onToggle={() => groups.toggle("Folder")}
        >
          <ReadOnly info={{ label: "Bundle" }} value={bundle} />
          {def.container && (
            <ReadOnly info={{ label: "Commands" }} value={String(element.children?.length ?? 0)} />
          )}
          {def.contentFile && (
            <ReadOnly
              info={{ label: "Add after unzipping" }}
              value={element.content || def.contentFile}
            />
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
      </div>
      <div className="prop-grid">
        <Group
          name="Identity Data"
          collapsed={groups.is("Identity Data")}
          onToggle={() => groups.toggle("Identity Data")}
        >
          <TextProp
            info={{ label: "Name", required: true, missing: !name.trim() }}
            value={name}
            field="name"
            onCommit={(v) => useStore.getState().setExtensionName(v.trim() || name)}
          />
        </Group>
        <Group
          name="Folder"
          collapsed={groups.is("Folder")}
          onToggle={() => groups.toggle("Folder")}
        >
          <ReadOnly info={{ label: "Folder" }} value={folder} />
          <ReadOnly info={{ label: "Tabs" }} value={tabs ?? "0"} />
          <ReadOnly info={{ label: "Panels" }} value={panels ?? "0"} />
          <ReadOnly info={{ label: "Bundles" }} value={bundles ?? "0"} />
        </Group>
      </div>
    </>
  );
}

/**
 * Revit's Properties palette, for the selected bundle - or for the extension
 * when nothing is selected, as Revit shows the view's properties. Every
 * parameter of every bundle type is here; there is no other editor.
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
        if (e.key === "Escape" && !(e.target as HTMLElement).matches("input, select, textarea")) {
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
