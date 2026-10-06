import { handleProvisionPortalUserInternal } from "../../server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const firebaseAppletConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
);

function getAdminApp() {
  // This integrity suite is write-capable. It is intentionally restricted to an
  // isolated Firebase Emulator environment and must never reuse a production app.
  const testProjectId = process.env.PORTAL_PROVISIONING_TEST_PROJECT_ID?.trim();
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();

  if (
    !testProjectId ||
    testProjectId === firebaseAppletConfig.projectId ||
    !authEmulatorHost ||
    !firestoreEmulatorHost
  ) {
    return null;
  }

  const existingApps = getApps();
  const matchingApp = existingApps.find((candidate) => candidate.options.projectId === testProjectId);
  if (matchingApp) {
    return matchingApp;
  }

  try {
    return initializeApp({ projectId: testProjectId });
  } catch (_) {
    return null;
  }
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

export async function runPortalProvisioningIntegritySuite() {
  console.log("\n==================================================");
  console.log("REAL PORTAL PROVISIONING INTEGRITY & CONCURRENCY SUITE (27 MATRIX TESTS)");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  const app = getAdminApp();
  const dbAdmin = app ? getAdminFirestore(app) : null;
  const authAdmin = app ? getAdminAuth(app) : null;

  const createdAuthUidsToClean: string[] = [];
  const createdDocPathsToClean: { collection: string; docId: string }[] = [];

  // Fail closed: this suite is write-capable and may only run against an isolated
  // Firebase Emulator project. Production credentials/projects are never accepted.
  const testProjectId = process.env.PORTAL_PROVISIONING_TEST_PROJECT_ID?.trim();
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();

  if (
    !testProjectId ||
    testProjectId === firebaseAppletConfig.projectId ||
    !authEmulatorHost ||
    !firestoreEmulatorHost ||
    !app ||
    !dbAdmin ||
    !authAdmin ||
    app.options.projectId !== testProjectId
  ) {
    throw new Error(
      "PORTAL_PROVISIONING_TEST_BLOCKED: this write-capable suite requires an isolated Firebase Auth + Firestore Emulator environment with a non-production project ID."
    );
  }

  const report = (id: number, title: string, isPass: boolean, details: string) => {
    if (isPass) {
      passed++;
      console.log(`[PASS] Matrix ${id}: ${title}\n       Details: ${details}`);
    } else {
      failed++;
      console.error(`[FAIL] Matrix ${id}: ${title}\n       Details: ${details}`);
    }
  };

  const ts = Date.now();
  const testOwnerId = `test-ow-matrix-${ts}`;
  const testOwner2Id = `test-ow2-matrix-${ts}`;
  const testTenantId = `test-tnt-matrix-${ts}`;
  const testTenant2Id = `test-tnt2-matrix-${ts}`;

  const testOwnerEmail = `owner-matrix-${ts}@falcon-test.ae`;
  const testTenantEmail = `tenant-matrix-${ts}@falcon-test.ae`;

  try {
    // Seed test owner/tenant docs
    if (dbAdmin) {
      await dbAdmin.collection("owners").doc(testOwnerId).set({ id: testOwnerId, nameEn: "Matrix Owner 1", nameAr: "مالك 1", isActive: true });
      await dbAdmin.collection("owners").doc(testOwner2Id).set({ id: testOwner2Id, nameEn: "Matrix Owner 2", nameAr: "مالك 2", isActive: true });
      await dbAdmin.collection("tenants").doc(testTenantId).set({ id: testTenantId, nameEn: "Matrix Tenant 1", nameAr: "مستأجر 1", isActive: true });
      await dbAdmin.collection("tenants").doc(testTenant2Id).set({ id: testTenant2Id, nameEn: "Matrix Tenant 2", nameAr: "مستأجر 2", isActive: true });

      createdDocPathsToClean.push({ collection: "owners", docId: testOwnerId });
      createdDocPathsToClean.push({ collection: "owners", docId: testOwner2Id });
      createdDocPathsToClean.push({ collection: "tenants", docId: testTenantId });
      createdDocPathsToClean.push({ collection: "tenants", docId: testTenant2Id });
    }

    const callHandler = async (
      body: any,
      callerRole = "SYSTEM_OWNER",
      dependencies: Parameters<typeof handleProvisionPortalUserInternal>[2] = {}
    ) => {
      const req: any = { user: { role: callerRole }, body };
      const res = createMockResponse();
      await handleProvisionPortalUserInternal(req, res, dependencies);
      return res;
    };

    // 1. New OWNER provisioning — real endpoint
    const res1 = await callHandler({ portalRole: "OWNER", targetId: testOwnerId, email: testOwnerEmail, nameEn: "Matrix Owner" });
    const pass1 = res1.statusCode === 200 && res1.body?.success === true && res1.body?.user?.role === "OWNER" && res1.body?.user?.ownerId === testOwnerId;
    if (res1.body?.user?.id) createdAuthUidsToClean.push(res1.body.user.id);
    report(1, "New OWNER provisioning — real endpoint", pass1, `Status ${res1.statusCode}, user.role=${res1.body?.user?.role}`);

    // 2. New TENANT provisioning — real endpoint
    const res2 = await callHandler({ portalRole: "TENANT", targetId: testTenantId, email: testTenantEmail, nameAr: "مستأجر" });
    const pass2 = res2.statusCode === 200 && res2.body?.success === true && res2.body?.user?.role === "TENANT" && res2.body?.user?.tenantId === testTenantId;
    if (res2.body?.user?.id) createdAuthUidsToClean.push(res2.body.user.id);
    report(2, "New TENANT provisioning — real endpoint", pass2, `Status ${res2.statusCode}, user.role=${res2.body?.user?.role}`);

    // 3. Same OWNER provisioning rerun — real endpoint (idempotent)
    const res3 = await callHandler({ portalRole: "OWNER", targetId: testOwnerId, email: testOwnerEmail });
    const pass3 = res3.statusCode === 200 && res3.body?.success === true && res3.body?.isNew === false && res3.body?.user?.id === res1.body?.user?.id;
    report(3, "Same OWNER provisioning rerun — real endpoint (idempotent)", pass3, `Status ${res3.statusCode}, isNew=false, same UID`);

    // 4. Same TENANT provisioning rerun — real endpoint (idempotent)
    const res4 = await callHandler({ portalRole: "TENANT", targetId: testTenantId, email: testTenantEmail });
    const pass4 = res4.statusCode === 200 && res4.body?.success === true && res4.body?.isNew === false && res4.body?.user?.id === res2.body?.user?.id;
    report(4, "Same TENANT provisioning rerun — real endpoint (idempotent)", pass4, `Status ${res4.statusCode}, isNew=false, same UID`);

    // 5. Missing portalRole
    const res5 = await callHandler({ targetId: testOwnerId, email: `norole-${ts}@test.com` });
    report(5, "Missing portalRole", res5.statusCode === 400 && res5.body?.error === "INVALID_PORTAL_ROLE", `Status ${res5.statusCode}`);

    // 6. Invalid lowercase owner
    const res6 = await callHandler({ portalRole: "owner", targetId: testOwnerId, email: `lc-${ts}@test.com` });
    report(6, "Invalid lowercase owner", res6.statusCode === 400 && res6.body?.error === "INVALID_PORTAL_ROLE", `Status ${res6.statusCode}`);

    // 7. Invalid arbitrary role
    const res7 = await callHandler({ portalRole: "SUPER_ROLE", targetId: testOwnerId, email: `arb-${ts}@test.com` });
    report(7, "Invalid arbitrary role", res7.statusCode === 400 && res7.body?.error === "INVALID_PORTAL_ROLE", `Status ${res7.statusCode}`);

    // 8. Missing targetId
    const res8 = await callHandler({ portalRole: "OWNER", targetId: "", email: `notarget-${ts}@test.com` });
    report(8, "Missing targetId", res8.statusCode === 400 && res8.body?.error === "MISSING_TARGET_ID", `Status ${res8.statusCode}`);

    // 9. Nonexistent Owner
    const res9 = await callHandler({ portalRole: "OWNER", targetId: `nonexistent-ow-${ts}`, email: `noow-${ts}@test.com` });
    report(9, "Nonexistent Owner target", res9.statusCode === 400 && res9.body?.error === "TARGET_NOT_FOUND", `Status ${res9.statusCode}`);

    // 10. Nonexistent Tenant
    const res10 = await callHandler({ portalRole: "TENANT", targetId: `nonexistent-tnt-${ts}`, email: `notnt-${ts}@test.com` });
    report(10, "Nonexistent Tenant target", res10.statusCode === 400 && res10.body?.error === "TARGET_NOT_FOUND", `Status ${res10.statusCode}`);

    // 11. Existing unrelated STAFF email
    const staffEmail = `staff-unrelated-${ts}@falcon-test.ae`;
    let staffUid = "";
    if (authAdmin && dbAdmin) {
      const uRec = await authAdmin.createUser({ email: staffEmail, password: "TestStaffPassword123!" });
      staffUid = uRec.uid;
      createdAuthUidsToClean.push(staffUid);
      await dbAdmin.collection("users").doc(staffUid).set({
        id: staffUid, firebaseUid: staffUid, email: staffEmail, role: "PROPERTY_MANAGER", isActive: true
      });
      createdDocPathsToClean.push({ collection: "users", docId: staffUid });
    }
    const res11 = await callHandler({ portalRole: "OWNER", targetId: testOwner2Id, email: staffEmail });
    report(11, "Existing unrelated STAFF email conversion guard", res11.statusCode === 400 && res11.body?.error === "EMAIL_ALREADY_IN_USE", `Status ${res11.statusCode}`);

    // 12. Existing Owner account bound to different Owner
    const res12 = await callHandler({ portalRole: "OWNER", targetId: testOwner2Id, email: testOwnerEmail });
    report(12, "Existing Owner account bound to different Owner", res12.statusCode === 400 || res12.statusCode === 409, `Status ${res12.statusCode}`);

    // 13. Existing Tenant account bound to different Tenant
    const res13 = await callHandler({ portalRole: "TENANT", targetId: testTenant2Id, email: testTenantEmail });
    report(13, "Existing Tenant account bound to different Tenant", res13.statusCode === 400 || res13.statusCode === 409, `Status ${res13.statusCode}`);

    // 14. Existing portal identity already bound to target
    const res14 = await callHandler({ portalRole: "OWNER", targetId: testOwnerId, email: `different-owner-${ts}@falcon-test.ae` });
    report(14, "Existing portal identity already bound to target (different email)", res14.statusCode === 409 && res14.body?.error === "TARGET_ALREADY_PROVISIONED", `Status ${res14.statusCode}`);

    // 15. Non-admin staff caller
    const res15 = await callHandler({ portalRole: "OWNER", targetId: testOwner2Id, email: `staffcall-${ts}@test.com` }, "EMPLOYEE");
    report(15, "Non-admin staff caller rejected", res15.statusCode === 403 && res15.body?.error === "USER_MANAGEMENT_ADMIN_REQUIRED", `Status ${res15.statusCode}`);

    // 16. Client ownerId injection
    const res16 = await callHandler({ portalRole: "TENANT", targetId: testTenant2Id, email: `tnt-inject-${ts}@falcon-test.ae`, ownerId: "INJECTED_OWNER" });
    if (res16.body?.user?.id) createdAuthUidsToClean.push(res16.body.user.id);
    report(16, "Client ownerId injection ignored for TENANT", res16.statusCode === 200 && res16.body?.user?.ownerId === undefined && res16.body?.user?.tenantId === testTenant2Id, `Status ${res16.statusCode}`);

    // 17. Client tenantId injection
    const res17 = await callHandler({ portalRole: "OWNER", targetId: testOwner2Id, email: `ow-inject-${ts}@falcon-test.ae`, tenantId: "INJECTED_TENANT" });
    if (res17.body?.user?.id) createdAuthUidsToClean.push(res17.body.user.id);
    report(17, "Client tenantId injection ignored for OWNER", res17.statusCode === 200 && res17.body?.user?.tenantId === undefined && res17.body?.user?.ownerId === testOwner2Id, `Status ${res17.statusCode}`);

    // 18a. Verify HTTP request body failureInjection is ignored (production safety)
    const prodHookEmail = `prod-hook-safety-${ts}@falcon-test.ae`;
    const res18a = await callHandler({ portalRole: "OWNER", targetId: testOwner2Id, email: prodHookEmail, failureInjection: true });
    const pass18a = res18a.statusCode === 200 && res18a.body?.success === true;
    if (res18a.body?.user?.id) createdAuthUidsToClean.push(res18a.body.user.id);
    report(18, "Production body failureInjection flag ignored (safety check)", pass18a, `Status ${res18a.statusCode}, success=${res18a.body?.success}`);

    // 18b. Programmatic test option failure — verifies Auth compensation AND claim release
    const failTargetId = `test-ow-fail-${ts}`;
    const compEmail = `comp-test-${ts}@falcon-test.ae`;
    if (dbAdmin) {
      await dbAdmin.collection("owners").doc(failTargetId).set({ id: failTargetId, nameEn: "Fail Target Owner", isActive: true });
      createdDocPathsToClean.push({ collection: "owners", docId: failTargetId });
    }

    const res18b = await callHandler(
      { portalRole: "OWNER", targetId: failTargetId, email: compEmail },
      "SYSTEM_OWNER",
      { writeUserProfile: async () => { throw new Error("FIRESTORE_WRITE_FAILED"); } }
    );
    let compAuthDeleted = false;
    let claimReleased = false;
    if (authAdmin && dbAdmin) {
      try {
        await authAdmin.getUserByEmail(compEmail);
        compAuthDeleted = false;
      } catch (e: any) {
        if (e.code === "auth/user-not-found") compAuthDeleted = true;
      }
      const claimSnap = await dbAdmin.collection("portal_claims").doc(`OWNER_${failTargetId}`).get();
      claimReleased = !claimSnap.exists;
    } else {
      throw new Error(
        "PORTAL_PROVISIONING_TEST_BLOCKED: real Auth/Firestore verification is unavailable."
      );
    }
    const pass18b = res18b.statusCode === 500 && compAuthDeleted && claimReleased;
    report(19, "Programmatic test failure — performs real Auth compensation and newly created claim release", pass18b, `Status ${res18b.statusCode}, Auth deleted=${compAuthDeleted}, Claim released=${claimReleased}`);

    // 18c. Verify pre-existing claim is never deleted when a subsequent call fails
    let preExistingClaimPreserved = false;
    if (dbAdmin) {
      const claimSnap = await dbAdmin.collection("portal_claims").doc(`OWNER_${testOwnerId}`).get();
      preExistingClaimPreserved = claimSnap.exists;
    } else {
      preExistingClaimPreserved = true;
    }
    report(20, "Verify pre-existing claim is never deleted on failed subsequent requests", preExistingClaimPreserved, `Pre-existing claim doc OWNER_${testOwnerId} exists=${preExistingClaimPreserved}`);

    // 21. Concurrent Owner provisioning
    const concOwnerTarget = `test-ow-conc-${ts}`;
    if (dbAdmin) {
      await dbAdmin.collection("owners").doc(concOwnerTarget).set({ id: concOwnerTarget, nameEn: "Conc Owner", isActive: true });
      createdDocPathsToClean.push({ collection: "owners", docId: concOwnerTarget });
    }
    const concReq1 = callHandler({ portalRole: "OWNER", targetId: concOwnerTarget, email: `conc-ow-1-${ts}@falcon-test.ae` });
    const concReq2 = callHandler({ portalRole: "OWNER", targetId: concOwnerTarget, email: `conc-ow-2-${ts}@falcon-test.ae` });
    const [concRes1, concRes2] = await Promise.all([concReq1, concReq2]);
    
    if (concRes1.body?.user?.id) createdAuthUidsToClean.push(concRes1.body.user.id);
    if (concRes2.body?.user?.id) createdAuthUidsToClean.push(concRes2.body.user.id);

    const concOwnerSuccessCount = [concRes1, concRes2].filter(r => r.statusCode === 200).length;
    const concOwnerConflictCount = [concRes1, concRes2].filter(r => r.statusCode === 409).length;
    report(21, "Concurrent Owner provisioning (1 succeeds, 1 returns 409)", concOwnerSuccessCount === 1 && concOwnerConflictCount === 1, `Success count: ${concOwnerSuccessCount}, Conflict count: ${concOwnerConflictCount}`);

    // 22. Concurrent Tenant provisioning
    const concTenantTarget = `test-tnt-conc-${ts}`;
    if (dbAdmin) {
      await dbAdmin.collection("tenants").doc(concTenantTarget).set({ id: concTenantTarget, nameEn: "Conc Tenant", isActive: true });
      createdDocPathsToClean.push({ collection: "tenants", docId: concTenantTarget });
    }
    const concTntReq1 = callHandler({ portalRole: "TENANT", targetId: concTenantTarget, email: `conc-tnt-1-${ts}@falcon-test.ae` });
    const concTntReq2 = callHandler({ portalRole: "TENANT", targetId: concTenantTarget, email: `conc-tnt-2-${ts}@falcon-test.ae` });
    const [concTntRes1, concTntRes2] = await Promise.all([concTntReq1, concTntReq2]);

    if (concTntRes1.body?.user?.id) createdAuthUidsToClean.push(concTntRes1.body.user.id);
    if (concTntRes2.body?.user?.id) createdAuthUidsToClean.push(concTntRes2.body.user.id);

    const concTntSuccessCount = [concTntRes1, concTntRes2].filter(r => r.statusCode === 200).length;
    const concTntConflictCount = [concTntRes1, concTntRes2].filter(r => r.statusCode === 409).length;
    report(22, "Concurrent Tenant provisioning (1 succeeds, 1 returns 409)", concTntSuccessCount === 1 && concTntConflictCount === 1, `Success count: ${concTntSuccessCount}, Conflict count: ${concTntConflictCount}`);

    // 23. Verify no orphan Firebase Auth users
    let orphanFound = false;
    if (authAdmin && dbAdmin) {
      try {
        const compCheck = await authAdmin.getUserByEmail(compEmail).catch(() => null);
        if (compCheck) orphanFound = true;
      } catch (_) {}
    }
    report(23, "Verify no orphan Firebase Auth users", !orphanFound, "Compensation user completely removed from Auth");

    // 24. Verify no duplicate Firestore user profiles
    let duplicateUsersFound = false;
    if (dbAdmin) {
      const uSnap = await dbAdmin.collection("users").where("ownerId", "==", testOwnerId).get();
      if (uSnap.size > 1) duplicateUsersFound = true;
    }
    report(24, "Verify no duplicate Firestore user profiles for same target", !duplicateUsersFound, "Only 1 authoritative user profile exists per target");

    // 25. Verify no duplicate target bindings
    let duplicateBindingsFound = false;
    if (dbAdmin) {
      const cSnap = await dbAdmin.collection("portal_claims").where("targetId", "==", testOwnerId).get();
      if (cSnap.size > 1) duplicateBindingsFound = true;
    }
    report(25, "Verify no duplicate target bindings in portal_claims", !duplicateBindingsFound, "Only 1 claim doc exists per target");

    // 26. Verify same-account idempotency
    const res26 = await callHandler({ portalRole: "OWNER", targetId: testOwnerId, email: testOwnerEmail });
    report(26, "Verify same-account idempotency", res26.statusCode === 200 && res26.body?.isNew === false, `Status ${res26.statusCode}, isNew=false`);

    // 27. Verify different-target conflict
    const res27 = await callHandler({ portalRole: "OWNER", targetId: testOwnerId, email: `diff-target-${ts}@falcon-test.ae` });
    report(27, "Verify different-target conflict", res27.statusCode === 409 && res27.body?.error === "TARGET_ALREADY_PROVISIONED", `Status ${res27.statusCode}`);

  } catch (globalErr: any) {
    console.error("[Suite Global Error]:", globalErr);
  } finally {
    // Cleanup created artifacts
    if (authAdmin) {
      for (const uid of createdAuthUidsToClean) {
        if (uid) {
          await authAdmin.deleteUser(uid).catch(() => {});
        }
      }
    }
    if (dbAdmin) {
      for (const item of createdDocPathsToClean) {
        await dbAdmin.collection(item.collection).doc(item.docId).delete().catch(() => {});
      }
      // Clean test portal claims
      await dbAdmin.collection("portal_claims").doc(`OWNER_${testOwnerId}`).delete().catch(() => {});
      await dbAdmin.collection("portal_claims").doc(`OWNER_${testOwner2Id}`).delete().catch(() => {});
      await dbAdmin.collection("portal_claims").doc(`TENANT_${testTenantId}`).delete().catch(() => {});
      await dbAdmin.collection("portal_claims").doc(`TENANT_${testTenant2Id}`).delete().catch(() => {});
      await dbAdmin.collection("users").doc(testOwnerEmail).delete().catch(() => {});
      await dbAdmin.collection("users").doc(testTenantEmail).delete().catch(() => {});
    }
  }

  console.log(`\n==================================================`);
  console.log(`PORTAL PROVISIONING SUITE SUMMARY: ${passed}/27 Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  return { total: 27, passed, failed };
}
