const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(/export const resolveUserRole = async \(email: string \| null \| undefined, uid: string\): Promise<string> => \{[\s\S]*?\/\/ 1\. Firestore Lookup/m, '');

fs.writeFileSync('server.ts', file);
