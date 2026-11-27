#!/usr/bin/env node
/**
 * Builds a static copy of the legal pages for GitHub Pages, from the same JSON the web
 * app renders (apps/web/content/legal). App stores need stable URLs before the web app
 * has a production domain; these are those URLs.
 *
 *   LEGAL_ENTITY_NAME=... LEGAL_CONTACT_EMAIL=... node scripts/build-legal-pages.mjs [outDir]
 *
 * Every string is HTML-escaped: the content is text, never markup.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const out = process.argv[2] ?? join(root, 'dist', 'legal-site');
const LANGS = ['ar', 'tr', 'en'];
const DOCS = ['privacy', 'terms', 'account-deletion'];
const LANG_NAMES = { ar: 'العربية', tr: 'Türkçe', en: 'English' };
const DEFAULT_ENTITY = { ar: 'مشغّل منصة «معرض الأشياء»', tr: "Ma'rad platformunun işletmecisi", en: "the operator of Ma'rad" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bundles = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(join(root, 'apps/web/content/legal', `${l}.json`), 'utf8'))]));

const entity = (lang) => process.env.LEGAL_ENTITY_NAME?.trim() || DEFAULT_ENTITY[lang];
const contact = (lang) => {
  const email = process.env.LEGAL_CONTACT_EMAIL?.trim();
  return email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : bundles[lang].contactFallback;
};
const fill = (text, lang) => text.replaceAll('{{entity}}', entity(lang)).replaceAll('{{contact}}', contact(lang));

const page = (lang, doc) => {
  const b = bundles[lang];
  const d = b.docs[doc];
  const nav = LANGS.map((l) => `<a href="../${l}/${doc}.html" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${esc(LANG_NAMES[l])}</a>`).join(' · ');
  const sections = d.sections
    .map((s) => `<section><h2>${esc(s.h)}</h2><ul>${s.items.map((i) => `<li>${esc(fill(i, lang))}</li>`).join('')}</ul>${s.note ? `<p class="note">${esc(fill(s.note, lang))}</p>` : ''}</section>`)
    .join('\n');
  return `<!doctype html>
<html lang="${lang}" dir="${b.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${esc(d.title)} — Ma'rad</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;max-width:46rem;margin:0 auto;padding:2rem 1rem;line-height:1.8;color:#111827;background:#fff}
nav{font-size:.9rem}a{color:#0d9488}a[aria-current]{font-weight:700;text-decoration:none;color:#111827}
h1{font-size:1.9rem;margin:.5rem 0}h2{font-size:1.25rem;margin-top:2rem}.meta,.note,footer{color:#4b5563}footer{border-top:1px solid #e5e7eb;margin-top:2rem;padding-top:1rem;font-size:.8rem}
@media (prefers-color-scheme:dark){body{background:#0b1220;color:#e5e7eb}a[aria-current]{color:#e5e7eb}.meta,.note,footer{color:#9ca3af}footer{border-color:#1f2937}}
</style>
</head>
<body>
<nav aria-label="${esc(b.labels.languages)}">${nav}</nav>
<h1>${esc(d.title)}</h1>
<p class="meta">${esc(b.labels.updated)}: <time datetime="${esc(b.updated)}">${esc(b.updated)}</time></p>
<p>${esc(fill(d.intro, lang))}</p>
${sections}
<footer>${esc(b.labels.draft)}</footer>
</body>
</html>
`;
};

for (const lang of LANGS) {
  mkdirSync(join(out, lang), { recursive: true });
  for (const doc of DOCS) writeFileSync(join(out, lang, `${doc}.html`), page(lang, doc));
}
// Root: short links for the store listings, Arabic by default.
const links = LANGS.flatMap((l) => DOCS.map((d) => `<li><a href="${l}/${d}.html" lang="${l}">${esc(bundles[l].docs[d].title)}</a></li>`)).join('');
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>معرض الأشياء — الصفحات القانونية</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:2}a{color:#0d9488}</style></head><body><h1>معرض الأشياء</h1><ul>${links}</ul></body></html>\n`,
);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`legal site: ${LANGS.length * DOCS.length} pages → ${out}`);
