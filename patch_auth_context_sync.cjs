const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

code = code.replace(`  const syncPortalAccounts = async (owners: Owner[], tenants: Tenant[]) => {
    try {
      const response = await authenticatedFetch('/api/auth/sync-portal-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners, tenants })
      });
      const data = await response.json();
      if (data.success && typeof data.createdCount === 'number') {
        // Also refresh local users state if needed or merge saved users
        return data.createdCount;
      }
      const count = syncAllService(owners, tenants, users, saveUser);
      return count;
    } catch (e) {
      console.warn("[AuthContext] syncPortalAccounts network error, falling back to local service:", e);
      const count = syncAllService(owners, tenants, users, saveUser);
      return count;
    }
  };`, `  const syncPortalAccounts = async (owners: Owner[], tenants: Tenant[]) => {
    try {
      const response = await authenticatedFetch('/api/auth/sync-portal-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners, tenants })
      });
      const data = await response.json();
      if (data.success && typeof data.createdCount === 'number') {
        return data.createdCount;
      }
      return 0;
    } catch (e) {
      console.warn("[AuthContext] syncPortalAccounts network error:", e);
      return 0;
    }
  };`);

fs.writeFileSync('src/context/AuthContext.tsx', code);
