import { User, Owner, Tenant, PortalAccountStatus } from "../types";
import { authenticatedFetch } from "../utils/apiClient";

/**
 * Centralized Owner Portal Login URL generator.
 * Must point to the Owner Login Page, never the dashboard directly.
 */
export const getOwnerPortalLoginUrl = (customBaseUrl?: string): string => {
  const base = customBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app");
  return `${base}/#owner-login`;
};

/**
 * Centralized Tenant Portal Login URL generator.
 * Must point to the Tenant Login Page, never the dashboard directly.
 */
export const getTenantPortalLoginUrl = (customBaseUrl?: string): string => {
  const base = customBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app");
  return `${base}/#tenant-login`;
};

/**
 * Validates if a string is a valid email address.
 */
export const isValidEmail = (email?: string): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 5) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(clean);
};

/**
 * Generates an initial temporary password from the person's name.
 * Example: "Ahmed Mohamed" -> "Ahmed@123"
 */

export interface ProvisionParams {
  portalRole: "OWNER" | "TENANT";
  targetId: string;
  email: string;
  nameEn: string;
  nameAr: string;
  phone?: string;
  existingUsers: User[];
  saveUser: (user: User) => void;
  logAudit?: (action: string, entityType: string, entityId: string, entityName: string, message: string) => void;
}

export interface ProvisionResult {
  status: PortalAccountStatus;
  user?: User;
  message?: string;
  isNew?: boolean;
}

/**
 * Automatically provisions or updates a Portal Account for an Owner or Tenant.
 */

// Local fallback provision is disabled in favor of unified server API.
// Use provisionPortalAccount from AuthContext directly.


export interface PortalAccountDisplayInfo {
  status: PortalAccountStatus;
  username: string;
  email: string;
  lastLogin: string | null;
  isFirstLoginCompleted: boolean;
  mustChangePassword: boolean;
  user: User | null;
  statusLabelAr: string;
  statusLabelEn: string;
  statusColorClass: string;
}

/**
 * Retrieves displayable information and status for an Owner or Tenant portal account.
 */
export const getPortalAccountInfo = (
  targetId: string,
  portalRole: "OWNER" | "TENANT",
  email: string | undefined,
  users: User[]
): PortalAccountDisplayInfo => {
  if (!isValidEmail(email)) {
    return {
      status: "NOT_PROVISIONED",
      username: "غير متوفر",
      email: email || "",
      lastLogin: null,
      isFirstLoginCompleted: false,
      mustChangePassword: false,
      user: null,
      statusLabelAr: "غير متوفر - يلزم إدخال بريد إلكتروني",
      statusLabelEn: "Not Provisioned (Email Required)",
      statusColorClass: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  const cleanEmail = (email || "").trim().toLowerCase();

  const user = users.find((u) => {
    if (portalRole === "OWNER") {
      return u.ownerId === targetId || ((u.email || "").trim().toLowerCase() === cleanEmail && (u.role === "OWNER" || u.role === "PROPERTY_OWNER"));
    } else {
      return u.tenantId === targetId || ((u.email || "").trim().toLowerCase() === cleanEmail && u.role === "TENANT");
    }
  });

  if (!user) {
    return {
      status: "NOT_PROVISIONED",
      username: cleanEmail,
      email: cleanEmail,
      lastLogin: null,
      isFirstLoginCompleted: false,
      mustChangePassword: false,
      user: null,
      statusLabelAr: "غير مفعّل - جاهز للإنشاء الآلي",
      statusLabelEn: "Not Provisioned - Ready for Auto Creation",
      statusColorClass: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  if (!user.isActive) {
    return {
      status: "SUSPENDED",
      username: user.username,
      email: user.email,
      lastLogin: user.lastLogin || null,
      isFirstLoginCompleted: !!user.isFirstLoginCompleted,
      mustChangePassword: !!user.mustChangePassword,
      user,
      statusLabelAr: "موقوف",
      statusLabelEn: "Suspended",
      statusColorClass: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  if (user.mustChangePassword || !user.isFirstLoginCompleted || user.portalAccountStatus === "PENDING_ACTIVATION") {
    return {
      status: "PENDING_ACTIVATION",
      username: user.username,
      email: user.email,
      lastLogin: user.lastLogin || null,
      isFirstLoginCompleted: false,
      mustChangePassword: true,
      user,
      statusLabelAr: "قيد التفعيل (يلزم تغيير كلمة المرور)",
      statusLabelEn: "Pending Activation (Password Change Required)",
      statusColorClass: "bg-sky-50 text-sky-700 border-sky-200",
    };
  }

  return {
    status: "ACTIVE",
    username: user.username,
    email: user.email,
    lastLogin: user.lastLogin || null,
    isFirstLoginCompleted: true,
    mustChangePassword: false,
    user,
    statusLabelAr: "نشط",
    statusLabelEn: "Active",
    statusColorClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
};


