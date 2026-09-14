import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import config from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const users = await getDocs(collection(db, "users"));
    console.log(`TOTAL USERS: ${users.size}`);
    users.forEach(doc => {
       console.log("USER:", doc.id, doc.data().email, doc.data().role, doc.data().ownerId);
    });

    const owners = await getDocs(collection(db, "owners"));
    console.log(`TOTAL OWNERS: ${owners.size}`);
    owners.forEach(doc => {
       console.log("OWNER:", doc.id, doc.data().nameEn);
    });

    const tenants = await getDocs(collection(db, "tenants"));
    console.log(`TOTAL TENANTS: ${tenants.size}`);
    tenants.forEach(doc => {
       console.log("TENANT:", doc.id, doc.data().nameEn);
    });

    process.exit(0);
  } catch (e) {
    console.error("DB Error:", e);
    process.exit(1);
  }
}
run();
