---
name: write
description: Write the article for a slug from its brief and my notes, then run the editor agent on it. Use when I type /write.
disable-model-invocation: true
model: sonnet
allowed-tools: Read, Write, Edit, Grep, Agent
---

Slug: $ARGUMENTS

1. Read `briefs/$ARGUMENTS.md`, `briefs/$ARGUMENTS.data.md`, `notes/$ARGUMENTS.md` (if it exists), `site/site.md` and `site/voice.md`.
2. Write `drafts/$ARGUMENTS.md`. Start with this frontmatter:

   ```
   ---
   title: <best title from the brief>
   slug: $ARGUMENTS
   keyword: <main keyword>
   meta_description: <from the brief>
   excerpt: <one or two sentences>
   ---
   ```

3. Follow the outline in the brief, one section at a time. My notes are the most valuable part of the article: use them in my voice, as first-hand experience. Where a question in my notes has no answer, put `[ADD: ...]` there instead of filling the gap.
4. When the draft is done, give it to the `editor` agent: "Review drafts/$ARGUMENTS.md against briefs/$ARGUMENTS.md". Apply every fix it lists unless it would make the article worse; say which ones you skipped and why.
   If the editor suggests new quotes or numbers, check them against the source page before you use them. Don't trust a quote just because the editor wrote it.
5. Tell me: word count, how many `[ADD` and `[NEED SOURCE` markers are left, and the editor's top 3 problems.
