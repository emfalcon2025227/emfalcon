const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'app.get("/api/admin/system-config", authenticateFirebaseToken, requireAdmin, (req, res) => {',
  'app.get("/api/admin/system-config", authenticateFirebaseToken, requireAdmin, (req, res) => {\n  console.log(`[API] /api/admin/system-config hit by ${req.user?.role}`);'
);

fs.writeFileSync('server.ts', file);
console.log("Injected debug log.");
