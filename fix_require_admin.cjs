const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(
  'message: "Access restricted to System Administrators.",\n    });',
  'message: "Access restricted to System Administrators.",\n      _padding: " ".repeat(1024),\n    });'
);

file = file.replace(
  'message: "Access restricted to authorized ERP staff.",\n    });',
  'message: "Access restricted to authorized ERP staff.",\n      _padding: " ".repeat(1024),\n    });'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed requireAdmin padding.");
