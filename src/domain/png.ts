// Icons are PNG, and only PNG: pyRevit loads icon.png, and the builder writes
// every icon under that name, so a JPEG, GIF, BMP or SVG would be a broken
// icon.png in Revit. A PNG is told by its bytes, not its file name or MIME
// type, which can lie.

/** The 8-byte PNG signature. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * A PNG as a data URL. Every PNG starts with its signature, then its IHDR
 * chunk, whose length's first byte is 0: in base64 that is always
 * "iVBORw0KGgo". So this one pattern tells a real PNG, and the JSON Schema
 * can say the same.
 */
export const PNG_DATA_URL = /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/;

export function isPngBytes(bytes: Uint8Array): boolean {
  return SIGNATURE.every((byte, i) => bytes[i] === byte);
}

export function isPngDataUrl(value: unknown): value is string {
  return typeof value === "string" && PNG_DATA_URL.test(value);
}

/** What an image file really is, by its first bytes, to say so when it isn't a PNG. */
export function imageKind(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (isPngBytes(bytes)) return "PNG";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG";
  if (ascii(0, 4) === "GIF8") return "GIF";
  if (ascii(0, 2) === "BM") return "BMP";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "WebP";
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "ICO";
  const text = ascii(0, 256).trimStart().toLowerCase();
  if (text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"))) return "SVG";
  return null;
}

/** The data URL of PNG bytes. */
export function pngDataUrl(bytes: Uint8Array): string {
  let binary = "";
  // In chunks: String.fromCharCode takes a bounded number of arguments.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/** Why a picked file can't be an icon, or null when it is a PNG. */
export function iconRefusal(fileName: string, bytes: Uint8Array): string | null {
  if (isPngBytes(bytes)) return null;
  const kind = imageKind(bytes);
  return `"${fileName}" ${kind ? `is a ${kind} image` : "is not a PNG image"}. pyRevit icons are PNG files (ideally 96 × 96 pixels): save it as PNG and pick it again.`;
}
