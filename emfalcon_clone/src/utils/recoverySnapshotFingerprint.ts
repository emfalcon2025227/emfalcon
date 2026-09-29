/**
 * RECOVERY SNAPSHOT FINGERPRINT
 * Generates a deterministic hash-like string representing dataset integrity.
 */

export function generateRecoverySnapshotFingerprint(data: any): string {
  // Deterministic summary of key counts and totals
  const ownersCount = data.owners?.length || 0;
  const tenantsCount = data.tenants?.length || 0;
  const leasesCount = data.leases?.length || 0;
  const collectionsCount = data.collections?.length || 0;
  
  const totalCollections = (data.collections || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  
  // Create a fingerprint string
  const raw = `O:${ownersCount}|T:${tenantsCount}|L:${leasesCount}|C:${collectionsCount}|V:${Math.floor(totalCollections)}`;
  
  // Simple "hash" for display
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  
  return `FING-${Math.abs(hash).toString(16).toUpperCase()}`;
}
