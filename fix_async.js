const fs = require('fs');
let code = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

code = code.replace(
  'const addPropertyExpense = (',
  'const addPropertyExpense = async ('
);
code = code.replace(
  'const reversePropertyExpense = (',
  'const reversePropertyExpense = async ('
);
code = code.replace(
  'const reverseOwnerTransfer = (',
  'const reverseOwnerTransfer = async ('
);

fs.writeFileSync('src/context/DataContext.tsx', code, 'utf-8');
console.log('Fixed async');
