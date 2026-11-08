// Opening a spec in the builder, from an import link or a loaded file: refuse
// it with the reasons, or ask before it replaces work in progress, then load
// it as one undo step.

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
  if (hasWork()) {
    const ok = await showConfirm(
      `Open "${result.layout.extensionName}" ${from}? It replaces the extension you are building here; Undo brings yours back.`,
      { title: "Open extension", confirmLabel: "Open" },
    );
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
  } finally {
    importing = false;
  }
}
