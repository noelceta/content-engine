---
name: brief
description: Research one keyword (live Google results + top ranking pages) and write the content brief. Use when I type /brief.
disable-model-invocation: true
model: opus
allowed-tools: Bash(node scripts/dfs.mjs *), Read, Write, Edit, WebFetch, WebSearch
---

Keyword: $ARGUMENTS

1. Run `node scripts/dfs.mjs brief "$ARGUMENTS"` and read the `briefs/<slug>.data.md` file it prints.
2. Work out what the searcher actually wants. Look at who ranks and which SERP features show up:
   forums, Reddit and videos at the top mean people want real experience, not another generic guide.
   Brand and manual pages mean they want model-specific steps.
3. Fetch the 2 or 3 best pages from the brief with WebFetch. Note the facts we'll need (with URLs) and what all of them miss or get wrong. Don't copy their wording.
4. Write `briefs/<slug>.md` with:
   - Search intent, one sentence
   - Our angle: what we'll do better than every page in the top 10, and why someone would pick ours
   - Outline: H1, then H2/H3s with one line each on what goes in it. Work in the People Also Ask questions where they fit
   - Facts we'll use, each with its source URL
   - 3 title options, a meta description under 155 characters, and the slug
   - Questions for me: 3 to 5 things only I can answer (what I've actually done, used, measured, photographed, or believe)
5. Create `notes/<slug>.md` with those questions as headings and nothing under them, so I can fill them in.
6. Tell me the angle in one sentence and list the questions.
