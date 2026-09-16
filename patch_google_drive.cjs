const fs = require('fs');
let file = fs.readFileSync('src/server-utils/googleDriveIntegrationService.ts', 'utf8');

const regex = /\/\/\s*---------------------------------------------------------------------------\s*const ENCRYPTION_ALGORITHM = "aes-256-gcm";[\s\S]*?decryptSecret\(cipherText: string\): string \{[\s\S]*?\n\}\s*\n/m;

const match = file.match(regex);
if (match) {
    file = file.replace(regex, "");
    fs.writeFileSync('src/server-utils/googleDriveIntegrationService.ts', file);
    console.log("Successfully removed duplicate definitions.");
} else {
    console.log("Regex didn't match.");
}
