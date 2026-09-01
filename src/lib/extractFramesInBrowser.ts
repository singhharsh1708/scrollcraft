/**
 * Pull frames out of a video file entirely in the browser.
 *
 * This used to be a server route that downloaded the video and shelled out to ffmpeg.
 * With no accounts there is nobody to attribute a request to, and an open endpoint that
 * fetches up to 500 MB and spawns a process is an obvious way to run up someone else's
 * bill — so the work moved to the machine that already has the file.
 *
 * It also means the video never leaves the device.
 */

export interface BrowserExtractOptions {
  /** How many frames to sample across the clip. */
  frameCount?: number;
  width?: number;
  height?: number;
  /** JPEG quality, 0..1. */
  quality?: number;
  onProgress?: (pct: number) => void;
}

export interface BrowserExtractResult {
  frames: string[];
  frameCount: number;
  /** Seconds actually sampled. Capped at MAX_DURATION_SECONDS. */
  duration: number;
  /**
   * The clip's own length, which is not always what was sampled.
   *
   * The two were reported as one number called `duration`, and the caller read neither,
   * so a clip past the cap was quietly cut and the user was told nothing: they uploaded
   * five minutes of footage and got the first two with no explanation.
   */
  sourceDuration: number;
}

/** Longest clip worth sampling. Past this the frames are far apart and the result is a slideshow. */
const MAX_DURATION_SECONDS = 120;
const MAX_FILE_BYTES = 500 * 1024 * 1024;

export class VideoExtractError extends Error {}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    // Required for the frames to be readable: without it the canvas is tainted.
    video.crossOrigin = "anonymous";
    video.playsInline = true;

    const fail = (message: string) => {
      URL.revokeObjectURL(url);
      reject(new VideoExtractError(message));
    };

    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        fail("That file does not look like a video this browser can read.");
        return;
      }
      resolve(video);
    };
    video.onerror = () =>
      fail("That video could not be decoded here. Try an MP4 (H.264), which every browser reads.");
    video.src = url;
  });
}

/** Seek and wait for the frame at that timestamp to be painted. */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new VideoExtractError("Timed out reading the video.")), 10_000);
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = Math.min(time, Math.max(video.duration - 0.05, 0));
  });
}

export async function extractFramesInBrowser(
  file: File,
  opts: BrowserExtractOptions = {}
): Promise<BrowserExtractResult> {
  if (!file.type.startsWith("video/")) {
    throw new VideoExtractError("That is not a video file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new VideoExtractError("That video is larger than 500 MB. Try a shorter clip.");
  }

  const frameCount = Math.min(Math.max(opts.frameCount ?? 120, 2), 240);
  const quality = Math.min(Math.max(opts.quality ?? 0.8, 0.1), 1);

  const video = await loadVideo(file);
  const objectUrl = video.src;

  try {
    const duration = Math.min(video.duration, MAX_DURATION_SECONDS);

    // Match the source's aspect ratio rather than forcing one, and cap the long edge so
    // a 4K clip does not produce frames far larger than any viewport needs.
    const srcW = video.videoWidth || 1280;
    const srcH = video.videoHeight || 720;
    const maxEdge = opts.width ?? 1280;
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const w = opts.width && opts.height ? opts.width : Math.round(srcW * scale);
    const h = opts.width && opts.height ? opts.height : Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new VideoExtractError("This browser cannot draw to a canvas.");

    const frames: string[] = [];
    for (let i = 0; i < frameCount; i++) {
      const t = (i / Math.max(frameCount - 1, 1)) * duration;
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, w, h);
      frames.push(canvas.toDataURL("image/jpeg", quality));
      opts.onProgress?.(Math.round(((i + 1) / frameCount) * 100));
      // Yield so the progress bar can paint between frames.
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    return { frames, frameCount: frames.length, duration, sourceDuration: video.duration };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
