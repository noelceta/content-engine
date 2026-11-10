---
name: autopilot
description: Run brief, write, review and publish for the next N queued keywords. Use when I type /autopilot.
disable-model-invocation: true
model: opus
allowed-tools: Bash(node scripts/dfs.mjs *), Bash(node scripts/publish.mjs *), Read, Write, Edit, Grep, WebFetch, WebSearch, Agent
---

How many articles: $ARGUMENTS (default 1)

For each of the next keywords in `data/queue.csv` with `status=queued`, in order:

1. Start a subagent with `model: opus` to do everything the `brief` skill does (`.claude/skills/brief/SKILL.md`) for that keyword.
2. Then start a subagent with `model: sonnet` to do everything the `write` skill does (`.claude/skills/write/SKILL.md`), including the `editor` review (the editor runs on Opus by itself). If `notes/<slug>.md` has answers, it uses them. If not, it doesn't wait for me: it leaves `[ADD: ...]` markers where my experience should go.
3. Run `node scripts/publish.mjs drafts/<slug>.md --status draft` so it lands in WordPress as a draft.
4. Set that row's status in `data/queue.csv` to `drafted` and put the WordPress edit link in `notes`.

Keep each article in its own subagents so one article's research doesn't fill up the context for the next.
When you're done, give me one line per article: title, word count, markers left, edit link.
