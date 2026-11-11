// Controllers let failures reach the error middleware (which hides internal messages)
// instead of answering 500 with the raw error text themselves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const QC = require('../src/models/QuranConnectionModel');
const GM = require('../src/models/GraphModel');
const qc = require('../src/controllers/quranConnectionsController');
const graph = require('../src/controllers/graphController');

const res = { status() { throw new Error('controller answered itself'); }, json() { throw new Error('controller answered itself'); } };
const boom = async () => { throw new Error('SQL secret'); };

test('quran connections and graph controllers reject instead of sending err.message', async (t) => {
  t.mock.method(QC, 'findAllForUser', boom);
  t.mock.method(QC, 'remove', boom);
  t.mock.method(GM, 'getFullGraphData', boom);
  const req = { user: { id: 1 }, params: { id: 1 }, query: {}, body: {} };
  await assert.rejects(qc.list(req, res), /SQL secret/);
  await assert.rejects(qc.remove(req, res), /SQL secret/);
  await assert.rejects(graph.fullGraph(req, res), /SQL secret/);
});
