const admin = require('firebase-admin');
const config = require('./firebase-applet-config.json');

const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!base64) {
  console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set");
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = config.firestoreDatabaseId ? admin.firestore(config.firestoreDatabaseId) : admin.firestore();

async function run() {
  const ownersSnap = await db.collection('owners').get();
  console.log(`owners count: ${ownersSnap.size}`);
  ownersSnap.forEach(doc => {
    console.log(`Owner: id=${doc.id}, nameAr=${doc.data().nameAr}, nameEn=${doc.data().nameEn}, email=${doc.data().email}`);
  });

  const tenantsSnap = await db.collection('tenants').get();
  console.log(`tenants count: ${tenantsSnap.size}`);
  tenantsSnap.forEach(doc => {
    console.log(`Tenant: id=${doc.id}, nameAr=${doc.data().nameAr}, nameEn=${doc.data().nameEn}, email=${doc.data().email}`);
  });

  const usersSnap = await db.collection('users').get();
  console.log(`users count: ${usersSnap.size}`);
  usersSnap.forEach(doc => {
    const d = doc.data();
    console.log(`User: id=${doc.id}, email=${d.email}, role=${d.role}, ownerId=${d.ownerId}, tenantId=${d.tenantId}, firebaseUid=${d.firebaseUid}`);
  });
}

run().catch(console.error);
