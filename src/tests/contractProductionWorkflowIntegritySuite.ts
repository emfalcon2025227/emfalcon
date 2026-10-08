/**
 * CONTRACT INTEGRITY R2 — REAL PRODUCTION WORKFLOW INTEGRATION (A–F)
 *
 * This suite mounts the real DataProvider and invokes the same lease/renewal
 * workflows used by the production UI. Firestore/Auth are isolated in Firebase
 * emulators; no production Firebase project is permitted.
 */

import React, { useEffect } from "react";
import { act, create } from "react-test-renderer";
import { connectAuthEmulator, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { DataProvider, useData, DataContextType } from "../context/DataContext";
import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider } from "../context/AuthContext";
import { auth, db } from "../lib/firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import type { Lease } from "../types";

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
  (globalThis as any).localStorage = localStorage;
  (globalThis as any).sessionStorage = localStorage;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).document = (globalThis as any).document || {
    documentElement: { dir: "", lang: "" },
  };
  win.crypto = win.crypto || (globalThis as any).crypto;
  (globalThis as any).alert = (globalThis as any).alert || (() => {});
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 15000, intervalMs = 100) {
  const started = Date.now();
  while (!(await condition())) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for production DataContext state.");
    }
    await sleep(intervalMs);
  }
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedUnit(id: string) {
  createdUnitIds.push(id);
  await setDoc(doc(db, "units", id), {
    id,
    unitNumber: id,
    propertyId: "test-property",
    type: "1BR",
    annualRent: 100000,
    status: "VACANT",
    createdAt: new Date().toISOString(),
  });
}

async function seedLease(lease: Lease) {
  createdLeaseIds.push(lease.id);
  await setDoc(doc(db, "leases", lease.id), lease);
}

async function readCommissionDocs(adminDb: FirebaseFirestore.Firestore, leaseId: string) {
  const snap = await adminDb.collection("commissions").where("leaseId", "==", leaseId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function runContractProductionWorkflowIntegritySuite() {
  installNodeBrowserShims();

  const emulatorAuthUrl = `http://${AUTH_EMULATOR_HOST}`;
  const [firestoreHost, firestorePortRaw] = FIRESTORE_EMULATOR_HOST.split(":");
  const firestorePort = Number(firestorePortRaw || "8080");
  try {
    connectAuthEmulator(auth, emulatorAuthUrl, { disableWarnings: true });
  } catch (err: any) {
    if (!String(err?.message || err).toLowerCase().includes("already")) throw err;
  }
  try {
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
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
        if (resolveApi) {
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

    const runWithAct = async (fn: () => any) => { let value: any; await act(async () => { value = await fn(); }); return value; };

    const getApi = () => {
      if (!dataApi) throw new Error("DataContext API is not ready.");
      return dataApi;
    };
    const owner = getApi().addOwner({ code: `TEST-OWNER-${Date.now()}`, nameAr: "مالك اختبار", nameEn: "Workflow Test Owner", phone: "0500000000", email: TEST_EMAIL } as any);
    const tenant = getApi().addTenant({ code: `TEST-TENANT-${Date.now()}`, nameAr: "مستأجر اختبار", nameEn: "Workflow Test Tenant", type: "INDIVIDUAL", nationality: "AE", email: TEST_EMAIL, phone: "0500000001", status: "ACTIVE" });
    const property = getApi().addProperty({ nameAr: "عقار اختبار", nameEn: "Workflow Test Property", code: `TEST-PROP-${Date.now()}`, ownerId: owner.id, status: "ACTIVE" } as any);
    await waitFor(() => getApi().owners.some((x) => x.id === owner.id));
    await waitFor(() => getApi().tenants.some((x) => x.id === tenant.id));
    await waitFor(() => getApi().properties.some((x) => x.id === property.id));
    const ownerId = owner.id;
    const tenantId = tenant.id;
    const propertyId = property.id;

    const createApprovedOriginalLease = async (label: string, annualRent: number, securityDeposit: number) => {
      const unit = getApi().addUnit({
        unitNumber: `TEST-${label}-UNIT-${Date.now()}`,
        propertyId,
        type: "1BR",
        annualRent,
        status: "VACANT",
      } as any);
      await waitFor(() => getApi().units.some((u) => u.id === unit.id));
      const lease = getApi().addLease({
        leaseNumber: `TEST-${label}-${Date.now()}`,
        ownerId,
        propertyId,
        unitId: unit.id,
        tenantId,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        annualRent,
        installmentsCount: 1,
        installments: [],
        securityDeposit,
        contractStatus: "ACTIVE",
      } as any);
      createdLeaseIds.push(lease.id);
      await waitFor(() => getApi().leases.some((l) => l.id === lease.id));
      const submit = getApi().submitLeaseForApproval(lease.id);
      if (!submit.success) throw new Error(`${label} submit failed: ${submit.error}`);
      await waitFor(async () => (await getDoc(doc(db, "leases", lease.id))).data()?.contractStatus === "PENDING_APPROVAL");
      await waitFor(() => getApi().leases.find((l) => l.id === lease.id)?.contractStatus === "PENDING_APPROVAL");
      const approval = await getApi().approveLease(lease.id, `Real ${label} original lease approval`);
      if (!approval.success) throw new Error(`${label} approval failed: ${approval.error}`);
      return { unitId: unit.id, leaseId: lease.id, leaseNumber: lease.leaseNumber };
    };

    // A — real new lease lifecycle: add -> submit -> approve.
    const unitA = getApi().addUnit({ unitNumber: `TEST-A-UNIT-${Date.now()}`, propertyId, type: "1BR", annualRent: 80000, status: "VACANT" } as any);
    await waitFor(() => getApi().units.some((u) => u.id === unitA.id));
    const leaseAId = uniqueId("lease-a");
    const leaseA = getApi().addLease({
      leaseNumber: `TEST-A-${Date.now()}`,
      ownerId,
      propertyId,
      unitId: unitA.id,
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
    await waitFor(() => getApi().leases.some((l) => l.id === leaseA.id));
    const submitA = getApi().submitLeaseForApproval(leaseA.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseA.id))).data()?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseA.id)?.contractStatus === "PENDING_APPROVAL");
    const approveA = await getApi().approveLease(leaseA.id, "Real production workflow test");
    const savedA = await getDoc(doc(db, "leases", leaseA.id));
    const unitSavedA = await getDoc(doc(db, "units", unitA.id));
    record(1, "A", "Real new lease approval workflow",
      submitA.success && approveA.success && savedA.data()?.contractStatus === "ACTIVE" &&
      unitSavedA.data()?.status === "OCCUPIED" && unitSavedA.data()?.currentLeaseId === leaseA.id,
      `submit=${submitA.success}, approve=${approveA.success}, lease=${savedA.data()?.contractStatus}, unit=${unitSavedA.data()?.status}`
    );

    // B — real concurrent approval of the same production workflow.
    const unitB = getApi().addUnit({ unitNumber: `TEST-B-UNIT-${Date.now()}`, propertyId, type: "1BR", annualRent: 90000, status: "VACANT" } as any);
    await waitFor(() => getApi().units.some((u) => u.id === unitB.id));
    const leaseB = getApi().addLease({
      leaseNumber: `TEST-B-${Date.now()}`, ownerId, propertyId, unitId: unitB.id, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 90000,
      installmentsCount: 1, installments: [], securityDeposit: 4500, contractStatus: "ACTIVE",
    } as any);
    createdLeaseIds.push(leaseB.id);
    await waitFor(() => getApi().leases.some((l) => l.id === leaseB.id));
    getApi().submitLeaseForApproval(leaseB.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseB.id))).data()?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseB.id)?.contractStatus === "PENDING_APPROVAL");
    const [b1, b2] = await Promise.all([
      getApi().approveLease(leaseB.id, "Concurrent worker 1"),
      getApi().approveLease(leaseB.id, "Concurrent worker 2"),
    ]);
    const bSuccesses = [b1, b2].filter((r) => r.success).length;
    const savedB = await getDoc(doc(db, "leases", leaseB.id));
    record(2, "B", "Real concurrent lease approval has one winner",
      bSuccesses === 1 && savedB.data()?.contractStatus === "ACTIVE",
      `successes=${bSuccesses}, finalStatus=${savedB.data()?.contractStatus}`
    );

    // C — real renewal creation + approval workflow.
    const originalC = await createApprovedOriginalLease("C", 100000, 5000);
    const renewalC = getApi().createLeaseRenewal({
      originalLeaseId: originalC.leaseId, originalLeaseNumber: originalC.leaseNumber,
      ownerId, propertyId, unitId: originalC.unitId, tenantId,
      currentAnnualRent: 100000, newAnnualRent: 110000, increaseAmount: 10000, increasePercentage: 10,
      originalStartDate: "2026-01-01", originalEndDate: "2026-12-31",
      newStartDate: "2027-01-01", newEndDate: "2027-12-31",
      installmentsCount: 1, paymentSchedule: [], securityDeposit: 5000,
    } as any);
    if (!renewalC.success || !renewalC.renewal) throw new Error(`C createLeaseRenewal failed: ${renewalC.error}`);
    createdRenewalIds.push(renewalC.renewal.id);
    await waitFor(async () => (await getDoc(doc(db, "lease_renewals", renewalC.renewal!.id))).exists());
    const approveC = await getApi().approveLeaseRenewal(renewalC.renewal.id, "Real renewal workflow");
    const savedRenC = await getDoc(doc(db, "lease_renewals", renewalC.renewal.id));
    const originalCSaved = await getDoc(doc(db, "leases", originalC.leaseId));
    const newLeaseCId = savedRenC.data()?.newLeaseId;
    const newLeaseC = newLeaseCId ? await getDoc(doc(db, "leases", newLeaseCId)) : null;
    if (newLeaseCId) createdLeaseIds.push(newLeaseCId);
    record(3, "C", "Real renewal creation and approval workflow",
      approveC.success && savedRenC.data()?.status === "APPROVED" &&
      originalCSaved.data()?.contractStatus === "RENEWED" &&
      newLeaseC?.data()?.contractStatus === "ACTIVE" &&
      newLeaseC?.data()?.renewalSequence === 2,
      `approve=${approveC.success}, renewal=${savedRenC.data()?.status}, original=${originalCSaved.data()?.contractStatus}, new=${newLeaseC?.data()?.contractStatus}, sequence=${newLeaseC?.data()?.renewalSequence}`
    );

    // D — real concurrent renewal approval.
    const originalD = await createApprovedOriginalLease("D", 120000, 6000);
    const renewalD = getApi().createLeaseRenewal({
      originalLeaseId: originalD.leaseId, originalLeaseNumber: originalD.leaseNumber,
      ownerId, propertyId, unitId: originalD.unitId, tenantId,
      currentAnnualRent: 120000, newAnnualRent: 125000, increaseAmount: 5000, increasePercentage: 4.1667,
      originalStartDate: "2026-01-01", originalEndDate: "2026-12-31",
      newStartDate: "2027-01-01", newEndDate: "2027-12-31",
      installmentsCount: 1, paymentSchedule: [], securityDeposit: 6000,
    } as any);
    if (!renewalD.success || !renewalD.renewal) throw new Error(`D createLeaseRenewal failed: ${renewalD.error}`);
    createdRenewalIds.push(renewalD.renewal.id);
    await waitFor(async () => (await getDoc(doc(db, "lease_renewals", renewalD.renewal!.id))).exists());
    const [d1, d2] = await Promise.all([
      getApi().approveLeaseRenewal(renewalD.renewal.id, "Concurrent renewal 1"),
      getApi().approveLeaseRenewal(renewalD.renewal.id, "Concurrent renewal 2"),
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
    const unitE = getApi().addUnit({ unitNumber: `TEST-E-UNIT-${Date.now()}`, propertyId, type: "1BR", annualRent: 100000, status: "VACANT" } as any);
    await waitFor(() => getApi().units.some((u) => u.id === unitE.id));
    const leaseE = getApi().addLease({
      leaseNumber: `TEST-E-${Date.now()}`, ownerId, propertyId, unitId: unitE.id, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 100000, installmentsCount: 1,
      installments: [], securityDeposit: 5000, contractStatus: "ACTIVE",
      stagedAdminFeesConfig: {
        includeAdminFees: true, ownerFeeEnabled: true, ownerFeeBasis: "PERCENTAGE_OF_RENT",
        ownerFeeRate: 5, ownerFeeDueDate: "2027-01-01",
      },
    } as any);
    createdLeaseIds.push(leaseE.id);
    await waitFor(() => getApi().leases.some((l) => l.id === leaseE.id));
    getApi().submitLeaseForApproval(leaseE.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseE.id))).data()?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseE.id)?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseE.id)?.contractStatus === "PENDING_APPROVAL");
    const approveE = await getApi().approveLease(leaseE.id, "Owner fee production workflow");
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
    const unitF = getApi().addUnit({ unitNumber: `TEST-F-UNIT-${Date.now()}`, propertyId, type: "1BR", annualRent: 100000, status: "VACANT" } as any);
    await waitFor(() => getApi().units.some((u) => u.id === unitF.id));
    const leaseF = getApi().addLease({
      leaseNumber: `TEST-F-${Date.now()}`, ownerId, propertyId, unitId: unitF.id, tenantId,
      startDate: "2027-01-01", endDate: "2027-12-31", annualRent: 100000, installmentsCount: 1,
      installments: [], securityDeposit: 5000, contractStatus: "ACTIVE",
      stagedAdminFeesConfig: {
        includeAdminFees: true, tenantFeeEnabled: true, tenantFeeBasis: "PERCENTAGE_OF_RENT",
        tenantFeeRate: 5, tenantFeeDueDate: "2027-01-01",
      },
    } as any);
    createdLeaseIds.push(leaseF.id);
    await waitFor(() => getApi().leases.some((l) => l.id === leaseF.id));
    getApi().submitLeaseForApproval(leaseF.id);
    await waitFor(async () => (await getDoc(doc(db, "leases", leaseF.id))).data()?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseF.id)?.contractStatus === "PENDING_APPROVAL");
    await waitFor(() => getApi().leases.find((l) => l.id === leaseF.id)?.contractStatus === "PENDING_APPROVAL");
    const approveF = await getApi().approveLease(leaseF.id, "Tenant fee production workflow");
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
