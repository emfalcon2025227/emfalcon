const fs = require('fs');
const lines = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8').split('\n');
lines.splice(794, 0, '  }');
fs.writeFileSync('src/server-utils/centralConfigManager.ts', lines.join('\n'));
console.log("Added missing bracket.");
