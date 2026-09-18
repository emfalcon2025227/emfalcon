import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import firebaseAppletConfig from "./firebase-applet-config.json";

const app = initializeApp({
    credential: applicationDefault(),
    projectId: firebaseAppletConfig.projectId,
});

const dbId = firebaseAppletConfig.firestoreDatabaseId;

async function testADC() {
    try {
        const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
        console.log("Firestore client generated for DB:", dbId || "(default)");
        // Let's test a simple read to see if ADC has datastore.user permissions
        try {
            await db.collection("users").limit(1).get();
            console.log("Firestore READ SUCCESS");
        } catch(fe: any) {
             console.error("Firestore READ FAILED:", fe.message);
        }
    } catch(e: any) {
        console.error("Firestore init error:", e.message);
    }
}
testADC();
