const fs = require('fs');

const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- SECURITY PRIMITIVES & IDENTITY ---
    
    // True if standard Firebase Auth token is present
    function isSignedIn() {
      return request.auth != null && request.auth.uid != null;
    }

    // Safely retrieves user role using their canonical UID lookup in Firestore
    function getUserRole() {
      if (!isSignedIn()) {
        return null;
      }
      return exists(/databases/$(database)/documents/users/$(request.auth.uid))
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('role', null)
        : null;
    }

    // System owner check
    function isSystemOwner() {
      return getUserRole() == 'SYSTEM_OWNER';
    }

    // Role hierarchies
    function isAdmin() {
      let role = getUserRole();
      return role == 'SYSTEM_OWNER' || role == 'SUPER_ADMIN' || role == 'MANAGER' || role == 'ADMINISTRATOR' || role == 'ADMIN';
    }

    function isFinancial() {
      let role = getUserRole();
      return isAdmin() || role == 'FINANCE' || role == 'ACCOUNTANT' || role == 'COLLECTION_OFFICER';
    }

    function isStaff() {
      let role = getUserRole();
      return role != null && 
             role != 'PROPERTY_OWNER' && 
             role != 'OWNER' && 
             role != 'TENANT' && 
             role != 'GUEST';
    }

    // Owner and Tenant record-level ownership checks (IDOR/BOLA protections)
    function isPropertyOwner(ownerId) {
      return isSignedIn() && ownerId != null && 
        exists(/databases/$(database)/documents/owners/$(ownerId)) &&
        get(/databases/$(database)/documents/owners/$(ownerId)).data.get('firebaseUid', '') == request.auth.uid;
    }

    function isTenantUser(tenantId) {
      return isSignedIn() && tenantId != null && 
        exists(/databases/$(database)/documents/tenants/$(tenantId)) &&
        get(/databases/$(database)/documents/tenants/$(tenantId)).data.get('firebaseUid', '') == request.auth.uid;
    }

    // --- DEFAULT DENY (CATCH-ALL) ---
    // Deny all operations by default on any undefined collections or paths
    match /{document=**} {
      allow read, write: if false;
    }

    // --- SPECIFIC COLLECTION RULES ---

    // 1. User profiles master list
    match /users/{userId} {
      allow read: if isStaff() || (isSignedIn() && request.auth.uid == userId);
      allow create: if isSystemOwner() || isAdmin() || (
        isSignedIn() && request.auth.uid == userId && 
        (!('role' in request.resource.data) || request.resource.data.role == 'TENANT' || request.resource.data.role == 'OWNER' || request.resource.data.role == 'GUEST')
      );
      allow update: if isSystemOwner() || (
        isAdmin() && resource.data.get('role', '') != 'SYSTEM_OWNER' && request.resource.data.get('role', '') != 'SYSTEM_OWNER'
      ) || (
        isSignedIn() && 
        request.auth.uid == userId && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isActive', 'permissions', 'email', 'id', 'firebaseUid', 'ownerId', 'tenantId', 'mustChangePassword', 'isFirstLoginCompleted'])
      );
      allow delete: if isSystemOwner();
    }

    // 2. Email-to-Role safe mapping table
    match /users_by_email/{email} {
      // Users can only read their own, staff can read all
      allow read: if isStaff() || (isSignedIn() && request.auth.token.email != null && email == request.auth.token.email);
      // Only admins can write, but they shouldn't use it as the source of truth anyway
      allow create, update: if isSystemOwner() || isAdmin();
      allow delete: if isSystemOwner();
    }

    // 3. Granular overrides
    match /userPermissionOverrides/{overrideId} {
      allow read: if isStaff();
      allow write: if isSystemOwner();
    }

    // 4. Properties configuration
    match /properties/{propId} {
      allow read: if isStaff() || (isSignedIn() && (
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow create: if isStaff();
      allow update: if isStaff() && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId']);
      allow delete: if isSystemOwner();
    }

    // 5. Units directory
    match /units/{unitId} {
      allow read: if isStaff() || (isSignedIn() && (
        isPropertyOwner(resource.data.get('ownerId', '')) || 
        isTenantUser(resource.data.get('tenantId', ''))
      ));
      allow write: if isStaff();
      allow delete: if isAdmin();
    }

    // 6. Tenant accounts directory
    match /tenants/{tenantId} {
      allow read: if isStaff() || isTenantUser(tenantId);
      allow create: if isStaff();
      allow update: if isStaff() || (
        isTenantUser(tenantId) && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['email', 'portalEmail', 'firebaseUid', 'status', 'id'])
      );
      allow delete: if isSystemOwner();
    }

    // 7. Lease contracts (legal obligations)
    match /contracts/{contractId} {
      allow read: if isStaff() || (isSignedIn() && (
        isTenantUser(resource.data.get('tenantId', '')) || 
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow write: if isStaff();
      allow delete: if isAdmin();
    }

    // 8. Cheques inventory
    match /cheques/{chequeId} {
      allow read: if isStaff() || (isSignedIn() && (
        isTenantUser(resource.data.get('tenantId', '')) || 
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow write: if isFinancial();
      allow delete: if isSystemOwner();
    }

    // 9. Payment transactions (cash/transfers)
    match /payments/{paymentId} {
      allow read: if isStaff() || (isSignedIn() && (
        isTenantUser(resource.data.get('tenantId', '')) || 
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow write: if isFinancial();
      allow delete: if isSystemOwner();
    }

    // 10. Property operational expenses
    match /expenses/{expenseId} {
      allow read: if isStaff() || (isSignedIn() && (
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow write: if isFinancial();
      allow delete: if isSystemOwner();
    }

    // 11. Custom payment categories lists
    match /payment_categories/{catId} {
      allow read: if isSignedIn();
      allow write: if isFinancial();
      allow delete: if isSystemOwner();
    }

    match /expense_categories/{catId} {
      allow read: if isSignedIn();
      allow write: if isFinancial();
      allow delete: if isSystemOwner();
    }

    // 12. App parameters
    match /app_settings/{settingId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
    }

    // 13. System electronic archive
    match /archive/{archiveId} {
      allow read: if isStaff() || (isSignedIn() && (
        resource.data.get('uploadedBy', '') == request.auth.uid || 
        isTenantUser(resource.data.get('tenantId', '')) || 
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow create: if isStaff() || (isSignedIn() && request.resource.data.get('uploadedBy', '') == request.auth.uid);
      allow update: if isStaff() || (isSignedIn() && resource.data.get('uploadedBy', '') == request.auth.uid && request.resource.data.get('uploadedBy', '') == request.auth.uid);
      allow delete: if isStaff();
    }

    // 14. Real-time notifications
    match /notifications/{notificationId} {
      allow read: if isStaff() || (isSignedIn() && (
        resource.data.get('userId', '') == request.auth.uid
      ));
      allow create: if isStaff() || (isSignedIn() && request.resource.data.get('userId', '') == request.auth.uid);
      allow update: if isStaff() || (isSignedIn() && resource.data.get('userId', '') == request.auth.uid);
      allow delete: if isStaff();
    }

    // 15. Team communications
    match /operational_communications/{commId} {
      allow read, write: if isStaff();
      allow delete: if isAdmin();
    }

    // 16. Dynamic payment ledger allocations
    match /payment_allocations/{allocationId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 17. Property owners master database
    match /owners/{ownerId} {
      allow read: if isStaff() || isPropertyOwner(ownerId);
      allow write: if isStaff();
      allow delete: if false; // Delete protected
    }

    // 18. Payout owner transfers
    match /owner_transfers/{transferId} {
      allow read: if isStaff() || (isSignedIn() && (
        isPropertyOwner(resource.data.get('ownerId', ''))
      ));
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 19. Auditable receipts/payment reversals
    match /financial_reversals/{reversalId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 20. Manual accounting ledger adjustments
    match /financial_adjustments/{adjId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 21. Defining active financial fiscal quarters/years
    match /financial_periods/{periodId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
      allow delete: if false; // Delete protected
    }

    // 22. Brokerage/management commissions
    match /commissions/{commId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 23. Tax VAT configurations
    match /vat_rates/{rateId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
      allow delete: if false; // Delete protected
    }
    match /vatRates/{rateId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
      allow delete: if false; // Delete protected
    }

    // 24. Office petty cash months
    match /office_petty_cash_months/{monthId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 25. Specific petty cash expense items
    match /office_petty_cash_expenses/{expenseId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 26. Configuration of petty cash categories
    match /office_petty_cash_categories/{categoryId} {
      allow read: if isSignedIn();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 27. Immutable past years statements historical records
    match /historicalRecords/{recordId} {
      allow read: if isStaff();
      allow write: if isSystemOwner();
      allow delete: if false; // Delete protected
    }

    // 28. Service maintenance requests
    match /maintenance_requests/{reqId} {
      allow read: if isStaff() || (isSignedIn() && (
        isTenantUser(resource.data.get('tenantId', '')) || 
        isPropertyOwner(resource.data.get('ownerId', '')) ||
        resource.data.get('createdBy', '') == request.auth.uid
      ));
      allow create: if isSignedIn();
      allow update: if isStaff() || (isSignedIn() && (
        isTenantUser(resource.data.get('tenantId', '')) || 
        resource.data.get('createdBy', '') == request.auth.uid
      ) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId', 'tenantId', 'propertyId']));
      allow delete: if isStaff();
    }

    // 29. Maintenance technicians directories
    match /technicians/{techId} {
      allow read: if isSignedIn();
      allow write: if isStaff();
      allow delete: if isAdmin();
    }

    // 30. Collections department action log
    match /collection_actions/{actionId} {
      allow read, write: if isStaff();
      allow delete: if isAdmin();
    }

    // 31. Tenant commitments payment promises
    match /payment_promises/{promiseId} {
      allow read, write: if isStaff();
      allow delete: if isAdmin();
    }

    // 32. Contract renewal drafts and negotiations
    match /lease_renewals/{renewalId} {
      allow read, write: if isStaff();
      allow delete: if isAdmin();
    }

    // 33. Deferred payments installments
    match /deferred_payments/{deferredId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 34. Double-entry chart of accounts Setup
    match /chart_of_accounts/{coaId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 35. Double-entry journal transaction ledger entries
    match /journal_entries/{journalId} {
      allow read: if isStaff();
      allow write: if isFinancial();
      allow delete: if false; // Delete protected
    }

    // 36. ERP security audit trails (strictly immutable: create only, no updates or deletes)
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isStaff(); // Staff can append logs
      allow update, delete: if false;
    }

    // 37. Draggable UI layouts config
    match /form_layouts/{formId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // 38. Hard closing fiscal years certifications
    match /period_certifications/{certId} {
      allow read: if isStaff();
      allow write: if isSystemOwner();
      allow delete: if false; // Delete protected
    }

    // 39. SMTP/API keys/global parameters Settings (Admin only)
    match /settings/{settingId} {
      allow read: if isAdmin();
      allow write: if isSystemOwner();
    }

    // 40. Tenant dynamic risk configuration parameters
    match /risk_config/{configId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
    }

    // 41. ERP system backups history
    match /system_backups/{backupId} {
      allow read, write: if isSystemOwner();
    }

    // 42. Registered trade legal profile
    match /company_profile/{profileId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
    }

    // 43. System sequence counters & idempotency locks
    match /system_counters/{counterId} {
      allow read, write: if isStaff();
    }
    match /idempotency_locks/{lockId} {
      allow read, write: if isStaff();
    }

    // 44. Real-time system health ping
    match /_system_health/{docId} {
      allow read: if isSignedIn();
      allow write: if isSystemOwner();
    }
  }
}
`;

fs.writeFileSync('firestore.rules', rules);
console.log("Updated firestore.rules");
