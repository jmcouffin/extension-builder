import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { showAlert } from "../state/dialogs";

function commitKeys(e: KeyboardEvent<HTMLInputElement>, reset: () => void) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  } else if (e.key === "Escape") {
    e.preventDefault();
    reset();
    e.currentTarget.blur();
  }
}

/**
 * An always-visible text input that commits on blur or Enter, like a native
 * `change` event. `onCommit` returns an error message to reject the value, or
 * an empty string to silently revert.
 */
export function CommitInput({
  value,
  onCommit,
  className,
  title,
}: {
  value: string;
  onCommit: (next: string) => string | null;
  className: string;
  title?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft === value) return;
    const error = onCommit(draft);
    if (error === null) return;
    if (error) void showAlert(error, { title: "Name not changed" });
    setDraft(value);
  };

  return (
    <input
      type="text"
      className={className}
      title={title}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      onKeyDown={(e) => commitKeys(e, () => setDraft(value))}
    />
  );
}

/** A label that turns into an input when clicked, and back on commit. */
export function EditableLabel({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  className: string;
}) {
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  if (!editing) {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: double-click opens the full editor; this is a shortcut
      <div
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {value}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        type="text"
        defaultValue={value}
        // biome-ignore lint/a11y/noAutofocus: the user just asked to edit this label
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          setEditing(false);
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          onCommit(e.currentTarget.value);
        }}
        onKeyDown={(e) =>
          commitKeys(e, () => {
            cancelled.current = true;
          })
        }
      />
    </div>
  );
}
