const fs = require('fs');
let file = fs.readFileSync('src/services/communicationProviderService.ts', 'utf8');

file = file.replace(
  /errorCode: data\.errorCode \|\| \(res\.success \? undefined : "CONNECTION_FAILED"\),/g,
  'errorCode: data.errorCode || (res.success ? undefined : (res.error || "CONNECTION_FAILED")),'
);

fs.writeFileSync('src/services/communicationProviderService.ts', file);
console.log("Fixed communicationProviderService.ts globally");
