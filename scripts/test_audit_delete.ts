import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

async function testAuditDelete() {
  const snap = await getDocs(collection(db, "auditLogs"));
  console.log(`Found ${snap.size} auditLogs`);
  if (snap.size > 0) {
    const docToDelete = snap.docs[0];
    try {
      await deleteDoc(docToDelete.ref);
      console.log(`Successfully deleted audit log ${docToDelete.id}`);
    } catch (e: any) {
      console.error(`Error deleting audit log ${docToDelete.id}:`, e.message);
    }
  }
}

testAuditDelete().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
