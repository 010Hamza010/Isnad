/** File name of a Content-Disposition header, preferring the UTF-8 one (Arabic titles). */
export function attachmentName(header = '') {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf) { try { return decodeURIComponent(utf[1]); } catch { /* fall back */ } }
  return /filename="([^"]+)"/.exec(header)?.[1] || null;
}
