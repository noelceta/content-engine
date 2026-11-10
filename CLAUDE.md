# Content engine

This folder writes SEO articles for my site. Claude does the research, briefs, drafts and publishing. I review everything before it goes live.

@site/site.md
@site/voice.md

## The pipeline

1. `/keywords <seed>` pulls keyword data and turns it into a queue in `data/queue.csv`
2. `/brief <keyword>` pulls the live Google results + the top pages and writes `briefs/<slug>.md`
3. I answer the questions in `notes/<slug>.md` (my experience, photos, opinions, numbers)
4. `/write <slug>` writes `drafts/<slug>.md`, then the `editor` agent tears it apart and the fixes get applied
5. `/publish <slug>` sends it to WordPress (as a draft unless I say otherwise)
6. `/autopilot <n>` runs steps 2 to 5 for the next n keywords in the queue

## Data rules

- Get SEO data only through `node scripts/dfs.mjs`. It saves small files. Read those. Never read `data/raw/`, it's huge and burns usage for nothing.
- Every number, stat or claim in an article must come from: the data brief, my notes, or a page you fetched and will link to. If you don't have it, write `[NEED SOURCE: what]` instead of guessing.
- Anything that needs my first-hand experience and isn't in my notes gets `[ADD: what I should add]`. Never invent experiences, tests, quotes, prices or "experts say".

## Writing rules

- Answer the search in the first two or three sentences. No warm-up intro.
- Write like you're explaining it to a friend who asked. Plain words, short paragraphs, specific examples.
- Banned: em dashes, "delve", "in today's fast-paced world", "unlock", "game-changer", "navigate the landscape", "it's important to note", "whether you're a beginner or", "in conclusion", "elevate", "seamless".
- Length is whatever it takes to beat the top pages on usefulness. Never pad to hit a word count.
- 2 to 4 internal links to pages in `site/site.md`, only where they actually help the reader. Link the external sources you used.
- Use the PAA questions from the brief where they fit naturally. A short FAQ at the end only if there are questions left over.
