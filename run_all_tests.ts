import { runPhase49FinancialClosingTests } from "./src/utils/phase49FinancialClosingTests";
import { runPhase50PeriodReconciliationTests } from "./src/utils/phase50PeriodReconciliationTests";
import { runPhase51ContinuousFinancialControlTests } from "./src/utils/phase51ContinuousFinancialControlTests";
import { runPhase52DailyDepositsForensicTests } from "./src/utils/phase52DailyDepositsForensicTests";
import { runPhase53DailyRevenueCollectionTests } from "./src/utils/phase53DailyRevenueCollectionTests";
import { runPhase54EndToEndFinancialReconciliationTests } from "./src/utils/phase54EndToEndFinancialReconciliationTests";
import { runPhase55FinancialReportingReconciliationTests } from "./src/utils/phase55FinancialReportingReconciliationTests";
import { runPhase56DepositDelayAlertTests } from "./src/utils/phase56DepositDelayAlertTests";
import { runPhase57ForensicTests } from "./src/utils/phase57DocumentIntelligenceForensicTests";
import { main as runPhase1cLiveTests } from "./src/tests/runPhase1cLiveTests";
import { runLeaseRenewalAdminFeeIntegritySuite } from "./src/tests/leaseRenewalAdminFeeIntegritySuite";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert as adminCert, applicationDefault } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./src/lib/firebase";
import fs from "fs";
import path from "path";

const firebaseAppletConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

function getAdminApp() {
  const existingApps = getAdminApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawAccount) {
    try {
      const trimmed = rawAccount.trim();
      let serviceAccount: any = null;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        serviceAccount = JSON.parse(trimmed);
      } else {
        const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
        serviceAccount = JSON.parse(decoded);
      }
      if (serviceAccount && typeof serviceAccount === "object") {
        return initAdminApp({
          credential: adminCert(serviceAccount),
          projectId: serviceAccount.project_id || firebaseAppletConfig.projectId
        });
      }
    } catch (e: any) {
      console.warn("[Firebase Admin] Service account initialization failed, falling back to ADC:", e?.message || e);
    }
  }
  try {
    return initAdminApp({
      credential: applicationDefault(),
      projectId: firebaseAppletConfig.projectId
    });
  } catch (e: any) {
    console.warn("[Firebase Admin] Credentials initialization unavailable:", e?.message || e);
  }
  return null;
}

async function authenticateClient() {
  const adminApp = getAdminApp();
  if (!adminApp) {
    console.warn("Could not initialize Firebase Admin to sign in. Tests will run unauthenticated.");
    return;
  }
  const adminAuth = getAdminAuth(adminApp);
  
  const testEmail = "test-staff-automation@falcon.ae";
  const testPassword = "TestAutomationPassword123!";
  
  let uid = "";
  try {
    const existingUser = await adminAuth.getUserByEmail(testEmail);
    uid = existingUser.uid;
    await adminAuth.updateUser(uid, { password: testPassword });
  } catch (e: any) {
    if (e.code === "auth/user-not-found") {
      const newUser = await adminAuth.createUser({
        email: testEmail,
        password: testPassword,
        emailVerified: true
      });
      uid = newUser.uid;
    } else {
      throw e;
    }
  }

  await signInWithEmailAndPassword(auth, testEmail, testPassword);
  console.log(`Successfully signed in client SDK as ${testEmail} (UID: ${uid})`);
  
  await setDoc(doc(db, "users", uid), {
    id: uid,
    firebaseUid: uid,
    email: testEmail,
    role: "SYSTEM_OWNER",
    isActive: true
  }, { merge: true });
  console.log(`Bootstrapped users/${uid} document in Firestore with SYSTEM_OWNER role`);
}

const mockContext: any = {
  owners: [],
  tenants: [],
  leases: [],
  commissions: [],
  vatRates: [],
  financialPeriods: [],
  ownerTransfers: [],
  journalEntries: [],
  collections: [],
  paymentAllocations: [],
  dailyDepositBatches: [],
  cheques: [],
  properties: [],
  units: [],
};

console.log("Phase 49 Tests available:", typeof runPhase49FinancialClosingTests === "function");
console.log("Phase 50 Tests available:", typeof runPhase50PeriodReconciliationTests === "function");
console.log("Phase 51 Tests available:", typeof runPhase51ContinuousFinancialControlTests === "function");
console.log("Phase 52 Tests available:", typeof runPhase52DailyDepositsForensicTests === "function");
console.log("Phase 53 Tests available:", typeof runPhase53DailyRevenueCollectionTests === "function");
console.log("Phase 54 Tests available:", typeof runPhase54EndToEndFinancialReconciliationTests === "function");
console.log("Phase 55 Tests available:", typeof runPhase55FinancialReportingReconciliationTests === "function");
console.log("Phase 56 Tests available:", typeof runPhase56DepositDelayAlertTests === "function");
console.log("Phase 57 Tests available:", typeof runPhase57ForensicTests === "function");

const phase57Report = runPhase57ForensicTests();
console.log(`\n======================================================`);
console.log(`PHASE 57-D FORENSIC AUDIT REPORT`);
console.log(`======================================================`);
console.log(`Total Forensic Tests: ${phase57Report.totalTests}`);
console.log(`Passed Tests: ${phase57Report.passedTests}`);
console.log(`Failed Tests: ${phase57Report.failedTests}`);
console.log(`Success Rate: ${phase57Report.successRate.toFixed(2)}%`);
console.log(`Checklist 47 Compliance: ${phase57Report.checklist47Evaluation.filter(c => c.compliant).length}/47 Points`);
console.log(`======================================================\n`);

async function cleanupTestUser() {
  try {
    const adminApp = getAdminApp();
    if (!adminApp) return;
    const adminAuth = getAdminAuth(adminApp);
    const testEmail = "test-staff-automation@falcon.ae";
    try {
      const existingUser = await adminAuth.getUserByEmail(testEmail);
      await adminAuth.deleteUser(existingUser.uid);
      console.log("Successfully deleted automated test user from Auth");
    } catch (_) {}
  } catch (err) {
    console.warn("Cleanup test user warning:", err);
  }
}

async function runIntegrity() {
  try {
    await authenticateClient();
  } catch (authErr: any) {
    console.warn("[Test Suite] Central Auth client authentication failed (falling back to unauthenticated Secure Bypass Gate mode):", authErr?.message || authErr);
  }
  try {
    const renewalReport = await runLeaseRenewalAdminFeeIntegritySuite();
    if (renewalReport.failed > 0) {
      console.error("\n[FAIL] LEASE RENEWAL / ADMIN FEE INTEGRITY TESTS FAILED!");
      process.exit(1);
    }
    await runPhase1cLiveTests();
  } catch (err) {
    console.error("Failed to run Phase 1C Integrity Tests:", err);
  } finally {
    await cleanupTestUser();
  }
}

runIntegrity();


