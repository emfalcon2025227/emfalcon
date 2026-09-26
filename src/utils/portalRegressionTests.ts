import { getOwnerPortalLoginUrl, getTenantPortalLoginUrl } from "../services/portalProvisioningService";

export function runPortalRegressionTests(): { success: boolean; results: { name: string; passed: boolean; message: string }[] } {
  const results = [];
  const testBase = "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";

  // Test 1: Owner Email URL
  const ownerUrl = getOwnerPortalLoginUrl(testBase);
  const ownerPassed = Boolean(
    ownerUrl &&
    ownerUrl.includes("#owner-login") &&
    !ownerUrl.includes("localhost") &&
    !ownerUrl.includes("127.0.0.1") &&
    !ownerUrl.includes("dashboard")
  );
  results.push({
    name: "Test 1 — Owner Email Portal Login URL",
    passed: ownerPassed,
    message: ownerPassed ? `Generated correct Owner URL: ${ownerUrl}` : `Invalid Owner URL: ${ownerUrl}`,
  });

  // Test 2: Tenant Email URL
  const tenantUrl = getTenantPortalLoginUrl(testBase);
  const tenantPassed = Boolean(
    tenantUrl &&
    tenantUrl.includes("#tenant-login") &&
    !tenantUrl.includes("localhost") &&
    !tenantUrl.includes("127.0.0.1") &&
    !tenantUrl.includes("dashboard")
  );
  results.push({
    name: "Test 2 — Tenant Email Portal Login URL",
    passed: tenantPassed,
    message: tenantPassed ? `Generated correct Tenant URL: ${tenantUrl}` : `Invalid Tenant URL: ${tenantUrl}`,
  });

  // Test 3: Owner URL ≠ Tenant URL & Separation
  const separationPassed = ownerUrl !== tenantUrl && !ownerUrl.includes("tenant") && !tenantUrl.includes("owner");
  results.push({
    name: "Test 3 — Owner / Tenant URL Separation",
    passed: separationPassed,
    message: separationPassed ? "Owner and Tenant URLs are strictly separated and distinct." : "URL separation failure.",
  });

  // Test 4: No Direct Dashboard Links in Email URLs
  const noDashboardPassed = !ownerUrl.includes("dashboard") && !tenantUrl.includes("dashboard");
  results.push({
    name: "Test 4 — No Direct Dashboard Links",
    passed: noDashboardPassed,
    message: noDashboardPassed ? "Portal links correctly point to login pages rather than dashboards." : "Dashboard link found in portal URL.",
  });

  // Test 5: Production Base URL Check
  const productionUrlPassed = !ownerUrl.includes("localhost") && !tenantUrl.includes("localhost");
  results.push({
    name: "Test 5 — Production Base URL Compliance",
    passed: productionUrlPassed,
    message: productionUrlPassed ? "URLs use production-accessible base URL." : "Localhost detected in production URL.",
  });

  const allPassed = results.every((r) => r.passed);
  console.log(`[Portal Regression Tests] Result: ${allPassed ? "PASSED" : "FAILED"}`, results);
  return { success: allPassed, results };
}
