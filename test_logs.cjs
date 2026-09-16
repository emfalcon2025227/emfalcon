const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'function authenticateFirebaseToken(req: express.Request, res: express.Response, next: express.NextFunction) {',
  'function authenticateFirebaseToken(req: express.Request, res: express.Response, next: express.NextFunction) {\n  console.log(`[API] authenticateFirebaseToken called for ${req.method} ${req.url}`);'
);

file = file.replace(
  'function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {',
  'function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {\n  console.log(`[API] requireAdmin called for ${req.method} ${req.url}`);'
);

file = file.replace(
  'app.post("/api/connections/test-smtp", authenticateFirebaseToken, requireAdmin, async (req, res) => {',
  'app.post("/api/connections/test-smtp", authenticateFirebaseToken, requireAdmin, async (req, res) => {\n  console.log(`[API] test-smtp route hit`);'
);

fs.writeFileSync('server.ts', file);
console.log("Injected logs.");
