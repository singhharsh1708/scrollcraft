import type { Metadata } from "next";
import Link from "next/link";
import GuideArticle, { CodeBlock, type Faq } from "@/components/GuideArticle";
import { guideMeta } from "@/lib/guides";

const PATH = "/video-scroll-animation";

export const metadata: Metadata = guideMeta(PATH);

const NAIVE = `const video = document.querySelector("video");
addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  video.currentTime = (scrollY / max) * video.duration;
});`;

const FAQ: Faq[] = [
  {
    q: "Is my video uploaded to a server?",
    a: "No. The frames are taken out by your own browser, on your own device, and stored in its local storage (IndexedDB). The video file is never sent to ScrollCraft or anyone else.",
  },
  {
    q: "What video formats work?",
    a: "Anything your browser can play: MP4, MOV and WebM in practice. If a file will not decode, convert it to MP4 with H.264, which every browser reads.",
  },
  {
    q: "Is there a length or size limit?",
    a: "Files up to 500 MB. Only the first two minutes are sampled, because past that the frames are too far apart to scrub smoothly. If your clip is longer, the builder tells you how much it used.",
  },
  {
    q: "Will it work on phones?",
    a: "Yes. Turn on portrait frames before you upload and a second, 720 by 1280 set is cut from the middle of your footage for screens under 768 pixels wide. Without it, phones use the landscape frames, cropped to fill the screen.",
  },
  {
    q: "Can I use footage I found online?",
    a: "Only if you have the right to. Stock sites that license clips for commercial use are fine; a clip from someone else's channel is not.",
  },
];

export default function VideoScrollGuide() {
  return (
    <GuideArticle
      path={PATH}
      faq={FAQ}
      lede={
        <p>
          You have a clip: a product turning on a table, a drone pass over a site, a kitchen at full
          tilt. You want it to play as the visitor scrolls, forwards on the way down and backwards on
          the way up. This guide explains why the obvious way to do that stutters, what works
          instead, and how to turn your footage into a finished scroll website in the browser.
        </p>
      }
    >
      <h2>Why you cannot just scrub a video element</h2>
      <p>The first thing most people try is setting the video&apos;s time from the scroll position:</p>
      <CodeBlock label="Code example: the naive version">{NAIVE}</CodeBlock>
      <p>
        It works on a short, specially encoded clip on a fast laptop, and stutters almost everywhere
        else. Web video is compressed so most frames are stored as differences from an earlier full
        frame (a keyframe). To show an arbitrary moment, the browser has to find the keyframe before
        it and decode forward. Scrolling asks for a new moment dozens of times a second, so the
        browser is always seeking, and the picture lags or jumps. Re-encoding with a keyframe on
        every frame helps but makes the file several times larger, and mobile browsers still treat
        video seeking differently from desktop ones.
      </p>

      <h2>What works: turn the video into frames</h2>
      <p>
        The reliable approach is the one behind Apple-style product pages. Take still images out of
        the video at even intervals, load them all, and draw the right one to a canvas as the visitor
        scrolls. Picking an image that is already in memory takes no seeking and no decoding, so the
        page keeps up however fast someone scrolls. The full technique, with a code sketch, is in{" "}
        <Link href="/scroll-animation">how to make an Apple-style scroll animation</Link>.
      </p>
      <p>
        Doing that by hand usually means running ffmpeg, picking a frame rate, resizing, naming files
        and writing the scroll code. ScrollCraft does it in the browser instead.
      </p>

      <h2>Turn a video into a scroll website with ScrollCraft</h2>
      <ol>
        <li>
          <strong>Open the builder.</strong> Go to <Link href="/create">the builder</Link>, choose
          any style on the first screen (your video will replace it) and press Next.
        </li>
        <li>
          <strong>Set the frame count.</strong> The slider runs from 60 to 200 and starts at 120.
          More frames scrub more smoothly and make a heavier site.
        </li>
        <li>
          <strong>Decide about phones.</strong> Turn on portrait frames if many visitors will be on
          phones. A second set at 720 by 1280 is cut from the centre of your footage.
        </li>
        <li>
          <strong>Drop in your video.</strong> Drag the file onto the upload box or click to choose
          it. Frames are sampled evenly across the clip, scaled so the long edge is at most 1280
          pixels, and saved as JPEGs in your browser. A progress bar shows how far it has got.
        </li>
        <li>
          <strong>Write the page.</strong> The editor opens with your footage as the background. Add
          sections, headings, text and a button, and scroll the preview to see the words move over
          the video.
        </li>
        <li>
          <strong>Export.</strong> The ZIP has <code>index.html</code> and a <code>frames</code>{" "}
          folder (plus <code>frames-mobile</code> if you made a portrait set), ready to drag onto
          Netlify or push to GitHub Pages. The{" "}
          <Link href="/website-builder-html-export">HTML export guide</Link> walks through hosting.
        </li>
      </ol>
      <p>
        If you would rather not write the words, <Link href="/describe">describe your business</Link>{" "}
        and the AI writer drafts the whole site, then swap in your own video in the editor.
      </p>

      <h2>Footage that scrolls well</h2>
      <p>Not every clip makes a good scroll background. What tends to work:</p>
      <ul>
        <li>
          <strong>One slow, continuous move.</strong> An orbit around a product, a push in through a
          doorway, a slow pan across a landscape. Scrolling stretches and compresses time, so smooth
          motion stays smooth and jerky motion gets worse.
        </li>
        <li>
          <strong>No cuts.</strong> A hard cut becomes a single-frame jump in the middle of a scroll.
          If you need two shots, a dissolve between them scrubs better.
        </li>
        <li>
          <strong>Short clips.</strong> With 120 frames, a 10 second clip gives 12 frames per second
          of footage; a 60 second clip gives 2, and the motion between frames starts to show. Ten to
          thirty seconds is a good range.
        </li>
        <li>
          <strong>A steady camera.</strong> Handheld shake turns into flicker when the visitor
          scrolls slowly. Use a stabilised shot, a gimbal or a tripod.
        </li>
        <li>
          <strong>Room for text.</strong> Your headings sit on top of the footage. Darker or less busy
          areas of the frame keep them readable.
        </li>
        <li>
          <strong>Subject in the centre.</strong> Phones crop the sides of landscape footage, so keep
          what matters near the middle.
        </li>
      </ul>

      <h2>Keeping the site light</h2>
      <p>
        Every frame is a JPEG the visitor downloads, so frame count, frame size and content all
        matter. Busy, detailed footage compresses worse than smooth gradients. If the exported{" "}
        <code>frames</code> folder feels heavy, go back and pick a lower frame count before you trim
        anything else. The exported page loads every fifth frame first so the whole scroll is
        roughly covered early, then fills in the rest. The <code>netlify.toml</code> and{" "}
        <code>vercel.json</code> in the ZIP tell those hosts to cache the frames for a year, so
        returning visitors do not download them twice.
      </p>
    </GuideArticle>
  );
}
