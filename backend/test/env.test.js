const { test } = require('node:test');
const assert = require('node:assert/strict');
const { envProblems, MIN_SECRET } = require('../config/env');

const strong = 'x'.repeat(MIN_SECRET);

test('a missing, example or short JWT_SECRET blocks the start', () => {
  assert.match(envProblems({}).join(), /JWT_SECRET is not set/);
  assert.match(envProblems({ JWT_SECRET: '' }).join(), /JWT_SECRET is not set/);
  assert.match(envProblems({ JWT_SECRET: 'change_this_secret' }).join(), /example value/);
  assert.match(envProblems({ JWT_SECRET: 'change_me_in_production' }).join(), /example value/);
  assert.match(envProblems({ JWT_SECRET: 'short' }).join(), /at least 32/);
});

test('a strong JWT_SECRET passes; QR_SECRET is optional but checked when set', () => {
  assert.deepEqual(envProblems({ JWT_SECRET: strong }), []);
  assert.deepEqual(envProblems({ JWT_SECRET: strong, QR_SECRET: '' }), []);
  assert.deepEqual(envProblems({ JWT_SECRET: strong, QR_SECRET: strong }), []);
  assert.match(envProblems({ JWT_SECRET: strong, QR_SECRET: 'change_this_secret' }).join(), /QR_SECRET is still the example value/);
});
