import { initializeApp } from "firebase/app";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);

// In browser and sandboxed iframe environments, default WebChannel streaming transport
// often gets blocked or buffered by the reverse proxy on its first attempt, logging:
// "Could not reach Cloud Firestore backend. Connection failed 1 times."
// Using initializeFirestore with experimentalForceLongPolling enables immediate, robust long-polling transport.
const isBrowser = typeof window !== "undefined";

export const db = initializeFirestore(
  app,
  isBrowser
    ? {
        experimentalForceLongPolling: true,
      }
    : {},
  firebaseConfig.firestoreDatabaseId || "(default)"
);

export const auth = getAuth(app);

// Suppress verbose/benign connection retry logs from Firebase Firestore SDK
try {
  setLogLevel("silent");
} catch {
  // Ignore in environments where setLogLevel is restricted
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Preserve Firestore FieldValue objects (e.g. deleteField(), serverTimestamp())
  if (obj.constructor && obj.constructor.name && obj.constructor.name.includes("FieldValue")) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeForFirestore(value);
    }
  }
  return cleaned;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuota = errMessage.toLowerCase().includes("quota") ||
                  errMessage.toLowerCase().includes("exhausted") ||
                  errMessage.toLowerCase().includes("limit") ||
                  errMessage.toLowerCase().includes("billing");
  const isConnection = errMessage.toLowerCase().includes("unavailable") ||
                       errMessage.toLowerCase().includes("could not reach") ||
                       errMessage.toLowerCase().includes("connection failed");

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  if (isQuota) {
    console.warn('Firestore Quota Notice: Fallback Local Storage Mode is active. Detail: ', JSON.stringify(errInfo));
  } else if (isConnection) {
    console.warn('Firestore Connection Notice: Operating in local/offline mode. Detail: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

