const fs = require('fs');
let file = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

const regexIsOwner = /export const isSystemOwnerUser = \(\s*user\?:\s*\{\s*id\?:\s*string;\s*email\?:\s*string;\s*username\?:\s*string;\s*role\?:\s*string\s*\}\s*\|\s*null\s*\):\s*boolean\s*=>\s*\{\s*if \(\!user\) return false;\s*const email = \(user\.email \|\| ""\)\.trim\(\)\.toLowerCase\(\);\s*const role = user\.role \|\| "";\s*return role === "SYSTEM_OWNER" && email === "m_hamed@msn\.com";\s*\};/m;

const replacementIsOwner = `export const isSystemOwnerUser = (user?: { id?: string; email?: string; username?: string; role?: string } | null): boolean => {
  if (!user) return false;
  return user.role === "SYSTEM_OWNER";
};`;

file = file.replace(regexIsOwner, replacementIsOwner);
fs.writeFileSync('src/context/AuthContext.tsx', file);
console.log("Patched AuthContext.tsx");
