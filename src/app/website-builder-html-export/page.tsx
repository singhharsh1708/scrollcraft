import type { Metadata } from "next";
import Link from "next/link";
import GuideArticle, { type Faq } from "@/components/GuideArticle";
import { guideMeta } from "@/lib/guides";
import { TEMPLATES } from "@/lib/templates";
import { GITHUB_REPO_URL } from "@/lib/links";

const PATH = "/website-builder-html-export";

export const metadata: Metadata = guideMeta(PATH);

const FILES: [string, string][] = [
  ["index.html", "The whole site: markup, styles and the scroll script in one file"],
  ["frames/", "The background images, only when the background came from a video"],
  ["frames-mobile/", "A portrait set for phones, if you made one"],
  ["404.html", "A not-found page in the site's own colours"],
  ["favicon.svg", "The browser tab icon, drawn from your site's name and palette"],
  ["apple-touch-icon.png", "The icon when someone saves the site to a phone's home screen"],
  ["og-image.jpg", "The preview card when the link is shared"],
  ["robots.txt", "Lets search engines index the site"],
  ["netlify.toml, vercel.json", "Host settings, already filled in, including caching for the frames"],
  [".nojekyll", "Stops GitHub Pages from hiding files that start with an underscore"],
  ["README.md", "How to put it online and how to edit it, written for a non-developer"],
];

const FAQ: Faq[] = [
  {
    q: "Do I need an account?",
    a: (
      <>
        Not to build or export. Open a template or the builder and start. Signing in with GitHub is
        only used to keep a bought pack of AI-written sites with you across browsers.
      </>
    ),
  },
  {
    q: "Is it really free?",
    a: (
      <>
        The builder, every template and the export are free, and the project is open source under
        the MIT licence. The AI writer is the one paid part: the first two written sites are free,
        then five more cost $20. See <Link href="/pricing">pricing</Link>.
      </>
    ),
  },
  {
    q: "Can I put the site on my own domain?",
    a: "Yes. Netlify, Vercel, GitHub Pages and Cloudflare Pages all let you connect a domain you own without paying them anything. You buy the domain from any registrar and point it at the host.",
  },
  {
    q: "Can I edit the HTML afterwards?",
    a: "Yes, in any text editor. The words are plain text in index.html and the colours are CSS custom properties near the top of the style block. There is no build step to rerun.",
  },
  {
    q: "Can I come back and keep editing in ScrollCraft?",
    a: "Your work stays in your browser between visits. You can also save a project file (name.scrollcraft.json) from the editor and open it later on another machine. A background made from your own video is too large for that file, so the editor warns you to keep the video.",
  },
  {
    q: "Does it work for a shop or a booking system?",
    a: "Not on its own. The export is a static site, so there is no checkout, login or database. Link your button to a shop, booking page, form or email address you already use.",
  },
];

export default function HtmlExportGuide() {
  return (
    <GuideArticle
      path={PATH}
      faq={FAQ}
      lede={
        <p>
          Most website builders keep your site on their servers: stop paying and it goes away, and
          there is no file to take with you. ScrollCraft works the other way round. You build in the
          browser without signing up, then download the site as plain HTML, CSS and JavaScript that
          you can host anywhere, for free, and keep for good.
        </p>
      }
    >
      <h2>What &quot;HTML export&quot; means here</h2>
      <p>
        When you export, you get a ZIP file. Inside is a static website: files a web server hands to
        the browser exactly as they are. There is no framework to install, no build command, no
        database and nothing that phones home to ScrollCraft. If ScrollCraft disappeared tomorrow,
        your site would keep working.
      </p>

      <h2>Build a site and download it, step by step</h2>
      <ol>
        <li>
          <strong>Start from something finished.</strong> Pick one of {TEMPLATES.length}{" "}
          <Link href="/templates">templates</Link>. Each is a complete site with a scroll-animated
          background, sections and a closing call to action, not a blank page.
        </li>
        <li>
          <strong>Or have it written.</strong> On <Link href="/describe">Describe</Link>, write a
          paragraph about your business and the AI writer (Claude, made by Anthropic) drafts every
          section, picks a style and a palette, and opens it in the editor.
        </li>
        <li>
          <strong>Edit it.</strong> Change the text, the colours of each section and the order
          of sections. Swap the background for{" "}
          <Link href="/video-scroll-animation">your own video</Link> if you have one.
        </li>
        <li>
          <strong>Point the button somewhere real.</strong> Templates ship their main button with a
          placeholder link, because only you know whether it should open a booking form, a shop or
          your inbox. A <code>mailto:</code> or <code>tel:</code> link works too.
        </li>
        <li>
          <strong>Export.</strong> Press Export in the editor and the ZIP downloads. Your text and
          settings are sent to the server once to build the HTML and are not stored there.
        </li>
      </ol>

      <h2>What is in the ZIP</h2>
      <div className="not-prose my-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card max-sm:hidden">
            <tr>
              <th scope="col" className="lc-mono px-4 py-3 font-normal text-muted-foreground">File</th>
              <th scope="col" className="lc-mono px-4 py-3 font-normal text-muted-foreground">What it is</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FILES.map(([file, what]) => (
              <tr key={file} className="max-sm:flex max-sm:flex-col max-sm:py-3">
                <td className="lc-mono whitespace-nowrap px-4 py-3 align-top text-primary-ink max-sm:py-0">{file}</td>
                <td className="px-4 py-3 text-muted-foreground max-sm:pb-0 max-sm:pt-1">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Unzip the whole thing before opening anything. Opening <code>index.html</code> straight from
        inside the ZIP copies just that one file somewhere temporary, so it cannot find its frames.
      </p>

      <h2>Where to host it for free</h2>
      <p>A site this size fits comfortably within what any of these host for nothing.</p>
      <h3>Netlify Drop</h3>
      <p>
        The easiest if you have never deployed anything. Make a free Netlify account, open
        app.netlify.com/drop while signed in, and drag the unzipped folder onto the page. You get a
        live address in under a minute. Without an account, Netlify keeps the site private and
        deletes it unless you claim it.
      </p>
      <h3>Vercel</h3>
      <p>
        If you have Node installed, run <code>npx vercel deploy --prod</code> inside the folder. The
        included <code>vercel.json</code> is already set up.
      </p>
      <h3>GitHub Pages</h3>
      <p>
        Create a repository, push the folder to it, then in Settings, Pages, choose to deploy from
        your branch at the root. The <code>.nojekyll</code> file is already there.
      </p>
      <h3>Cloudflare Pages</h3>
      <p>
        Create a project, connect the repository, and leave the build command empty with the output
        directory set to <code>/</code>.
      </p>
      <h3>Any other web host</h3>
      <p>
        Upload the contents of the folder to the web root over FTP or the host&apos;s file manager.
        There is nothing to compile.
      </p>

      <h2>Editing the downloaded HTML</h2>
      <p>
        Open <code>index.html</code> in any text editor. Search for a sentence to change it. The
        site&apos;s colours are CSS custom properties starting with <code>--sc-</code> near the top of
        the <code>&lt;style&gt;</code> block. Replace <code>og-image.jpg</code> with your own 1200 by
        630 image for a custom share card, and <code>favicon.svg</code> for your own icon. To preview
        changes locally, run <code>npx serve .</code> in the folder and open the address it prints.
      </p>

      <h2>When this is not the right tool</h2>
      <p>
        A static export suits a business site, a launch page, a portfolio, an event or a product
        story. It is not a shop, a blog engine or a members area. If you need to take payments or
        let customers log in, link out to a service that does that, or use a hosted platform built
        for it.
      </p>
      <p>
        Everything ScrollCraft runs on, from the editor to the exporter, is{" "}
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          open source on GitHub
        </a>
        , so you can check exactly what goes into your files.
      </p>
    </GuideArticle>
  );
}
