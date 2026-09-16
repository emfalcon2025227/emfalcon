const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'const jsonPayload = decodeURIComponent(atob(base64).split("").map(function(c) {\n          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);\n      }).join(""));\n      decoded = JSON.parse(jsonPayload);',
  'const jsonPayload = Buffer.from(base64, "base64").toString("utf8");\n      decoded = JSON.parse(jsonPayload);'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed atob to Buffer.");
