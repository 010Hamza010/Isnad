const fs   = require('fs');
const path = require('path');
const Backup = require('../models/BackupModel');
const { HttpError } = require('../utils/httpError');

const DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const PRE = 'pre-restore-latest.json';
const stamp = (d = new Date()) => d.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');

const sendJson = (res, name, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(JSON.stringify(obj));
};

exports.download = async (req, res) => sendJson(res, `isnad-backup-${stamp()}.json`, await Backup.dump());

exports.summary = async (req, res) => {
  res.json({ counts: await Backup.summary(), preRestore: fs.existsSync(path.join(DIR, PRE)) ? fs.statSync(path.join(DIR, PRE)).mtime : null });
};

// the database as it was before the last restore (saved automatically), to undo it
exports.preRestore = async (req, res) => {
  const file = path.join(DIR, PRE);
  if (!fs.existsSync(file)) throw new HttpError(404, 'لا توجد نسخة سابقة للاستعادة');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="isnad-before-restore-${stamp(fs.statSync(file).mtime)}.json"`);
  fs.createReadStream(file).pipe(res);
};

exports.restore = async (req, res) => {
  const current = await Backup.dump();
  fs.mkdirSync(DIR, { recursive: true });
  const text = JSON.stringify(current);
  fs.writeFileSync(path.join(DIR, `pre-restore-${stamp()}.json`), text);
  fs.writeFileSync(path.join(DIR, PRE), text);
  const counts = await Backup.restore(req.body, req.user.id);
  res.json({ counts });
};
