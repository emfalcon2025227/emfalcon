import fs from 'fs';
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

async function getUid() {
  const email = "emfalcon2025227@gmail.com";
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: "" }) // we don't have idToken. We can't lookup by email without admin SDK or user's password.
  });
}
