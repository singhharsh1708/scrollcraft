---
description: Rebuild the ScrollCraft site in this directory, check it, and preview it
---

Rebuild and verify the scroll site in the current directory.

1. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/build-site.mjs" --spec scrollcraft.json --out dist`
2. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/doctor.mjs" --spec scrollcraft.json`
3. If the doctor exits non-zero, fix what it reports before saying anything succeeded.
4. `node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/serve.mjs" --dir dist` and give the user the URL.

A build that succeeds is not evidence the page works — a missing frame renders as a black canvas
with no error. Say what you actually verified.

$ARGUMENTS
