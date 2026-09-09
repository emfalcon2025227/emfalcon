const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const outputDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const zipPath = path.join(outputDir, 'scanner-bridge-package.zip');
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function () {
  console.log(`Created ${zipPath} (${archive.pointer()} total bytes)`);
});

archive.on('error', function (err) {
  throw err;
});

archive.pipe(output);

// Append files from scanner-bridge/
const sourceDir = path.join(process.cwd(), 'scanner-bridge');
const filesToInclude = [
  'cloud-bridge.js',
  'config.json',
  'Start-Scanner-Bridge.bat',
  'install-windows-startup.bat',
  'server.js',
  'wia-scanner.ps1',
  'package.json',
];

filesToInclude.forEach(file => {
  const filePath = path.join(sourceDir, file);
  if (fs.existsSync(filePath)) {
    archive.file(filePath, { name: file });
  }
});

archive.finalize();
