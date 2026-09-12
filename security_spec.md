# Emirates Falcon Real Estate ERP — Security Specifications (Step 2)

This specification defines the security invariants, threat matrix, and Firestore access parameters establishing Firestore as a secure boundary for the Emirates Falcon Real Estate ERP application.

---

## 1. Core Security Invariants & Role Hierarchy

Access control is strictly governed by the following roles retrieved from the trusted email-to-role lookup mapping (`/users_by_email/{email}`):

| Role Code | Title | Scope of Action |
| :--- | :--- | :--- |
| **`SYSTEM_OWNER`** | System Owner | complete master access, user creation/deactivation, setting overrides. |
| **`SUPER_ADMIN`** | Super Admin | Full operational and configuration access, except modifying System Owner. |
| **`MANAGER`** | Property Manager | Full operational and property management, except fiscal period configurations. |
| **`FINANCE`** | Chief Financial Officer | full financial ledger operations, reversals, bank batching, closing periods. |
| **`ACCOUNTANT`** | Accountant | Financial transaction recording, invoicing, and receipting. |
| **`COLLECTION_OFFICER`** | Collections Officer | Payment tracking, collection actions, and tenant promises. |
| **`LEGAL`** | Legal Counsel | Dispute cases, legal filings, and UAE court records. |
| **`PROPERTY_OWNER`** | Investor (External) | Read-only access restricted to owned properties, leases, and payouts. |
| **`TENANT`** | Tenant (External) | Read-only access restricted to own lease, cheques, receipts, and cases. |

---

## 2. ERP Data Invariants & Business Safeguards

1. **Email-Verified Identity Enforcement**: All standard database operations (except initial read on basic configurations) strictly mandate that the user is authenticated via standard Firebase Authentication and has their email verified (`request.auth.token.email_verified == true`).
2. **Delete Protection**: Critical financial, transaction, and legal collections (`leases`, `cheques`, `collections`, `deposit_batches`, `property_expenses`, `payment_allocations`, `owner_transfers`, `financial_reversals`, `financial_adjustments`, `deferred_payments`, `chart_of_accounts`, `journal_entries`, `period_certifications`) are strictly write-only/read-only and **protected against any client-side deletion** (`allow delete: if false;`). Reversals are recorded as auditable entries rather than destructive deletions.
3. **Immutability of Audit Trails**: ERP security audit records (`auditLogs`) are strictly write-once. They can be created by any authenticated user to log actions, but can never be modified, rewritten, or deleted under any circumstance (`allow update, delete: if false;`).
4. **Self-Escalation Prevention**: ERP users are strictly prohibited from editing critical roles, deactivating profiles, or changing privileges on their own profiles. Only the `SYSTEM_OWNER` is authorized to modify roles and permissions.
5. **Least Privilege Sandboxing**: External roles (`TENANT`, `PROPERTY_OWNER`) are strictly isolated. A tenant can only read records where the document's `tenantId` field matches their authenticated email address. An owner can only read records where `ownerId` matches their authenticated email address.

---

## 3. The "Dirty Dozen" Payload Threat Matrix

The following table documents twelve specific hostile payloads designed to breach system integrity, along with their corresponding security rules mitigation vectors:

| # | Threat Vector / Attack Payload | Affected Collection | Intended Exploit Outcome | Enforced Rules Mitigation |
| :-: | :--- | :--- | :--- | :--- |
| **1** | Unauthenticated Read / List Query | `/leases` | Leak corporate lease contracts to the public. | Reject immediately if `request.auth == null` or email not verified. |
| **2** | Self-Role Escalation Payload | `/users/{my_user_id}` | Edit self profile to change `role: "SYSTEM_OWNER"`. | Block updates targeting `role`, `isActive`, or `permissions` fields via `diff().affectedKeys()`. |
| **3** | Unauthorized User Creation | `/users/hacker_id` | Register a new user with `role: "SUPER_ADMIN"`. | Only allow creation if `isSystemOwner()` is `true`. |
| **4** | Destruction of Financial Cheque | `/cheques/{cheque_id}` | Delete a cheque document to cover up unpaid balances. | Strict `allow delete: if false;` protection on financial collections. |
| **5** | Fabricating Cash Receipts | `/collections/{receipt_id}` | Forge a rent payment receipt without authorization. | Restrict write access on `/collections` strictly to `isFinancial()`. |
| **6** | Tampering with Closed Quarters | `/financial_periods/{id}` | Edit closed financial years to adjust historical revenue. | Only allow writes to fiscal configurations to `isSystemOwner()`. |
| **7** | Rewrite Security History | `/auditLogs/{log_id}` | Update audit logs to remove evidence of unauthorized writes. | Complete immutability of audit logs (`allow update: if false;`). |
| **8** | Snooping on Other Tenants | `/leases/{other_lease_id}` | Read another tenant's lease terms and rent pricing. | Restrict reads to `isStaff()` or document `tenantId == auth.email`. |
| **9** | Modifying Legal Cases | `/cases/{case_id}` | Alter legal/court records to wipe out active lawsuits. | Restrict case writes strictly to internal `isStaff()`. |
| **10** | Forging Bank Deposit Batches | `/deposit_batches/{id}`| Tamper with bank transfer batches before clearing. | Restrict write access strictly to authorized `isFinancial()`. |
| **11** | Hijacking Owner Payouts | `/owner_transfers/{id}` | Direct rent payouts to a fraudulent bank account. | Restrict transfers creation/modification strictly to `isFinancial()`. |
| **12** | Overriding System Controls | `/settings/{id}` | Access and edit central ERP variables or API keys. | Restrict writes strictly to authorized `isSystemOwner()`. |

---

## 4. Verification Test Suite Outline

A comprehensive test suite verifying these rules can be structured using `@firebase/rules-unit-testing` matching the threat matrix above:

```typescript
// Example Spec: firestore.rules.test.ts
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";

let testEnv: RulesTestEnvironment;

describe("Emirates Falcon ERP Firestore Rules Verification", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "emirates-falcon-erp-fortress",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("1. Unauthenticated users cannot read leases", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, "leases/lease-101")));
  });

  test("2. Standard users cannot elevate their own role", async () => {
    const context = testEnv.authenticatedContext("usr-999", { email: "tenant@gmail.com", email_verified: true });
    const authDb = context.firestore();
    await assertFails(updateDoc(doc(authDb, "users/usr-999"), { role: "SYSTEM_OWNER" }));
  });

  test("3. Destructive deletion of cheques is blocked", async () => {
    const context = testEnv.authenticatedContext("usr-101", { email: "mahmoud@msn.com", email_verified: true });
    const authDb = context.firestore();
    await assertFails(deleteDoc(doc(authDb, "cheques/cheque-202")));
  });
});
```
