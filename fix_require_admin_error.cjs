const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'error: "FORBIDDEN",\n      message: "Access restricted to System Administrators.",',
  'error: "ADMIN_REQUIRED",\n      message: "Access restricted to System Administrators.",'
);

file = file.replace(
  'error: "FORBIDDEN",\n      message: "Access restricted to authorized ERP staff.",',
  'error: "STAFF_REQUIRED",\n      message: "Access restricted to authorized ERP staff.",'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed requireAdmin error codes.");
