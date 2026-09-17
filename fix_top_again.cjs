const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');
file = file.replace(/export const resolveUserRole = async \(email: string \| null \| undefined, uid: string\): Promise<string> => \{\s*\/\/ STRICT MODE: No hard-coded email bypass allowed\.\s*\/\/ 1\. Firestore Lookup/g, '');
fs.writeFileSync('server.ts', file);
