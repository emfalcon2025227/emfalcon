import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

// Collections strictly classified as User Operational Data
const OPERATIONAL_COLLECTIONS = [
  "owners",
  "properties",
  "units",
  "tenants",
  "leases",
  "cheques",
  "collections",
  "cases",
  "archive",
  "notifications",
  "auditLogs",
  "historicalRecords",
  "maintenance_requests",
  "technicians",
  "commissions",
  "payment_allocations",
  "financial_reversals",
  "financial_adjustments",
  "owner_transfers",
  "property_expenses",
  "collection_actions",
  "payment_promises",
  "lease_renewals",
  "deferred_payments",
  "journal_entries",
  "office_petty_cash_months",
  "office_petty_cash_expenses",
  "financial_periods",
  "period_certifications"
];

// Collections strictly classified as System / Configuration Data
const PRESERVED_COLLECTIONS = [
  "chart_of_accounts",
  "office_petty_cash_categories",
  "vatRates",
  "vat_rates",
  "settings",
  "users",
  "userPermissionOverrides",
  "form_layouts"
];

async function purgeOperationalData() {
  console.log("==================================================");
  console.log("STARTING EMIRATES FALCON ERP OPERATIONAL DATA PURGE");
  console.log("==================================================");

  const deletionReport: Record<string, number> = {};

  for (const colName of OPERATIONAL_COLLECTIONS) {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const docCount = snapshot.size;

      if (docCount === 0) {
        deletionReport[colName] = 0;
        console.log(`[PASS] ${colName}: 0 records (already empty)`);
        continue;
      }

      console.log(`[PURGING] ${colName}: Deleting ${docCount} documents...`);

      const docs = snapshot.docs;
      const batchSize = 400;
      let deleted = 0;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
        deleted += chunk.length;
      }

      deletionReport[colName] = deleted;
      console.log(`[DELETED] ${colName}: Successfully purged ${deleted} records.`);
    } catch (err: any) {
      console.error(`[ERROR] Failed to purge ${colName}:`, err.message);
      deletionReport[colName] = -1;
    }
  }

  console.log("\n==================================================");
  console.log("VERIFYING PRESERVED SYSTEM COLLECTIONS");
  console.log("==================================================");

  const preservedReport: Record<string, number> = {};
  for (const colName of PRESERVED_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, colName));
      preservedReport[colName] = snapshot.size;
      console.log(`[PRESERVED] ${colName}: ${snapshot.size} documents intact`);
    } catch (e: any) {
      preservedReport[colName] = -1;
      console.log(`[PRESERVED-CHECK] ${colName}: Checked (${e.message})`);
    }
  }

  console.log("\n==================================================");
  console.log("PURGE EXECUTION SUMMARY");
  console.log("==================================================");
  console.log("Deleted User Data:", JSON.stringify(deletionReport, null, 2));
  console.log("Preserved System Data:", JSON.stringify(preservedReport, null, 2));
}

purgeOperationalData().then(() => {
  console.log("\nDATA RESET COMPLETE.");
  process.exit(0);
}).catch((e) => {
  console.error("FATAL ERROR DURING PURGE:", e);
  process.exit(1);
});
