import { readFileSync } from "node:fs";
import { layoutFromSpec } from "../api/spec";
import { droppedIconsNotice, migrate, snapshot } from "./layoutFile";
import { initialLayout } from "./model";
import { iconRefusal, imageKind, isPngBytes, isPngDataUrl, pngDataUrl } from "./png";
import type { FileNode, TreeNode } from "./templates";
import { buildFolderStructure } from "./tree";
import { resolveIconData } from "./zip";

const png = new Uint8Array(readFileSync("public/icon.png"));
const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46);
const JPEG_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
// A PNG MIME type around JPEG bytes: what a renamed file gives.
const LYING_URL = "data:image/png;base64,/9j/4AAQSkZJRg==";

describe("PNG icons only", () => {
  it("tells a PNG by its bytes, and what anything else is", () => {
    expect(isPngBytes(png)).toBe(true);
    expect(imageKind(png)).toBe("PNG");
    expect(imageKind(JPEG)).toBe("JPEG");
    expect(imageKind(text("GIF89a"))).toBe("GIF");
    expect(imageKind(text("BM6...."))).toBe("BMP");
    expect(imageKind(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("WebP");
    expect(
      imageKind(text('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBe("SVG");
    expect(imageKind(text("hello"))).toBeNull();
  });

  it("makes a data URL the PNG check accepts, and refuses one that only claims to be PNG", () => {
    const url = pngDataUrl(png);
    expect(url.startsWith("data:image/png;base64,iVBORw0KGgo")).toBe(true);
    expect(isPngDataUrl(url)).toBe(true);
    expect(isPngDataUrl(JPEG_URL)).toBe(false);
    expect(isPngDataUrl(LYING_URL)).toBe(false);
    expect(isPngDataUrl(null)).toBe(false);
  });

  it("says why a picked file is refused", () => {
    expect(iconRefusal("icon.png", png)).toBeNull();
    expect(iconRefusal("logo.jpg", JPEG)).toBe(
      '"logo.jpg" is a JPEG image. pyRevit icons are PNG files (ideally 96 × 96 pixels): save it as PNG and pick it again.',
    );
    expect(iconRefusal("logo.png", JPEG)).toMatch(/^"logo\.png" is a JPEG image/);
    expect(iconRefusal("notes.txt", text("hello"))).toMatch(/is not a PNG image/);
    expect(iconRefusal("logo.svg", text("<svg/>"))).toMatch(/^"logo\.svg" is an SVG image/);
  });

  it("resets icons that aren't PNG when a layout loads, and names them", () => {
    const layout = initialLayout();
    const button = layout.elements.element1;
    if (!button) throw new Error("no button");
    button.iconData = JPEG_URL;
    button.iconDarkData = pngDataUrl(png);
    button.iconOnData = LYING_URL;
    const dropped: string[] = [];
    const loaded = migrate(JSON.parse(JSON.stringify(snapshot(layout))), dropped);
    expect(loaded.elements.element1).toMatchObject({ iconData: null, iconOnData: null });
    expect(loaded.elements.element1?.iconDarkData).toBe(pngDataUrl(png));
    expect(dropped).toEqual(['"Button 1": icon', '"Button 1": on icon']);
    expect(droppedIconsNotice(dropped)?.message).toMatch(
      /^2 icons weren't PNG and are back to the default/,
    );
    expect(droppedIconsNotice([])).toBeNull();

    // An empty icon is no icon: reset quietly, not reported as refused.
    const empty = initialLayout();
    const first = empty.elements.element1;
    if (!first) throw new Error("no button");
    first.iconData = "";
    const none: string[] = [];
    expect(
      migrate(JSON.parse(JSON.stringify(snapshot(empty))), none).elements.element1?.iconData,
    ).toBeNull();
    expect(none).toEqual([]);
  });

  it("refuses a spec icon that isn't PNG, even under a PNG data URL", () => {
    const spec = (icon: string) => ({
      name: "X",
      tabs: [
        { name: "T", panels: [{ name: "P", items: [{ type: "pushbutton", name: "B", icon }] }] },
      ],
    });
    expect(layoutFromSpec(spec(JPEG_URL)).errors[0]?.message).toMatch(
      /JPEG, GIF, BMP, WebP and SVG are refused/,
    );
    expect(layoutFromSpec(spec(LYING_URL)).errors[0]?.message).toMatch(/is not a PNG image/);
    // Starts like a PNG, but isn't valid base64.
    expect(layoutFromSpec(spec("data:image/png;base64,iVBORw0KGgo!!!")).errors[0]?.message).toMatch(
      /invalid base64 characters or padding/,
    );
    expect(layoutFromSpec(spec(pngDataUrl(png))).errors).toEqual([]);
  });

  it("never writes anything but a PNG into icon.png", () => {
    const layout = initialLayout();
    const button = layout.elements.element1;
    if (!button) throw new Error("no button");
    button.iconData = JPEG_URL;
    const defaults = { light: "data:image/png;base64,iVBORw0KGgoDEFAULT", dark: "" };
    const find = (node: TreeNode): FileNode | null => {
      if (node.type === "file") {
        return node.elementId === "element1" && node.iconKey === "icon.png" ? node : null;
      }
      for (const child of node.children) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    const icon = find(buildFolderStructure(layout));
    if (!icon) throw new Error("no icon.png");
    expect(resolveIconData(icon, layout, defaults)).toBe(defaults.light);
    button.iconData = pngDataUrl(png);
    expect(resolveIconData(icon, layout, defaults)).toBe(button.iconData);
  });
});
