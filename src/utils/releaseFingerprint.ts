/**
 * RELEASE FINGERPRINT
 * Generates a deterministic hash of the approved release state.
 */

export function generateReleaseFingerprint(version: string, changeCount: number): string {
  const raw = `REL:${version}|CHG:${changeCount}|TS:${new Date().toISOString().slice(0,13)}`;
  
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  
  return `REL-FING-${Math.abs(hash).toString(16).toUpperCase()}`;
}
