import fs from 'fs';
let file = fs.readFileSync('server.ts', 'utf8');

// Modify the test endpoints to accept requests
file = file.replace(
  'app.post("/api/connections/test-smtp", authenticateFirebaseToken, requireAdmin, async (req, res) => {',
  'app.post("/api/connections/test-smtp", authenticateFirebaseToken, requireStaff, async (req, res) => {'
);

fs.writeFileSync('server.ts', file);
console.log("Made test endpoints accessible to staff.");
