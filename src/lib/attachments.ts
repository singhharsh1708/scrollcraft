import { MAX_DOCUMENT_CHARS, MAX_DOCUMENT_PDF_BYTES } from "@/lib/briefLimits";

/** Long edge photographs are reduced to on the device before sending. */
export const LONG_EDGE = 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export type PickedImage = { name: string; size: number; media_type: string; data: string; preview: string };
export type PickedDocument = { name: string; size: number; media_type: "application/pdf" | "text/plain"; data: string };

export async function downscale(file: File): Promise<PickedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  const data = url.split(",")[1] ?? "";
  return { name: file.name, size: Math.round(data.length * 0.75), media_type: "image/jpeg", data, preview: url };
}

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
export const DOCUMENT_ACCEPT = "application/pdf,text/plain,text/markdown,.pdf,.txt,.md";

export function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
  return /^video\/(mp4|quicktime|webm)$/.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Reads a PDF as base64 or a .txt/.md file as text, or says plainly why it cannot. */
export async function readDocument(file: File): Promise<PickedDocument | { error: string }> {
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const text = /^text\/(plain|markdown)$/.test(file.type) || /\.(txt|md)$/i.test(file.name);
  if (!pdf && !text) return { error: `${file.name} is not a PDF, .txt or .md file.` };
  if (pdf) {
    if (file.size > MAX_DOCUMENT_PDF_BYTES) {
      return { error: `${file.name} is ${formatBytes(file.size)}. PDFs must be under ${formatBytes(MAX_DOCUMENT_PDF_BYTES)}.` };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { name: file.name, size: file.size, media_type: "application/pdf", data: btoa(binary) };
  }
  const body = (await file.text()).trim();
  if (!body) return { error: `${file.name} is empty.` };
  if (body.length > MAX_DOCUMENT_CHARS) {
    return { error: `${file.name} is too long. Text files must be under ${MAX_DOCUMENT_CHARS.toLocaleString("en")} characters.` };
  }
  return { name: file.name, size: file.size, media_type: "text/plain", data: body };
}
