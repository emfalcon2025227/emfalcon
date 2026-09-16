const fs = require('fs');
let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

const regex = /const res = await fetch\("\/api\/connections\/send-test-email", \{[\s\S]*?body: JSON\.stringify\(/m;
const replacement = `const res = await authenticatedFetch("/api/connections/send-test-email", {
                              method: "POST",
                              body: JSON.stringify(`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Patched authenticatedFetch.");
