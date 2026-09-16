import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

try {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: config.projectId,
  });
  const db = getFirestore(app, config.firestoreDatabaseId);
  const snap = await db.collection('users').limit(1).get();
  console.log("Success! Found docs:", snap.size);
} catch (e) {
  console.error("Admin error:", e);
}
