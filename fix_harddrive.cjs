const fs = require('fs');
let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

file = file.replace("}   HardDrive,\n} from \"lucide-react\";", "  HardDrive,\n} from \"lucide-react\";");
fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Fixed import.");
