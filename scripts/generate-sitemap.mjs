import { readFile, writeFile } from 'node:fs/promises';

const SITE = 'https://mangaatlasjpraw.github.io';
const STATIC_CHAPTERS = new Set([
  'kingdom-raw-jap-891', 'kingdom-eng-891',
  'one-piece-jap-raw-1196', 'one-piece-eng-raw-1196',
  'days-raw-279-jap', 'Kagurabacjp-raw-jp-135',
  'Kagurabacjp-raw-eng-135', 'days-raw-279',
  'days-raw-jap-280', 'one-piece-jap-raw-1197'
]);
const ALIASES = {
  'kingdom-raw-engraw-891': 'kingdom-eng-891',
  'one-piece-raw-jap-1196': 'one-piece-jap-raw-1196',
  'one-piece-raw-eng-1196': 'one-piece-eng-raw-1196',
  'one-piece-raw-jap-1197': 'one-piece-jap-raw-1197'
};
const manual = JSON.parse(await readFile('data/manual-chapters.json', 'utf8'));
const content = JSON.parse(await readFile('data/content.json', 'utf8'));
const urls = new Map();
const add = (loc, lastmod = '') => { const date = lastmod ? new Date(lastmod).toISOString().slice(0, 10) : ''; const previous = urls.get(loc) || ''; if (!previous || (date && date > previous)) urls.set(loc, date || previous); };
for (const path of ['/', '/latest-chapters.html', '/manga.html', '/country.html', '/blog.html', '/japan-blog.html', '/france-blog.html']) add(SITE + path);
for (const chapter of [...(manual.chapters || []), ...(content.chapters || [])]) {
  if (!chapter?.slug) continue;
  const normalized = ALIASES[chapter.slug] || chapter.slug;
  const loc = STATIC_CHAPTERS.has(normalized)
    ? `${SITE}/chapter/${normalized}/`
    : `${SITE}/chapter.html?slug=${encodeURIComponent(chapter.slug)}`;
  add(loc, chapter.updatedAt || chapter.updated_at || chapter.createdAt || chapter.created_at || '');
}
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const body = [...urls].map(([loc, lastmod]) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n');
await writeFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
console.log(`Generated sitemap with ${urls.size} canonical URLs.`);
