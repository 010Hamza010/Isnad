/**
 * Public verification link printed in the QR: «<base>/v/<token>».
 * base: the «public address» setting, or the address the app is currently opened from.
 */
export function verifyUrl(token, base) {
  const origin = String(base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  return `${origin}/v/${encodeURIComponent(token)}`;
}

/** Arabic label of a verification status. */
export const statusLabel = s => (s === 'revoked' ? 'ملغاة' : 'صحيحة');
