const fs = require('fs');
let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

const regex = /import \{ downloadDriveStartupBat \} from "\.\.\/\.\.\/services\/driveStartupBatchGenerator";/;
const replacement = `import { downloadDriveStartupBat } from "../../services/driveStartupBatchGenerator";
import { authenticatedFetch } from "../../utils/apiClient";`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Patched import.");
