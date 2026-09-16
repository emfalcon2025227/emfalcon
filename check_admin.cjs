const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '{}');
if (!serviceAccount.project_id) {
    console.error("No service account");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  const users = await db.collection('users').get();
  console.log("Total users:", users.size);
  users.forEach(doc => {
    const d = doc.data();
    if (d.email === 'm_hamed@msn.com' || d.email === 'emfalcon2025227@gmail.com') {
      console.log("Found:", doc.id, d.email, d.role, d.firebaseUid);
    }
  });
}

check().then(() => process.exit(0)).catch(console.error);
