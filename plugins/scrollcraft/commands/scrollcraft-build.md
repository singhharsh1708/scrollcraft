---
description: Rebuild the ScrollCraft site in this directory, check it, and preview it
---

Rebuild and verify the scroll site in the current directory.

1. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/build-site.mjs" --spec scrollcraft.json --out dist`
2. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/doctor.mjs" --spec scrollcraft.json`
3. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/verify.mjs" --dir dist --shots shots`
4. If either exits non-zero, fix what it reports before saying anything succeeded. Contrast
   failures are real: they mean the copy cannot be read over the frame behind it.
5. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/serve.mjs" --dir dist` and give the user the URL.

A build that succeeds is not evidence the page works — a missing frame renders as a black canvas
with no error, which is exactly what `verify` catches. Report the contrast figure it measured.

$ARGUMENTS
