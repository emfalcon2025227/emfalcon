const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

// Fix test-smtp
file = file.replace(
  'return res.status(403).json({ success: false, ...gmail, steps });',
  'return res.status(400).json({ success: false, ...gmail, steps });'
);

// Fix test-whatsapp
file = file.replace(
  'return res.status(403).json({ success: false, ...wa, steps });',
  'return res.status(400).json({ success: false, ...wa, steps });'
);

// Fix send-test-email
file = file.replace(
  'return res.status(403).json({ success: false, message: `Failed to send email: ${err.message}` });',
  'return res.status(400).json({ success: false, message: `Failed to send email: ${err.message}` });'
);

// Fix send-test-whatsapp
file = file.replace(
  'return res.status(403).json({ success: false, message: `Failed to send WhatsApp: ${err.message}` });',
  'return res.status(400).json({ success: false, message: `Failed to send WhatsApp: ${err.message}` });'
);

fs.writeFileSync('server.ts', file);
console.log("Fixed 403s in API routes.");
