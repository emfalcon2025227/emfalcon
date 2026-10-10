/**
 * Portal Provisioning HTTP Integration Suite.
 * Exercises the actual Express route, Firebase ID-token middleware,
 * active-account enforcement, RBAC middleware, production handler, and
 * Firebase Auth/Firestore Emulator side effects. Never targets production.
 */
import { createServer, type Server } from "node:http";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const TEST_PROJECT_ID = process.env.PORTAL_PROVISIONING_TEST_PROJECT_ID?.trim();
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim();

if (!TEST_PROJECT_ID || TEST_PROJECT_ID === firebaseConfig.projectId || !AUTH_EMULATOR_HOST || !FIRESTORE_EMULATOR_HOST) {
  throw new Error("PORTAL_HTTP_TEST_BLOCKED: isolated Firebase Auth and Firestore Emulator settings are required.");
}

type Caller = { uid: string; email: string; password: string; role: string; isActive: boolean };

export async function runPortalProvisioningHttpIntegritySuite() {
  const adminApp = initializeAdminApp({ projectId: TEST_PROJECT_ID }, "portal-http-admin-" + Date.now());
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getAdminFirestore(adminApp);

  const clientApp = initializeClientApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: TEST_PROJECT_ID,
  }, "portal-http-client-" + Date.now());
  const clientAuth = getAuth(clientApp);
  connectAuthEmulator(clientAuth, "http://" + AUTH_EMULATOR_HOST, { disableWarnings: true });

  const callers: Caller[] = [];
  const createdPortalUids: string[] = [];
  const createdTargetDocs: Array<{ collection: string; id: string }> = [];
  const createdUserProfiles: string[] = [];
  let httpServer: Server | null = null;
  let passed = 0;
  let failed = 0;
  const results: Array<{ id: number; title: string; passed: boolean; details: string }> = [];

  const report = (id: number, title: string, ok: boolean, details: string) => {
    results.push({ id, title, passed: ok, details });
    if (ok) passed++;
    else failed++;
    console.log("[" + (ok ? "PASS" : "FAIL") + "] Portal HTTP " + id + ": " + title + " — " + details);
  };

  const createCaller = async (role: string, isActive: boolean): Promise<Caller> => {
    const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const caller: Caller = {
      uid: "portal-http-caller-" + suffix,
      email: "portal-http-caller-" + suffix + "@falcon-test.ae",
      password: "PortalHttpTest!2026",
      role,
      isActive,
    };
    await adminAuth.createUser({ uid: caller.uid, email: caller.email, password: caller.password, emailVerified: true });
    await adminDb.collection("users").doc(caller.uid).set({
      id: caller.uid,
      firebaseUid: caller.uid,
      email: caller.email,
      role: caller.role,
      isActive: caller.isActive,
      disabled: !caller.isActive,
      nameAr: "اختبار تكامل البوابة",
      nameEn: "Portal HTTP Integration Test",
    });
    callers.push(caller);
    createdUserProfiles.push(caller.uid);
    return caller;
  };

  const tokenFor = async (caller: Caller) => {
    await signOut(clientAuth).catch(() => {});
    const credential = await signInWithEmailAndPassword(clientAuth, caller.email, caller.password);
    return credential.user.getIdToken(true);
  };

  const post = async (url: string, body: unknown, token?: string) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token !== undefined) headers.authorization = "Bearer " + token;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };

  try {
    const stamp = Date.now();
    const ownerId = "portal-http-owner-" + stamp;
    const tenantId = "portal-http-tenant-" + stamp;
    const ownerEmail = "portal-http-owner-" + stamp + "@falcon-test.ae";
    const tenantEmail = "portal-http-tenant-" + stamp + "@falcon-test.ae";

    await adminDb.collection("owners").doc(ownerId).set({ id: ownerId, nameEn: "HTTP Test Owner", nameAr: "مالك اختبار HTTP", isActive: true });
    await adminDb.collection("tenants").doc(tenantId).set({ id: tenantId, nameEn: "HTTP Test Tenant", nameAr: "مستأجر اختبار HTTP", isActive: true });
    createdTargetDocs.push({ collection: "owners", id: ownerId }, { collection: "tenants", id: tenantId });

    // Initialize the production Express application only after the isolated Admin app exists.
    const { app } = await import("../../server");
    httpServer = createServer(app);
    await new Promise<void>((resolve, reject) => {
      httpServer!.once("error", reject);
      httpServer!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Could not resolve ephemeral HTTP test port.");
    const endpoint = "http://127.0.0.1:" + address.port + "/api/auth/provision-portal-user";

    // 1. Actual route rejects requests without a bearer token.
    const missingToken = await post(endpoint, { portalRole: "OWNER", targetId: ownerId, email: ownerEmail });
    report(1, "Missing token is rejected by authentication middleware", missingToken.status === 401, "status=" + missingToken.status);

    // 2. Actual route rejects an invalid Firebase ID token.
    const invalidToken = await post(endpoint, { portalRole: "OWNER", targetId: ownerId, email: ownerEmail }, "not-a-valid-firebase-id-token");
    report(2, "Invalid token is rejected by Firebase middleware", invalidToken.status === 401, "status=" + invalidToken.status);

    const systemOwner = await createCaller("SYSTEM_OWNER", true);
    const ownerToken = await tokenFor(systemOwner);

    // 3. Active System Owner traverses middleware and production handler successfully.
    const ownerProvision = await post(endpoint, { portalRole: "OWNER", targetId: ownerId, email: ownerEmail, nameEn: "HTTP Portal Owner" }, ownerToken);
    if (ownerProvision.body?.user?.id) createdPortalUids.push(ownerProvision.body.user.id);
    report(3, "Active System Owner can provision an Owner portal through HTTP", ownerProvision.status === 200 && ownerProvision.body?.success === true && ownerProvision.body?.user?.ownerId === ownerId, "status=" + ownerProvision.status + ", error=" + (ownerProvision.body?.error || "none"));

    // 4. Non-admin staff identity cannot traverse user-management middleware.
    const employee = await createCaller("EMPLOYEE", true);
    const employeeToken = await tokenFor(employee);
    const employeeAttempt = await post(endpoint, { portalRole: "OWNER", targetId: ownerId, email: "blocked-employee-" + stamp + "@falcon-test.ae" }, employeeToken);
    report(4, "Employee is blocked by user-management RBAC middleware", employeeAttempt.status === 403 && employeeAttempt.body?.error === "USER_MANAGEMENT_ADMIN_REQUIRED", "status=" + employeeAttempt.status + ", error=" + employeeAttempt.body?.error);

    // 5. Disabled admin must be blocked before the provisioning handler executes.
    const disabledAdmin = await createCaller("SYSTEM_OWNER", false);
    const disabledToken = await tokenFor(disabledAdmin);
    const disabledAttempt = await post(endpoint, { portalRole: "OWNER", targetId: ownerId, email: "blocked-disabled-" + stamp + "@falcon-test.ae" }, disabledToken);
    report(5, "Disabled System Owner is blocked by active-account middleware", disabledAttempt.status === 403 && disabledAttempt.body?.error === "ACCOUNT_DISABLED", "status=" + disabledAttempt.status + ", error=" + disabledAttempt.body?.error);

    // 6. Active System Owner can provision a Tenant portal through the same real HTTP route.
    const tenantProvision = await post(endpoint, { portalRole: "TENANT", targetId: tenantId, email: tenantEmail, nameEn: "HTTP Portal Tenant" }, ownerToken);
    if (tenantProvision.body?.user?.id) createdPortalUids.push(tenantProvision.body.user.id);
    report(6, "Active System Owner can provision a Tenant portal through HTTP", tenantProvision.status === 200 && tenantProvision.body?.success === true && tenantProvision.body?.user?.tenantId === tenantId, "status=" + tenantProvision.status + ", error=" + (tenantProvision.body?.error || "none"));

    // 7. Authenticated admin still cannot supply an unsupported portal role.
    const invalidRole = await post(endpoint, { portalRole: "SUPER_ADMIN", targetId: ownerId, email: "invalid-role-" + stamp + "@falcon-test.ae" }, ownerToken);
    report(7, "Unsupported portal role is rejected by production handler", invalidRole.status === 400 && invalidRole.body?.error === "INVALID_PORTAL_ROLE", "status=" + invalidRole.status + ", error=" + invalidRole.body?.error);

    // 8. Verify actual Firestore bindings persisted by the production route.
    const ownerProfile = ownerProvision.body?.user?.id ? await adminDb.collection("users").doc(ownerProvision.body.user.id).get() : null;
    const tenantProfile = tenantProvision.body?.user?.id ? await adminDb.collection("users").doc(tenantProvision.body.user.id).get() : null;
    report(8, "HTTP provisioning persists correct authoritative profile bindings",
      ownerProfile?.data()?.ownerId === ownerId && ownerProfile?.data()?.role === "OWNER" &&
      tenantProfile?.data()?.tenantId === tenantId && tenantProfile?.data()?.role === "TENANT",
      "ownerBinding=" + (ownerProfile?.data()?.ownerId || "missing") + ", tenantBinding=" + (tenantProfile?.data()?.tenantId || "missing"));

    console.log("PORTAL PROVISIONING HTTP INTEGRITY: " + passed + "/8 PASSED, " + failed + " FAILED");
    return { total: 8, passed, failed, results };
  } finally {
    if (httpServer) await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    await signOut(clientAuth).catch(() => {});
    for (const uid of createdPortalUids) await adminAuth.deleteUser(uid).catch(() => {});
    for (const uid of createdUserProfiles) await adminDb.collection("users").doc(uid).delete().catch(() => {});
    for (const caller of callers) await adminAuth.deleteUser(caller.uid).catch(() => {});
    for (const target of createdTargetDocs) await adminDb.collection(target.collection).doc(target.id).delete().catch(() => {});
    for (const targetId of createdTargetDocs.filter((d) => d.collection === "owners").map((d) => d.id)) {
      await adminDb.collection("portal_claims").doc("OWNER_" + targetId).delete().catch(() => {});
    }
    for (const targetId of createdTargetDocs.filter((d) => d.collection === "tenants").map((d) => d.id)) {
      await adminDb.collection("portal_claims").doc("TENANT_" + targetId).delete().catch(() => {});
    }
    await deleteClientApp(clientApp).catch(() => {});
    await deleteAdminApp(adminApp).catch(() => {});
  }
}

if (process.argv.some((arg) => arg.endsWith("portalProvisioningHttpIntegritySuite.ts"))) {
  runPortalProvisioningHttpIntegritySuite()
    .then((result) => {
      if (result.failed !== 0 || result.passed !== result.total) process.exit(1);
      // server.ts imports dependencies that may keep Node's event loop alive.
      // The suite has completed cleanup in its finally block, so terminate the
      // isolated test process explicitly to prevent a false CI timeout/cancel.
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
