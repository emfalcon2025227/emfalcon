const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');

const regexOauth = /const calculatedCallbackUri = `\$\{originUrl\}\/api\/integrations\/google-drive\/callback`;\s*const configuredRedirectUri =\s*process\.env\.GOOGLE_REDIRECT_URI \|\|\s*driveConfig\.repairInstructions\?\.includes\("URI:"\)\s*\?\s*calculatedCallbackUri\s*:\s*calculatedCallbackUri;\s*const oauthMatch = true;/m;

const replacementOauth = `const calculatedCallbackUri = \`\${originUrl}/api/integrations/google-drive/callback\`;
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI || "";
  const oauthMatch = configuredRedirectUri === calculatedCallbackUri;`;

file = file.replace(regexOauth, replacementOauth);

// Fix ENCRYPTION_SECRET test
file = file.replace(/status: hasEncryptionSecret \? "PASS" : "FAIL"/g, `status: hasEncryptionSecret ? "PASS" : "NOT_CONFIGURED"`);

// Find the ENCRYPTION_SECRET item in the array to make sure it's accurate
const encSecretItemRegex = /id: "ENCRYPTION_SECRET",[\s\S]*?testAvailable: true,/m;
const encSecretReplacement = `id: "ENCRYPTION_SECRET",
      service: "Vault",
      category: "SECURITY",
      key: "ENCRYPTION_SECRET",
      labelAr: "مفتاح تشفير الخزنة الآمنة",
      labelEn: "Vault Encryption Key",
      type: "Secret",
      required: true,
      status: hasEncryptionSecret ? "CONFIGURED" : "NOT_CONFIGURED",
      currentSource: hasEncryptionSecret ? "Server Environment" : "Default Fallback",
      displayValue: hasEncryptionSecret ? "••••••••••••••••" : undefined,
      isSecret: true,
      isConfigured: hasEncryptionSecret,
      descriptionAr: "مفتاح التشفير الرئيسي لتأمين الأسرار في الخزنة. لا يمكن تغييره بدون فقدان البيانات المشفرة.",
      descriptionEn: "Master encryption key for the secure vault. Modifying it will break decryption of existing secrets.",
      testAvailable: true,`;

file = file.replace(encSecretItemRegex, encSecretReplacement);

fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
console.log("Patched manager logic.");
