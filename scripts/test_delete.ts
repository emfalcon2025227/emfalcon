import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

async function testDelete() {
  const snap = await getDocs(collection(db, "collection_actions"));
  console.log(`Found ${snap.size} collection_actions`);
  for (const d of snap.docs) {
    try {
      await deleteDoc(d.ref);
      console.log(`Successfully deleted collection_action ${d.id}`);
    } catch (e: any) {
      console.error(`Error deleting collection_action ${d.id}:`, e.message);
    }
  }
}

testDelete().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
