const fs = require('fs');
let file = fs.readFileSync('src/services/communicationProviderService.ts', 'utf8');

file = file.replace(
  'errorCode: data.errorCode || (res.success ? undefined : "CONNECTION_FAILED"),',
  'errorCode: data.errorCode || (res.success ? undefined : (res.error || "CONNECTION_FAILED")),'
);

file = file.replace(
  'safeErrorMessage: err.message || "Failed to contact local server connection proxy.",',
  'safeErrorMessage: err.message || "Failed to contact local server connection proxy.",' // keep this in catch block
);

fs.writeFileSync('src/services/communicationProviderService.ts', file);
console.log("Fixed communicationProviderService.ts");
