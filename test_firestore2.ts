import { initializeApp as initAdminApp, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import firebaseAppletConfig from "./firebase-applet-config.json";

const app = initAdminApp({
    credential: applicationDefault(),
    projectId: firebaseAppletConfig.projectId,
});

const firestoreAdminDb = getAdminFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
const firestoreAdminDbDefault = getAdminFirestore(app);

firestoreAdminDbDefault.collection("users").limit(1).get().then(snap => {
    console.log("Docs Default:", snap.docs.length);
}).catch(e => {
    console.error("Error reading users Default:", e.message);
});
