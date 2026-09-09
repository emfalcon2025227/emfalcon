const fs = require("fs");
const targetPath = "C:/Users/Mahmoud/Downloads/scanner-bridge/server.js";

if (!fs.existsSync(targetPath)) {
  console.error("Target path does not exist:", targetPath);
  process.exit(1);
}

let code = fs.readFileSync(targetPath, "utf8");

// 1. Fix single-scanner handling in /health
code = code.replace(
  /const scanners = JSON\.parse\(result\.output\);\s*const available = scanners\.length > 0;/,
  `let scanners = JSON.parse(result.output);
            if (!Array.isArray(scanners)) scanners = (scanners && (scanners.name || scanners.id)) ? [scanners] : [];
            const available = scanners.length > 0;`
);

// 2. Add status and scannerDetected fields in /health response
code = code.replace(
  /bridgeVersion:\s*BRIDGE_VERSION,\s*scannerAvailable:\s*available,/,
  `bridgeRunning: true,
                bridgeVersion: BRIDGE_VERSION,
                scannerAvailable: available,
                scannerDetected: available,
                status: available ? "SCANNER_READY" : "NO_SCANNER_DETECTED",
                statusCode: available ? "SCANNER_READY" : "NO_SCANNER_DETECTED",
                hpDetected: available && scanners[0] && scanners[0].name ? /hp|laserjet|m282/i.test(scanners[0].name) : false,
                scanners: scanners,`
);

// 3. Fix in /scanners
code = code.replace(
  /app\.get\(['"]\/scanners['"],\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?const scanners = JSON\.parse\(result\.output\);/,
  (match) => match.replace(
    `const scanners = JSON.parse(result.output);`,
    `let scanners = JSON.parse(result.output);
            if (!Array.isArray(scanners)) scanners = (scanners && (scanners.name || scanners.id)) ? [scanners] : [];`
  )
);

// 4. Listen on 0.0.0.0
code = code.replace(/app\.listen\(PORT,\s*['"]127\.0\.0\.1['"]/, `app.listen(PORT, "0.0.0.0"`);

fs.writeFileSync(targetPath, code, "utf8");
console.log("Successfully patched " + targetPath);
