const fs = require('fs');
let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /\/\/ Mode 2: Service Account Fallback \(if configured in environment\)[\s\S]*?throw new Error\("GOOGLE_DRIVE_NOT_CONFIGURED"\);\s*\}/m;

const replacement = `// Mode 2: Service Account Fallback (if configured in environment)
  // [LEGACY COMPATIBILITY ONLY] As per strict rules, Central OAuth must be the only active production path.
  // We do NOT use SA as an active fallback when OAuth fails or is missing.
  // Throw error requiring OAuth configuration.
  
  throw new Error("GOOGLE_DRIVE_NOT_CONFIGURED");
}`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched getValidAccessToken.");
