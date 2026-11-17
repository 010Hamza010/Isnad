/**
 * Serve the built frontend (frontend `npm run build`, copied to backend/views) from the API server:
 * its files as they are, and index.html for every other GET outside /api, so the app's own routes
 * (/persons, /ijazat…) work on reload. Hashed files under /assets are cached for a year; index.html
 * never, so a new build is picked up at once. Nothing is served when the folder has no index.html.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const DEFAULT_DIR = path.join(__dirname, '..', 'views');

function serveFrontend(app, dir = process.env.FRONTEND_DIR || DEFAULT_DIR) {
  const index = path.join(dir, 'index.html');
  if (!fs.existsSync(index)) return false;
  app.use(express.static(dir, {
    index: false,
    setHeaders: (res, file) => res.setHeader('Cache-Control',
      file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'),
  }));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return true;
}

module.exports = { serveFrontend, DEFAULT_DIR };
