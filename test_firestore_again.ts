import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({
    credential: applicationDefault(),
    projectId: "gen-lang-client-0196715356"
});

const db = getFirestore(app);

async function testRead() {
    try {
        console.log("Reading...");
        await db.collection("users").limit(1).get();
        console.log("Success");
    } catch(e: any) {
        console.error("Error:", e.message);
    }
}
testRead();
