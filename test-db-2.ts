import { config } from 'dotenv';
config();
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

let db;
try {
  if (fs.existsSync("./.secrets.json")) {
    const serviceAccount = JSON.parse(fs.readFileSync("./.secrets.json", "utf-8"));
    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }
  } else {
    initializeApp();
  }
  db = getFirestore();
  db.collection('users').where('email', '==', 'emfalcon2025227@gmail.com').get().then(snapshot => {
     snapshot.forEach(doc => console.log(doc.id, doc.data()));
  }).catch(console.error);
} catch (e) { console.error(e); }
