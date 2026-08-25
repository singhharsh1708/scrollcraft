---
description: Start a new ScrollCraft scroll site — scaffolds the spec, generates a background, and builds it
---

Start a new cinematic scroll site in the current directory.

Arguments (all optional): $ARGUMENTS — may contain a site name, and/or a style name from
`aurora`, `nebula`, `tide`, `ember`, `dusk`, `monolith`.

Steps:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/SKILL.md` and follow it.
2. If the user gave no style, run `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/frames-from-style.mjs" --list`
   and pick the one that fits what they described. Say which you picked and why.
3. Scaffold with `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/init.mjs" --name "<name>" --style <style>`.
4. Rewrite the placeholder sections in `scrollcraft.json` as real copy for their subject. One idea
   per section. Do not leave the starter text in place.
5. Vary each section's `layout` so consecutive screens do not share a shape.
6. Rebuild, run `doctor.mjs` and `verify.mjs`, then serve it and tell them the URL and the measured contrast.

If they have their own footage, use `frames-from-video.mjs` instead of the procedural style.
