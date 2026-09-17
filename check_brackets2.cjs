const fs = require('fs');
const ts = require('typescript');
const file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');
let depth = 0;
let lines = file.split('\n');
for(let i=0; i<lines.length; i++) {
  let line = lines[i];
  for(let j=0; j<line.length; j++) {
    if (line[j] === '{') depth++;
    if (line[j] === '}') depth--;
  }
  if (depth < 0) { console.log("Depth negative at line", i); break; }
  if (line.includes('export ') || line.includes('function ')) {
     console.log("Line " + (i+1) + " depth: " + depth + " - " + line.trim());
  }
}
console.log("Final depth:", depth);
