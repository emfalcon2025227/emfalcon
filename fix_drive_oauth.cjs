const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(/app\.get\("\/api\/integrations\/google-drive\/callback", authenticateFirebaseToken, requireStaff, async \(req, res\) => \{[\s\S]*?try \{[\s\S]*?const { code } = req\.query;[\s\S]*?const host = req\.headers\.host;[\s\S]*?const protocol = req\.protocol;[\s\S]*?const originUrl = req\.headers\.origin \|\| \`\$\{protocol\}:\/\/\$\{host\}\`;[\s\S]*?const redirectUri = \`\$\{originUrl\}\/api\/integrations\/google-drive\/callback\`;/m, `app.get("/api/integrations/google-drive/callback", authenticateFirebaseToken, requireStaff, async (req, res) => {
  try {
    const { code } = req.query;
    // STRICT MODE: Use canonical URL only
    const canonicalUrl = process.env.GOOGLE_REDIRECT_URI 
      ? process.env.GOOGLE_REDIRECT_URI.replace("/api/integrations/google-drive/callback", "")
      : (req.headers.origin || \`\${req.protocol}://\${req.headers.host}\`);
      
    const redirectUri = \`\${canonicalUrl}/api/integrations/google-drive/callback\`;`);

fs.writeFileSync('server.ts', file);
