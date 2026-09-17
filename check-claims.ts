import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  projectId: config.projectId
});
const auth = getAuth(app);

async function check() {
  try {
    const user = await auth.getUserByEmail("emfalcon2025227@gmail.com");
    console.log("User UID:", user.uid);
    console.log("User Claims:", user.customClaims);
  } catch (err) {
    console.error(err);
  }
}
check();
