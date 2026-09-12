import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, Permission, UserPermissionOverride, Owner, Tenant } from "../types";
import { 
  PERMISSION_REGISTRY, 
  getPermissionDefinition, 
  LEGACY_PERMISSION_MAP,
  PermissionDefinition 
} from "../data/permissionRegistry";
import { db, sanitizeForFirestore, auth } from "../lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  provisionPortalAccount as provisionService,
  getPortalAccountInfo as getInfoService,
  syncAllPortalAccounts as syncAllService,
  ProvisionParams,
  PortalAccountDisplayInfo
} from "../services/portalProvisioningService";

export const ROLE_PERMISSIONS: Record<UserRole, (Permission | string)[]> = {
  SYSTEM_OWNER: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "PROPERTIES.CREATE",
    "PROPERTIES.EDIT",
    "PROPERTIES.DELETE",
    "UNITS.VIEW",
    "UNITS.CREATE",
    "UNITS.EDIT",
    "OWNERS.VIEW",
    "OWNERS.EDIT",
    "OWNER_TRANSFERS.APPROVE",
    "TENANTS.VIEW",
    "TENANTS.CUSTOMER_EXCEPTION",
    "LEASES.VIEW",
    "LEASES.CREATE",
    "LEASES.RENEW",
    "LEASES.DISCOUNT_OVERRIDE",
    "CHEQUES.VIEW",
    "CHEQUES.RECORD_BOUNCE",
    "COLLECTIONS.VIEW",
    "COLLECTIONS.MODIFY_PAID",
    "EXPENSES.CREATE",
    "EXPENSES.APPROVE",
    "DAILY_DEPOSITS.RECONCILE",
    "REPORTS.FINANCIAL_VIEW",
    "VAT.OVERRIDE",
    "SECURITY.MANAGE_PERMISSIONS",
    "VIEW_DASHBOARD",
    "MANAGE_USERS",
    "EDIT_USER",
    "DELETE_USER",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "OCR_SCAN",
    "RECORD_COLLECTIONS",
    "MANAGE_CASES",
    "MANAGE_HEARINGS",
    "VIEW_MAINTENANCE",
    "MANAGE_MAINTENANCE",
    "CREATE_MAINTENANCE",
    "EDIT_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "CONFIGURE_RISK",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "IMPORT_DATA",
    "VIEW_AUDIT_LOGS",
    "OVERRIDE_RISK",
    "DELETE_RECORDS",
    "EDIT_SAVED_FINANCIAL_RECORDS",
    "VIEW_OFFICE_PETTY_CASH",
    "CREATE_OFFICE_PETTY_CASH_MONTH",
    "ADD_OFFICE_EXPENSE",
    "EDIT_OFFICE_EXPENSE",
    "DELETE_OFFICE_EXPENSE",
    "UPLOAD_OFFICE_PETTY_CASH_RECEIPT",
    "CLOSE_OFFICE_PETTY_CASH_MONTH",
    "REOPEN_OFFICE_PETTY_CASH_MONTH",
    "MANAGE_OFFICE_EXPENSE_CATEGORIES",
    "VIEW_OFFICE_PETTY_CASH_REPORTS",
    "MODIFY_CLOSED_OFFICE_PETTY_CASH",
    "identity.read",
    "identity.view",
    "identity.create",
    "identity.update",
    "identity.document.upload",
    "identity.document.view",
    "identity.settings.manage",
    "identity.bridge.manage",
    "VERIFICATION.MANUAL_OVERRIDE",
    "VERIFICATION.OVERRIDE_MISMATCH"
  ],
  SUPER_ADMIN: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "PROPERTIES.CREATE",
    "PROPERTIES.EDIT",
    "PROPERTIES.DELETE",
    "UNITS.VIEW",
    "UNITS.CREATE",
    "UNITS.EDIT",
    "OWNERS.VIEW",
    "OWNERS.EDIT",
    "OWNER_TRANSFERS.APPROVE",
    "TENANTS.VIEW",
    "TENANTS.CUSTOMER_EXCEPTION",
    "LEASES.VIEW",
    "LEASES.CREATE",
    "LEASES.RENEW",
    "LEASES.DISCOUNT_OVERRIDE",
    "CHEQUES.VIEW",
    "CHEQUES.RECORD_BOUNCE",
    "COLLECTIONS.VIEW",
    "COLLECTIONS.MODIFY_PAID",
    "EXPENSES.CREATE",
    "EXPENSES.APPROVE",
    "DAILY_DEPOSITS.RECONCILE",
    "REPORTS.FINANCIAL_VIEW",
    "VAT.OVERRIDE",
    "SECURITY.MANAGE_PERMISSIONS",
    "VIEW_DASHBOARD",
    "MANAGE_USERS",
    "EDIT_USER",
    "DELETE_USER",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "OCR_SCAN",
    "RECORD_COLLECTIONS",
    "MANAGE_CASES",
    "MANAGE_HEARINGS",
    "VIEW_MAINTENANCE",
    "MANAGE_MAINTENANCE",
    "CREATE_MAINTENANCE",
    "EDIT_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "CONFIGURE_RISK",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "IMPORT_DATA",
    "VIEW_AUDIT_LOGS",
    "OVERRIDE_RISK",
    "DELETE_RECORDS",
    "EDIT_SAVED_FINANCIAL_RECORDS",
    "VIEW_OFFICE_PETTY_CASH",
    "CREATE_OFFICE_PETTY_CASH_MONTH",
    "ADD_OFFICE_EXPENSE",
    "EDIT_OFFICE_EXPENSE",
    "DELETE_OFFICE_EXPENSE",
    "UPLOAD_OFFICE_PETTY_CASH_RECEIPT",
    "CLOSE_OFFICE_PETTY_CASH_MONTH",
    "REOPEN_OFFICE_PETTY_CASH_MONTH",
    "MANAGE_OFFICE_EXPENSE_CATEGORIES",
    "VIEW_OFFICE_PETTY_CASH_REPORTS",
    "MODIFY_CLOSED_OFFICE_PETTY_CASH",
    "identity.read",
    "identity.view",
    "identity.create",
    "identity.update",
    "identity.document.upload",
    "identity.document.view",
    "identity.settings.manage",
    "identity.bridge.manage",
    "VERIFICATION.MANUAL_OVERRIDE",
    "VERIFICATION.OVERRIDE_MISMATCH"
  ],
  MANAGER: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "PROPERTIES.CREATE",
    "PROPERTIES.EDIT",
    "UNITS.VIEW",
    "UNITS.CREATE",
    "UNITS.EDIT",
    "OWNERS.VIEW",
    "OWNERS.EDIT",
    "TENANTS.VIEW",
    "TENANTS.CUSTOMER_EXCEPTION",
    "LEASES.VIEW",
    "LEASES.CREATE",
    "LEASES.RENEW",
    "CHEQUES.VIEW",
    "CHEQUES.RECORD_BOUNCE",
    "COLLECTIONS.VIEW",
    "EXPENSES.CREATE",
    "REPORTS.FINANCIAL_VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "OCR_SCAN",
    "RECORD_COLLECTIONS",
    "MANAGE_CASES",
    "MANAGE_HEARINGS",
    "VIEW_MAINTENANCE",
    "MANAGE_MAINTENANCE",
    "CREATE_MAINTENANCE",
    "EDIT_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "CONFIGURE_RISK",
    "VIEW_AUDIT_LOGS",
    "OVERRIDE_RISK",
    "VIEW_OFFICE_PETTY_CASH",
    "CREATE_OFFICE_PETTY_CASH_MONTH",
    "ADD_OFFICE_EXPENSE",
    "EDIT_OFFICE_EXPENSE",
    "UPLOAD_OFFICE_PETTY_CASH_RECEIPT",
    "VIEW_OFFICE_PETTY_CASH_REPORTS",
    "VERIFICATION.MANUAL_OVERRIDE"
  ],
  FINANCE: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "OWNERS.VIEW",
    "TENANTS.VIEW",
    "LEASES.VIEW",
    "CHEQUES.VIEW",
    "COLLECTIONS.VIEW",
    "EXPENSES.CREATE",
    "REPORTS.FINANCIAL_VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "OCR_SCAN",
    "RECORD_COLLECTIONS",
    "VIEW_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "VIEW_AUDIT_LOGS",
    "VIEW_OFFICE_PETTY_CASH",
    "CREATE_OFFICE_PETTY_CASH_MONTH",
    "ADD_OFFICE_EXPENSE",
    "EDIT_OFFICE_EXPENSE",
    "UPLOAD_OFFICE_PETTY_CASH_RECEIPT",
    "VIEW_OFFICE_PETTY_CASH_REPORTS",
    "VERIFICATION.MANUAL_OVERRIDE"
  ],
  LEGAL: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "TENANTS.VIEW",
    "LEASES.VIEW",
    "CHEQUES.VIEW",
    "CHEQUES.RECORD_BOUNCE",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "MANAGE_CASES",
    "MANAGE_HEARINGS",
    "VIEW_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "VIEW_AUDIT_LOGS"
  ],
  PROPERTY_MANAGER: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "TENANTS.VIEW",
    "LEASES.VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "VIEW_MAINTENANCE",
    "MANAGE_MAINTENANCE",
    "CREATE_MAINTENANCE",
    "EDIT_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "VIEW_REPORTS"
  ],
  DATA_ENTRY: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "TENANTS.VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "OCR_SCAN",
    "VIEW_MAINTENANCE",
    "CREATE_MAINTENANCE",
    "MANAGE_ARCHIVE"
  ],
  TENANT: [
    "TENANT_VIEW_OWN_DATA",
    "CREATE_MAINTENANCE"
  ],
  OWNER: [
    "OWNER_VIEW_OWN_DATA",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "LEASES.VIEW",
    "CHEQUES.VIEW",
    "COLLECTIONS.VIEW"
  ],
  PROPERTY_OWNER: [
    "OWNER_VIEW_OWN_DATA",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "LEASES.VIEW",
    "CHEQUES.VIEW",
    "COLLECTIONS.VIEW"
  ]
};

export const INITIAL_OWNER_USER: User = {
  id: "usr-owner-mahmoud",
  username: "owner_mahmoud",
  email: "owner@falcon.ae",
  nameEn: "Mahmoud Mohamed Mahmoud Hamed (Owner)",
  nameAr: "محمود محمد محمود حامد (مالك)",
  role: "OWNER",
  ownerId: "own-mahmoud",
  phone: "+971501234567",
  isActive: true,
  createdAt: "2024-01-01T08:00:00Z",
  lastLogin: new Date().toISOString(),
  mustChangePassword: false,
  isFirstLoginCompleted: true,
  portalAccountStatus: "ACTIVE",
};

export const INITIAL_SYSTEM_OWNER: User = {
  id: "usr-01",
  username: "Mahmoud",
  email: "m_hamed@msn.com",
  nameEn: "Mahmoud Mohamed Mahmoud Hamed",
  nameAr: "محمود محمد محمود حامد",
  role: "SYSTEM_OWNER",
  phone: "+971501234567",
  isActive: true,
  createdAt: "2024-01-01T08:00:00Z",
  lastLogin: new Date().toISOString(),
  mustChangePassword: false,
  isFirstLoginCompleted: true,
  portalAccountStatus: "ACTIVE",
};

export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  var mathPow = Math.pow;
  var lengthProperty = 'length';
  var i, j;
  var result = '';

  var words: number[] = [];
  var asciiLength = ascii[lengthProperty];
  
  var hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var wordsLength = ((asciiLength + 8) >> 6) + 1;
  for (i = 0; i < wordsLength * 16; i++) words[i] = 0;
  for (i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  words[wordsLength * 16 - 1] = asciiLength * 8;

  for (j = 0; j < wordsLength; j++) {
    var w = [];
    for (i = 0; i < 16; i++) w[i] = words[j * 16 + i];
    for (i = 16; i < 64; i++) {
      var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (i = 0; i < 64; i++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    var hex = hash[i].toString(16);
    while (hex[lengthProperty] < 8) hex = '0' + hex;
    result += hex;
  }
  return result;
}

export const isSystemOwnerUser = (user?: { id?: string; email?: string; username?: string; role?: string } | null): boolean => {
  if (!user) return false;
  const email = (user.email || "").trim().toLowerCase();
  const role = user.role || "";
  return role === "SYSTEM_OWNER" && email === "m_hamed@msn.com";
};

export interface EffectivePermissionResult {
  permissionId: string;
  granted: boolean;
  source: "SYSTEM_OWNER" | "ADMIN_ONLY_RESTRICTION" | "USER_DENY" | "USER_GRANT" | "ROLE" | "DENIED_BY_DEFAULT";
  reason: string;
  reasonAr: string;
  override?: UserPermissionOverride;
}

export function evaluateEffectivePermission(
  user: User | null,
  permissionId: string,
  userOverrides: UserPermissionOverride[],
  rolePermissions: Record<UserRole, (Permission | string)[]>
): EffectivePermissionResult {
  if (!user || !user.isActive) {
    return {
      permissionId,
      granted: false,
      source: "DENIED_BY_DEFAULT",
      reason: "User is not authenticated or account is disabled",
      reasonAr: "المستخدم غير محقق أو الحساب معطل",
    };
  }

  // SYSTEM_OWNER is absolute Root Super Admin
  if (isSystemOwnerUser(user)) {
    return {
      permissionId,
      granted: true,
      source: "SYSTEM_OWNER",
      reason: "System Owner has absolute root permissions across all modules",
      reasonAr: "مالك النظام يمتلك كافة الصلاحيات الشاملة تلقائياً (ROOT)",
    };
  }

  const normalizedId = LEGACY_PERMISSION_MAP[permissionId] || permissionId;
  const def = getPermissionDefinition(normalizedId);
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "MANAGER";

  // Check Admin-Only Non-Delegable constraint
  if (def && def.adminOnly && !isAdminUser) {
    return {
      permissionId,
      granted: false,
      source: "ADMIN_ONLY_RESTRICTION",
      reason: "Permission is classified as Admin-Only and non-delegable to staff via User Overrides",
      reasonAr: "هذه الصلاحية مقتصرة حصرياً على الإدارة العليا ولا يمكن تفويضها للموظفين عبر الاستثناءات",
    };
  }

  // Check User Overrides (GRANT or DENY)
  const activeOverride = userOverrides.find((o) => {
    if (o.userId !== user.id) return false;
    const oNormalized = LEGACY_PERMISSION_MAP[o.permissionId] || o.permissionId;
    if (oNormalized !== normalizedId) return false;
    if (o.status === "REVOKED") return false;
    if (o.expiresAt && new Date(o.expiresAt).getTime() <= Date.now()) return false;
    return true;
  });

  if (activeOverride) {
    if (activeOverride.effect === "DENY") {
      return {
        permissionId,
        granted: false,
        source: "USER_DENY",
        reason: `Explicitly DENIED by User Override (${activeOverride.reason || "Direct Denial"})`,
        reasonAr: `ممنوعة بقرار حظر استثنائي خاص للمستخدم (${activeOverride.reason || "حظر خاص"})`,
        override: activeOverride,
      };
    } else if (activeOverride.effect === "GRANT") {
      return {
        permissionId,
        granted: true,
        source: "USER_GRANT",
        reason: `Explicitly GRANTED by User Override (${activeOverride.reason || "Direct Grant"})`,
        reasonAr: `ممنوحة باستثناء خاص للمستخدم (${activeOverride.reason || "منح خاص"})`,
        override: activeOverride,
      };
    }
  }

  // Check Role Permissions
  const roleList = rolePermissions[user.role] || [];
  const inRole = roleList.some((p) => {
    const pNorm = LEGACY_PERMISSION_MAP[p as string] || p;
    return pNorm === normalizedId;
  });

  if (inRole) {
    return {
      permissionId,
      granted: true,
      source: "ROLE",
      reason: `Granted by default user role: ${user.role}`,
      reasonAr: `ممنوحة افتراضياً عبر الدور الأساسي: ${user.role}`,
    };
  }

  return {
    permissionId,
    granted: false,
    source: "DENIED_BY_DEFAULT",
    reason: "Not granted in default role or active overrides",
    reasonAr: "غير مسموحة افتراضياً في الدور الوظيفي أو الاستثناءات",
  };
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  canRemixAndShare: boolean;
  users: User[];
  userPermissionOverrides: UserPermissionOverride[];
  loginMode: "STAFF" | "TENANT" | "OWNER" | null;
  login: (usernameOrEmail: string, password: string, mode: "STAFF" | "TENANT" | "OWNER") => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  quickSwitchUser: (userId: string) => void;
  hasPermission: (permission: Permission | string, targetUserId?: string) => boolean;
  getEffectivePermission: (permissionId: string, userId?: string) => EffectivePermissionResult;
  addUserPermissionOverride: (overrideData: { userId: string; permissionId: string; effect: "GRANT" | "DENY"; reason?: string; expiresAt?: string | null }) => { success: boolean; error?: string };
  revokeUserPermissionOverride: (overrideId: string) => { success: boolean; error?: string };
  createUser: (userData: Omit<User, "id" | "createdAt">) => { success: boolean; user?: User; error?: string };
  updateUser: (userId: string, patch: Partial<User>) => { success: boolean; error?: string };
  updateUserStatus: (userId: string, isActive: boolean) => { success: boolean; error?: string };
  updateUserRole: (userId: string, newRole: UserRole) => { success: boolean; error?: string };
  resetUserPassword: (userId: string, newPassword?: string) => string;
  changeOwnPassword: (currentPassword: string, newPassword: string) => { success: boolean; error?: string };
  deleteUser: (userId: string) => { success: boolean; error?: string };
  provisionPortalAccount: (params: Omit<ProvisionParams, "existingUsers" | "saveUser">) => ReturnType<typeof provisionService>;
  getPortalAccountInfo: (targetId: string, portalRole: "OWNER" | "TENANT", email: string | undefined) => PortalAccountDisplayInfo;
  syncPortalAccounts: (owners: Owner[], tenants: Tenant[]) => number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem("ef_users");
    let loadedUsers: User[] = [INITIAL_SYSTEM_OWNER];
    if (saved) {
      try {
        loadedUsers = JSON.parse(saved);
      } catch (e) {
        loadedUsers = [INITIAL_SYSTEM_OWNER];
      }
    }
    // Filter out obsolete test accounts
    loadedUsers = loadedUsers.filter(u => u.id !== "usr-02" && u.id !== "usr-tenant" && u.id !== "usr-mahmoud-tenant");
    
    // Ensure Mahmoud (usr-01 / m_hamed@msn.com) is ALWAYS present, active, and SYSTEM_OWNER
    const hasMahmoud = loadedUsers.some(u => isSystemOwnerUser(u));
    if (!hasMahmoud) {
      loadedUsers = [INITIAL_SYSTEM_OWNER, ...loadedUsers];
    } else {
      loadedUsers = loadedUsers.map(u => isSystemOwnerUser(u) ? { 
        ...u, 
        id: "usr-01",
        username: "Mahmoud",
        email: "m_hamed@msn.com", 
        nameEn: "Mahmoud Mohamed Mahmoud Hamed",
        nameAr: "محمود محمد محمود حامد",
        role: "SYSTEM_OWNER", 
        isActive: true,
      } : u);
    }

    // Ensure demo owner account exists
    const hasOwner = loadedUsers.some(u => u.id === INITIAL_OWNER_USER.id || u.role === "OWNER" || u.role === "PROPERTY_OWNER");
    if (!hasOwner) {
      loadedUsers = [...loadedUsers, INITIAL_OWNER_USER];
    }

    return loadedUsers;
  });

  const [userPermissionOverrides, setUserPermissionOverrides] = useState<UserPermissionOverride[]>(() => {
    const saved = localStorage.getItem("ef_user_overrides");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loginMode, setLoginMode] = useState<"STAFF" | "TENANT" | "OWNER" | null>(() => {
    return localStorage.getItem("ef_login_mode") as "STAFF" | "TENANT" | "OWNER" | null;
  });

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // Derive currentUser when users or firebaseUser changes
  useEffect(() => {
    if (loadingAuth) return;
    if (!firebaseUser) {
      setCurrentUser(null);
      return;
    }
    const match = users.find(
      (u) => (u.email || "").trim().toLowerCase() === (firebaseUser.email || "").trim().toLowerCase()
    );
    if (match) {
      if (match.isActive) {
        setCurrentUser(match);
      } else {
        signOut(auth).catch(() => {});
        setCurrentUser(null);
      }
    } else {
      if (users.length > 0) {
        setCurrentUser(null);
      }
    }
  }, [users, firebaseUser, loadingAuth]);

  useEffect(() => {
    const handleUrlLoginCheck = () => {
      if (typeof window !== "undefined") {
        const hash = (window.location.hash || "").toLowerCase();
        const search = (window.location.search || "").toLowerCase();
        if (hash.includes("login") || search.includes("login") || search.includes("logout") || search.includes("mode=")) {
          signOut(auth).catch(() => {});
          setCurrentUser(null);
          localStorage.removeItem("ef_current_user_id");
        }
      }
    };
    handleUrlLoginCheck();
    window.addEventListener("hashchange", handleUrlLoginCheck);
    return () => window.removeEventListener("hashchange", handleUrlLoginCheck);
  }, []);

  useEffect(() => {
    // Keep SYSTEM_OWNER immutably protected
    setUsers((prev) => {
      let updated = prev.filter(u => u.id !== "usr-02" && u.id !== "usr-tenant" && u.id !== "usr-mahmoud-tenant");
      const hasMahmoud = updated.some(u => isSystemOwnerUser(u));
      if (!hasMahmoud) {
        updated = [INITIAL_SYSTEM_OWNER, ...updated];
      } else {
        updated = updated.map(u => isSystemOwnerUser(u) ? { 
          ...u, 
          id: "usr-01",
          username: "Mahmoud",
          email: "m_hamed@msn.com", 
          nameEn: "Mahmoud Mohamed Mahmoud Hamed",
          nameAr: "محمود محمد محمود حامد",
          role: "SYSTEM_OWNER", 
          isActive: true,
        } : u);
      }
      return updated;
    });

    // Firestore real-time listener for users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      if (!snapshot.empty) {
        const remoteUsers: User[] = [];
        snapshot.forEach((docSnap) => {
          remoteUsers.push(docSnap.data() as User);
        });
        if (remoteUsers.length > 0) {
          const hasMahmoudRemote = remoteUsers.some(u => isSystemOwnerUser(u));
          let finalRemote = remoteUsers;
          if (!hasMahmoudRemote) {
            finalRemote = [INITIAL_SYSTEM_OWNER, ...remoteUsers];
          } else {
            finalRemote = finalRemote.map(u => isSystemOwnerUser(u) ? {
              ...u,
              isActive: true,
              role: "SYSTEM_OWNER",
            } : u);
          }
          setUsers(finalRemote);
        }
      }
    }, (err) => {
      console.warn("[AuthContext] Firestore users listener notice:", err.message);
    });

    // Firestore real-time listener for userPermissionOverrides
    const unsubOverrides = onSnapshot(collection(db, "userPermissionOverrides"), (snapshot) => {
      if (!snapshot.empty) {
        const remoteOverrides: UserPermissionOverride[] = [];
        snapshot.forEach((docSnap) => {
          remoteOverrides.push(docSnap.data() as UserPermissionOverride);
        });
        setUserPermissionOverrides(remoteOverrides);
      }
    }, (err) => {
      console.warn("[AuthContext] Firestore overrides listener notice:", err.message);
    });

    return () => {
      unsubUsers();
      unsubOverrides();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ef_users", JSON.stringify(users));
    } catch (e) {
      console.warn("[AuthContext] Unable to save users to localStorage:", e);
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem("ef_user_overrides", JSON.stringify(userPermissionOverrides));
    } catch (e) {
      console.warn("[AuthContext] Unable to save userPermissionOverrides to localStorage:", e);
    }
  }, [userPermissionOverrides]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("ef_current_user_id", currentUser.id);
      } else {
        localStorage.removeItem("ef_current_user_id");
        localStorage.removeItem("ef_login_mode");
        setLoginMode(null);
      }
    } catch (e) {
      console.warn("[AuthContext] Unable to save current user id:", e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      if (loginMode) {
        localStorage.setItem("ef_login_mode", loginMode);
      }
    } catch (e) {
      console.warn("[AuthContext] Unable to save login mode:", e);
    }
  }, [loginMode]);

  const login = async (usernameOrEmail: string, password: string, mode: "STAFF" | "TENANT" | "OWNER"): Promise<{ success: boolean; error?: string }> => {
    const clean = usernameOrEmail.trim().toLowerCase();
    
    const user = users.find((u) => {
      const uEmail = (u.email || "").trim().toLowerCase();
      const uUsername = (u.username || "").trim().toLowerCase();
      const emailMatch = uEmail === clean;
      const usernameMatch = uUsername === clean;
      
      if (mode === "TENANT") {
        return (emailMatch || usernameMatch) && u.role === "TENANT";
      } else if (mode === "OWNER") {
        return (emailMatch || usernameMatch) && (u.role === "OWNER" || u.role === "PROPERTY_OWNER" || !!u.ownerId);
      } else {
        return (emailMatch || usernameMatch) && u.role !== "TENANT" && u.role !== "OWNER" && u.role !== "PROPERTY_OWNER";
      }
    });

    if (!user) {
      let errorMsg = "اسم المستخدم أو كلمة المرور غير صحيحة";
      if (mode === "TENANT") errorMsg = "خطأ في البريد الإلكتروني أو كلمة المرور للمستأجر";
      if (mode === "OWNER") errorMsg = "خطأ في البريد الإلكتروني أو كلمة المرور لبوابة المالك";
      return { success: false, error: errorMsg };
    }

    if (!user.isActive) {
      return { success: false, error: "الحساب معطل، يرجى التواصل مع مالك النظام SYSTEM_OWNER" };
    }

    let errorMsg = "اسم المستخدم أو كلمة المرور غير صحيحة";
    if (mode === "TENANT") errorMsg = "خطأ في البريد الإلكتروني أو كلمة المرور للمستأجر";
    if (mode === "OWNER") errorMsg = "خطأ في البريد الإلكتروني أو كلمة المرور لبوابة المالك";

    try {
      // 1. Attempt standard Firebase Auth sign in
      await signInWithEmailAndPassword(auth, user.email, password);
    } catch (error: any) {
      const isAuthFail = error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/wrong-password";
      
      if (isAuthFail) {
        // 2. Validate password locally against database document before lazy migration
        let isLocalPasswordValid = false;
        if (user.password) {
          if (user.password === sha256(password)) {
            isLocalPasswordValid = true;
          } else if (user.password.length > 20 && user.password === btoa(password)) {
            isLocalPasswordValid = true;
          } else if (user.password === password) {
            isLocalPasswordValid = true;
          }
        }

        if (isLocalPasswordValid) {
          // Correct password, but the user is not migrated to Firebase Auth yet! Lazy create.
          try {
            await createUserWithEmailAndPassword(auth, user.email, password);
          } catch (createErr: any) {
            console.error("[Auth] Lazy migration failed:", createErr.message);
            return { success: false, error: "فشل إنشاء حساب المصادقة الجديد: " + createErr.message };
          }
        } else {
          return { success: false, error: errorMsg };
        }
      } else {
        console.error("[Auth] Firebase login failed:", error.message);
        if (error.code === "auth/too-many-requests") {
          errorMsg = "تم حظر الحساب مؤقتاً بسبب محاولات دخول خاطئة متكررة";
        }
        return { success: false, error: errorMsg };
      }
    }

    // Login successful
    const updatedUser = { ...user, lastLogin: new Date().toISOString() };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    setLoginMode(mode);
    setCurrentUser(updatedUser);
    return { success: true };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("[Auth] Firebase signOut error:", e);
    }
    setCurrentUser(null);
    setLoginMode(null);
    localStorage.removeItem("ef_current_user_id");
    localStorage.removeItem("ef_login_mode");
  };

  const quickSwitchUser = (userId: string) => {
    console.warn("[Security Violation Alert] Impersonation via quickSwitchUser was requested and blocked for user ID:", userId);
  };

  const hasPermission = (permission: Permission | string, targetUserId?: string): boolean => {
    const targetId = targetUserId || currentUser?.id;
    const targetUser = users.find((u) => u.id === targetId) || currentUser;
    if (!targetUser || !targetUser.isActive) return false;
    const res = evaluateEffectivePermission(targetUser, permission as string, userPermissionOverrides, ROLE_PERMISSIONS);
    return res.granted;
  };

  const getEffectivePermission = (permissionId: string, userId?: string): EffectivePermissionResult => {
    const targetId = userId || currentUser?.id;
    const targetUser = users.find((u) => u.id === targetId) || currentUser;
    return evaluateEffectivePermission(targetUser, permissionId, userPermissionOverrides, ROLE_PERMISSIONS);
  };

  const addUserPermissionOverride = (overrideData: {
    userId: string;
    permissionId: string;
    effect: "GRANT" | "DENY";
    reason?: string;
    expiresAt?: string | null;
  }): { success: boolean; error?: string } => {
    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بإدارة الاستثناءات والصلاحيات" };
    }
    const targetUser = users.find((u) => u.id === overrideData.userId);
    if (!targetUser) return { success: false, error: "المستخدم المحدد غير موجود" };

    if (isSystemOwnerUser(targetUser)) {
      return { success: false, error: "حساب مالك النظام SYSTEM_OWNER يمتلك كافة الصلاحيات الشاملة ولا يتأثر بالاستثناءات" };
    }

    const def = getPermissionDefinition(overrideData.permissionId);
    if (def?.adminOnly && targetUser.role !== "SUPER_ADMIN" && targetUser.role !== "MANAGER" && overrideData.effect === "GRANT") {
      return { success: false, error: "الصلاحية محددة كـ Admin-Only ولا يمكن تفويضها للموظفين العاديين عبر الاستثناءات" };
    }

    const newOverride: UserPermissionOverride = {
      id: "ovr-" + Date.now() + "-" + Date.now() % 10000,
      userId: overrideData.userId,
      permissionId: overrideData.permissionId,
      effect: overrideData.effect,
      reason: overrideData.reason || "",
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: overrideData.expiresAt || null,
      status: "ACTIVE",
    };

    setUserPermissionOverrides((prev) => [
      newOverride,
      ...prev.filter((o) => !(o.userId === overrideData.userId && o.permissionId === overrideData.permissionId && o.status === "ACTIVE"))
    ]);
    // Persist to Firestore
    setDoc(doc(db, "userPermissionOverrides", newOverride.id), sanitizeForFirestore(newOverride), { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore override set error:", e.message);
    });
    return { success: true };
  };

  const revokeUserPermissionOverride = (overrideId: string): { success: boolean; error?: string } => {
    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بإلغاء استثناءات الصلاحيات" };
    }
    setUserPermissionOverrides((prev) =>
      prev.map((o) => (o.id === overrideId ? { ...o, status: "REVOKED" } : o))
    );
    // Persist status update to Firestore
    setDoc(doc(db, "userPermissionOverrides", overrideId), { status: "REVOKED" }, { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore override revoke error:", e.message);
    });
    return { success: true };
  };

  const createUser = (userData: Omit<User, "id" | "createdAt">): { success: boolean; user?: User; error?: string } => {
    if (userData.role === "SYSTEM_OWNER") {
      return { success: false, error: "لا يمكن إنشاء حساب SYSTEM_OWNER آخر. يوجد مالك نظام واحد فقط مقتصر على m_hamed@msn.com" };
    }

    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بإنشاء حسابات مستخدمين جديدة" };
    }

    const isTenant = userData.role === "TENANT";
    if (userData.username && users.some((u) => (u.username || "").toLowerCase() === (userData.username || "").toLowerCase() && (isTenant ? u.role === "TENANT" : u.role !== "TENANT"))) {
      return { success: false, error: "اسم المستخدم مسجل مسبقاً في هذا القسم" };
    }
    if (userData.email && users.some((u) => (u.email || "").toLowerCase() === (userData.email || "").toLowerCase() && (isTenant ? u.role === "TENANT" : u.role !== "TENANT"))) {
      return { success: false, error: "البريد الإلكتروني مسجل مسبقاً في هذا القسم" };
    }

    const newUser: User = {
      ...userData,
      id: "usr-" + Date.now(),
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    // Persist to Firestore
    setDoc(doc(db, "users", newUser.id), sanitizeForFirestore(newUser), { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore create user error:", e.message);
    });
    return { success: true, user: newUser };
  };

  const updateUser = (userId: string, patch: Partial<User>): { success: boolean; error?: string } => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, error: "المستخدم غير موجود" };

    if (isSystemOwnerUser(target)) {
      if (!currentUser || !isSystemOwnerUser(currentUser)) {
        return { success: false, error: "لا يمكن لأي مدير أو مستخدم آخر تعديل حساب مالك النظام SYSTEM_OWNER" };
      }
      if (patch.username && patch.username.toLowerCase() !== "mahmoud") {
        return { success: false, error: "لا يمكن تغيير اسم المستخدم لمالك النظام الثابت (Mahmoud)" };
      }
      if (patch.email && patch.email.toLowerCase() !== "m_hamed@msn.com") {
        return { success: false, error: "لا يمكن تغيير البريد الإلكتروني لمالك النظام الثابت (m_hamed@msn.com)" };
      }
      if (patch.role && patch.role !== "SYSTEM_OWNER") {
        return { success: false, error: "لا يمكن تخفيض دور أو رتبة مالك النظام SYSTEM_OWNER" };
      }
    } else {
      if (!currentUser || !isSystemOwnerUser(currentUser)) {
        return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بتعديل حسابات المستخدمين" };
      }
    }

    if (patch.role === "SYSTEM_OWNER" && !isSystemOwnerUser(target)) {
      return { success: false, error: "لا يمكن ترقية أي مستخدم إلى SYSTEM_OWNER" };
    }

    const updated = { ...target, ...patch };
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
    // Persist to Firestore
    setDoc(doc(db, "users", userId), sanitizeForFirestore(patch), { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore update user error:", e.message);
    });
    return { success: true };
  };

  const updateUserStatus = (userId: string, isActive: boolean): { success: boolean; error?: string } => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, error: "المستخدم غير موجود" };

    if (isSystemOwnerUser(target)) {
      return { success: false, error: "حساب مالك النظام SYSTEM_OWNER محمي نهائياً ولا يمكن تعطيله" };
    }

    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بتغيير حالة حسابات المستخدمين" };
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          if (currentUser?.id === userId && !isActive) {
            setTimeout(() => logout(), 100);
          }
          return { ...u, isActive };
        }
        return u;
      })
    );
    // Persist to Firestore
    setDoc(doc(db, "users", userId), { isActive }, { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore update user status error:", e.message);
    });
    return { success: true };
  };

  const updateUserRole = (userId: string, newRole: UserRole): { success: boolean; error?: string } => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, error: "المستخدم غير موجود" };

    if (isSystemOwnerUser(target) && newRole !== "SYSTEM_OWNER") {
      return { success: false, error: "لا يمكن تغيير أو تخفيض دور مالك النظام SYSTEM_OWNER" };
    }

    if (newRole === "SYSTEM_OWNER" && !isSystemOwnerUser(target)) {
      return { success: false, error: "لا يمكن تعيين دور SYSTEM_OWNER لأي مستخدم آخر" };
    }

    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بتعديل أدوار المستخدمين" };
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, role: newRole };
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
    // Persist to Firestore
    setDoc(doc(db, "users", userId), { role: newRole }, { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore update user role error:", e.message);
    });
    return { success: true };
  };

  const resetUserPassword = (userId: string, newPassword?: string): string => {
    const rawPass = newPassword || ("Falcon@" + (Date.now() % 10000));
    const finalPass = sha256(rawPass);
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, password: finalPass };
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
    // Persist to Firestore
    setDoc(doc(db, "users", userId), { password: finalPass }, { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore reset password error:", e.message);
    });
    return rawPass;
  };

  const changeOwnPassword = (currentPassword: string, newPassword: string): { success: boolean; error?: string } => {
    if (!currentUser) {
      return { success: false, error: "المستخدم غير مسجل الدخول" };
    }
    let isValidPassword = false;
    if (currentUser.password) {
      if (currentUser.password === sha256(currentPassword)) {
        isValidPassword = true;
      } else if (currentUser.password.length > 20 && currentUser.password === btoa(currentPassword)) {
        isValidPassword = true;
      } else if (currentUser.password === currentPassword) {
        isValidPassword = true;
      }
    }

    if (!isValidPassword) {
      return { success: false, error: "كلمة المرور الحالية غير صحيحة" };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: "كلمة المرور الجديدة يجب أن لا تقل عن 4 رموز" };
    }

    const updatedUser: User = { 
      ...currentUser, 
      password: sha256(newPassword),
      mustChangePassword: false,
      isFirstLoginCompleted: true,
      portalAccountStatus: "ACTIVE"
    };
    setCurrentUser(updatedUser);
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? updatedUser : u))
    );
    // Persist to Firestore
    setDoc(doc(db, "users", currentUser.id), sanitizeForFirestore(updatedUser), { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore change password error:", e.message);
    });
    return { success: true };
  };

  const saveUser = (userToSave: User) => {
    let finalUser = { ...userToSave };
    // Hash plaintext passwords on save if not already hashed
    if (finalUser.password && finalUser.password.length < 20 && !finalUser.password.endsWith("==") && finalUser.password.length !== 64) {
      finalUser.password = sha256(finalUser.password);
    }
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === finalUser.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalUser;
        return next;
      }
      return [...prev, finalUser];
    });
    setDoc(doc(db, "users", finalUser.id), sanitizeForFirestore(finalUser), { merge: true }).catch((e) => {
      console.warn("[AuthContext] Firestore saveUser error:", e.message);
    });
  };

  const provisionPortalAccount = (params: Omit<ProvisionParams, "existingUsers" | "saveUser">) => {
    return provisionService({
      ...params,
      existingUsers: users,
      saveUser,
    });
  };

  const getPortalAccountInfo = (targetId: string, portalRole: "OWNER" | "TENANT", email: string | undefined) => {
    return getInfoService(targetId, portalRole, email, users);
  };

  const syncPortalAccounts = (owners: Owner[], tenants: Tenant[]) => {
    return syncAllService(owners, tenants, users, saveUser);
  };

  const deleteUser = (userId: string): { success: boolean; error?: string } => {
    const userToDelete = users.find((u) => u.id === userId);
    if (isSystemOwnerUser(userToDelete)) {
      return { success: false, error: "حساب مالك النظام SYSTEM_OWNER محمي نهائياً ولا يمكن حذفه" };
    }

    if (!currentUser || !isSystemOwnerUser(currentUser)) {
      return { success: false, error: "فقط مالك النظام SYSTEM_OWNER مصرح له بحذف حسابات المستخدمين" };
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId));
    // Delete from Firestore
    deleteDoc(doc(db, "users", userId)).catch((e) => {
      console.warn("[AuthContext] Firestore delete user error:", e.message);
    });
    if (currentUser?.id === userId) {
      setTimeout(() => logout(), 100);
    }
    return { success: true };
  };

  const canRemixAndShare = !!currentUser && currentUser.isActive && (isSystemOwnerUser(currentUser) || currentUser.role === "SUPER_ADMIN");

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        canRemixAndShare,
        users,
        userPermissionOverrides,
        loginMode,
        login,
        logout,
        quickSwitchUser,
        hasPermission,
        getEffectivePermission,
        addUserPermissionOverride,
        revokeUserPermissionOverride,
        createUser,
        updateUser,
        updateUserStatus,
        updateUserRole,
        resetUserPassword,
        changeOwnPassword,
        deleteUser,
        provisionPortalAccount,
        getPortalAccountInfo,
        syncPortalAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
