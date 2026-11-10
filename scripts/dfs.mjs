#!/usr/bin/env node
// Tiny DataForSEO client for the content pipeline. No dependencies (Node 18+).
// It pulls the data, throws away the noise, and saves small files Claude can read
// without burning your usage limits on raw JSON.
//
//   node scripts/dfs.mjs keywords "coffee grinder" [--limit 300]
//   node scripts/dfs.mjs brief "how to clean a coffee grinder" [--pages 5]
//   node scripts/dfs.mjs balance
//
// Settings come from .env in the project root:
//   DATAFORSEO_LOGIN=...   DATAFORSEO_PASSWORD=...
//   LOCATION_CODE=2840 (United States)   LANGUAGE_CODE=en

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(root, '.env'));

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
const LOCATION = Number(process.env.LOCATION_CODE || 2840);
const LANGUAGE = process.env.LANGUAGE_CODE || 'en';
if (!LOGIN || !PASSWORD) die('Missing DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in .env');

const [cmd, arg, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
let spent = 0;

if (cmd === 'balance') await balance();
else if (cmd === 'keywords' && arg) await keywords(arg, Number(opt('limit', 300)));
else if (cmd === 'brief' && arg) await brief(arg, Number(opt('pages', 5)));
else die('Usage: dfs.mjs keywords "<seed>" | brief "<keyword>" | balance');

// ---------- commands ----------

async function balance() {
  const r = await api('GET', '/v3/appendix/user_data');
  console.log(`DataForSEO balance: $${r[0].money.balance.toFixed(2)}`);
}

async function keywords(seed, limit) {
  const base = { location_code: LOCATION, language_code: LANGUAGE };
  // Long-tail phrases that contain the seed + "people also search for" style ideas.
  const [sugg, rel] = await Promise.all([
    api('POST', '/v3/dataforseo_labs/google/keyword_suggestions/live', [
      { ...base, keyword: seed, limit, include_seed_keyword: true },
    ]),
    api('POST', '/v3/dataforseo_labs/google/related_keywords/live', [
      { ...base, keyword: seed, depth: 2, limit },
    ]),
  ]);

  const rows = new Map();
  const add = (k) => {
    if (!k?.keyword || rows.has(k.keyword)) return;
    const info = k.keyword_info || {};
    rows.set(k.keyword, {
      keyword: k.keyword,
      volume: info.search_volume ?? '',
      kd: k.keyword_properties?.keyword_difficulty ?? '',
      intent: k.search_intent_info?.main_intent ?? '',
      cpc: info.cpc ?? '',
    });
  };
  for (const it of sugg[0]?.items || []) add(it);
  for (const it of rel[0]?.items || []) add(it.keyword_data);
  if (sugg[0]?.seed_keyword_data) add({ keyword: seed, ...sugg[0].seed_keyword_data });

  const list = [...rows.values()].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const file = path.join(root, 'data', `keywords-${slug(seed)}.csv`);
  writeCsv(file, list, ['keyword', 'volume', 'kd', 'intent', 'cpc']);
  console.log(`${list.length} keywords -> ${rel_(file)}  (cost $${spent.toFixed(4)})`);
}

async function brief(keyword, pageCount) {
  const serp = await api('POST', '/v3/serp/google/organic/live/advanced', [
    { keyword, location_code: LOCATION, language_code: LANGUAGE, device: 'desktop', depth: 20 },
  ]);
  const items = serp[0]?.items || [];
  const organic = items.filter((i) => i.type === 'organic').slice(0, 10);
  const paa = items
    .filter((i) => i.type === 'people_also_ask')
    .flatMap((i) => i.items || [])
    .map((q) => q.title);
  const related = [...new Set(items
    .filter((i) => i.type === 'related_searches')
    .flatMap((i) => i.items || []))];
  const aio = items.find((i) => i.type === 'ai_overview');
  const features = [...new Set(items.map((i) => i.type))].filter((t) => t !== 'organic');

  // Google now hides some result links behind google.com/goto redirects in live results.
  // DataForSEO Labs keeps a stored copy of the SERP (a snapshot, can be a few months old) with the real URLs, so we read pages from that.
  const hist = await api('POST', '/v3/dataforseo_labs/google/historical_serps/live', [
    { keyword, location_code: LOCATION, language_code: LANGUAGE },
  ]);
  const snap = hist[0]?.items?.[0];
  const storedUrls = (snap?.items || []).filter((i) => i.type === 'organic').map((i) => i.url);

  // Read the top ranking articles: headings + length, not the whole page.
  // Skip videos, social posts, forums and shops, and keep going until we have N readable pages.
  const skip = /(youtube\.com|facebook\.com|instagram\.com|tiktok\.com|reddit\.com|quora\.com|amazon\.|pinterest\.)/;
  const candidates = storedUrls.filter((u) => !skip.test(u)).slice(0, pageCount * 2);
  const pages = [];
  for (let i = 0; i < candidates.length && pages.length < pageCount; i += pageCount) {
    const batch = await Promise.all(candidates.slice(i, i + pageCount).map((url) => readPage(url)));
    pages.push(...batch.filter((p) => p.words > 150).slice(0, pageCount - pages.length));
  }

  const out = [];
  out.push(`# Data brief: ${keyword}`, '');
  out.push(`Pulled ${new Date().toISOString().slice(0, 10)} from Google (location ${LOCATION}, ${LANGUAGE}).`, '');
  out.push(`SERP features: ${features.join(', ') || 'none'}`, '');
  if (aio) {
    const refs = (aio.references || []).map((r) => r.domain).filter(Boolean);
    out.push(`AI Overview: yes${refs.length ? `, cites ${[...new Set(refs)].slice(0, 8).join(', ')}` : ''}`, '');
  }
  out.push('## Top 10 results', '');
  organic.forEach((o, i) => out.push(`${i + 1}. ${o.title} | ${o.website_name || o.domain}${/google\.com\/goto/.test(o.url) ? '' : ` | ${o.url}`}`));
  if (paa.length) out.push('', '## People also ask', '', ...paa.map((q) => `- ${q}`));
  if (related.length) out.push('', '## Related searches', '', ...related.map((q) => `- ${q}`));
  out.push('', `## What the top pages cover (DataForSEO's stored copy of the results, ${snap?.datetime?.slice(0, 10) || 'date unknown'})`, '');
  pages.forEach((p, i) => {
    out.push(`### ${i + 1}. ${p.url}`, `~${p.words} words`);
    p.headings.forEach((h) => out.push(`${'  '.repeat(Math.max(0, h.level - 2))}- H${h.level}: ${h.text}`));
    out.push('');
  });
  const avg = Math.round(pages.filter((p) => p.words).reduce((s, p) => s + p.words, 0) / (pages.filter((p) => p.words).length || 1));
  out.push(`Average length of readable top pages: ~${avg} words`, '');

  const file = path.join(root, 'briefs', `${slug(keyword)}.data.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'));
  // Keep the raw SERP too, in case you want to dig in later (Claude doesn't need to read it).
  fs.mkdirSync(path.join(root, 'data', 'raw'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'raw', `serp-${slug(keyword)}.json`), JSON.stringify(serp, null, 1));
  console.log(`Brief -> ${rel_(file)}  (${out.join('\n').length} chars, cost $${spent.toFixed(4)})`);
}

async function readPage(url) {
  try {
    const r = await api('POST', '/v3/on_page/content_parsing/live', [{ url }]);
    const pc = r[0]?.items?.[0]?.page_content;
    if (!pc) return { url, words: 0, headings: [], error: 'no content returned' };
    const headings = [];
    let words = 0;
    const count = (blocks) => (blocks || []).forEach((b) => (words += (b.text || '').split(/\s+/).filter(Boolean).length));
    for (const t of pc.main_topic || []) {
      if (t.h_title && t.level >= 2 && t.level <= 3) headings.push({ level: t.level, text: t.h_title.trim() });
      count(t.primary_content);
    }
    return { url, words, headings: headings.slice(0, 40) };
  } catch (e) {
    return { url, words: 0, headings: [], error: e.message.slice(0, 80) };
  }
}

// ---------- helpers ----------


async function api(method, endpoint, body) {
  const res = await fetch(`https://api.dataforseo.com${endpoint}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  spent += json.cost || 0;
  const task = json.tasks?.[0];
  if (json.status_code !== 20000 || (task && task.status_code !== 20000)) {
    throw new Error(`${endpoint}: ${task?.status_message || json.status_message}`);
  }
  return task.result || [];
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

function writeCsv(file, rows, cols) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  fs.writeFileSync(file, [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c] ?? '')).join(','))].join('\n'));
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function rel_(f) {
  return path.relative(process.cwd(), f) || f;
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}
