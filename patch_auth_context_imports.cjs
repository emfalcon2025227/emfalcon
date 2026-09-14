const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
code = code.replace(/provisionPortalAccount as provisionService,\s*/, "");
code = code.replace(/syncAllPortalAccounts as syncAllService,\s*/, "");
fs.writeFileSync('src/context/AuthContext.tsx', code);
