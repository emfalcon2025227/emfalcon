const fs = require('fs');
let code = fs.readFileSync('src/services/portalProvisioningService.ts', 'utf8');

code = code.replace(/export const provisionPortalAccount =[\s\S]*?;\n\s*\};/g, `
// Local fallback provision is disabled in favor of unified server API.
// Use provisionPortalAccount from AuthContext directly.
`);

code = code.replace(/export const syncAllPortalAccounts =[\s\S]*?;\n\s*\};/g, `
// Local fallback sync is disabled in favor of unified server API.
// Use syncPortalAccounts from AuthContext directly.
`);

fs.writeFileSync('src/services/portalProvisioningService.ts', code);
