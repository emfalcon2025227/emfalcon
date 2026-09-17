const fs = require('fs');

let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const targetFunc = /export function generateConnectAuthUrl\([\s\S]*?access_type: "offline",\n    prompt: "consent",\n  \}\);\n\n  return \{ authUrl, state, redirectUri \};\n\}/;

const newFunc = `export function generateConnectAuthUrl(params: {
  adminUid: string;
  origin: string;
  customRedirectUri?: string;
}): { authUrl: string; state: string; redirectUri: string } {
  const calculatedUri = \`\${params.origin}/api/integrations/google-drive/callback\`;
  const configuredUri = process.env.GOOGLE_REDIRECT_URI;
  
  const redirectUri =
    params.customRedirectUri ||
    configuredUri ||
    calculatedUri;

  console.log("[OAuth Diagnostic] Generating Auth URL:");
  console.log(" - OAuth Client ID:", process.env.GOOGLE_CLIENT_ID ? "***" + process.env.GOOGLE_CLIENT_ID.slice(-5) : "MISSING");
  console.log(" - Application Origin:", params.origin);
  console.log(" - Calculated Callback Route:", calculatedUri);
  console.log(" - Configured Redirect URI:", configuredUri || "NONE");
  console.log(" - Actually Sent redirect_uri:", redirectUri);
  
  if (configuredUri && configuredUri !== calculatedUri) {
      console.warn(\`[OAuth Diagnostic] REDIRECT_URI_MISMATCH! Configured: \${configuredUri} | Actual Origin-based: \${calculatedUri}\`);
  }

  const oauth2Client = getOAuth2Client(redirectUri);
  const state = require("crypto").randomBytes(32).toString("hex");

  pendingOAuthStates.set(state, {
    adminUid: params.adminUid,
    redirectUri,
    createdAt: Date.now(),
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
  });

  return { authUrl, state, redirectUri };
}`;

file = file.replace(targetFunc, newFunc);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched OAuth Url Generator");
