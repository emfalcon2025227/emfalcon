const fs = require('fs');
let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /const hasOAuth = Boolean\(secrets\.googleDriveRefreshToken\);\s*const hasSA = Boolean\([\s\S]*?\);\s*if \(\!hasOAuth && \!hasSA\) \{/m;

const replacement = `const hasOAuth = Boolean(secrets.googleDriveRefreshToken);

  if (!hasOAuth) {`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched testArchiveConnection Step 1.");
