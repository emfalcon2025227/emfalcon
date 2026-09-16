const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'uid = decoded.uid;',
  'uid = decoded.uid || decoded.user_id;'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed uid extraction.");
