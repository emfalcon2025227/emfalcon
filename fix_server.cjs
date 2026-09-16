const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
lines.splice(120, 1);
fs.writeFileSync('server.ts', lines.join('\n'));
console.log("Removed extra }");
