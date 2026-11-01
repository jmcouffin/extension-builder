// Folder structure generation and validation, as pure functions of a layout.

import { type ContainerKey, FIELDS, getType, rejectionReason, TYPES } from "./bundleTypes";
import type { Element, Layout, Panel } from "./model";
import {
  buildBundle,
  buildLayoutYaml,
  extensionFolder,
  type FolderNode,
  panelFolder,
  sanitizeFileName,
  type TreeNode,
  tabFolder,
  yamlLine,
} from "./templates";

interface Rejection {
  element: Element;
  container: ContainerKey;
  reason: string;
}

type LayoutParts = Pick<Layout, "extensionName" | "tabs" | "panels" | "elements">;

/**
 * Build the whole virtual file tree from a layout.
 *
 * One recursive walk driven by the bundle type table. There is no per-type
 * switch anywhere, so a new type cannot be forgotten in one place but not
 * another.
 */
export function buildFolderStructure(layout: LayoutParts, rejected: Rejection[] = []): FolderNode {
  const extension = extensionFolder(layout.extensionName);

  for (const tab of Object.values(layout.tabs)) {
    const folder = tabFolder(tab.name);
    for (const panelId of tab.panels) {
      const panel = layout.panels[panelId];
      if (panel) folder.children.push(buildPanel(layout, panel, rejected));
    }
    extension.children.push(folder);
  }

  return extension;
}

function buildPanel(layout: LayoutParts, panel: Panel, rejected: Rejection[]): FolderNode {
  const folder = panelFolder(panel.name);
  const childNames: string[] = [];

  for (const elementId of panel.elements ?? []) {
    const element = layout.elements[elementId];
    if (!element) continue;
    const child = buildElement(layout, elementId, element, "panel", rejected);
    if (child?.postfix) {
      folder.children.push(child);
      childNames.push(child.name.slice(0, -child.postfix.length));
    }
  }

  // Preserve the order the user built, so pyRevit does not re-sort the panel
  // alphabetically. Only emitted when the orders actually differ.
  const yaml = yamlLine("title", panel.name) + buildLayoutYaml(childNames);
  if (yaml.trim()) folder.children.unshift({ type: "file", name: "bundle.yaml", content: yaml });

  return folder;
}

function buildElement(
  layout: LayoutParts,
  elementId: string,
  element: Element,
  container: ContainerKey,
  rejected: Rejection[],
): FolderNode | null {
  const typeDef = getType(element.type);
  if (!typeDef) return null;

  const reason = rejectionReason(container, element.type);
  if (reason) {
    rejected.push({ element, container, reason });
    return null;
  }

  const folder = buildBundle(element.type, element, elementId);
  if (!folder) return null;

  if (typeDef.container) {
    for (const childId of element.children ?? []) {
      const child = layout.elements[childId];
      if (!child) continue;
      const childFolder = buildElement(layout, childId, child, element.type, rejected);
      if (childFolder) folder.children.push(childFolder);
    }
  }

  return folder;
}

/**
 * Everything that would produce a bundle pyRevit silently ignores, or a
 * folder collision in the ZIP. Returns [] when the extension is sound.
 */
export function validate(layout: LayoutParts): string[] {
  const problems: string[] = [];
  const seenFolders = new Map<string, string>();
  const rejected: Rejection[] = [];
  const stackMin = TYPES.stack.minChildren ?? 2;

  const walk = (node: TreeNode, parentPath: string) => {
    if (node.type !== "folder") return;
    const full = parentPath ? `${parentPath}/${node.name}` : node.name;
    const key = full.toLowerCase();

    const seen = seenFolders.get(key);
    if (seen) {
      problems.push(
        `Two bundles map to the same folder: ${seen} and ${full} ("My Button" and "my button" sanitise identically.)`,
      );
    } else {
      seenFolders.set(key, full);
    }

    if (node.contentFile && node.postfix) {
      problems.push(
        `${full} is a ${node.postfix.replace(".", "")} bundle and needs a ${node.contentFile} family file. Add your own .rfa into that folder after unzipping.`,
      );
    }

    // A stack with fewer than minChildren is skipped by pyRevit
    // (StackBuilder.cs:80), so it is worse than useless: it looks fine in the
    // preview and produces no button at all.
    if (node.postfix === ".stack") {
      const count = node.children.filter((c) => c.type === "folder").length;
      if (count < stackMin) {
        problems.push(
          `${full} is a stack with ${count} command${count === 1 ? "" : "s"}. pyRevit needs at least ${stackMin} or it will not appear at all.`,
        );
      }
    }

    for (const child of node.children) walk(child, full);
  };

  walk(buildFolderStructure(layout, rejected), "");

  for (const r of rejected) problems.push(`Element "${r.element.name}" was skipped: ${r.reason}`);

  // Required bundle.yaml keys. Without them pyRevit logs an error and the
  // command never binds to anything.
  for (const element of Object.values(layout.elements)) {
    const typeDef = getType(element.type);
    if (!typeDef?.required) continue;
    const missing = typeDef.required.filter((key) => !element[key]);
    if (missing.length) {
      problems.push(
        `${typeDef.label} "${element.name}" is missing: ${missing.map((k) => FIELDS[k].label).join(", ")}. Put them in the Advanced section.`,
      );
    }
  }

  for (const tab of Object.values(layout.tabs)) {
    if (!tab.panels?.length) problems.push(`Tab "${tab.name}" has no panels and will not appear.`);
  }

  const raw = layout.extensionName;
  if (!raw.trim()) {
    problems.push("The extension has no name.");
  } else if (sanitizeFileName(raw) === "Untitled") {
    problems.push(`The extension name "${raw}" has no characters usable in a folder name.`);
  }

  return problems;
}

export function formatFolderStructure(node: TreeNode, prefix = "", isLast = true): string {
  let out = `${prefix}${isLast ? "└── " : "├── "}${node.name}\n`;
  if (node.type === "folder") {
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    node.children.forEach((child, i) => {
      out += formatFolderStructure(child, childPrefix, i === node.children.length - 1);
    });
  }
  return out;
}

export function countNodes(node: TreeNode): { folders: number; files: number } {
  if (node.type === "file") return { folders: 0, files: 1 };
  return node.children.reduce(
    (acc, child) => {
      const c = countNodes(child);
      return { folders: acc.folders + c.folders, files: acc.files + c.files };
    },
    { folders: 1, files: 0 },
  );
}
