import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embeddedFontCss } from '../src/utils/frozenDoc.js';

const CSS = `@font-face { font-family: 'Amiri'; font-weight: 400; src: url(https://fonts.gstatic.com/s/amiri/a.woff2) format('woff2'); }
@font-face { font-family: 'Amiri'; font-weight: 700; src: url(https://fonts.gstatic.com/s/amiri/b.woff2) format('woff2'); }`;

const fakeFetch = calls => async url => {
  calls.push(url);
  if (url.startsWith('https://fonts.googleapis.com/')) return { ok: true, text: async () => CSS };
  return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url.endsWith('a.woff2') ? 'AAA' : 'BBB').buffer };
};

test('font files are inlined as data: URLs; no network URL remains', async () => {
  const calls = [];
  const css = await embeddedFontCss(['Amiri', 'Amiri', 'Noto Naskh Arabic'], fakeFetch(calls));
  assert.match(calls[0], /family=Amiri:wght@400;700&family=Noto\+Naskh\+Arabic:wght@400;700/);
  assert.equal(calls.length, 3); // css + 2 files, each once
  assert.match(css, /url\(data:font\/woff2;base64,QUFB\)/);
  assert.match(css, /url\(data:font\/woff2;base64,QkJC\)/);
  assert.doesNotMatch(css, /https:/);
});

test('a failed download is an error, not a silently unembedded document', async () => {
  await assert.rejects(embeddedFontCss(['Amiri'], async () => ({ ok: false })));
});
