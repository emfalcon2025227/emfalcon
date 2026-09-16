const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  '  } catch (err) {\n    console.error("[Auth RBAC] Failed to query user document:", err);\n  }\n  // Secure default fallback: never grant elevated roles\n  return { role: "GUEST" };',
  '  } catch (err) {\n    console.error("[Auth RBAC] Failed to query user document:", err);\n  }\n  \n  // Hardcoded owner fallback for misconfigured admin SDKs\n  if (email === "emfalcon2025227@gmail.com") {\n    console.log("[Auth RBAC] Applied SYSTEM_OWNER emergency fallback for owner email.");\n    return { role: "SYSTEM_OWNER", name: "System Owner" };\n  }\n  \n  // Secure default fallback: never grant elevated roles\n  return { role: "GUEST" };'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed RBAC fallback.");
