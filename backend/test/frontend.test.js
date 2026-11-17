const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { serveFrontend } = require('../src/frontend');

// a built app in a temp folder, served by a fresh express app on a free port
async function withServer(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isnad-views-'));
  Object.entries(files).forEach(([f, body]) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), body);
  });
  const app = express();
  app.get('/api/health', (_, res) => res.json({ ok: true }));
  app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
  const served = serveFrontend(app, dir);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, served); } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('serves the build: files, index.html for the app routes, the API untouched', async () => {
  await withServer({ 'index.html': '<!doctype html><div id="root"></div>', 'assets/app-1a2b.js': 'console.log(1)' }, async (base, served) => {
    assert.equal(served, true);
    const js = await fetch(`${base}/assets/app-1a2b.js`);
    assert.equal(await js.text(), 'console.log(1)');
    assert.match(js.headers.get('cache-control'), /immutable/);
    for (const route of ['/', '/persons', '/ijazat/12']) {
      const r = await fetch(base + route);
      assert.equal(r.status, 200, route);
      assert.match(await r.text(), /id="root"/, route);
      assert.equal(r.headers.get('cache-control'), 'no-cache', route);
    }
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
    const missing = await fetch(`${base}/api/nothing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Not found' });
  });
});

test('no build in the folder: nothing is served', async () => {
  await withServer({}, async (base, served) => {
    assert.equal(served, false);
    assert.equal((await fetch(`${base}/persons`)).status, 404);
  });
});
