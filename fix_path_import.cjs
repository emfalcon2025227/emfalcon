const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(/import \{ getAuth as getAdminAuth \} from "firebase-admin\/auth";\nimport path from "path";/, `import { getAuth as getAdminAuth } from "firebase-admin/auth";
import path from "path";`);

if (!file.includes('import path from "path";')) {
  file = `import path from "path";\n` + file;
}

fs.writeFileSync('server.ts', file);
