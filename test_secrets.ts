import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

process.env.ENCRYPTION_SECRET = "test-encryption-key-for-secrets-tests";

// we need to mock SECRETS_FILE_PATH because it's hardcoded to .secrets.json in cwd
// But it's better to just swap it out temporarily or just write to it and then clean it up.
const SECRETS_FILE_PATH = path.join(process.cwd(), ".secrets.json");
let originalSecrets = "";
if (fs.existsSync(SECRETS_FILE_PATH)) {
  originalSecrets = fs.readFileSync(SECRETS_FILE_PATH, "utf8");
}

function restoreSecrets() {
  if (originalSecrets) {
    fs.writeFileSync(SECRETS_FILE_PATH, originalSecrets, "utf8");
  } else {
    if (fs.existsSync(SECRETS_FILE_PATH)) fs.unlinkSync(SECRETS_FILE_PATH);
  }
}

async function runTests() {
  try {
    const { encryptSecret, decryptSecret, loadStoredSecrets } = await import('./src/server-utils/googleDriveIntegrationService.js');
    const { updateSystemConfiguration } = await import('./src/server-utils/centralConfigManager.js');

    // Test A - Encryption
    console.log("Running Test A - Encryption");
    const testSecret = "my-super-secret";
    const encrypted = encryptSecret(testSecret);
    if (!encrypted.startsWith("enc_gcm_v1:")) throw new Error("Test A failed: Does not start with enc_gcm_v1:");
    if (encrypted.includes(testSecret)) throw new Error("Test A failed: Contains plaintext");
    console.log("Test A passed.");

    // Test B - Decryption
    console.log("Running Test B - Decryption");
    const decrypted = decryptSecret(encrypted);
    if (decrypted !== testSecret) throw new Error("Test B failed: Decrypted value doesn't match");
    console.log("Test B passed.");

    // Test C - Plaintext migration
    console.log("Running Test C - Plaintext migration");
    fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify({
      smtpAppPassword: "legacy-plain-password",
      whatsappAccessToken: "legacy-plain-whatsapp"
    }), "utf8");
    const loaded = loadStoredSecrets();
    if (loaded.smtpAppPassword !== "legacy-plain-password") throw new Error("Test C failed: Did not load legacy");
    const fileContent = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
    if (fileContent.smtpAppPassword) throw new Error("Test C failed: Plaintext still in file");
    if (fileContent.whatsappAccessToken) throw new Error("Test C failed: Plaintext still in file");
    if (!fileContent.smtpAppPasswordEncrypted?.startsWith("enc_gcm_v1:")) throw new Error("Test C failed: Missing encrypted password");
    console.log("Test C passed.");

    // Test D - Missing encryption key
    console.log("Running Test D - Missing encryption key");
    process.env.ENCRYPTION_SECRET = ""; // remove key
    let caught = false;
    try {
      await updateSystemConfiguration({ gmailAppPassword: "new-password" }, "admin@example.com");
    } catch (e: any) {
      caught = true;
      if (!e.message.includes("ENCRYPTION_SECRET is not configured")) {
        throw new Error("Test D failed: Wrong error message: " + e.message);
      }
    }
    if (!caught) throw new Error("Test D failed: Did not throw on missing key");
    
    const fileContentD = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
    if (fileContentD.smtpAppPassword) throw new Error("Test D failed: Saved plaintext!");
    console.log("Test D passed.");

    // Restore key
    process.env.ENCRYPTION_SECRET = "test-encryption-key-for-secrets-tests";

    // Test E & F - Save Gmail and WhatsApp
    console.log("Running Test E & F - Save Gmail and WhatsApp");
    await updateSystemConfiguration({
      gmailAppPassword: "new-gmail-password",
      whatsappToken: "new-whatsapp-token"
    }, "admin@example.com");
    const fileContentEF = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, "utf8"));
    if (fileContentEF.smtpAppPassword || fileContentEF.whatsappAccessToken) throw new Error("Test EF failed: Plaintext saved");
    if (!fileContentEF.smtpAppPasswordEncrypted || !fileContentEF.whatsappAccessTokenEncrypted) throw new Error("Test EF failed: Encrypted missing");
    
    const loadedEF = loadStoredSecrets();
    if (loadedEF.smtpAppPassword !== "new-gmail-password") throw new Error("Test EF failed: Decrypted gmail wrong");
    if (loadedEF.whatsappAccessToken !== "new-whatsapp-token") throw new Error("Test EF failed: Decrypted whatsapp wrong");
    console.log("Test E & F passed.");

    // Test I - Audit
    console.log("Running Test I - Audit");
    const { getConfigAuditLogs } = await import('./src/server-utils/centralConfigManager.js');
    const logs = getConfigAuditLogs();
    const latestLog = logs[0]; // assuming updateSystemConfiguration logs at unshift
    if (JSON.stringify(logs).includes("new-gmail-password")) throw new Error("Test I failed: Secret found in audit log");
    console.log("Test I passed.");

  } finally {
    restoreSecrets();
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
