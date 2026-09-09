import { NotificationRecord, OperationalCommunicationRecord } from "../types";

/**
 * Utility functions enforcing strict scoping and authorization for Portal Notifications & Communications.
 * ERP Internal alerts (such as Administrative Fees, internal financial alerts, accounting logs,
 * staff reminders, and system workflows) MUST NOT be exposed inside Owner or Tenant portals.
 */

// Patterns indicating internal ERP content or Administrative Fees that must NEVER be surfaced in portals
const INTERNAL_DISALLOWED_PATTERNS = [
  /رسوم\s*إداري/i,
  /admin(istrative)?\s*fee/i,
  /internal\s*(alert|financial|accounting|workflow|system|staff)/i,
  /قيد\s*يومي/i,
  /تسوية\s*محاسبي/i,
  /إقفال\s*مالي/i,
  /forensic/i,
  /audit\s*log/i,
  /مراجعة\s*داخلية/i,
  /مذكرة\s*داخلية/i,
  /staff\s*reminder/i,
  /employee/i,
];

/**
 * Checks if a text contains any internal-only or administrative fee keywords.
 */
export function containsInternalOrAdminFeeContent(text?: string): boolean {
  if (!text) return false;
  return INTERNAL_DISALLOWED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Authorizes a notification for display in the Owner Portal.
 * Enforces strict ownership verification and disallows any ERP internal alerts.
 */
export function isAuthorizedForOwnerPortal(
  notification: NotificationRecord,
  ownerId: string,
  ownerPhone?: string
): boolean {
  if (!notification || !ownerId) return false;

  // 1. Explicit internal-only flag or non-portal visibility
  if (notification.scope === "INTERNAL_ONLY" || notification.isPortalVisible === false) {
    return false;
  }

  // 2. Prohibit administrative fees and internal ERP alerts
  const combinedText = `${notification.type || ""} ${notification.content || ""} ${notification.message || ""}`;
  if (containsInternalOrAdminFeeContent(combinedText)) {
    return false;
  }

  // 3. Prohibit internal non-owner notification types
  const notifType = String(notification.type || "").toUpperCase();
  if (
    notifType.includes("ADMIN_FEE") ||
    notifType.includes("INTERNAL") ||
    notifType.includes("STAFF") ||
    notifType.includes("AUDIT") ||
    notifType.includes("RECONCILIATION") ||
    notifType.includes("FORENSIC") ||
    notifType.includes("PERIOD_CLOSE") ||
    notifType.includes("PETTY_CASH")
  ) {
    return false;
  }

  // 4. Verify association with this specific owner
  const matchesOwnerId = notification.ownerId === ownerId;
  const matchesPhone = Boolean(
    ownerPhone &&
      (notification.recipientPhone === ownerPhone ||
        notification.recipient === ownerPhone ||
        (notification.recipientPhone &&
          ownerPhone.replace(/\D/g, "").endsWith(notification.recipientPhone.replace(/\D/g, "").slice(-8))))
  );

  return matchesOwnerId || matchesPhone;
}

/**
 * Authorizes a notification for display in the Tenant Portal.
 * Enforces strict tenancy verification and disallows any ERP internal alerts.
 */
export function isAuthorizedForTenantPortal(
  notification: NotificationRecord,
  tenantId: string,
  tenantPhone?: string
): boolean {
  if (!notification || !tenantId) return false;

  // 1. Explicit internal-only flag or non-portal visibility
  if (notification.scope === "INTERNAL_ONLY" || notification.isPortalVisible === false) {
    return false;
  }

  // 2. Prohibit administrative fees and internal ERP alerts
  const combinedText = `${notification.type || ""} ${notification.content || ""} ${notification.message || ""}`;
  if (containsInternalOrAdminFeeContent(combinedText)) {
    return false;
  }

  // 3. Prohibit internal system notification types
  const notifType = String(notification.type || "").toUpperCase();
  if (
    notifType.includes("ADMIN_FEE") ||
    notifType.includes("INTERNAL") ||
    notifType.includes("STAFF") ||
    notifType.includes("AUDIT") ||
    notifType.includes("RECONCILIATION") ||
    notifType.includes("FORENSIC") ||
    notifType.includes("PERIOD_CLOSE") ||
    notifType.includes("PETTY_CASH")
  ) {
    return false;
  }

  // 4. Verify association with this specific tenant
  const matchesTenantId = notification.tenantId === tenantId;
  const matchesPhone = Boolean(
    tenantPhone &&
      (notification.recipientPhone === tenantPhone ||
        notification.recipient === tenantPhone ||
        (notification.recipientPhone &&
          tenantPhone.replace(/\D/g, "").endsWith(notification.recipientPhone.replace(/\D/g, "").slice(-8))))
  );

  return matchesTenantId || matchesPhone;
}

/**
 * Filters operational communications strictly authorized for the Owner Portal.
 */
export function filterOwnerPortalCommunications(
  communications: OperationalCommunicationRecord[],
  ownerId: string
): OperationalCommunicationRecord[] {
  if (!Array.isArray(communications) || !ownerId) return [];

  return communications.filter((comm) => {
    // 1. Exclude internal communications
    if (comm.direction === "INTERNAL" || comm.scope === "INTERNAL_ONLY" || comm.isPortalVisible === false) {
      return false;
    }

    // 2. Exclude administrative fee and internal workflow texts
    const text = `${comm.subject || ""} ${comm.messageSummary || ""} ${comm.body || ""}`;
    if (containsInternalOrAdminFeeContent(text)) {
      return false;
    }

    // 3. Must be associated with this owner
    return comm.ownerId === ownerId || comm.recipientId === ownerId || comm.senderId === ownerId;
  });
}

/**
 * Filters operational communications strictly authorized for the Tenant Portal.
 */
export function filterTenantPortalCommunications(
  communications: OperationalCommunicationRecord[],
  tenantId: string
): OperationalCommunicationRecord[] {
  if (!Array.isArray(communications) || !tenantId) return [];

  return communications.filter((comm) => {
    // 1. Exclude internal communications
    if (comm.direction === "INTERNAL" || comm.scope === "INTERNAL_ONLY" || comm.isPortalVisible === false) {
      return false;
    }

    // 2. Exclude administrative fee and internal workflow texts
    const text = `${comm.subject || ""} ${comm.messageSummary || ""} ${comm.body || ""}`;
    if (containsInternalOrAdminFeeContent(text)) {
      return false;
    }

    // 3. Must be associated with this tenant
    return comm.tenantId === tenantId || comm.recipientId === tenantId || comm.senderId === tenantId;
  });
}
