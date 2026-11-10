import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachmentName } from '../src/utils/attachment.js';

test('attachment name prefers the UTF-8 (Arabic) file name', () => {
  assert.equal(attachmentName(`attachment; filename="isnad-share.json"; filename*=UTF-8''${encodeURIComponent('إسناد-الجزرية.json')}`), 'إسناد-الجزرية.json');
  assert.equal(attachmentName('attachment; filename="isnad-backup.json"'), 'isnad-backup.json');
  assert.equal(attachmentName(''), null);
});
