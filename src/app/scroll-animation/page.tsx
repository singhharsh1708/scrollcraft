import type { Metadata } from "next";
import Link from "next/link";
import GuideArticle, { type Faq } from "@/components/GuideArticle";
import { guideMeta } from "@/lib/guides";
import { TEMPLATES } from "@/lib/templates";
import ScrollDemo from "./ScrollDemo";

const PATH = "/scroll-animation";

export const metadata: Metadata = guideMeta(PATH);

const SKETCH = `<canvas id="seq"></canvas>
<div style="height: 400vh"></div>

<script>
  const canvas = document.getElementById("seq");
  const ctx = canvas.getContext("2d");
  const count = 120;
  const frames = [];

  for (let i = 0; i < count; i++) {
    const img = new Image();
    img.src = \`frames/frame_\${String(i).padStart(4, "0")}.jpg\`;
    frames.push(img);
  }

  function draw(index) {
    const img = frames[index];
    if (!img.complete || !img.naturalWidth) return;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = Math.min(Math.max(scrollY / max, 0), 1);
      draw(Math.round(p * (count - 1)));
      ticking = false;
    });
  }, { passive: true });

  frames[0].onload = () => draw(0);
</script>`;

const CSS = `#seq { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; }`;

const FAQ: Faq[] = [
  {
    q: "Is this the same effect Apple uses?",
    a: "The technique is the same one people have taken apart on Apple's AirPods and iPhone pages: a numbered set of still images drawn to a canvas, with the scroll position choosing which image is shown. Apple's own code and assets are theirs; the idea is common knowledge.",
  },
  {
    q: "Do I need GSAP or another library?",
    a: "No. GSAP's ScrollTrigger is convenient if you already use it, but the core is a scroll listener, a little arithmetic and drawImage. The sketch on this page has no dependencies, and neither do the pages ScrollCraft exports.",
  },
  {
    q: "How many frames should I use?",
    a: "Somewhere between 60 and 200. More frames scrub more smoothly and cost more to download. ScrollCraft's builder offers 60 to 200 and starts at 120, which is smooth on a typical page length.",
  },
  {
    q: "Can I do it with CSS only?",
    a: "Not with an image sequence. CSS scroll-driven animations (animation-timeline: scroll()) can move, fade and scale elements as you scroll, but they cannot pick a frame from a set of images. That part needs a few lines of JavaScript.",
  },
  {
    q: "Is it free to make one with ScrollCraft?",
    a: (
      <>
        Yes. The builder, the <Link href="/templates">templates</Link> and the export are free and
        need no account. Only the AI writer on <Link href="/describe">Describe</Link> is paid after
        the first two sites.
      </>
    ),
  },
];

export default function ScrollAnimationGuide() {
  return (
    <GuideArticle
      path={PATH}
      faq={FAQ}
      lede={
        <p>
          On Apple&apos;s product pages, the phone or the headphones turn and come apart as you
          scroll, and run backwards when you scroll up. It looks like video, but it is a stack of
          still images. Here is how it works, a demo you can scroll, the code to build one, and how
          to make one without writing any.
        </p>
      }
      demo={
        <figure>
          <ScrollDemo />
          <figcaption className="mt-3 text-center text-sm text-muted-foreground">
            Keep scrolling. The scroll position chooses one of 120 frames, so scrolling up plays it
            backwards.
          </figcaption>
        </figure>
      }
    >
      <h2>What an Apple-style scroll animation is</h2>
      <p>
        The effect has a few names: scroll-scrubbed animation, image sequence animation,
        scrollytelling. They all describe the same thing. A short animation is exported as a
        numbered sequence of images, say <code>frame_0000.jpg</code> to <code>frame_0119.jpg</code>.
        The page pins a full-screen canvas behind the content. As the visitor scrolls, the page works
        out how far down they are, as a number from 0 to 1, and draws the matching frame.
      </p>
      <p>
        Nothing plays on a timer. If the visitor stops, the picture stops. If they scroll back up, it
        reverses. That direct control is why it feels more like handling an object than watching a
        clip, and it is why product pages use it to show something from every side.
      </p>

      <h2>How it works, step by step</h2>
      <ol>
        <li>
          <strong>Make the frames.</strong> Render an animation from 3D software, or take frames out
          of a video. 120 frames at 1280 pixels on the long edge is a reasonable starting point.
        </li>
        <li>
          <strong>Preload them.</strong> Every frame has to be in memory before it is needed, or the
          canvas shows a gap while the image downloads. A good approach loads every fifth frame
          first so the whole range is roughly covered, then fills in the rest.
        </li>
        <li>
          <strong>Map scroll to a frame.</strong> Progress is <code>scrollY</code> divided by the
          scrollable distance (page height minus window height). Multiply by the frame count minus
          one and round.
        </li>
        <li>
          <strong>Draw on the next animation frame.</strong> Scroll events fire faster than the
          screen repaints. Wrap the draw in <code>requestAnimationFrame</code> so it runs at most
          once per repaint.
        </li>
        <li>
          <strong>Cover the screen.</strong> Scale each image so it fills the canvas and crop the
          overflow, the same way <code>object-fit: cover</code> does for an image.
        </li>
      </ol>

      <h2>How to make a scroll animation website without code</h2>
      <p>
        ScrollCraft is a free, open-source builder that does every step above for you and hands you
        the finished site as plain files.
      </p>
      <ol>
        <li>
          <strong>Pick a starting point.</strong> Choose one of {TEMPLATES.length}{" "}
          <Link href="/templates">templates</Link>, each a finished site with its own scroll
          background, or <Link href="/describe">describe your business</Link> in a paragraph and the
          AI writer drafts the whole site for you.
        </li>
        <li>
          <strong>Choose the background.</strong> Keep the template&apos;s drawn background (Gradient
          Flow, Geometric, Particles or Wave, in your colours) or{" "}
          <Link href="/video-scroll-animation">upload your own video</Link> and its frames are taken
          out in your browser.
        </li>
        <li>
          <strong>Edit the words.</strong> Change headings, text and buttons in the editor and watch
          the preview scroll.
        </li>
        <li>
          <strong>Export.</strong> Download a ZIP with <code>index.html</code>, your frames if you
          used a video, and a README that explains how to put it online for free. No account is
          needed for any of this.
        </li>
      </ol>
      <p>
        A drawn background ships no images at all. The exported page carries the drawing code and
        redraws each frame at the visitor&apos;s screen size, so the page itself comes to about 30
        KB. See <Link href="/website-builder-html-export">what the export contains</Link> for the
        full list of files.
      </p>

      <h2>How to build an image sequence scroll animation in HTML and JavaScript</h2>
      <p>
        If you would rather write it yourself, this is the whole idea in about forty lines. Put your
        frames in a <code>frames</code> folder beside the page.
      </p>
      <pre>
        <code>{SKETCH}</code>
      </pre>
      <p>And one line of CSS to pin the canvas behind everything else:</p>
      <pre>
        <code>{CSS}</code>
      </pre>
      <p>
        That is enough to see the effect. A production version needs more: it should size the canvas
        for the device pixel ratio (capped at 2, or a phone ends up drawing millions of pixels each
        frame), only resize the canvas when the window changes rather than on every draw, preload in
        a sensible order, and show something useful if the frames fail to load. The exported
        ScrollCraft page does all of that, and since it is plain JavaScript you can open it and read
        how.
      </p>

      <h2>Performance on mobile</h2>
      <ul>
        <li>
          <strong>Weight.</strong> 120 JPEGs at 1280 pixels can easily add up to several megabytes.
          Lower the frame count or the JPEG quality before anything else.
        </li>
        <li>
          <strong>Portrait screens.</strong> A landscape frame on a tall phone is mostly cropped
          away. A separate portrait set, cut for phones, looks better. ScrollCraft can make one from
          an uploaded video and serves it below 768 pixels wide.
        </li>
        <li>
          <strong>Decode off the scroll path.</strong> Call <code>img.decode()</code> after each frame
          loads so the browser does not stall decoding a JPEG in the middle of a scroll.
        </li>
        <li>
          <strong>Keep text readable.</strong> Moving pictures behind words make the words harder to
          read. A dark overlay or a panel behind the text fixes that.
        </li>
      </ul>

      <h2>Reduced motion and accessibility</h2>
      <p>
        Some people set their system to reduce motion because animation makes them unwell. A
        scrubbed background only moves when the visitor scrolls, which is gentler than autoplay, but
        any extra entrance animations should switch off under{" "}
        <code>prefers-reduced-motion: reduce</code>. ScrollCraft&apos;s exported pages turn their text
        reveal animations off for those visitors. Mark the canvas <code>aria-hidden</code> if it is
        decoration, and keep every piece of real information in the text, not in the frames.
      </p>
      <p>
        The demo at the top of this page follows the same rule: with reduced motion on, it stops
        following the scroll and gives you a slider instead.
      </p>
    </GuideArticle>
  );
}
