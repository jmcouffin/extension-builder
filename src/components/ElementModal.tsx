import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  type ContainerKey,
  FIELD_KEYS,
  FIELDS,
  type FieldKey,
  ORDER,
  rejectionReason,
  TYPES,
  type TypeDef,
  type TypeId,
} from "../domain/bundleTypes";
import {
  containerKeyOf,
  type DropTarget,
  nextDefaultButtonName,
  nextDefaultGroupName,
} from "../domain/rules";
import { readFileAsDataUrl } from "../domain/zip";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { showAlert, showConfirm } from "../state/dialogs";
import { type ElementPayload, type ModalRequest, useStore } from "../state/store";

const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/bmp,image/svg+xml";

type FieldValues = Record<FieldKey, string>;

interface Setup {
  title: string;
  submitLabel: string;
  containerKey: ContainerKey;
  wantContainers: boolean;
  initialType: TypeId | null;
  initialName: string;
  elementId?: string;
  target?: DropTarget;
}

function emptyFields(): FieldValues {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, ""])) as FieldValues;
}

function useSetup(request: ModalRequest): Setup | null {
  return useMemo(() => {
    const layout = useStore.getState();
    if (request.mode === "edit") {
      const element = layout.elements[request.elementId];
      if (!element) return null;
      const def = TYPES[element.type];
      const parent = element.parentId ? layout.elements[element.parentId] : undefined;
      return {
        title: `Edit ${def.label}`,
        submitLabel: "Update",
        containerKey: parent ? parent.type : "panel",
        wantContainers: def.container,
        initialType: element.type,
        initialName: element.name,
        elementId: request.elementId,
      };
    }
    const containerKey = containerKeyOf(layout, request.target) ?? "panel";
    const isGroup = request.kind === "container";
    return {
      title: isGroup ? "New Group" : "New Command",
      submitLabel: "Create",
      containerKey,
      wantContainers: isGroup,
      initialType: request.presetType ?? null,
      initialName: isGroup
        ? nextDefaultGroupName(layout)
        : nextDefaultButtonName(layout, request.target),
      target: request.target,
    };
  }, [request]);
}

function TypePicker({
  containerKey,
  wantContainers,
  selected,
  onSelect,
}: {
  containerKey: ContainerKey;
  wantContainers: boolean;
  selected: TypeId | null;
  onSelect: (id: TypeId) => void;
}) {
  const groups = new Map<string, TypeId[]>();
  for (const id of ORDER) {
    const def = TYPES[id];
    if (def.container !== wantContainers) continue;
    if (rejectionReason(containerKey, id)) continue;
    groups.set(def.group, [...(groups.get(def.group) ?? []), id]);
  }

  return (
    <div id="buttonTypeGrid">
      {[...groups].map(([label, ids]) => (
        <div className="type-group" key={label}>
          <h4>{label}</h4>
          <div className="button-types">
            {ids.map((id) => {
              const def = TYPES[id];
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: tiles mirror the original picker markup
                <div
                  key={id}
                  className={id === selected ? "button-type selected" : "button-type"}
                  data-type={id}
                  title={def.help || def.postfix}
                  onClick={() => onSelect(id)}
                >
                  <div className="type-icon">{def.glyph}</div>
                  <div className="type-name">{def.label}</div>
                  <div className="type-postfix">{def.postfix}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdvancedField({
  fieldKey,
  typeDef,
  value,
  onChange,
}: {
  fieldKey: FieldKey;
  typeDef: TypeDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const def = FIELDS[fieldKey];
  const id = `adv_${fieldKey}`;
  const forced = fieldKey === "context" ? typeDef.forcedContext : undefined;
  const common = {
    id,
    title: def.help,
    placeholder: def.placeholder,
    value: forced ?? value,
    disabled: !!forced,
  };

  let input: ReactNode;
  if (def.input === "select") {
    input = (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        {def.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (def.input === "textarea") {
    input = (
      <textarea {...common} rows={def.rows ?? 3} onChange={(e) => onChange(e.target.value)} />
    );
  } else {
    input = (
      <input
        {...common}
        type={def.input === "url" ? "url" : "text"}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div
      className={
        def.input === "textarea" ? "form-group advanced-field span-2" : "form-group advanced-field"
      }
      data-field={fieldKey}
    >
      <label htmlFor={id}>
        {def.label}
        {def.optional ? " (optional)" : ""}
      </label>
      {input}
      {def.help && <div className="field-help">{def.help}</div>}
    </div>
  );
}

export function ElementModal() {
  const request = useStore((s) => s.modal);
  if (!request) return null;
  return <ModalBody key={JSON.stringify(request)} request={request} />;
}

function ModalBody({ request }: { request: ModalRequest }) {
  const setup = useSetup(request);
  const closeModal = useStore((s) => s.closeModal);
  const existing = useStore((s) => (setup?.elementId ? s.elements[setup.elementId] : undefined));

  const firstType = useMemo(() => {
    if (!setup) return null;
    if (setup.initialType) return setup.initialType;
    return (
      ORDER.find(
        (id) =>
          TYPES[id].container === setup.wantContainers && !rejectionReason(setup.containerKey, id),
      ) ?? null
    );
  }, [setup]);

  const [type, setType] = useState<TypeId | null>(firstType);
  const [name, setName] = useState(setup?.initialName ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [tooltip, setTooltip] = useState(existing?.tooltip ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [fields, setFields] = useState<FieldValues>(() => {
    const values = emptyFields();
    if (existing) for (const k of FIELD_KEYS) values[k] = existing[k] ?? "";
    return values;
  });
  const [preview, setPreview] = useState<string>(existing?.iconData || FALLBACK_ICON);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const iconRef = useRef<HTMLInputElement>(null);
  const darkIconRef = useRef<HTMLInputElement>(null);
  const onIconRef = useRef<HTMLInputElement>(null);

  if (!setup) return null;
  const typeDef = type ? TYPES[type] : null;
  const pickerHasType =
    !!type &&
    TYPES[type].container === setup.wantContainers &&
    !rejectionReason(setup.containerKey, type);
  const visibleFields = typeDef?.fields ?? [];

  const fileOf = (ref: RefObject<HTMLInputElement | null>) => ref.current?.files?.[0] ?? null;
  const readIcon = async (ref: RefObject<HTMLInputElement | null>) => {
    const file = fileOf(ref);
    return file ? readFileAsDataUrl(file) : null;
  };

  const submit = async () => {
    if (!type || !typeDef) {
      void showAlert("Pick a command type first.", { title: "No type selected" });
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      void showAlert("A name is required - it becomes the bundle folder name.", {
        title: "Name required",
      });
      return;
    }

    const advanced: Partial<Record<FieldKey, string>> = {};
    for (const key of typeDef.fields) advanced[key] = fields[key].trim();

    // Without these pyRevit logs an error and the button never binds.
    for (const key of typeDef.required ?? []) {
      if (!advanced[key]) {
        void showAlert(`${FIELDS[key].label} is required for a ${typeDef.label}.`, {
          title: "Missing required field",
        });
        setAdvancedOpen(true);
        return;
      }
    }

    const [iconData, iconDarkData, iconOnData] = await Promise.all([
      readIcon(iconRef),
      readIcon(darkIconRef),
      readIcon(onIconRef),
    ]);

    const payload: ElementPayload = {
      type,
      name: trimmedName,
      title: title.trim(),
      tooltip: tooltip.trim(),
      code,
      iconData,
      iconDarkData,
      iconOnData,
      ...advanced,
    };

    const store = useStore.getState();
    if (setup.elementId && existing) {
      const oldDef = TYPES[existing.type];
      const children = existing.children?.length ?? 0;
      if (oldDef.container && !typeDef.container && children) {
        const ok = await showConfirm(
          `This ${oldDef.label.toLowerCase()} contains ${children} command(s). Changing it to a ${typeDef.label.toLowerCase()} will delete them.`,
          { title: "Delete its commands?", confirmLabel: "Change type", danger: true },
        );
        if (!ok) return;
      }
      store.updateElement(setup.elementId, payload);
      closeModal();
      return;
    }

    if (!setup.target) return;
    const error = store.createElement(payload, setup.target);
    if (error) {
      void showAlert(error, { title: "Name already used" });
      return;
    }
    closeModal();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "SUMMARY") return;
    e.preventDefault();
    e.stopPropagation();
    void submit();
  };

  const showIcon = (typeDef?.icons ?? []).length > 0;
  const showDarkIcon = (typeDef?.darkIcons ?? []).length > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
    >
      <DialogContent
        className="modal-content"
        overlayProps={{ id: "buttonModal", className: "modal" }}
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
        // Nothing is focused on open, as before; Tab still enters the dialog.
        onOpenAutoFocus={(e) => e.preventDefault()}
        // A stray click on the backdrop must not throw away a half-filled form.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle
          id="modalTitle"
          className="modal-title text-[1.5em] leading-[inherit] font-bold"
        >
          {setup.title}
        </DialogTitle>

        <h3 className="modal-section-title">Bundle Type</h3>
        <TypePicker
          containerKey={setup.containerKey}
          wantContainers={setup.wantContainers}
          selected={type}
          onSelect={setType}
        />
        {typeDef && !pickerHasType && (
          <div className="type-note" id="typeNote">
            A {typeDef.label} ({typeDef.postfix}) already exists here, but it cannot be created from
            this container.
          </div>
        )}

        <div className="modal-grid">
          <div className="form-group span-2">
            <label htmlFor="buttonName">Name (required)</label>
            <input
              type="text"
              id="buttonName"
              placeholder="Button 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="buttonTitle">Title</label>
            <input
              type="text"
              id="buttonTitle"
              placeholder="Defaults to name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group span-3">
            <label htmlFor="buttonTooltip">Tooltip</label>
            <input
              type="text"
              id="buttonTooltip"
              placeholder="Shown on hover"
              value={tooltip}
              onChange={(e) => setTooltip(e.target.value)}
            />
          </div>

          {showIcon && (
            <div className="form-group" id="buttonIconGroup">
              <label htmlFor="buttonIcon">Icon</label>
              <div className="icon-upload">
                <input
                  type="file"
                  id="buttonIcon"
                  ref={iconRef}
                  accept={IMAGE_TYPES}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const data = await readFileAsDataUrl(file);
                    if (data) setPreview(data);
                  }}
                />
                <div className="icon-preview" id="iconPreview">
                  <img src={preview} alt="Icon Preview" />
                </div>
              </div>
            </div>
          )}

          {typeDef?.toggle && (
            <div className="form-group" id="onIconGroup">
              <label htmlFor="buttonOnIcon">On-state Icon</label>
              <div className="icon-upload">
                <input type="file" id="buttonOnIcon" ref={onIconRef} accept={IMAGE_TYPES} />
                <div className="icon-preview" id="onIconPreview" />
              </div>
            </div>
          )}

          {typeDef?.script && (
            <div className="form-group span-3" id="buttonCodeGroup">
              <label htmlFor="buttonCode">Python</label>
              <textarea
                id="buttonCode"
                placeholder="Leave empty for a starter script."
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}
        </div>

        {visibleFields.length > 0 && typeDef && (
          <details
            className="advanced-disclosure"
            id="advancedDisclosure"
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          >
            <summary>
              Advanced <span className="advanced-hint">(bundle.yaml)</span>
            </summary>
            <div className="advanced-body" id="advancedBody">
              <div id="advancedFields">
                {visibleFields.map((key) => (
                  <AdvancedField
                    key={key}
                    fieldKey={key}
                    typeDef={typeDef}
                    value={fields[key]}
                    onChange={(v) => setFields((f) => ({ ...f, [key]: v }))}
                  />
                ))}
              </div>
              {showDarkIcon && (
                <div className="form-group" id="darkIconGroup">
                  <label htmlFor="buttonDarkIcon">Dark-theme Icon</label>
                  <input type="file" id="buttonDarkIcon" ref={darkIconRef} accept={IMAGE_TYPES} />
                </div>
              )}
            </div>
          </details>
        )}

        <div className="modal-actions">
          <button type="button" id="createButton" onClick={() => void submit()}>
            {setup.submitLabel}
          </button>
          <button type="button" className="cancel-button" onClick={closeModal}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
