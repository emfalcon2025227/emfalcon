const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');
file = file.replace("  }\n\n  // 4. Google OAuth & Redirect Match\n  }", "  // 4. Google OAuth & Redirect Match");
fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
