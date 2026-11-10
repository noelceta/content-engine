# Content engine

The setup I use to replace Outrank with Claude Code and DataForSEO. It does the keyword research, the brief, the draft, a tough editor pass and the WordPress publishing. You add the part only you can add: your own experience.

You need:

- A Claude Pro plan ($20/month). Claude Code comes with it.
- A DataForSEO account (pay as you go, $50 minimum top-up, never expires)
- Node.js 18 or newer
- A WordPress site, if you want auto-publishing

## Setup

1. Install Claude Code: `curl -fsSL https://claude.ai/install.sh | bash` (Mac/Linux) or `irm https://claude.ai/install.ps1 | iex` (Windows PowerShell). On Windows, also install [Git for Windows](https://git-scm.com/downloads/win).
2. Clone this repo and copy `.env.example` to `.env`.
3. Paste your DataForSEO API login and API password into `.env`. They're on the [API Access page](https://app.dataforseo.com/api-access). The API password is not your account password.
4. Fill in `site/site.md` (what your site is, who reads it, pages to link to, how strong it is) and paste 2 or 3 things you wrote into `site/voice.md`. Don't skip this. It's most of the quality.
5. Run `claude` in this folder, then `/model sonnet` once so Sonnet is your default.

## Commands

| Command | What it does | Model |
| --- | --- | --- |
| `/keywords coffee grinder` | Pulls keyword ideas, cleans out the junk, queues the best 15 topics in `data/queue.csv` | Sonnet |
| `/brief how to clean a coffee grinder` | Pulls the live Google results and top pages, writes the brief, and asks you 3 to 5 questions in `notes/` | Opus |
| `/write how-to-clean-a-coffee-grinder` | Writes the draft from the brief and your notes, then the editor agent reviews it | Sonnet + Opus editor |
| `/publish how-to-clean-a-coffee-grinder` | Sends it to WordPress as a draft | Haiku |
| `/autopilot 2` | Brief, write, review and publish for the next 2 queued keywords | Opus brief, Sonnet writer |

Anything Claude doesn't know gets an `[ADD: ...]` or `[NEED SOURCE: ...]` marker instead of a made-up answer. `scripts/publish.mjs` won't publish or schedule a post while those markers are still in it. It only sends it as a draft.

To schedule a post instead, run the script yourself:

```
node scripts/publish.mjs drafts/your-slug.md --status future --at "2026-11-20 09:00"
```

## WordPress

In WordPress go to Users, then Profile, then Application Passwords. Add one called "Claude" and paste it into `.env` with your site URL and username. Your site needs HTTPS for that section to show up.

Not on WordPress? Ask Claude to rewrite `scripts/publish.mjs` for your platform's API (Webflow, Ghost, Shopify, Sanity) and give it the API docs.

## What's in `examples/`

A real brief, data brief and draft from a test run on a made-up coffee blog. The notes were left empty on purpose, so the draft shows what you get when you don't add your own experience: markers where it should go.

## A note on cost and automation

At API prices, one article came out at about $3.20 in my test (one run, so treat it as a ballpark). On Pro you don't pay per token, but you have a 5-hour limit and a weekly limit. Check `/usage` before you run `/autopilot` on more than a couple of articles.

Pro limits assume "ordinary, individual usage". Running this for your own site is fine. If you run it for clients or as a service, use an API key.
