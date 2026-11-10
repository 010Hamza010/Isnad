import api from './api';
import { attachmentName } from './attachment.js';

/** Save a Blob under `name` (a temporary link click). */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** GET an attachment from the API (with the login token) and save it under the server's name. */
export async function downloadFrom(url, fallbackName) {
  const r = await api.get(url, { responseType: 'blob' });
  saveBlob(r.data, attachmentName(r.headers['content-disposition']) || fallbackName);
}

/** Read a chosen file as JSON; null when it is not JSON. */
export async function readJsonFile(file) {
  try { return JSON.parse(await file.text()); } catch { return null; }
}
