const fs = require('fs');

const paths = [
  'C:/Users/Mahmoud/Downloads/scanner-bridge/wia-scanner.ps1',
  'scanner-bridge/wia-scanner.ps1'
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    // Ensure UTF8 BOM
    if (!content.startsWith('\uFEFF')) {
      content = '\uFEFF' + content;
    }
    fs.writeFileSync(p, content, { encoding: 'utf8' });
    console.log('Added UTF8 BOM to ' + p);
  }
});
