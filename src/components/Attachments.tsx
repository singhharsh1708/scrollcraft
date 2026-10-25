"use client";
import { useRef, useState } from "react";
import { FileText, Film, ImagePlus, X } from "lucide-react";
import { MAX_IMAGES } from "@/lib/briefLimits";
import {
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  MAX_VIDEO_BYTES,
  VIDEO_ACCEPT,
  downscale,
  formatBytes,
  isImageFile,
  isVideoFile,
  readDocument,
  type PickedDocument,
  type PickedImage,
} from "@/lib/attachments";

export type AttachmentState = ReturnType<typeof useAttachments>;

export function useAttachments({ allowVideo = true }: { allowVideo?: boolean } = {}) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [doc, setDoc] = useState<PickedDocument | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [error, setError] = useState("");

  const addImages = async (files: File[]) => {
    const errors: string[] = [];
    const room = MAX_IMAGES - images.length;
    const ok = files.filter((f) => {
      if (isImageFile(f)) return true;
      errors.push(`${f.name} is not a JPG, PNG or WebP photo.`);
      return false;
    });
    if (ok.length > room) errors.push(`Up to ${MAX_IMAGES} photos. Kept the first ${Math.max(room, 0)}.`);
    const picked: PickedImage[] = [];
    for (const file of ok.slice(0, Math.max(room, 0))) {
      try {
        picked.push(await downscale(file));
      } catch {
        errors.push(`${file.name} could not be read as an image.`);
      }
    }
    setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES));
    return errors;
  };

  const addVideo = (file: File) => {
    if (!isVideoFile(file)) return [`${file.name} is not an MP4, MOV or WebM video.`];
    if (file.size > MAX_VIDEO_BYTES) return [`${file.name} is ${formatBytes(file.size)}. Videos must be under 500 MB.`];
    setVideo(file);
    return [];
  };

  const addDocument = async (file: File) => {
    const read = await readDocument(file);
    if ("error" in read) return [read.error];
    setDoc(read);
    return [];
  };

  const run = async (work: Promise<string[]> | string[]) => {
    setError("");
    const errors = await work;
    setError(errors.join(" "));
  };

  return {
    images,
    doc,
    video: allowVideo ? video : null,
    allowVideo,
    error,
    pickImages: (files: FileList | null) => run(addImages(Array.from(files ?? []))),
    pickVideo: (files: FileList | null) => files?.[0] && run(addVideo(files[0])),
    pickDocument: (files: FileList | null) => files?.[0] && run(addDocument(files[0])),
    addAny: (files: FileList) =>
      run(
        (async () => {
          const list = Array.from(files);
          const errors = await addImages(list.filter(isImageFile));
          const vid = list.find(isVideoFile);
          if (vid && allowVideo) errors.push(...addVideo(vid));
          const rest = list.filter((f) => !isImageFile(f) && !isVideoFile(f));
          if (rest[0]) errors.push(...(await addDocument(rest[0])));
          return errors;
        })()
      ),
    removeImage: (i: number) => setImages((c) => c.filter((_, j) => j !== i)),
    removeDocument: () => setDoc(null),
    removeVideo: () => setVideo(null),
  };
}

const toolClass =
  "lc-mono inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 text-xs text-foreground transition-colors hover:border-primary-ink/50 hover:bg-primary-ink/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 max-sm:flex-col max-sm:gap-1 max-sm:rounded-2xl max-sm:py-2 sm:min-h-9";

/** Labelled Photos, Video and Document buttons; the inputs behind them are not in the tab order. */
export default function AttachmentBar({ state, disabled }: { state: AttachmentState; disabled?: boolean }) {
  const photos = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const hidden = { "aria-hidden": true, tabIndex: -1, className: "sr-only" } as const;
  return (
    <div role="group" aria-label="Attach" className={`grid gap-2 sm:flex sm:flex-wrap ${state.allowVideo ? "grid-cols-3" : "grid-cols-2"}`}>
      <input ref={photos} type="file" accept={IMAGE_ACCEPT} multiple {...hidden} onChange={(e) => { void state.pickImages(e.target.files); e.target.value = ""; }} />
      <button type="button" disabled={disabled || state.images.length >= MAX_IMAGES} onClick={() => photos.current?.click()} className={toolClass}>
        <ImagePlus className="h-4 w-4 text-primary-ink" aria-hidden="true" />
        Photos
      </button>
      {state.allowVideo && (
        <>
          <input ref={video} type="file" accept={VIDEO_ACCEPT} {...hidden} onChange={(e) => { void state.pickVideo(e.target.files); e.target.value = ""; }} />
          <button type="button" disabled={disabled} onClick={() => video.current?.click()} className={toolClass}>
            <Film className="h-4 w-4 text-primary-ink" aria-hidden="true" />
            Video
          </button>
        </>
      )}
      <input ref={docRef} type="file" accept={DOCUMENT_ACCEPT} {...hidden} onChange={(e) => { void state.pickDocument(e.target.files); e.target.value = ""; }} />
      <button type="button" disabled={disabled} onClick={() => docRef.current?.click()} className={toolClass}>
        <FileText className="h-4 w-4 text-primary-ink" aria-hidden="true" />
        Document
      </button>
    </div>
  );
}

function Chip({ label, detail, onRemove, disabled, children }: { label: string; detail: string; onRemove: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-white/10 bg-background/60 py-1 pl-1 pr-1 text-xs">
      {children}
      <span className="min-w-0">
        <span className="block max-w-[11rem] truncate text-foreground">{label}</span>
        <span className="lc-mono block text-muted-foreground">{detail}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring sm:h-8 sm:w-8"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

const tile = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-ink/10 text-primary-ink";

/** What is attached, each removable, and any error about what was not. */
export function AttachmentChips({ state, disabled }: { state: AttachmentState; disabled?: boolean }) {
  const any = state.images.length > 0 || state.doc || state.video;
  return (
    <>
      {any && (
        <ul aria-label="Attached" className="flex flex-wrap gap-2 px-2 pb-3">
          {state.images.map((image, i) => (
            <Chip key={image.name + i} label={image.name} detail={`Photo · ${formatBytes(image.size)}`} onRemove={() => state.removeImage(i)} disabled={disabled}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the visitor just picked */}
              <img src={image.preview} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            </Chip>
          ))}
          {state.video && (
            <Chip label={state.video.name} detail={`Video background · ${formatBytes(state.video.size)}`} onRemove={state.removeVideo} disabled={disabled}>
              <span className={tile}><Film className="h-4 w-4" aria-hidden="true" /></span>
            </Chip>
          )}
          {state.doc && (
            <Chip
              label={state.doc.name}
              detail={`${state.doc.media_type === "application/pdf" ? "PDF" : "Text"} · ${formatBytes(state.doc.size)}`}
              onRemove={state.removeDocument}
              disabled={disabled}
            >
              <span className={tile}><FileText className="h-4 w-4" aria-hidden="true" /></span>
            </Chip>
          )}
        </ul>
      )}
      {state.error && (
        <p role="alert" className="mx-2 mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          {state.error}
        </p>
      )}
    </>
  );
}
