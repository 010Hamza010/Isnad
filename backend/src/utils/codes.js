const crypto = require('crypto');

/** Unguessable token for the public link (128 bits, URL-safe). */
const newToken = () => crypto.randomBytes(16).toString('base64url');

// Crockford base32: no I, L, O, U — easy to read aloud and type
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Short code printed under the QR: «ISN-7K3Q-9P2M» (40 random bits). */
function newShortCode() {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map(b => ALPHABET[b % 32]).join('');
  return `ISN-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/** Accept a typed code in any form («isn 7k3q 9p2m», «7K3Q9P2M», O for 0…) → canonical, or null. */
function normalizeShortCode(input) {
  const raw = String(input ?? '').toUpperCase().replace(/^ISN/, '').replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (raw.length !== 8 || [...raw].some(c => !ALPHABET.includes(c))) return null;
  return `ISN-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const isToken = t => /^[A-Za-z0-9_-]{16,32}$/.test(String(t ?? ''));

module.exports = { newToken, newShortCode, normalizeShortCode, isToken };
