import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

const collectionsToCheck = [
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
  "period_certifications",
  "chart_of_accounts",
  "office_petty_cash_categories",
  "vatRates",
  "users",
  "form_layouts"
];

async function run() {
  console.log("Checking Firestore collections...");
  for (const col of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, col));
      console.log(`- ${col}: ${snap.size} documents`);
    } catch (e: any) {
      console.log(`- ${col}: ERROR -> ${e.message}`);
    }
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
