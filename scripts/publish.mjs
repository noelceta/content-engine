#!/usr/bin/env node
// Sends a markdown draft to WordPress through the REST API. No dependencies (Node 18+).
//
//   node scripts/publish.mjs drafts/my-post.md                 # uses WP_STATUS from .env (default: draft)
//   node scripts/publish.mjs drafts/my-post.md --status future --at "2026-11-20 09:00"
//
// Running it again on the same file updates the same post instead of making a duplicate
// (the WordPress post id gets saved into the draft's frontmatter as wp_id).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(root, '.env'));

const [file, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
if (!file) die('Usage: publish.mjs drafts/<slug>.md [--status draft|future|publish] [--at "YYYY-MM-DD HH:MM"]');

const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) die('Missing WP_URL / WP_USER / WP_APP_PASSWORD in .env');

const raw = fs.readFileSync(file, 'utf8');
const { meta, body } = parseFrontmatter(raw);
const status = opt('status', process.env.WP_STATUS || 'draft');
const at = opt('at', meta.publish_at);

// Safety net: nothing with open placeholders goes live.
const markers = body.match(/\[(ADD|NEED SOURCE)\b[^\]]*\]/gi) || [];
if (markers.length && status !== 'draft') {
  die(`Refusing to set status "${status}": ${markers.length} open marker(s):\n- ${markers.join('\n- ')}`);
}
if (status === 'future' && !at) die('Status "future" needs a date: --at "YYYY-MM-DD HH:MM" or publish_at in the frontmatter');

const auth = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD.replace(/\s+/g, '')}`).toString('base64');
const api = `${WP_URL.replace(/\/$/, '')}/wp-json/wp/v2`;

// Upload local images (your own photos and screenshots) and point the article at the uploaded copies.
// The first image becomes the featured image.
let featured = meta.featured_media ? Number(meta.featured_media) : undefined;
let content = body;
const uploaded = [];
for (const [, alt, src] of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
  if (/^https?:/.test(src)) continue;
  // Look next to the draft first, then in the project folder (so "images/photo.jpg" works from drafts/).
  const local = [path.resolve(path.dirname(file), src), path.resolve(root, src)].find((f) => fs.existsSync(f));
  if (!local) die(`Image not found: ${src}`);
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(local).toLowerCase()];
  if (!type) die(`Unsupported image type: ${src}`);
  const up = await fetch(`${api}/media`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': type, 'Content-Disposition': `attachment; filename="${path.basename(local)}"` },
    body: fs.readFileSync(local),
  });
  const media = await up.json().catch(() => ({}));
  if (!up.ok) die(`Image upload failed for ${src}: ${media.message || up.status}`);
  if (alt) await fetch(`${api}/media/${media.id}`, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ alt_text: alt }) });
  content = content.split(`](${src})`).join(`](${media.source_url})`);
  uploaded.push([src, media.source_url]);
  featured ??= media.id;
  console.log(`Uploaded ${src} -> media ${media.id}`);
}

const post = {
  title: meta.title,
  slug: meta.slug,
  excerpt: meta.excerpt || meta.meta_description || '',
  content: markdownToHtml(content),
  status,
};
if (featured) post.featured_media = featured;
if (at) post.date = at.replace(' ', 'T') + (at.length <= 16 ? ':00' : '');

const res = await fetch(`${api}/posts${meta.wp_id ? `/${meta.wp_id}` : ''}`, {
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/json' },
  body: JSON.stringify(post),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) die(`WordPress said ${res.status}: ${json.message || JSON.stringify(json).slice(0, 300)}`);

// Remember the post id and uploaded image URLs, so the next run updates instead of duplicating.
let saved = raw;
for (const [src, url] of uploaded) saved = saved.split(`](${src})`).join(`](${url})`);
if (!meta.wp_id) saved = saved.replace(/^---\n/, `---\nwp_id: ${json.id}\n`);
if (featured && !meta.featured_media) saved = saved.replace(/^---\n/, `---\nfeatured_media: ${featured}\n`);
if (saved !== raw) fs.writeFileSync(file, saved);
console.log(`${meta.wp_id ? 'Updated' : 'Created'} post ${json.id} as "${json.status}"${markers.length ? ` (${markers.length} markers left to fill in)` : ''}`);
console.log(`Edit: ${WP_URL.replace(/\/$/, '')}/wp-admin/post.php?post=${json.id}&action=edit`);
if (json.link) console.log(`Link: ${json.link}`);

// ---------- helpers ----------

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) die('Draft needs frontmatter (--- title: ... ---) at the top');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) meta[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: m[2] };
}

// Small markdown converter: headings, paragraphs, lists, links, images, bold, italic, code, quotes, tables.
function markdownToHtml(md) {
  const inline = (s) =>
    s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); if (h[1].length > 1) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; } // H1 = post title, skip
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      i--;
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(line)) { flush(); out.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ''))}</p></blockquote>`); continue; }
    if (/^\|.*\|$/.test(line.trim())) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(lines[i++].trim());
      i--;
      const cells = (r) => r.slice(1, -1).split('|').map((c) => c.trim());
      const [head, , ...bodyRows] = rows;
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}
