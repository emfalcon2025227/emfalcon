import { User, Owner, Tenant, PortalAccountStatus } from "../types";

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
export const generateInitialPassword = (nameEn?: string, nameAr?: string): string => {
  let firstWord = "";
  if (nameEn && nameEn.trim().length > 0) {
    firstWord = nameEn.trim().split(/\s+/)[0] || "";
  }
  if (!firstWord && nameAr && nameAr.trim().length > 0) {
    firstWord = nameAr.trim().split(/\s+/)[0] || "";
  }

  // Sanitize firstWord to English characters if possible, or fallback
  const sanitized = firstWord.replace(/[^a-zA-Z]/g, "");
  if (sanitized.length >= 2) {
    const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1).toLowerCase();
    return `${capitalized}@123`;
  }

  return "Falcon@123";
};

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
export const provisionPortalAccount = (params: ProvisionParams): ProvisionResult => {
  const { portalRole, targetId, email, nameEn, nameAr, phone, existingUsers, saveUser, logAudit } = params;

  if (!isValidEmail(email)) {
    return {
      status: "NOT_PROVISIONED",
      message: "البريد الإلكتروني غير صالح أو غير مدخل",
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  // Find existing account linked by targetId OR email + portalRole
  const existingUser = existingUsers.find((u) => {
    if (portalRole === "OWNER") {
      return u.ownerId === targetId || ((u.email || "").trim().toLowerCase() === cleanEmail && (u.role === "OWNER" || u.role === "PROPERTY_OWNER"));
    } else {
      return u.tenantId === targetId || ((u.email || "").trim().toLowerCase() === cleanEmail && u.role === "TENANT");
    }
  });

  if (existingUser) {
    // Account exists — Check if email or names updated
    let updatedNeeded = false;
    const patch: Partial<User> = {};

    if (existingUser.email.toLowerCase() !== cleanEmail) {
      // Check if new cleanEmail is taken by ANOTHER account of same role
      const duplicate = existingUsers.find(
        (u) => u.id !== existingUser.id && (u.email || "").trim().toLowerCase() === cleanEmail && u.role === existingUser.role
      );
      if (duplicate) {
        return {
          status: existingUser.portalAccountStatus || (existingUser.isActive ? "ACTIVE" : "SUSPENDED"),
          user: existingUser,
          message: `تنبيه: البريد الإلكتروني ${cleanEmail} مستخدم بالفعل لحساب آخر`,
        };
      }
      patch.email = cleanEmail;
      patch.username = cleanEmail;
      updatedNeeded = true;
    }

    if (nameEn && existingUser.nameEn !== nameEn) {
      patch.nameEn = nameEn;
      updatedNeeded = true;
    }
    if (nameAr && existingUser.nameAr !== nameAr) {
      patch.nameAr = nameAr;
      updatedNeeded = true;
    }
    if (phone && existingUser.phone !== phone) {
      patch.phone = phone;
      updatedNeeded = true;
    }

    if (portalRole === "OWNER" && existingUser.ownerId !== targetId) {
      patch.ownerId = targetId;
      updatedNeeded = true;
    }
    if (portalRole === "TENANT" && existingUser.tenantId !== targetId) {
      patch.tenantId = targetId;
      updatedNeeded = true;
    }

    if (updatedNeeded) {
      const updatedUser: User = { ...existingUser, ...patch };
      saveUser(updatedUser);
      if (logAudit) {
        logAudit(
          "UPDATE",
          portalRole === "OWNER" ? "OWNER_PORTAL_ACCOUNT" : "TENANT_PORTAL_ACCOUNT",
          targetId,
          nameEn || nameAr,
          `Updated portal account identity for ${portalRole} (${cleanEmail})`
        );
      }
      return {
        status: updatedUser.portalAccountStatus || (updatedUser.isActive ? "ACTIVE" : "SUSPENDED"),
        user: updatedUser,
        isNew: false,
        message: "تم تحديث بيانات حساب البوابة المرتبط بنجاح",
      };
    }

    return {
      status: existingUser.portalAccountStatus || (existingUser.isActive ? "ACTIVE" : "SUSPENDED"),
      user: existingUser,
      isNew: false,
    };
  }

  // Account does not exist — Create new Portal Account
  // Verify cleanEmail is not taken by another user in same role
  const emailDuplicate = existingUsers.find(
    (u) => (u.email || "").trim().toLowerCase() === cleanEmail && (portalRole === "OWNER" ? (u.role === "OWNER" || u.role === "PROPERTY_OWNER") : u.role === "TENANT")
  );

  if (emailDuplicate) {
    return {
      status: "NOT_PROVISIONED",
      message: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لحساب بوابة آخر`,
    };
  }

  const initialPassword = generateInitialPassword(nameEn, nameAr);
  const newUserId = `usr-${portalRole.toLowerCase()}-${targetId}`;

  const newUser: User = {
    id: newUserId,
    username: cleanEmail,
    email: cleanEmail,
    nameEn: nameEn || nameAr || cleanEmail,
    nameAr: nameAr || nameEn || cleanEmail,
    phone: phone || "",
    role: portalRole === "OWNER" ? "OWNER" : "TENANT",
    ownerId: portalRole === "OWNER" ? targetId : undefined,
    tenantId: portalRole === "TENANT" ? targetId : undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
    password: initialPassword,
    mustChangePassword: true,
    isFirstLoginCompleted: false,
    portalAccountStatus: "PENDING_ACTIVATION",
  };

  saveUser(newUser);

  if (logAudit) {
    logAudit(
      "CREATE",
      portalRole === "OWNER" ? "OWNER_PORTAL_ACCOUNT" : "TENANT_PORTAL_ACCOUNT",
      targetId,
      nameEn || nameAr,
      `Automatically provisioned ${portalRole} Portal Account for ${cleanEmail}`
    );
  }

  // Trigger email dispatch in the background
  try {
    const portalUrl = typeof window !== "undefined" ? window.location.origin : "https://ais-dev-kurx4d4uvxuhdqsvv4veh2-405724254259.europe-west3.run.app";
    const loginUrl = portalRole === "OWNER" ? getOwnerPortalLoginUrl(portalUrl) : getTenantPortalLoginUrl(portalUrl);
    fetch("/api/notifications/dispatch-portal-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: cleanEmail,
        role: portalRole,
        name: nameAr || nameEn || cleanEmail,
        username: cleanEmail,
        password: initialPassword,
        portalUrl: portalUrl,
        loginUrl: loginUrl
      })
    }).catch(err => console.error("Failed to send portal access email", err));
  } catch (e) {
    console.error("Error triggering email dispatch", e);
  }

  return {
    status: "PENDING_ACTIVATION",
    user: newUser,
    isNew: true,
    message: `تم إنشاء حساب البوابة تلقائياً بكلمة مرور مؤقتة: ${initialPassword}`,
  };
};

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

/**
 * Idempotently scans and provisions all owners and tenants.
 */
export const syncAllPortalAccounts = (
  owners: Owner[],
  tenants: Tenant[],
  existingUsers: User[],
  saveUser: (user: User) => void,
  logAudit?: (action: string, entityType: string, entityId: string, entityName: string, message: string) => void
) => {
  let createdCount = 0;

  // Sync Owners
  owners.forEach((owner) => {
    if (isValidEmail(owner.email)) {
      const res = provisionPortalAccount({
        portalRole: "OWNER",
        targetId: owner.id,
        email: owner.email,
        nameEn: owner.nameEn,
        nameAr: owner.nameAr,
        phone: owner.phone,
        existingUsers,
        saveUser,
        logAudit,
      });
      if (res.isNew) createdCount++;
    }
  });

  // Sync Tenants
  tenants.forEach((tenant) => {
    if (isValidEmail(tenant.email)) {
      const res = provisionPortalAccount({
        portalRole: "TENANT",
        targetId: tenant.id,
        email: tenant.email,
        nameEn: tenant.nameEn,
        nameAr: tenant.nameAr,
        phone: tenant.phone,
        existingUsers,
        saveUser,
        logAudit,
      });
      if (res.isNew) createdCount++;
    }
  });

  return createdCount;
};
