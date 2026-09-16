import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

try {
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);
  const snap = await getDocs(collection(db, 'users'));
  console.log("Success! Found docs client side:", snap.size);
} catch (e) {
  console.error("Client error:", e);
}
