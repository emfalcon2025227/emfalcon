import { initializeApp as initAdminApp, applicationDefault } from "firebase-admin/app";
import firebaseAppletConfig from "./firebase-applet-config.json";

console.log("Config:", firebaseAppletConfig);
try {
    const app = initAdminApp({
        credential: applicationDefault(),
        projectId: firebaseAppletConfig.projectId,
    });
    console.log("App initialized:", app.name);
} catch (e: any) {
    console.error("Error:", e.message);
}
