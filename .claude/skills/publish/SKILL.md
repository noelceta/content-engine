---
name: publish
description: Send a finished draft to WordPress. Use when I type /publish.
disable-model-invocation: true
model: haiku
allowed-tools: Bash(node scripts/publish.mjs *), Read
---

Slug: $ARGUMENTS

1. Run `node scripts/publish.mjs drafts/$ARGUMENTS.md`.
2. If it refuses because of `[ADD` or `[NEED SOURCE` markers, list them and stop.
3. Otherwise give me the edit link it prints and the status it went up with.
