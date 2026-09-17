const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

file = file.replace(/export const resolveUserRole = async \(email: string \| null \| undefined, uid: string\): Promise<string> => \{[\s\S]*?\/\/ 1\. Hard-coded system owner bypass[\s\S]*?if \(email && \(email\.toLowerCase\(\) === "emfalcon2025227@gmail\.com" || email\.toLowerCase\(\) === "eng\.a\.samara@gmail\.com"\)\) \{[\s\S]*?return "SYSTEM_OWNER";[\s\S]*?\}[\s\S]*?\/\/ 2\. Firestore Lookup/m, `export const resolveUserRole = async (email: string | null | undefined, uid: string): Promise<string> => {
  // STRICT MODE: No hard-coded email bypass allowed.
  // 1. Firestore Lookup`);

fs.writeFileSync('server.ts', file);
