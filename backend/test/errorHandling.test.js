const { test } = require('node:test');
const assert = require('node:assert/strict');
const w = require('../src/utils/asyncHandler');
const errorHandler = require('../src/middleware/errorHandler');
const { requireFields, HttpError } = require('../src/utils/httpError');

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; return res; };
  return res;
};

test('asyncHandler forwards rejected promises to next()', async () => {
  const err = new Error('db down');
  let got;
  await w(async () => { throw err; })({}, {}, e => { got = e; });
  assert.equal(got, err);
});

test('requireFields throws 400 listing missing fields', () => {
  assert.throws(() => requireFields({ name_ar: '  ' }, ['name_ar', 'qiraa_id']),
    e => e instanceof HttpError && e.status === 400 && /name_ar, qiraa_id/.test(e.message));
  assert.doesNotThrow(() => requireFields({ to_person_id: 0 }, ['to_person_id']));
});

test('errorHandler hides internal messages but exposes client errors', () => {
  const orig = console.error; console.error = () => {};
  try {
    const req = { method: 'GET', originalUrl: '/x' };
    let res = mockRes(); errorHandler(new Error('SQL secret'), req, res);
    assert.equal(res.statusCode, 500); assert.equal(res.body.error, 'Internal server error');
    res = mockRes(); errorHandler(new HttpError(400, 'Missing fields: x'), req, res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.error, 'Missing fields: x');
  } finally { console.error = orig; }
});

test('requireValidLink rejects links to "me" (0) and self-links', () => {
  const { requireValidLink } = require('../src/utils/httpError');
  assert.throws(() => requireValidLink({ from_person_id: 5, to_person_id: 0 }), e => e.status === 400);
  assert.throws(() => requireValidLink({ from_person_id: 5, to_person_id: 5 }), e => e.status === 400);
  assert.throws(() => requireValidLink({ from_person_id: 5 }), e => e.status === 400);
  assert.doesNotThrow(() => requireValidLink({ from_person_id: 0, to_person_id: 5 }));
  assert.doesNotThrow(() => requireValidLink({ to_person_id: 5 })); // from defaults to me
});
