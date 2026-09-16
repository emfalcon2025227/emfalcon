const fs = require('fs');

let authContext = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

// We will replace the localStorage accesses related to current identity.
authContext = authContext.replace(/localStorage\.getItem\("ef_users"\)/g, 'null');
authContext = authContext.replace(/localStorage\.getItem\("ef_user_overrides"\)/g, 'null');
authContext = authContext.replace(/localStorage\.getItem\("ef_login_mode"\)/g, 'null');
authContext = authContext.replace(/localStorage\.setItem\("ef_users"/g, '// localStorage.setItem("ef_users"');
authContext = authContext.replace(/localStorage\.setItem\("ef_user_overrides"/g, '// localStorage.setItem("ef_user_overrides"');

fs.writeFileSync('src/context/AuthContext.tsx', authContext);
console.log("Patched localStorage in AuthContext");
