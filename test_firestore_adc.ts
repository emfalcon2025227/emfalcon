import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

try {
    const app = initializeApp({
        credential: applicationDefault(),
        projectId: "gen-lang-client-0196715356" // From report
    });
    
    const db = getFirestore(app);
    console.log("Firestore created.");
    db.collection("users").limit(1).get()
      .then(() => console.log("Success!"))
      .catch(e => console.error("Firestore read error:", e.message));
} catch(e: any) {
    console.error("Init error:", e.message);
}
