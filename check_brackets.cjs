const fs = require('fs');
const file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');
let depth = 0;
for(let i=0; i<file.length; i++) {
  if (file[i] === '{') depth++;
  if (file[i] === '}') depth--;
}
console.log("Bracket depth at end:", depth);
