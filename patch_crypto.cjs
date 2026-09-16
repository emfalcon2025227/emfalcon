const fs = require('fs');

let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /\/\/ 1\. Encryption & Decryption at Rest \(AES-256-GCM\)[\s\S]*?\/\/ ---------------------------------------------------------------------------/m;

const replacement = `// 1. Encryption & Decryption at Rest (AES-256-GCM)
// ---------------------------------------------------------------------------
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getActiveEncryptionKey() {
  if (process.env.ENCRYPTION_SECRET) {
    return crypto.createHash("sha256").update(process.env.ENCRYPTION_SECRET).digest();
  }
  return null;
}

function getLegacyEncryptionKeys() {
  const keys = [];
  if (process.env.FIREBASE_PROJECT_ID) {
    keys.push(crypto.createHash("sha256").update(process.env.FIREBASE_PROJECT_ID).digest());
  }
  keys.push(crypto.createHash("sha256").update("emirates-falcon-secure-gdrive-vault-2026").digest());
  return keys;
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getActiveEncryptionKey();
  if (!key) {
    console.error("[Vault] ENCRYPTION_SECRET is missing. Cannot encrypt safely.");
    throw new Error("ENCRYPTION_SECRET is not configured. Cannot securely encrypt data.");
  }
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return \`enc_gcm_v1:\${iv.toString("hex")}:\${authTag.toString("hex")}:\${encrypted}\`;
  } catch (err: any) {
    console.error("[Vault] Encryption error:", err.message);
    throw err;
  }
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc_gcm_v1:")) {
    // Legacy / unencrypted fallback
    return cipherText;
  }
  
  const keysToTry = [];
  const active = getActiveEncryptionKey();
  if (active) keysToTry.push(active);
  keysToTry.push(...getLegacyEncryptionKeys());

  for (const key of keysToTry) {
    try {
      const parts = cipherText.split(":");
      if (parts.length !== 4) continue;
      const iv = Buffer.from(parts[1], "hex");
      const authTag = Buffer.from(parts[2], "hex");
      const encrypted = parts[3];
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (err: any) {
      // Ignore and try next key
    }
  }
  console.error("[Vault] Decryption failed for all available keys.");
  return "";
}

// ---------------------------------------------------------------------------`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
console.log("Patched crypto logic.");
