import { Lease, Tenant, User } from "../types";

/**
 * Resolves the authoritative Tenant record for an authenticated user.
 * Combines tenantId matching, email matching, phone matching, and ID matching.
 */
export function resolveTenantForUser(currentUser: User | null, tenants: Tenant[]): Tenant | null {
  if (!currentUser) return null;

  // 1. Direct tenantId match
  if (currentUser.tenantId) {
    const found = tenants.find(t => t.id === currentUser.tenantId);
    if (found) return found;
  }

  // 2. Email match
  if (currentUser.email) {
    const cleanEmail = currentUser.email.trim().toLowerCase();
    const foundByEmail = tenants.find(t => t.email && t.email.trim().toLowerCase() === cleanEmail);
    if (foundByEmail) return foundByEmail;
  }

  // 3. Phone match
  if (currentUser.phone) {
    const cleanPhone = currentUser.phone.trim();
    const foundByPhone = tenants.find(t => t.phone && t.phone.trim() === cleanPhone);
    if (foundByPhone) return foundByPhone;
  }

  // 4. User ID match
  if (currentUser.id) {
    const foundById = tenants.find(t => t.id === currentUser.id);
    if (foundById) return foundById;
  }

  // 5. Name match fallback
  if (currentUser.nameEn || currentUser.nameAr) {
    const foundByName = tenants.find(t => 
      (currentUser.nameEn && t.nameEn && t.nameEn.toLowerCase() === currentUser.nameEn.toLowerCase()) ||
      (currentUser.nameAr && t.nameAr && t.nameAr === currentUser.nameAr)
    );
    if (foundByName) return foundByName;
  }

  return null;
}

/**
 * Retrieves all currently active contracts belonging to the tenant.
 * Uses authoritative ERP business rules:
 * - Matches tenantId.
 * - Status is occupying (not TERMINATED, not CANCELLED, not EXPIRED).
 * - Handles statuses like ACTIVE, RENEWED, UNDER_RENEWAL, PENDING, PENDING_APPROVAL, DRAFT, PENDING_AUDIT.
 * - Handles date validation if applicable.
 */
export function getActiveTenantLeases(tenantId: string, leases: Lease[]): Lease[] {
  if (!tenantId) return [];

  const tenantLeases = leases.filter(l => l.tenantId === tenantId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tenantLeases.filter(l => {
    const status = (l.contractStatus || "ACTIVE").toUpperCase().trim();

    // Explicitly non-active statuses
    if (status === "TERMINATED" || status === "CANCELLED" || status === "EXPIRED") {
      return false;
    }

    // Check date validity if end date exists
    if (l.endDate) {
      const end = new Date(l.endDate);
      end.setHours(23, 59, 59, 999);
      if (!isNaN(end.getTime()) && end < today && status !== "ACTIVE" && status !== "RENEWED" && status !== "UNDER_RENEWAL") {
        return false;
      }
    }

    // Occupying active statuses
    return (
      status === "ACTIVE" ||
      status === "RENEWED" ||
      status === "UNDER_RENEWAL" ||
      status === "PENDING" ||
      status === "PENDING_APPROVAL" ||
      status === "DRAFT" ||
      status === "PENDING_AUDIT"
    );
  });
}
