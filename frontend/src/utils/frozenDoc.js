// The exact issued ijaza as a standalone HTML document: the laid-out pages plus a copy of every
// style rule they use, so later changes to the app's code or CSS can never alter it.

const FONTS = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Lateef:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Reem+Kufi:wght@400;700&family=Scheherazade+New:wght@400;700&display=swap';

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

/** Every readable (same-origin) CSS rule of the app, as text. */
function appCss() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin (Google Fonts): linked instead
    for (const r of rules) out.push(r.cssText);
  }
  return out.join('\n');
}

/** Build the document from the on-screen `.cert-sheets` element. */
export function buildFrozenDocument(sheetsEl) {
  const clone = sheetsEl.cloneNode(true);
  clone.style.zoom = '';
  clone.querySelectorAll('.cert-measure').forEach(n => n.remove());
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${FONTS}">
<style>${appCss()}
${DOC_CSS}</style></head>
<body>${clone.outerHTML}</body></html>`;
}

/** First and last characters of a SHA-256, for display: «a1b2c3d4…e5f6». */
export const shortHash = h => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '');
