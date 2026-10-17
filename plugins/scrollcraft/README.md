# ScrollCraft for Claude Code

Build a cinematic scroll-driven website on your own machine. Scrolling scrubs through a
frame sequence painted on a full-screen canvas, while the copy stays pinned above it in
sticky sections. The plugin makes that site from a video, a numbered image sequence or a
generated background, checks it in headless Chrome, and writes a static folder that any
host can serve as it is. It needs no account or API key of its own.

This is the local half of [ScrollCraft](https://scrollcraft.space). The web app writes a
first draft from a description and has a visual editor. The plugin works on disk and in
version control, with or without footage of your own.

## Install

From inside Claude Code:

```
/plugin marketplace add singhharsh1708/scrollcraft
/plugin install scrollcraft@scrollcraft
```

Then describe what you want, such as "build me a scroll site from hero.mp4". Two commands
come with it: `/scrollcraft:scrollcraft-new` starts a site, and
`/scrollcraft:scrollcraft-build` rebuilds, checks and previews the one in the current
directory.

To update, open `/plugin`, select `scrollcraft` on the Installed tab and choose Update now,
or run `claude plugin update scrollcraft@scrollcraft` in your shell.

## Requirements

- Node.js 22 or newer. The scripts are plain Node with nothing to install.
- ffmpeg, to make frames from a video or a generated background (`brew install ffmpeg` or
  `apt install ffmpeg`). An image sequence you already have needs none.
- Chrome, Chromium or Edge, for the check that opens the built page and measures what a
  reader would see. If the check says it found no browser, set `CHROME_PATH` to the
  browser's binary.

## Privacy

The plugin's scripts run on your computer. They call ffmpeg, serve the site on 127.0.0.1
and drive a local headless Chrome. Nothing is sent to ScrollCraft. The pages it builds load
their typefaces from Google Fonts, and an email form you add posts to the provider you
name. The [privacy policy](https://scrollcraft.space/privacy) covers the web app as well.

## Licence

MIT. The [source](https://github.com/singhharsh1708/scrollcraft), the
[licence](https://github.com/singhharsh1708/scrollcraft/blob/main/LICENSE) and the
[issue tracker](https://github.com/singhharsh1708/scrollcraft/issues) are on GitHub.
