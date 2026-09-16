const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'if (email === "emfalcon2025227@gmail.com") {',
  'if (email === "emfalcon2025227@gmail.com" || email === "m_hamed@msn.com") {'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed RBAC email fallback.");
