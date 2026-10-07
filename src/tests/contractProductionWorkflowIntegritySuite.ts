/**
 * CONTRACT INTEGRITY R2 — REAL PRODUCTION WORKFLOW INTEGRATION (A–F)
 *
 * This suite mounts the real DataProvider and invokes the same lease/renewal
 * workflows used by the production UI. Firestore/Auth are isolated in Firebase
 * emulators; no production Firebase project is permitted.
 */

import React, { useEffect } from "react";
import { act, create } from "react-test-renderer";
import { connectAuthEmulator, connectFirestoreEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { DataProvider, useData, DataContextType } from "../context/DataContext";
import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { auth, db, app } from "../lib/firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import type { Lease, LeaseRenewalRecord } from "../types";

const TEST_PROJECT_ID = process.env.CONTRACT_INTEGRITY_TEST_PROJECT_ID?.trim();
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim();
const PRODUCTION_PROJECT_ID = firebaseConfig.projectId;

if (!TEST_PROJECT_ID || !AUTH_EMULATOR_HOST || !FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "CONTRACT_WORKFLOW_TEST_BLOCKED: isolated Firebase Auth + Firestore emulator settings are required."
  );
}
if (TEST_PROJECT_ID === PRODUCTION_PROJECT_ID) {
  throw new Error(
    "CONTRACT_WORKFLOW_TEST_BLOCKED: test project ID must differ from the production Firebase project ID."
  );
}

const TEST_EMAIL = `contract-workflow-${Date.now()}@falcon.test`;
const TEST_PASSWORD = "FalconWorkflowTest!2026";
const ADMIN_UID = `test-system-owner-${Date.now()}`;
const createdLeaseIds: string[] = [];
const createdRenewalIds: string[] = [];
const createdUnitIds: string[] = [];
const createdCommissionIds: string[] = [];

function installNodeBrowserShims() {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() { return storage.size; },
  };

  const win: any = (globalThis as any).window || {};
  win.localStorage = localStorage;
  win.sessionStorage = localStorage;
  win.__firebaseToken = "";
  win.addEventListener = win.addEventListener || (() => {});
  win.removeEventListener = win.removeEventListener || (() => {});
  win.dispatchEvent = win.dispatchEvent || (() => true);
  (globalThis as any).window = win;
  (globalThis as any).alert = (globalThis as any).alert || (() => {});
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs = 15000, intervalMs = 100) {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for production DataContext state.");
    }
    await sleep(intervalMs);
  }
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedUnit(adminDb: FirebaseFirestore.Firestore, id: string) {
  createdUnitIds.push(id);
  await adminDb.collection("units").doc(id).set({
    id,
    unitNumber: id,
    propertyId: "test-property",
    type: "1BR",
    annualRent: 100000,
    status: "VACANT",
    createdAt: new Date().toISOString(),
  });
}

async function seedLease(
  adminDb: FirebaseFirestore.Firestore,
  lease: Lease
) {
  createdLeaseIds.push(lease.id);
  await adminDb.collection("leases").doc(lease.id).set(lease);
}

async function readCommissionDocs(adminDb: FirebaseFirestore.Firestore, leaseId: string) {
  const snap = await adminDb.collection("commissions").where("leaseId", "==", leaseId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function runContractProductionWorkflowIntegritySuite() {
  installNodeBrowserShims();

  const emulatorAuthUrl = `http://${AUTH_EMULATOR_HOST}`;
  try {
    connectAuthEmulator(auth, emulatorAuthUrl, { disableWarnings: true });
  } catch (err: any) {
    if (!String(err?.message || err).toLowerCase().includes("already")) throw err;
  }
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  } catch (err: any) {
    if (!String(err?.message || err).toLowerCase().includes("already")) throw err;
  }

  const adminApp = initializeAdminApp(
    { projectId: TEST_PROJECT_ID },
    `contract-workflow-test-${Date.now()}`
  );
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getAdminFirestore(adminApp);

  const results: Array<{ testNumber: number; letter: string; passed: boolean; details: string }> = [];
  let passed = 0;
  let failed = 0;
  let renderer: ReturnType<typeof create> | null = null;
  let dataApi: DataContextType | null = null;

  const record = (testNumber: number, letter: string, name: string, ok: boolean, details: string) => {
    results.push({ testNumber, letter, passed: ok, details });
    if (ok) passed++; else failed++;
    console.log(`[${ok ? "PASS" : "FAIL"}] ${testNumber} [${letter}] ${name}: ${details}`);
  };

  try {
    const firebaseUser = await adminAuth.createUser({
      uid: ADMIN_UID,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: true,
      displayName: "Contract Workflow Test Owner",
    });

    await adminDb.collection("users").doc(firebaseUser.uid).set({
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: TEST_EMAIL,
      nameAr: "اختبار تكامل العقود",
      nameEn: "Contract Workflow Test",
      role: "SYSTEM_OWNER",
      isActive: true,
      disabled: false,
      createdAt: new Date().toISOString(),
    });

    await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);

    let resolveApi: ((api: DataContextType) => void) | null = null;
    const apiReady = new Promise<DataContextType>((resolve) => { resolveApi = resolve; });

    const Harness = () => {
      const api = useData();
      dataApi = api;
      useEffect(() => {
        if (api.isDataLoaded && resolveApi) {
          resolveApi(api);
          resolveApi = null;
        }
      }, [api.isDataLoaded, api]);
      return null;
    };

    renderer = await act(async () => {
      return create(
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            AuthProvider,
            null,
            React.createElement(
              DataProvider,
              null,
              React.createElement(Harness)
            )
          )
        )
      );
    });

    await act(async () => {
      await Promise.race([
        apiReady,
        (async () => { await sleep(15000); throw new Error("DataProvider did not become ready."); })(),
      ]);
    });

    const api = dataApi!;
    const ownerId = "test-owner";
    const tenantId = "test-tenant";
    const propertyId = "test-property";

    // A — real new lease lifecycle: add -> submit -> approve.
    const unitA = uniqueId("unit-a");
    await seedUnit(adminDb, unitA);
    const leaseAId = uniqueId("lease-a");
    const leaseA = api.addLease({
      leaseNumber: `TEST-A-${Date.now()}`,
      ownerId,
      propertyId,
      unitId: unitA,
      tenantId,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      annualRent: 80000,
      installmentsCount: 1,
      installments: [{
        installmentNumber: 1,
        dueDate: "2027-01-01",
        amount: 80000,
        paymentMethod: "BANK_TRANSFER",
        status: "PENDING",
      }],
      securityDeposit: 4000,
      contractStatus: "ACTIVE",
    } as any);
    createdLeaseIds.push(leaseA.id);
    await waitFor(() => api.leases.some((l) => l.id === leaseA.id));
    const submitA = api.submitLeaseForApproval(leaseA.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseA.id))).data()?.contractStatus === "PENDING_APPROVAL" as any);
    const approveA = await api.approveLease(leaseA.id, "Real production workflow test");
    const savedA = await getDoc(doc(db, "leases", leaseA.id));
    const unitSavedA = await getDoc(doc(db, "units", unitA));
    record(1, "A", "Real new lease approval workflow",
      submitA.success && approveA.success && savedA.data()?.contractStatus === "ACTIVE" &&
      unitSavedA.data()?.status === "OCCUPIED" && unitSavedA.data()?.currentLeaseId === leaseA.id,
      `submit=${submitA.success}, approve=${approveA.success}, lease=${savedA.data()?.contractStatus}, unit=${unitSavedA.data()?.status}`
    );

    // B — real concurrent approval of the same production workflow.
    const unitB = uniqueId("unit-b");
    await seedUnit(adminDb, unitB);
    const leaseB = api.addLease({
      leaseNumber: `TEST-B-${Date.now()}`, ownerId, propertyId, unitId: unitB, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 90000,
      installmentsCount: 1, installments: [], securityDeposit: 4500, contractStatus: "ACTIVE",
    } as any);
    createdLeaseIds.push(leaseB.id);
    await waitFor(() => api.leases.some((l) => l.id === leaseB.id));
    api.submitLeaseForApproval(leaseB.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseB.id))).data()?.contractStatus === "PENDING_APPROVAL" as any);
    const [b1, b2] = await Promise.all([
      api.approveLease(leaseB.id, "Concurrent worker 1"),
      api.approveLease(leaseB.id, "Concurrent worker 2"),
    ]);
    const bSuccesses = [b1, b2].filter((r) => r.success).length;
    const savedB = await getDoc(doc(db, "leases", leaseB.id));
    record(2, "B", "Real concurrent lease approval has one winner",
      bSuccesses === 1 && savedB.data()?.contractStatus === "ACTIVE",
      `successes=${bSuccesses}, finalStatus=${savedB.data()?.contractStatus}`
    );

    // C — real renewal creation + approval workflow.
    const unitC = uniqueId("unit-c");
    const leaseCId = uniqueId("lease-c");
    await seedUnit(adminDb, unitC);
    await seedLease(adminDb, {
      id: leaseCId, leaseNumber: `TEST-C-${Date.now()}`, ownerId, propertyId, unitId: unitC, tenantId,
      startDate: "2026-01-01", endDate: "2026-12-31", annualRent: 100000, installmentsCount: 1,
      installments: [], securityDeposit: 5000, securityDepositHeld: 5000, contractStatus: "ACTIVE",
      renewalSequence: 1, createdAt: new Date().toISOString(),
    });
    await waitFor(() => dataApi!.leases.some((l) => l.id === leaseCId));
    const renewalC = api.createLeaseRenewal({
      originalLeaseId: leaseCId, originalLeaseNumber: `TEST-C`,
      ownerId, propertyId, unitId: unitC, tenantId,
      currentAnnualRent: 100000, newAnnualRent: 110000, increaseAmount: 10000, increasePercentage: 10,
      originalStartDate: "2026-01-01", originalEndDate: "2026-12-31",
      newStartDate: "2027-01-01", newEndDate: "2027-12-31",
      installmentsCount: 1, paymentSchedule: [], securityDeposit: 5000,
    } as any);
    if (!renewalC.success || !renewalC.renewal) throw new Error(`C createLeaseRenewal failed: ${renewalC.error}`);
    createdRenewalIds.push(renewalC.renewal.id);
    await waitFor(async () => (await getDoc(doc(db, "lease_renewals", renewalC.renewal!.id))).exists() as any);
    const approveC = await api.approveLeaseRenewal(renewalC.renewal.id, "Real renewal workflow");
    const savedRenC = await getDoc(doc(db, "lease_renewals", renewalC.renewal.id));
    const originalC = await getDoc(doc(db, "leases", leaseCId));
    const newLeaseCId = savedRenC.data()?.newLeaseId;
    const newLeaseC = newLeaseCId ? await getDoc(doc(db, "leases", newLeaseCId)) : null;
    if (newLeaseCId) createdLeaseIds.push(newLeaseCId);
    record(3, "C", "Real renewal creation and approval workflow",
      approveC.success && savedRenC.data()?.status === "APPROVED" &&
      originalC.data()?.contractStatus === "RENEWED" &&
      newLeaseC?.data()?.contractStatus === "ACTIVE" &&
      newLeaseC?.data()?.renewalSequence === 2,
      `approve=${approveC.success}, renewal=${savedRenC.data()?.status}, original=${originalC.data()?.contractStatus}, new=${newLeaseC?.data()?.contractStatus}, sequence=${newLeaseC?.data()?.renewalSequence}`
    );

    // D — real concurrent renewal approval.
    const unitD = uniqueId("unit-d");
    const leaseDId = uniqueId("lease-d");
    await seedUnit(adminDb, unitD);
    await seedLease(adminDb, {
      id: leaseDId, leaseNumber: `TEST-D-${Date.now()}`, ownerId, propertyId, unitId: unitD, tenantId,
      startDate: "2026-01-01", endDate: "2026-12-31", annualRent: 120000, installmentsCount: 1,
      installments: [], securityDeposit: 6000, securityDepositHeld: 6000, contractStatus: "ACTIVE",
      renewalSequence: 1, createdAt: new Date().toISOString(),
    });
    await waitFor(() => dataApi!.leases.some((l) => l.id === leaseDId));
    const renewalD = api.createLeaseRenewal({
      originalLeaseId: leaseDId, originalLeaseNumber: `TEST-D`,
      ownerId, propertyId, unitId: unitD, tenantId,
      currentAnnualRent: 120000, newAnnualRent: 125000, increaseAmount: 5000, increasePercentage: 4.1667,
      originalStartDate: "2026-01-01", originalEndDate: "2026-12-31",
      newStartDate: "2027-01-01", newEndDate: "2027-12-31",
      installmentsCount: 1, paymentSchedule: [], securityDeposit: 6000,
    } as any);
    if (!renewalD.success || !renewalD.renewal) throw new Error(`D createLeaseRenewal failed: ${renewalD.error}`);
    createdRenewalIds.push(renewalD.renewal.id);
    await waitFor(async () => (await getDoc(doc(db, "lease_renewals", renewalD.renewal!.id))).exists() as any);
    const [d1, d2] = await Promise.all([
      api.approveLeaseRenewal(renewalD.renewal.id, "Concurrent renewal 1"),
      api.approveLeaseRenewal(renewalD.renewal.id, "Concurrent renewal 2"),
    ]);
    const dSuccesses = [d1, d2].filter((r) => r.success).length;
    const savedRenD = await getDoc(doc(db, "lease_renewals", renewalD.renewal.id));
    const newLeaseDId = savedRenD.data()?.newLeaseId;
    const newLeaseD = newLeaseDId ? await getDoc(doc(db, "leases", newLeaseDId)) : null;
    if (newLeaseDId) createdLeaseIds.push(newLeaseDId);
    record(4, "D", "Real concurrent renewal approval has one winner",
      dSuccesses === 1 && savedRenD.data()?.status === "APPROVED" &&
      newLeaseD?.data()?.renewalSequence === 2,
      `successes=${dSuccesses}, renewal=${savedRenD.data()?.status}, sequence=${newLeaseD?.data()?.renewalSequence}`
    );

    // E — real owner admin fee creation during lease approval.
    const unitE = uniqueId("unit-e");
    await seedUnit(adminDb, unitE);
    const leaseE = api.addLease({
      leaseNumber: `TEST-E-${Date.now()}`, ownerId, propertyId, unitId: unitE, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 100000, installmentsCount: 1,
      installments: [], securityDeposit: 5000, contractStatus: "ACTIVE",
      stagedAdminFeesConfig: {
        includeAdminFees: true, ownerFeeEnabled: true, ownerFeeBasis: "PERCENTAGE_OF_RENT",
        ownerFeeRate: 5, ownerFeeDueDate: "2027-01-01",
      },
    } as any);
    createdLeaseIds.push(leaseE.id);
    await waitFor(() => dataApi!.leases.some((l) => l.id === leaseE.id));
    api.submitLeaseForApproval(leaseE.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseE.id))).data()?.contractStatus === "PENDING_APPROVAL" as any);
    const approveE = await api.approveLease(leaseE.id, "Owner fee production workflow");
    const ownerFees = await readCommissionDocs(adminDb, leaseE.id);
    const ownerFee = ownerFees.find((c: any) => c.partyType === "OWNER" && c.commissionType === "ADMIN_FEE");
    if (ownerFee) createdCommissionIds.push(ownerFee.id);
    record(5, "E", "Real Owner Admin Fee creation during lease approval",
      approveE.success && ownerFees.length === 1 &&
      ownerFee?.partyType === "OWNER" &&
      ownerFee?.totalCommissionAmount === 5000 &&
      ownerFee?.renewalSequence === 1,
      `approve=${approveE.success}, commissionCount=${ownerFees.length}, amount=${ownerFee?.totalCommissionAmount}, sequence=${ownerFee?.renewalSequence}`
    );

    // F — real tenant admin fee creation during lease approval.
    const unitF = uniqueId("unit-f");
    await seedUnit(adminDb, unitF);
    const leaseF = api.addLease({
      leaseNumber: `TEST-F-${Date.now()}`, ownerId, propertyId, unitId: unitF, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 100000, installmentsCount: 1,
      installments: [], securityDeposit: 5000, contractStatus: "ACTIVE",
      stagedAdminFeesConfig: {
        includeAdminFees: true, tenantFeeEnabled: true, tenantFeeBasis: "PERCENTAGE_OF_RENT",
        tenantFeeRate: 5, tenantFeeDueDate: "2027-01-01",
      },
    } as any);
    createdLeaseIds.push(leaseF.id);
    await waitFor(() => dataApi!.leases.some((l) => l.id === leaseF.id));
    api.submitLeaseForApproval(leaseF.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseF.id))).data()?.contractStatus === "PENDING_APPROVAL" as any);
    const approveF = await api.approveLease(leaseF.id, "Tenant fee production workflow");
    const tenantFees = await readCommissionDocs(adminDb, leaseF.id);
    const tenantFee = tenantFees.find((c: any) => c.partyType === "TENANT" && c.commissionType === "ADMIN_FEE");
    if (tenantFee) createdCommissionIds.push(tenantFee.id);
    record(6, "F", "Real Tenant Admin Fee creation during lease approval",
      approveF.success && tenantFees.length === 1 &&
      tenantFee?.partyType === "TENANT" &&
      tenantFee?.totalCommissionAmount === 5000 &&
      tenantFee?.renewalSequence === 1,
      `approve=${approveF.success}, commissionCount=${tenantFees.length}, amount=${tenantFee?.totalCommissionAmount}, sequence=${tenantFee?.renewalSequence}`
    );

    console.log(`CONTRACT PRODUCTION WORKFLOW A–F: ${passed}/6 PASSED, ${failed} FAILED`);
    return { total: 6, passed, failed, results };
  } finally {
    renderer?.unmount();
    await signOut(auth).catch(() => {});
    for (const id of createdCommissionIds) await adminDb.collection("commissions").doc(id).delete().catch(() => {});
    for (const id of createdRenewalIds) await adminDb.collection("lease_renewals").doc(id).delete().catch(() => {});
    for (const id of createdLeaseIds) await adminDb.collection("leases").doc(id).delete().catch(() => {});
    for (const id of createdUnitIds) await adminDb.collection("units").doc(id).delete().catch(() => {});
    await adminDb.collection("users").doc(ADMIN_UID).delete().catch(() => {});
    await adminAuth.deleteUser(ADMIN_UID).catch(() => {});
    await deleteAdminApp(adminApp).catch(() => {});
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runContractProductionWorkflowIntegritySuite()
    .then((result) => {
      if (result.failed !== 0 || result.passed !== result.total) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
