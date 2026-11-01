import JSZip from "jszip";
import type { Layout } from "./model";
import type { FileNode, FolderNode } from "./templates";
import { buildFolderStructure } from "./tree";

// 1x1 transparent PNG, used when nothing at all is available.
const PLACEHOLDER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface DefaultIcons {
  light: string | null;
  dark: string | null;
}

/**
 * Data URL for an icon file, or null to fall back to the default.
 * An element with no upload must still get the bundled icon, not a blank
 * pixel, so every level falls through rather than returning early.
 */
export function resolveIconData(
  node: FileNode,
  layout: Pick<Layout, "elements">,
  defaults: DefaultIcons,
): string | null {
  const element = node.elementId ? layout.elements[node.elementId] : undefined;
  const key = node.iconKey ?? "";
  const isDark = key.includes(".dark.");

  if (element) {
    if (isDark) {
      if (element.iconDarkData) return element.iconDarkData;
    } else if (key === "on.png") {
      if (element.iconOnData) return element.iconOnData;
    } else if (element.iconData) {
      return element.iconData;
    }
  }

  // A dark variant falls back to the light one, which is what pyRevit would do anyway.
  if (isDark) return defaults.dark || defaults.light;
  return defaults.light;
}

function addFolder(
  zip: JSZip,
  folder: FolderNode,
  path: string,
  resolve: (f: FileNode) => string | null,
) {
  const folderPath = path ? `${path}/${folder.name}` : folder.name;
  zip.folder(folderPath);
  for (const child of folder.children) {
    if (child.type === "folder") {
      addFolder(zip, child, folderPath, resolve);
    } else if (child.binary) {
      const data = resolve(child);
      zip.file(`${folderPath}/${child.name}`, data?.split(",")[1] ?? PLACEHOLDER_PNG, {
        base64: true,
      });
    } else {
      zip.file(`${folderPath}/${child.name}`, child.content ?? "");
    }
  }
}

export async function buildZip(
  layout: Layout,
  defaults: DefaultIcons,
): Promise<{ blob: Blob; name: string }> {
  const structure = buildFolderStructure(layout);
  const zip = new JSZip();
  addFolder(zip, structure, "", (f) => resolveIconData(f, layout, defaults));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, name: `${structure.name}.zip` };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function readFileAsDataUrl(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await readFileAsDataUrl(await response.blob());
  } catch {
    return null;
  }
}
