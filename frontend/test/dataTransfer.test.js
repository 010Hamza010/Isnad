import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Both import cards were once imported but never rendered, so only the full backup showed.
test('«النسخ والنقل» renders the isnad and thabat import cards', () => {
  const src = readFileSync(new URL('../src/pages/shared/DataTransfer.jsx', import.meta.url), 'utf8');
  assert.match(src, /<ShareIsnad\b/);
  assert.match(src, /<Thabat\b/);
});
