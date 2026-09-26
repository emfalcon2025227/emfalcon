import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, Permission, UserPermissionOverride, Owner, Tenant } from "../types";
import { 
  PERMISSION_REGISTRY, 
  getPermissionDefinition, 
  LEGACY_PERMISSION_MAP,
  PermissionDefinition 
} from "../data/permissionRegistry";
import { db, sanitizeForFirestore, auth } from "../lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, getDocs, query, where } from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updatePassword, 
  User as FirebaseUser 
} from "firebase/auth";
import {
  getPortalAccountInfo as getInfoService,
  ProvisionParams,
  PortalAccountDisplayInfo
} from "../services/portalProvisioningService";
import { authenticatedFetch } from "../utils/apiClient";
import { INITIAL_OWNERS, INITIAL_TENANTS } from "../data/seedData";

export const VALID_ERP_ROLES: readonly UserRole[] = [
  "SYSTEM_OWNER",
  "ADMIN",
  "SUPER_ADMIN",
  "MANAGER",
  "SALES_MANAGER",
  "FINANCE",
  "LEGAL",
  "PROPERTY_MANAGER",
  "DATA_ENTRY",
  "TENANT",
  "OWNER",
  "PROPERTY_OWNER"
] as const;

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
  ADMIN: [
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
    "TENANTS.VIEW",
    "LEASES.VIEW",
    "LEASES.CREATE",
    "LEASES.RENEW",
    "CHEQUES.VIEW",
    "CHEQUES.RECORD_BOUNCE",
    "COLLECTIONS.VIEW",
    "REPORTS.FINANCIAL_VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_USERS",
    "EDIT_USER",
    "DELETE_USER",
    "MANAGE_MASTER_DATA",
    "MANAGE_CHEQUES",
    "RECORD_COLLECTIONS",
    "MANAGE_CASES",
    "MANAGE_HEARINGS",
    "VIEW_MAINTENANCE",
    "MANAGE_MAINTENANCE",
    "MANAGE_ARCHIVE",
    "DISPATCH_NOTIFICATIONS",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "VIEW_AUDIT_LOGS"
  ],
  SALES_MANAGER: [
    "DASHBOARD.VIEW",
    "PROPERTIES.VIEW",
    "UNITS.VIEW",
    "TENANTS.VIEW",
    "LEASES.VIEW",
    "LEASES.CREATE",
    "LEASES.RENEW",
    "OWNERS.VIEW",
    "VIEW_DASHBOARD",
    "MANAGE_MASTER_DATA",
    "OCR_SCAN",
    "VIEW_MAINTENANCE",
    "DISPATCH_NOTIFICATIONS",
    "VIEW_REPORTS",
    "EXPORT_DATA",
    "MANAGE_ARCHIVE"
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
  return user.role === "SYSTEM_OWNER";
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
  const isAdminUser = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGER";

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
  loadingAuth: boolean;
  authError: string | null;
  clearAuthError: () => void;
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
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => { success: boolean; error?: string };
  importUsersBatch: (records: Partial<User>[]) => Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }>;
  provisionPortalAccount: (params: Omit<ProvisionParams, "existingUsers" | "saveUser">) => Promise<any>;
  getPortalAccountInfo: (targetId: string, portalRole: "OWNER" | "TENANT", email: string | undefined) => PortalAccountDisplayInfo;
  syncPortalAccounts: (owners: Owner[], tenants: Tenant[]) => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = null;
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
    
    // Ensure initial system owner bootstrap template is present if no SYSTEM_OWNER exists
    const hasSystemOwner = loadedUsers.some(u => isSystemOwnerUser(u));
    if (!hasSystemOwner) {
      loadedUsers = [INITIAL_SYSTEM_OWNER, ...loadedUsers];
    }

    return loadedUsers;
  });

  // Keep live ref to users so async callbacks always access the freshest list
  const usersRef = React.useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const [userPermissionOverrides, setUserPermissionOverrides] = useState<UserPermissionOverride[]>(() => {
    const saved = null;
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
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginMode, setLoginMode] = useState<"STAFF" | "TENANT" | "OWNER" | null>(() => {
    return null as "STAFF" | "TENANT" | "OWNER" | null;
  });

  const clearAuthError = () => setAuthError(null);

  // In-flight promise deduplication to prevent concurrent resolution races
  const inFlightResolutions = React.useRef<Map<string, Promise<User | null>>>(new Map());

  // Dedicated Asynchronous Profile Resolution Logic
  const resolveUserProfile = async (
    fUser: FirebaseUser, 
    currentUsersList?: User[], 
    requestedMode?: "STAFF" | "TENANT" | "OWNER" | null
  ): Promise<User | null> => {
    const fUid = fUser.uid;
    const existingPromise = inFlightResolutions.current.get(fUid);
    if (existingPromise) {
      return existingPromise;
    }

    const resolutionPromise = (async (): Promise<User | null> => {
      const fEmail = (
        fUser.email ||
        fUser.providerData?.[0]?.email ||
        fUser.providerData?.find((p: any) => p?.email)?.email ||
        ""
      ).trim().toLowerCase();
      const fDisplayName = fUser.displayName || fUser.providerData?.[0]?.displayName || "";

      // 1. First, check if a profile document exists directly at users/{fUid}
      try {
        const userDocRef = doc(db, "users", fUid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const profileData = userDocSnap.data() as User;
          if (profileData && profileData.role) {
            let authoritativeRole = profileData.role;
            if (fEmail === "m_hamed@msn.com" || fEmail === "emfalcon2025227@gmail.com") {
              authoritativeRole = "SYSTEM_OWNER";
            }
            const authoritativeProfile: User = {
              ...profileData,
              id: fUid,
              firebaseUid: fUid,
              role: authoritativeRole,
              lastLogin: new Date().toISOString()
            };
            if (authoritativeRole !== profileData.role) {
              setDoc(userDocRef, { role: authoritativeRole, lastLogin: authoritativeProfile.lastLogin }, { merge: true }).catch(() => {});
              if (fEmail) {
                setDoc(doc(db, "users_by_email", fEmail), { role: authoritativeRole, firebaseUid: fUid, id: fUid }, { merge: true }).catch(() => {});
              }
            } else {
              setDoc(userDocRef, { lastLogin: authoritativeProfile.lastLogin }, { merge: true }).catch(() => {});
            }
            return authoritativeProfile;
          }
        }
      } catch (err: any) {
        console.warn("[AuthContext] Direct users/{fUid} lookup notice:", err?.message);
      }

      // 2. Controlled initial bootstrap: If this is the designated initial owner (m_hamed@msn.com),
      // and no document exists yet for this UID in Firestore, bootstrap their SYSTEM_OWNER document
      const isInitialSystemOwner = fEmail === "m_hamed@msn.com" || fEmail === "emfalcon2025227@gmail.com";
      if (isInitialSystemOwner) {
        try {
          console.log(`[AuthContext] Running controlled SYSTEM_OWNER bootstrap for UID: ${fUid}, Email: ${fEmail}`);
          const userDocRef = doc(db, "users", fUid);

          let baseFields = { ...INITIAL_SYSTEM_OWNER };
          try {
            const legacyDoc = await getDoc(doc(db, "users", "usr-01"));
            if (legacyDoc.exists()) {
              baseFields = { ...baseFields, ...(legacyDoc.data() as User) };
            }
          } catch (_) {}

          const newSystemOwnerProfile: User = {
            id: fUid,
            firebaseUid: fUid,
            systemId: "usr-01",
            username: "Mahmoud",
            nameAr: baseFields.nameAr || "محمود محمد محمود حامد",
            nameEn: baseFields.nameEn || "Mahmoud Mohamed Mahmoud Hamed",
            email: fEmail,
            role: "SYSTEM_OWNER",
            isActive: true,
            phone: baseFields.phone || "+971501234567",
            createdAt: baseFields.createdAt || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            mustChangePassword: false,
            isFirstLoginCompleted: true,
            portalAccountStatus: "ACTIVE"
          };

          const sanitized = sanitizeForFirestore(newSystemOwnerProfile);
          await setDoc(userDocRef, sanitized, { merge: true });

          try {
            await setDoc(doc(db, "users_by_email", fEmail), {
              id: fUid,
              firebaseUid: fUid,
              email: fEmail,
              role: "SYSTEM_OWNER",
              isActive: true,
              username: newSystemOwnerProfile.username,
              nameAr: newSystemOwnerProfile.nameAr,
              nameEn: newSystemOwnerProfile.nameEn
            }, { merge: true });
          } catch (eEmail: any) {
            console.warn("[AuthContext] users_by_email mapping notice:", eEmail?.message);
          }

          return newSystemOwnerProfile;
        } catch (err: any) {
          console.error("[AuthContext] Error during SYSTEM_OWNER bootstrap:", err);
          return {
            ...INITIAL_SYSTEM_OWNER,
            id: fUid,
            firebaseUid: fUid,
            email: fEmail,
            username: "Mahmoud",
            nameAr: "محمود محمد محمود حامد",
            nameEn: "Mahmoud Mohamed Mahmoud Hamed",
            role: "SYSTEM_OWNER",
            isActive: true
          };
        }
      }

      // 3. For all other users: Lookup existing profile (NO auto-escalation to SYSTEM_OWNER or ADMIN)
      let match: User | null = null;

      // Lookup in users_by_email mapping table
      if (!match && fEmail) {
        try {
          const emailDoc = await getDoc(doc(db, "users_by_email", fEmail));
          if (emailDoc.exists()) {
            const emailData = emailDoc.data();
            const targetId = emailData.id;
            if (targetId) {
              try {
                const targetDoc = await getDoc(doc(db, "users", targetId));
                if (targetDoc.exists()) {
                  const targetData = targetDoc.data() as User;
                  match = { ...targetData, id: targetId, firebaseUid: fUid };
                  if (targetData.firebaseUid !== fUid) {
                    await setDoc(doc(db, "users", targetId), { firebaseUid: fUid }, { merge: true }).catch(() => {});
                  }
                }
              } catch (targetErr: any) {
                console.warn("[AuthContext] Target user doc lookup notice:", targetErr?.message);
              }
            }
          }
        } catch (err: any) {
          console.warn("[AuthContext] users_by_email lookup error:", err?.message);
        }
      }

      // Fallback query by firebaseUid
      if (!match) {
        try {
          const qUid = query(collection(db, "users"), where("firebaseUid", "==", fUid));
          const snapUid = await getDocs(qUid);
          if (!snapUid.empty) {
            const d = snapUid.docs[0].data() as User;
            match = { ...d, id: snapUid.docs[0].id, firebaseUid: fUid };
          }
        } catch (err: any) {
          console.warn("[AuthContext] firebaseUid query notice:", err?.message);
        }
      }

      // Fallback query by email in Firestore users collection
      if (!match && fEmail) {
        try {
          const qEmail = query(collection(db, "users"), where("email", "==", fEmail));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const d = snapEmail.docs[0].data() as User;
            match = { ...d, id: snapEmail.docs[0].id, firebaseUid: fUid };
            if (d.firebaseUid !== fUid) {
              await setDoc(doc(db, "users", snapEmail.docs[0].id), { firebaseUid: fUid }, { merge: true }).catch(() => {});
            }
          }
        } catch (err: any) {
          console.warn("[AuthContext] users query by email notice:", err?.message);
        }
      }

      // Check Tenant records by email
      if (!match && fEmail) {
        const matchedLocalTenant = INITIAL_TENANTS.find(t => (t.email || "").trim().toLowerCase() === fEmail);
        if (matchedLocalTenant) {
          match = {
            id: fUid,
            systemId: "usr-tnt-" + matchedLocalTenant.id,
            username: fEmail.split("@")[0],
            nameEn: matchedLocalTenant.nameEn || fDisplayName || "Tenant",
            nameAr: matchedLocalTenant.nameAr || "مستأجر",
            email: fEmail,
            role: "TENANT",
            tenantId: matchedLocalTenant.id,
            isActive: matchedLocalTenant.status !== "INACTIVE",
            firebaseUid: fUid,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
        } else {
          try {
            const qTenant = query(collection(db, "tenants"), where("email", "==", fEmail));
            const snapTenant = await getDocs(qTenant);
            if (!snapTenant.empty) {
              const tenantData = snapTenant.docs[0].data();
              match = {
                id: fUid,
                systemId: "usr-tnt-" + snapTenant.docs[0].id,
                username: fEmail.split("@")[0],
                nameEn: tenantData.nameEn || fDisplayName || "Tenant",
                nameAr: tenantData.nameAr || "مستأجر",
                email: fEmail,
                role: "TENANT",
                tenantId: snapTenant.docs[0].id,
                isActive: tenantData.status !== "INACTIVE",
                firebaseUid: fUid,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
              };
              if (tenantData.firebaseUid !== fUid) {
                await setDoc(doc(db, "tenants", snapTenant.docs[0].id), { firebaseUid: fUid }, { merge: true }).catch(() => {});
              }
            }
          } catch (err: any) {
            console.warn("[AuthContext] Tenant lookup by email notice:", err?.message);
          }
        }
      }

      // Check Owner records by email
      if (!match && fEmail) {
        const matchedLocalOwner = INITIAL_OWNERS.find(o => (o.email || "").trim().toLowerCase() === fEmail);
        if (matchedLocalOwner) {
          match = {
            id: fUid,
            systemId: "usr-own-" + matchedLocalOwner.id,
            username: fEmail.split("@")[0],
            nameEn: matchedLocalOwner.nameEn || fDisplayName || "Property Owner",
            nameAr: matchedLocalOwner.nameAr || "مالك عقار",
            email: fEmail,
            role: "OWNER",
            ownerId: matchedLocalOwner.id,
            isActive: matchedLocalOwner.status !== "INACTIVE",
            firebaseUid: fUid,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
        } else {
          try {
            const qOwner = query(collection(db, "owners"), where("email", "==", fEmail));
            const snapOwner = await getDocs(qOwner);
            if (!snapOwner.empty) {
              const ownerData = snapOwner.docs[0].data();
              match = {
                id: fUid,
                systemId: "usr-own-" + snapOwner.docs[0].id,
                username: fEmail.split("@")[0],
                nameEn: ownerData.nameEn || fDisplayName || "Property Owner",
                nameAr: ownerData.nameAr || "مالك عقار",
                email: fEmail,
                role: "OWNER",
                ownerId: snapOwner.docs[0].id,
                isActive: ownerData.status !== "INACTIVE",
                firebaseUid: fUid,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
              };
              if (ownerData.firebaseUid !== fUid) {
                await setDoc(doc(db, "owners", snapOwner.docs[0].id), { firebaseUid: fUid }, { merge: true }).catch(() => {});
              }
            }
          } catch (err: any) {
            console.warn("[AuthContext] Owner lookup by email notice:", err?.message);
          }
        }
      }

      // If match found for regular user, save to Firestore if needed
      if (match) {
        if (fEmail === "emfalcon2025227@gmail.com" || fEmail === "m_hamed@msn.com") {
          match.role = "SYSTEM_OWNER";
        }

        // Enforce explicit valid ERP role allowlist
        if (!VALID_ERP_ROLES.includes(match.role)) {
          console.warn("[AuthContext] User profile has invalid or unsupported role:", match.role);
          return null;
        }

        try {
          const sanitizedMatch = sanitizeForFirestore({
            ...match,
            id: match.id || fUid,
            firebaseUid: fUid,
            lastLogin: new Date().toISOString()
          });
          await setDoc(doc(db, "users", match.id || fUid), sanitizedMatch, { merge: true }).catch(() => {});
          if (fEmail) {
            await setDoc(doc(db, "users_by_email", fEmail.trim().toLowerCase()), { role: match.role, firebaseUid: fUid, id: match.id || fUid }, { merge: true }).catch(() => {});
          }
        } catch (e: any) {
          console.warn("[AuthContext] setDoc update error:", e?.message);
        }
      }

      // If no profile match found, do NOT auto-provision an ERP profile. Fail closed to null.
      return match;
    })().finally(() => {
      inFlightResolutions.current.delete(fUid);
    });

    inFlightResolutions.current.set(fUid, resolutionPromise);
    return resolutionPromise;
  };

  // Listen to Firebase Auth state changes and resolve user profile
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      if (!isMounted) return;

      if (!fUser) {
        (window as any).__firebaseToken = "";
        setFirebaseUser(null);
        setCurrentUser(null);
        setLoadingAuth(false);
        setAuthError(null);
        return;
      }

      setFirebaseUser(fUser);
      setLoadingAuth(true);
      setAuthError(null);

      try {
        const token = await fUser.getIdToken();
        (window as any).__firebaseToken = token;
      } catch (err) {
        console.warn("[AuthContext] Failed to update global window token fallback:", err);
      }

      try {
        const resolved = await resolveUserProfile(fUser, usersRef.current);
        if (!isMounted) return;

        if (resolved) {
          if (!resolved.isActive) {
            setAuthError("تم تعطيل هذا الحساب من قِبل إدارة النظام. يرجى التواصل مع مالك النظام.");
            setCurrentUser(null);
            signOut(auth).catch(() => {});
          } else if (!VALID_ERP_ROLES.includes(resolved.role)) {
            setAuthError("عذراً، دور هذا المستخدم غير صالح أو غير معتمد في النظام.");
            setCurrentUser(null);
            signOut(auth).catch(() => {});
          } else {
            setCurrentUser(resolved);
            setUsers(prev => {
              const filtered = prev.filter(u => u.id !== "usr-01" && u.id !== resolved.id && (u.email || "").toLowerCase() !== (resolved.email || "").toLowerCase());
              return [resolved, ...filtered];
            });
            // Update login mode according to role
            if (resolved.role === "TENANT") {
              setLoginMode("TENANT");
            } else if (resolved.role === "OWNER" || resolved.role === "PROPERTY_OWNER" || !!resolved.ownerId) {
              setLoginMode("OWNER");
            } else {
              setLoginMode(prev => (prev === "TENANT" || prev === "OWNER" ? "STAFF" : (prev || "STAFF")));
            }
            setAuthError(null);
          }
        } else {
          setAuthError("عذراً، هذا الحساب غير مسجل كمستخدم مصرح له في نظام صقر الإمارات ERP. يرجى التواصل مع إدارة النظام.");
          setCurrentUser(null);
          signOut(auth).catch(() => {});
        }
      } catch (err: any) {
        console.error("[AuthContext] Profile resolution error:", err);
        setAuthError(err?.message || "حدث خطأ أثناء تحميل بيانات الملف الشخصي للمستخدم.");
        setCurrentUser(null);
        signOut(auth).catch(() => {});
      } finally {
        if (isMounted) {
          setLoadingAuth(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Ensure initial system owner bootstrap template is present if no SYSTEM_OWNER exists
    setUsers((prev) => {
      let updated = prev.filter(u => u.id !== "usr-02" && u.id !== "usr-tenant" && u.id !== "usr-mahmoud-tenant");
      const hasSystemOwner = updated.some(u => isSystemOwnerUser(u));
      if (!hasSystemOwner) {
        updated = [INITIAL_SYSTEM_OWNER, ...updated];
      }
      return updated;
    });

    // Firestore real-time listener for users (only when authenticated)
    if (!firebaseUser) {
      return;
    }

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

          // If current user is logged in, refresh their record if changed
          setCurrentUser(prev => {
            if (!prev) return null;
            const updated = finalRemote.find(u => u.id === prev.id);
            return updated || prev;
          });
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
  }, [firebaseUser]);

  useEffect(() => {
    try {
      // localStorage.setItem("ef_users", JSON.stringify(users));
    } catch (e) {
      console.warn("[AuthContext] Unable to save users to localStorage:", e);
    }
  }, [users]);

  useEffect(() => {
    try {
      // localStorage.setItem("ef_user_overrides", JSON.stringify(userPermissionOverrides));
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
      }
    } catch (e) {
      console.warn("[AuthContext] Unable to save current user id:", e);
    }
  }, [currentUser]);

  // ef_login_mode localStorage behavior removed for security

  const login = async (usernameOrEmail: string, password: string, mode: "STAFF" | "TENANT" | "OWNER"): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const clean = usernameOrEmail.trim().toLowerCase();

    // 1. Determine target user candidate and canonical email
    let targetEmail = "";
    let candidateUser: User | undefined;

    if (clean.includes("@")) {
      targetEmail = clean;
      candidateUser = users.find(u => (u.email || "").trim().toLowerCase() === clean) ||
                      usersRef.current.find(u => (u.email || "").trim().toLowerCase() === clean);
    } else {
      // Look up candidate by username in memory
      candidateUser = users.find(u => (u.username || "").trim().toLowerCase() === clean) ||
                      usersRef.current.find(u => (u.username || "").trim().toLowerCase() === clean);
      if (candidateUser && candidateUser.email) {
        targetEmail = candidateUser.email.trim().toLowerCase();
      }

      // If not resolved from memory, query Firestore users collection by username
      if (!targetEmail) {
        try {
          const qUser = query(collection(db, "users"), where("username", "==", clean));
          const snapUser = await getDocs(qUser);
          if (!snapUser.empty) {
            const uData = snapUser.docs[0].data() as User;
            if (uData.email) {
              targetEmail = uData.email.trim().toLowerCase();
              candidateUser = { ...uData, id: snapUser.docs[0].id };
            }
          }
        } catch (queryErr) {
          console.warn("[Auth] Firestore username lookup warning:", queryErr);
        }
      }
    }

    // Direct fallback for SYSTEM_OWNER approved aliases
    if (!targetEmail && (clean === "mahmoud" || clean === "admin" || clean === "owner")) {
      targetEmail = "m_hamed@msn.com";
      candidateUser = users.find(u => u.email === "m_hamed@msn.com") || INITIAL_SYSTEM_OWNER;
    }

    if (!targetEmail) {
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }

    if (candidateUser && candidateUser.isActive === false) {
      return { success: false, error: "تم تعطيل هذا الحساب من قِبل إدارة النظام. يرجى التواصل مع مالك النظام." };
    }

    try {
      setLoadingAuth(true);
      let fUser: FirebaseUser | null = null;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
        fUser = userCredential.user;
      } catch (signInErr: any) {
        console.warn("[Auth] signInWithEmailAndPassword note:", signInErr.code);
        setLoadingAuth(false);

        if (signInErr.code === "auth/operation-not-allowed") {
          return {
            success: false,
            error: "تسجيل الدخول بالبريد وكلمة المرور (Email/Password) غير مفعّل في مشروع Firebase الجديد (emirates-falcon-erp). يرجى تفعيله من Firebase Console > Authentication > Sign-in method."
          };
        }
        if (
          signInErr.code === "auth/user-not-found" ||
          signInErr.code === "auth/invalid-credential" ||
          signInErr.code === "auth/invalid-login-credentials" ||
          signInErr.code === "auth/wrong-password"
        ) {
          return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
        }
        if (signInErr.code === "auth/too-many-requests") {
          return { success: false, error: "تم حظر الحساب مؤقتاً بسبب محاولات دخول خاطئة متكررة. يرجى المحاولة لاحقاً" };
        }
        return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      }

      if (!fUser) {
        setLoadingAuth(false);
        return { success: false, error: "فشل التحقق من بيانات الحساب" };
      }

      // Direct profile resolution on credential return
      const resolved = await resolveUserProfile(fUser, usersRef.current, mode);
      if (resolved) {
        if (!resolved.isActive) {
          await signOut(auth).catch(() => {});
          setCurrentUser(null);
          setLoadingAuth(false);
          return { success: false, error: "تم تعطيل هذا الحساب من قِبل إدارة النظام. يرجى التواصل مع مالك النظام." };
        }

        if (!VALID_ERP_ROLES.includes(resolved.role)) {
          await signOut(auth).catch(() => {});
          setCurrentUser(null);
          setLoadingAuth(false);
          return { success: false, error: "عذراً، دور هذا المستخدم غير صالح أو غير معتمد في النظام." };
        }

        // Validate that the user role matches the selected login mode
        if (mode === "OWNER") {
          const isOwner = resolved.role === "OWNER" || resolved.role === "PROPERTY_OWNER" || !!resolved.ownerId || resolved.role === "SYSTEM_OWNER";
          if (!isOwner) {
            await signOut(auth).catch(() => {});
            setCurrentUser(null);
            setLoadingAuth(false);
            return { success: false, error: "عذراً، هذا الحساب غير مسجل كمالك في النظام." };
          }
        } else if (mode === "TENANT") {
          const isTenant = resolved.role === "TENANT" || !!resolved.tenantId || resolved.role === "SYSTEM_OWNER";
          if (!isTenant) {
            await signOut(auth).catch(() => {});
            setCurrentUser(null);
            setLoadingAuth(false);
            return { success: false, error: "عذراً، هذا الحساب غير مسجل كمستأجر في النظام." };
          }
        } else if (mode === "STAFF") {
          const isStaff = resolved.role !== "OWNER" && resolved.role !== "PROPERTY_OWNER" && resolved.role !== "TENANT" && !resolved.ownerId && !resolved.tenantId;
          if (!isStaff) {
            await signOut(auth).catch(() => {});
            setCurrentUser(null);
            setLoadingAuth(false);
            return { success: false, error: "عذراً، هذا الحساب غير مصرح له بالدخول كعضو إدارة." };
          }
        }

        setCurrentUser(resolved);
        setLoginMode(mode);
        setUsers(prev => {
          const filtered = prev.filter(u => u.id !== "usr-01" && u.id !== resolved.id && (u.email || "").toLowerCase() !== (resolved.email || "").toLowerCase());
          return [resolved, ...filtered];
        });
        setLoadingAuth(false);
        return { success: true };
      } else {
        await signOut(auth).catch(() => {});
        setCurrentUser(null);
        setLoadingAuth(false);
        return { success: false, error: "عذراً، هذا الحساب غير مسجل كمستخدم مصرح له في نظام صقر الإمارات ERP. يرجى التواصل مع إدارة النظام." };
      }
    } catch (error: any) {
      setLoadingAuth(false);
      console.error("[Auth] Firebase login failed:", error.code, error.message);
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found" || error.code === "auth/invalid-login-credentials") {
        return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      }
      if (error.code === "auth/too-many-requests") {
        return { success: false, error: "تم حظر الحساب مؤقتاً بسبب محاولات دخول خاطئة متكررة. يرجى المحاولة لاحقاً" };
      }
      if (error.code === "auth/operation-not-allowed") {
        return { success: false, error: "auth/operation-not-allowed" };
      }
      return { success: false, error: error.message || "فشلت عملية تسجيل الدخول" };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("[Auth] Firebase signOut error:", e);
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    setLoginMode(null);
    setAuthError(null);
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
    if (newUser.email) {
      setDoc(doc(db, "users_by_email", newUser.email.trim().toLowerCase()), {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive
      }, { merge: true }).catch((e) => {
        console.warn("[AuthContext] Firestore users_by_email sync error:", e.message);
      });
    }
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
    if (updated.email) {
      setDoc(doc(db, "users_by_email", updated.email.trim().toLowerCase()), {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive
      }, { merge: true }).catch((e) => {
        console.warn("[AuthContext] Firestore users_by_email sync error:", e.message);
      });
    }
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
    if (target.email) {
      setDoc(doc(db, "users_by_email", target.email.trim().toLowerCase()), {
        isActive
      }, { merge: true }).catch((e) => {
        console.warn("[AuthContext] Firestore users_by_email sync status error:", e.message);
      });
    }
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
    if (target.email) {
      setDoc(doc(db, "users_by_email", target.email.trim().toLowerCase()), {
        role: newRole
      }, { merge: true }).catch((e) => {
        console.warn("[AuthContext] Firestore users_by_email sync role error:", e.message);
      });
    }
    return { success: true };
  };

  const resetUserPassword = (userId: string, newPassword?: string): string => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && (targetUser.role === "OWNER" || targetUser.role === "TENANT")) {
      console.warn("resetUserPassword called for Owner/Tenant. This is forbidden. Use Firebase Secure Reset.");
      return "";
    }
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

  const changeOwnPassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: "المستخدم غير مسجل الدخول" };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: "كلمة المرور الجديدة يجب أن لا تقل عن 6 رموز" };
    }

    try {
      // Direct credential update in Firebase Authentication
      await updatePassword(auth.currentUser, newPassword);

      if (currentUser) {
        const updatedUser: User = { 
          ...currentUser, 
          mustChangePassword: false,
          isFirstLoginCompleted: true,
          portalAccountStatus: "ACTIVE"
        };
        // Remove direct password fields from application database records
        delete updatedUser.password;
        
        setCurrentUser(updatedUser);
        setUsers((prev) =>
          prev.map((u) => (u.id === currentUser.id ? updatedUser : u))
        );
        // Persist profile updates to Firestore
        await setDoc(doc(db, "users", currentUser.id), sanitizeForFirestore(updatedUser), { merge: true });
      }
      return { success: true };
    } catch (e: any) {
      console.error("[Auth] Change password failed:", e.message);
      if (e.code === "auth/requires-recent-login") {
        return { success: false, error: "تتطلب هذه العملية تسجيل الدخول مجدداً للأمان" };
      }
      return { success: false, error: e.message || "فشل تغيير كلمة المرور" };
    }
  };

  const saveUser = (userToSave: User) => {
    let finalUser = { ...userToSave };
    // Do not allow password fields for Owner/Tenant portal authentication
    if (finalUser.role === "OWNER" || finalUser.role === "TENANT") {
      delete finalUser.password;
    } else if (finalUser.password && finalUser.password.length < 20 && !finalUser.password.endsWith("==") && finalUser.password.length !== 64) {
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

  const provisionPortalAccount = async (params: Omit<ProvisionParams, "existingUsers" | "saveUser">) => {
    try {
      const response = await authenticatedFetch('/api/auth/provision-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.error };
      }

      if (data.user) {
        saveUser(data.user);
      }
      return { success: true, user: data.user, isNew: data.isNew, message: data.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const getPortalAccountInfo = (targetId: string, portalRole: "OWNER" | "TENANT", email: string | undefined) => {
    return getInfoService(targetId, portalRole, email, users);
  };

  const syncPortalAccounts = async (owners: Owner[], tenants: Tenant[]) => {
    try {
      const response = await authenticatedFetch('/api/auth/sync-portal-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners, tenants })
      });
      const data = await response.json();
      if (data.success && typeof data.createdCount === 'number') {
        return data.createdCount;
      }
      return 0;
    } catch (e) {
      console.warn("[AuthContext] syncPortalAccounts network error:", e);
      return 0;
    }
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

  const importUsersBatch = async (records: Partial<User>[]): Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }> => {
    let importedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      try {
        if (!rec.username && !rec.email && !rec.nameAr && !rec.nameEn) {
          errors.push(`السجل رقم ${i + 1}: ينقصه اسم المستخدم أو البريد الإلكتروني`);
          continue;
        }

        const emailClean = (rec.email || "").trim().toLowerCase();
        const usernameClean = (rec.username || "").trim().toLowerCase();

        // Preserve ROOT system owner
        if (rec.role === "SYSTEM_OWNER" || rec.id === "usr-01" || emailClean === "m_hamed@msn.com") {
          continue;
        }

        const existingUser = users.find(u => 
          (rec.id && u.id === rec.id) || 
          (emailClean && (u.email || "").trim().toLowerCase() === emailClean) ||
          (usernameClean && (u.username || "").trim().toLowerCase() === usernameClean)
        );

        const userId = rec.id || (existingUser ? existingUser.id : "usr-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6));

        const fullUser: User = {
          id: userId,
          username: rec.username || emailClean.split("@")[0] || ("user_" + userId.slice(-4)),
          email: rec.email || "",
          nameAr: rec.nameAr || rec.nameEn || rec.username || "مستخدم",
          nameEn: rec.nameEn || rec.nameAr || rec.username || "User",
          role: rec.role || "PROPERTY_MANAGER",
          phone: rec.phone || "",
          tenantId: rec.tenantId,
          ownerId: rec.ownerId,
          permissions: rec.permissions || [],
          userPermissionOverrides: rec.userPermissionOverrides || [],
          isActive: rec.isActive !== undefined ? rec.isActive : true,
          createdAt: rec.createdAt || new Date().toISOString(),
          lastLogin: rec.lastLogin,
          password: rec.password || "Falcon@1234",
          mustChangePassword: rec.mustChangePassword || false,
          isFirstLoginCompleted: rec.isFirstLoginCompleted !== undefined ? rec.isFirstLoginCompleted : true,
          portalAccountStatus: rec.portalAccountStatus || "ACTIVE",
          firebaseUid: rec.firebaseUid
        };

        if (existingUser) {
          updatedCount++;
        } else {
          importedCount++;
        }

        setUsers(prev => {
          const idx = prev.findIndex(u => u.id === fullUser.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = fullUser;
            return copy;
          }
          return [...prev, fullUser];
        });

        // Persist doc into Firestore
        await setDoc(doc(db, "users", fullUser.id), sanitizeForFirestore(fullUser), { merge: true });
        if (fullUser.email) {
          await setDoc(doc(db, "users_by_email", fullUser.email.trim().toLowerCase()), {
            id: fullUser.id,
            email: fullUser.email,
            role: fullUser.role,
            isActive: fullUser.isActive
          }, { merge: true });
        }
      } catch (err: any) {
        errors.push(`خطأ في السجل رقم ${i + 1}: ${err?.message || String(err)}`);
      }
    }

    return { total: records.length, importedCount, updatedCount, errors };
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
        loadingAuth,
        authError,
        clearAuthError,
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
        importUsersBatch,
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
