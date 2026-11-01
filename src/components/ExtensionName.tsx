import { sanitizeFileName } from "../domain/templates";
import { useStore } from "../state/store";

/**
 * Warn only when the extension name cannot be used as-is. The resulting
 * folder name is deliberately NOT echoed otherwise - it is the first line of
 * the folder tree, and repeating it beside the field was just noise.
 */
function nameWarning(raw: string): string | null {
  const folder = sanitizeFileName(raw);
  if (!raw.trim()) return "Give the extension a name";
  if (folder === "Untitled") return "No usable folder characters in this name";
  if (folder !== raw.trim()) return `Saved as ${folder}.extension`;
  return null;
}

export function ExtensionName() {
  const name = useStore((s) => s.extensionName);
  const setName = useStore((s) => s.setExtensionName);
  const warning = nameWarning(name);

  return (
    <div className="extension-name">
      <label className="extension-name-label" htmlFor="extensionName">
        Extension name
      </label>
      <div className="extension-name-row">
        <input
          className="glowing-text field"
          type="text"
          id="extensionName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          maxLength={60}
          placeholder="My Extension"
        />
        <div className="extension-name-hint" id="extensionNameHint">
          {warning && <span className="hint-warn">{warning}</span>}
        </div>
      </div>
    </div>
  );
}
