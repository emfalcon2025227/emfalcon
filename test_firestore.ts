import { initializeApp as initAdminApp, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import firebaseAppletConfig from "./firebase-applet-config.json";

const app = initAdminApp({
    credential: applicationDefault(),
    projectId: firebaseAppletConfig.projectId,
});

const dbId = firebaseAppletConfig.firestoreDatabaseId;
const firestoreAdminDb = dbId ? getAdminFirestore(app, dbId) : getAdminFirestore(app);

firestoreAdminDb.collection("users").limit(1).get().then(snap => {
    console.log("Docs:", snap.docs.length);
}).catch(e => {
    console.error("Error reading users:", e.message);
});
