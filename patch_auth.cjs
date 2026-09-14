const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

// 1. Remove fallback in provisionPortalAccount
code = code.replace(
  /const provisionPortalAccount = async \([\s\S]*?\n  };\n\n  const getPortalAccountInfo/,
  `const provisionPortalAccount = async (params: Omit<ProvisionParams, "existingUsers" | "saveUser">) => {
    try {
      const response = await authenticatedFetch('/api/auth/provision-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await response.json();
      if (!data.success && !data.clientManaged) {
        return { success: false, error: data.error };
      }
      if (data.clientManaged) {
        const res = provisionService({
          ...params,
          existingUsers: users,
          saveUser,
        });
        return { success: true, user: res.user, isNew: res.isNew, message: res.message };
      }
      if (data.user) {
        saveUser(data.user);
      }
      return { success: true, user: data.user, isNew: data.isNew, message: data.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const getPortalAccountInfo`
);

// 2. Remove INITIAL_OWNER_USER
code = code.replace(
  /export const INITIAL_OWNER_USER: User = \{[\s\S]*? portalAccountStatus: "ACTIVE",\n\};\n\n/,
  ''
);

// 3. Remove INITIAL_OWNER_USER from loadedUsers logic
code = code.replace(
  /\/\/ Ensure demo owner account exists\n\s*const hasOwner = loadedUsers.some.*?;\n\s*if \(\!hasOwner\) \{\n\s*loadedUsers = \[\.\.\.loadedUsers, INITIAL_OWNER_USER\];\n\s*\}/g,
  ''
);

fs.writeFileSync('src/context/AuthContext.tsx', code);
