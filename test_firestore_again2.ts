import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({
    credential: applicationDefault(),
    projectId: "gen-lang-client-0196715356"
});

const db = getFirestore(app, "ai-studio-remixremixremixr-8c567d77-3b0d-4111-85f4-1551be3cdb6b");

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
