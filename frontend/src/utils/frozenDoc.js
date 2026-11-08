// The exact issued ijaza as a standalone HTML document: the laid-out pages, a copy of every style
// rule they use, and the fonts embedded — later changes to the app (code, CSS, fonts online) can
// never alter it, and it needs nothing from the network.

const FONTS_CSS = 'https://fonts.googleapis.com/css2';
const FONT_FILE = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/g;

// page canvas for the standalone document (screen: grey desk; print: one A4 sheet per page)
const DOC_CSS = `
html, body { margin: 0; background: #e9e6df; }
body > .cert-sheets { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 18px 0; zoom: 1 !important; }
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff; }
  body > .cert-sheets { display: block; padding: 0; }
  .cert-page { box-shadow: none !important; break-after: page; }
  .cert-page-wrap:last-child .cert-page, body > .cert-sheets > .cert-page:last-child { break-after: auto; }
}`;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * @font-face rules for these families (regular + bold) with every font file inlined as a data: URL.
 * Throws if the fonts cannot be downloaded (better than freezing a document that depends on the network).
 */
export async function embeddedFontCss(families, fetchFn = fetch) {
  const query = [...new Set(families)].map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700`).join('&');
  const cssRes = await fetchFn(`${FONTS_CSS}?${query}&display=swap`);
  if (!cssRes.ok) throw new Error('fonts css');
  const css = await cssRes.text();
  const urls = [...new Set([...css.matchAll(FONT_FILE)].map(m => m[1]))];
  const inlined = new Map(await Promise.all(urls.map(async u => {
    const r = await fetchFn(u);
    if (!r.ok) throw new Error(`font ${u}`);
    return [u, `data:font/woff2;base64,${toBase64(await r.arrayBuffer())}`];
  })));
  return css.replace(FONT_FILE, (_, u) => `url(${inlined.get(u)})`);
}

/** Every readable (same-origin) CSS rule of the app, as text. */
function appCss() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheets: fonts are embedded instead
    for (const r of rules) out.push(r.cssText);
  }
  return out.join('\n');
}

/** Build the document from the on-screen `.cert-sheets` element, with the design's fonts embedded. */
export async function buildFrozenDocument(sheetsEl, design, fetchFn = fetch) {
  const families = [...Object.values(design.fonts).map(f => f.family), 'Amiri'];
  const fonts = await embeddedFontCss(families, fetchFn);
  const clone = sheetsEl.cloneNode(true);
  clone.style.zoom = '';
  clone.querySelectorAll('.cert-measure').forEach(n => n.remove());
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${fonts}
${appCss()}
${DOC_CSS}</style></head>
<body>${clone.outerHTML}</body></html>`;
}

/** First and last characters of a SHA-256, for display: «a1b2c3d4…e5f6». */
export const shortHash = h => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '');
