// Opening a spec in the builder, from an import link or a loaded file: refuse
// it with the reasons, or ask before it replaces work in progress, then load
// it as one undo step.

import { TYPES } from "../domain/bundleTypes";
import { initialLayout } from "../domain/model";
import { showAlert, showConfirm } from "../state/dialogs";
import { layoutOf, useStore } from "../state/store";
import { readSpecSource, specSourceOf, withoutSpec } from "./importLink";
import { describeIssues, type SpecResult, specFromLayout } from "./spec";

/** True when the builder holds something other than its starting layout. */
function hasWork(): boolean {
  const now = JSON.stringify(specFromLayout(layoutOf(useStore.getState())));
  return now !== JSON.stringify(specFromLayout(initialLayout()));
}

const MAX_LISTED = 12;

/** Load a read spec, after the checks; true when it was loaded. */
export async function openSpecResult(result: SpecResult, from: string): Promise<boolean> {
  if (!result.layout) {
    const issues = describeIssues(result);
    await showAlert(`The extension ${from} can't be opened. Fix these and try again:`, {
      title: "Could not open that extension",
      details: [
        ...issues.slice(0, MAX_LISTED),
        ...(issues.length > MAX_LISTED ? [`...and ${issues.length - MAX_LISTED} more.`] : []),
      ],
    });
    return false;
  }
  // pyRevit runs a bundle's script.py when its button is clicked, so code
  // that came with a link or a file is always shown before it is taken in.
  const scripted = Object.values(result.layout.elements)
    .filter((el) => el.code?.trim())
    .map((el) => `${TYPES[el.type].label} "${el.name}"`);
  const replaces = hasWork();
  if (scripted.length || replaces) {
    const name = result.layout.extensionName;
    const lines = [
      `Open "${name}" ${from}?`,
      replaces ? "It replaces the extension you are building here; Undo brings yours back." : "",
      scripted.length
        ? `It brings its own Python, which Revit runs when you click these buttons. Read their script.py before you use them:`
        : "",
    ].filter(Boolean);
    const ok = await showConfirm(lines.join(" "), {
      title: scripted.length ? "Open an extension with scripts" : "Open extension",
      confirmLabel: "Open",
      ...(scripted.length ? { details: scripted } : {}),
    });
    if (!ok) return false;
  }
  useStore.getState().loadLayout(result.layout);
  return true;
}

let importing = false;

/**
 * Open the spec the page's URL carries (#spec= or ?spec_url=), then take it
 * out of the URL so a reload doesn't open it again.
 */
export async function openSpecFromLocation(): Promise<void> {
  const source = specSourceOf(window.location.href);
  if (!source || importing) return;
  importing = true;
  try {
    window.history.replaceState(window.history.state, "", withoutSpec(window.location.href));
    await openSpecResult(await readSpecSource(source), "from this link");
  } catch (error) {
    await showAlert((error as Error).message, { title: "Could not open that extension" });
  } finally {
    importing = false;
  }
}
