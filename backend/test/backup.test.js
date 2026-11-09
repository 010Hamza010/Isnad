const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escape } = require('mysql2');
const { backupName, tableSql, header, qid } = require('../scripts/backup');

test('backup file name is db + local timestamp', () => {
  assert.equal(backupName('isnad_db', new Date(2026, 10, 9, 7, 5, 3)), 'isnad_db_20261109-070503.sql');
});

test('identifiers are backtick-quoted and escaped', () => {
  assert.equal(qid('persons'), '`persons`');
  assert.equal(qid('a`b'), '`a``b`');
});

test('table with no rows: drop + create only', () => {
  const sql = tableSql('t', 'CREATE TABLE `t` (id int)', [], escape);
  assert.equal(sql, 'DROP TABLE IF EXISTS `t`;\nCREATE TABLE `t` (id int);\n');
});

test('rows are escaped (Arabic, quotes, NULL, JSON strings) and batched by 200', () => {
  const rows = Array.from({ length: 201 }, (_, i) => ({ id: i, name: i ? `شيخ ${i}` : "O'Brien", meta: i ? null : '{"a":1}' }));
  const sql = tableSql('persons', 'CREATE TABLE `persons` (x int)', rows, escape);
  const inserts = sql.split('\n').filter(l => l.startsWith('INSERT'));
  assert.equal(inserts.length, 2);
  assert.match(sql, /INSERT INTO `persons` \(`id`, `name`, `meta`\) VALUES\n\(0, 'O\\'Brien', '\{\\"a\\":1\}'\)/);
  assert.match(sql, /\(200, 'شيخ 200', NULL\);\n$/);
});

test('header keeps id 0 («أنا») and disables FK checks', () => {
  const h = header('isnad_db', new Date('2026-11-09T00:00:00Z'));
  assert.match(h, /NO_AUTO_VALUE_ON_ZERO/);
  assert.match(h, /FOREIGN_KEY_CHECKS = 0/);
  assert.match(h, /SET NAMES utf8mb4/);
});
