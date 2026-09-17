const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(`import { getAuth as getAdminAuth } from "firebase-admin/auth";
import path from "path";`, `import { getAuth as getAdminAuth } from "firebase-admin/auth";`);

fs.writeFileSync('server.ts', file);
