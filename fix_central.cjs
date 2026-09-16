const fs = require('fs');
const lines = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8').split('\n');

lines.splice(793, 16); // Remove from 794 to 809 (inclusive)

fs.writeFileSync('src/server-utils/centralConfigManager.ts', lines.join('\n'));
console.log("Removed extra catch block in centralConfigManager.ts");
