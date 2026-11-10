---
name: keywords
description: Pull keyword data for a seed topic and turn it into a publishing queue. Use when I type /keywords.
disable-model-invocation: true
model: sonnet
allowed-tools: Bash(node scripts/dfs.mjs *), Read, Write, Edit
---

Seed topic: $ARGUMENTS

1. Run `node scripts/dfs.mjs keywords "$ARGUMENTS"`. It saves a CSV in `data/`. Read that CSV.
2. Clean it up. The raw list is full of junk:
   - Word salad variants like "coffee grinder coffee grinder" or "grinder and coffee": drop them.
   - Close variants of the same search (same meaning, same results) are ONE topic. Keep the clearest phrasing as the main keyword. Don't add their volumes together: close variants usually share one volume number, so adding them invents searches. Use the highest single volume.
   - Drop anything that doesn't fit `site/site.md`, and brand/product searches we can't serve.
3. One topic = one article. Check `data/queue.csv` and skip topics that are already there.
4. Pick the best 15 for my site. Use the site strength in `site/site.md`: a new site should go after low KD informational and comparison topics first. Volume matters less than "can we actually rank and does it lead to money".
5. Append them to `data/queue.csv` (create it if missing) with columns:
   `keyword,volume,kd,intent,variants,status,notes` and `status=queued`.
6. Show me the 15 as a short table, then tell me the 3 you'd write first and why, one line each.
