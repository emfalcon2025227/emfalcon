const fs = require('fs');
const file = fs.readFileSync('src/components/settings/SettingsView.tsx', 'utf8');
const newFile = file.replace(
  'const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SYSTEM_OWNER";',
  'const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SYSTEM_OWNER" || currentUser?.role === "MANAGER";'
);
fs.writeFileSync('src/components/settings/SettingsView.tsx', newFile);
console.log("Fixed RBAC in SettingsView");
