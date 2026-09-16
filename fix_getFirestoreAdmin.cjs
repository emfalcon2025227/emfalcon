const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  `function getFirestoreAdmin() {\n  if (firestoreAdminDb) return firestoreAdminDb;\n  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;\n  if (!base64) {\n    return null;\n  }\n\n  const app = getAdminApp();`,
  `function getFirestoreAdmin() {\n  if (firestoreAdminDb) return firestoreAdminDb;\n\n  const app = getAdminApp();`
);

fs.writeFileSync('server.ts', file);
console.log("Fixed getFirestoreAdmin.");
