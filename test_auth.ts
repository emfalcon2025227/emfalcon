import { initializeApp as initAdminApp, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import firebaseAppletConfig from "./firebase-applet-config.json";

const app = initAdminApp({
    credential: applicationDefault(),
    projectId: firebaseAppletConfig.projectId,
});

try {
    const auth = getAdminAuth(app);
    console.log("Auth initialized:", !!auth);
} catch (e: any) {
    console.error("Auth error:", e.message);
}
