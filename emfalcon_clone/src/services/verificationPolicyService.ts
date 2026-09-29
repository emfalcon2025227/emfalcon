/**
 * ============================================================================
 * PRODUCTION REALITY: AI VERIFICATION + MANUAL OVERRIDE POLICY SERVICE
 * ============================================================================
 * 
 * Core Philosophy:
 * "AI is a verification tool, not the sole authority. AI extracts and compares.
 * Authorized humans may override when the automated verification service is
 * unavailable or fails, but every override must be explicit, authorized,
 * reasoned, traceable, and auditable. An override must never fabricate, modify,
 * or conceal AI-extracted data."
 * 
 * Rule 1: Two Official Paths:
 *   - Path 1: AI Verification (Automatic Deterministic Match)
 *   - Path 2: Manual Override (Explicit Human Authorized Decision)
 * Rule 2: AI is not a single point of failure (never lock a transaction forever if AI is down).
 * Rule 3: Override is NOT Fake Success (never set match = true or conceal failure).
 * Rule 4: Standard Override on AI failure/unavailability requires mandatory reason & standard authority.
 * Rule 5: Mismatch Override requires escalated high-level authority (Super Admin / System Owner).
 * Rule 6: Never alter or fabricate AI-extracted values. Keep original values for audit.
 * Rule 7: One single authoritative financial transaction identity and amount.
 * Rule 8: Proof document is mandatory when required.
 * Rule 9: Full structured audit trail logged in existing audit infrastructure.
 * Rule 10: Strict Settlement Gate:
 *   Allowed ONLY for: AI_VERIFIED, MANUALLY_VERIFIED, or OVERRIDDEN (with high-level auth).
 */

import { UserRole, AuditActionType } from "../types";

export const PRODUCTION_REALITY_RULE_EN =
  "AI is a verification tool, not the sole authority. AI extracts and compares. Authorized humans may override when the automated verification service is unavailable or fails, but every override must be explicit, authorized, reasoned, traceable, and auditable. An override must never fabricate, modify, or conceal AI-extracted data.";

export const PRODUCTION_REALITY_RULE_AR =
  "الذكاء الاصطناعي أداة تحقق ومطابقة وليس السلطة المطلقة. يقوم الذكاء الاصطناعي بالاستخراج والمقارنة، ويحق للموظفين المخولين اعتماد المعاملات يدويًا عند تعذر أو فشل الخدمة الآلية، بشرط أن يكون كل اعتماد صريحًا، مخولاً، مسببًا، قابلاً للتتبع والتدقيق، ودون أي تعديل أو تزييف أو إخفاء للبيانات المستخرجة.";

export type FinancialVerificationStatus =
  | "AI_VERIFIED"
  | "MANUALLY_VERIFIED"
  | "OVERRIDDEN"
  | "MISMATCH"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "UNVERIFIED";

export type VerificationMethod =
  | "AI_AUTOMATED"
  | "MANUAL_OVERRIDE"
  | "MISMATCH_OVERRIDE";

export type VerificationOverrideType =
  | "AI_UNAVAILABLE"
  | "OCR_FAILED"
  | "DOCUMENT_UNREADABLE"
  | "SERVICE_ERROR"
  | "NETWORK_ERROR"
  | "MANUAL_REVIEW_AFTER_MISMATCH"
  | "OTHER";

export type VerificationAuthorizationLevel = "STANDARD" | "HIGH_LEVEL";

export interface AiVerificationDetails {
  aiStatus: "MATCH" | "MISMATCH" | "NEEDS_REVIEW" | "FAILED" | "UNAVAILABLE";
  failureReason?: string;
  extractedValues?: {
    amount?: number | string;
    bankName?: string;
    referenceNumber?: string;
    accountNumber?: string;
    date?: string;
    [key: string]: any;
  };
  expectedValues?: {
    amount?: number | string;
    bankName?: string;
    referenceNumber?: string;
    accountNumber?: string;
    date?: string;
    [key: string]: any;
  };
  comparisonResults?: {
    amountMatch?: boolean;
    bankMatch?: boolean;
    referenceMatch?: boolean;
    accountMatch?: boolean;
    [key: string]: any;
  };
  analyzedAt: string;
}

export interface VerificationAuditPayload {
  transactionId: string;
  entityType: string;
  proofDocumentId?: string;
  proofFileName?: string;
  proofHash?: string;
  verificationMethod: VerificationMethod;
  previousVerificationStatus: string;
  aiStatus: string;
  aiExtractedValues: Record<string, any>;
  expectedValues: Record<string, any>;
  comparisonResults: Record<string, any>;
  overrideReason?: string;
  overrideType?: VerificationOverrideType;
  verifiedBy: {
    userId: string;
    userName: string;
  };
  verifiedAt: string;
  userRole: string;
  authorizationLevel: VerificationAuthorizationLevel;
  finalStatus: FinancialVerificationStatus;
}

/**
 * Standard authorized users: FINANCE, MANAGER, SUPER_ADMIN, SYSTEM_OWNER.
 * Can override when AI is unavailable, failed, timed out, or unreadable.
 */
export function isStandardOverrideAuthorized(userRole?: UserRole | string): boolean {
  if (!userRole) return false;
  const standardAuthorizedRoles: (UserRole | string)[] = [
    "FINANCE",
    "MANAGER",
    "SUPER_ADMIN",
    "SYSTEM_OWNER",
  ];
  return standardAuthorizedRoles.includes(userRole);
}

/**
 * Higher authorized users: SUPER_ADMIN, SYSTEM_OWNER.
 * Required for MISMATCH overrides (where AI read a conflicting amount/bank).
 */
export function isHighLevelOverrideAuthorized(userRole?: UserRole | string): boolean {
  if (!userRole) return false;
  const highLevelRoles: (UserRole | string)[] = [
    "SUPER_ADMIN",
    "SYSTEM_OWNER",
  ];
  return highLevelRoles.includes(userRole);
}

/**
 * Validates whether the given user can perform the requested manual override.
 */
export function checkManualOverridePermission(params: {
  userRole?: UserRole | string;
  overrideType: VerificationOverrideType;
  isMismatch?: boolean;
}): {
  allowed: boolean;
  requiredLevel: VerificationAuthorizationLevel;
  errorEn?: string;
  errorAr?: string;
} {
  const { userRole, overrideType, isMismatch } = params;

  // Case 1: Mismatch Override (High Risk)
  if (isMismatch || overrideType === "MANUAL_REVIEW_AFTER_MISMATCH") {
    if (!isHighLevelOverrideAuthorized(userRole)) {
      return {
        allowed: false,
        requiredLevel: "HIGH_LEVEL",
        errorEn: "Mismatch override requires higher administrative authorization (Super Admin or System Owner).",
        errorAr: "اعتماد التجاوز عند عدم التطابق يتطلب صلاحية إدارية عليا (مدير النظام أو المشرف العام).",
      };
    }
    return { allowed: true, requiredLevel: "HIGH_LEVEL" };
  }

  // Case 2: Standard AI Failure / Unavailability Override
  if (!isStandardOverrideAuthorized(userRole)) {
    return {
      allowed: false,
      requiredLevel: "STANDARD",
      errorEn: "Manual verification requires authorized finance or manager role.",
      errorAr: "الاعتماد اليدوي يتطلب دوراً مخولاً (المالية أو مدير أو المشرف العام).",
    };
  }

  return { allowed: true, requiredLevel: "STANDARD" };
}

/**
 * Strict Settlement Gate evaluator.
 * Settlement is permitted ONLY for:
 *   1. AI_VERIFIED (or MATCH)
 *   2. MANUALLY_VERIFIED (authorized standard override + mandatory reason + proof)
 *   3. OVERRIDDEN (authorized high-level mismatch override + mandatory reason + proof)
 * 
 * Every other state is BLOCKED.
 */
export function evaluateSettlementGate(params: {
  verificationStatus: FinancialVerificationStatus | string;
  hasProof?: boolean;
  hasValidProofDocument?: boolean;
  isProofResolved?: boolean;
  hasReferenceNumberOnly?: boolean;
  proofRequired?: boolean;
  overrideReason?: string;
  overrideType?: VerificationOverrideType;
  originalAiStatus?: string;
  authorizationLevel?: VerificationAuthorizationLevel;
  userRole?: UserRole | string;
  isMismatch?: boolean;
}): {
  allowed: boolean;
  reasonEn: string;
  reasonAr: string;
} {
  const {
    verificationStatus,
    hasProof,
    hasValidProofDocument,
    isProofResolved,
    hasReferenceNumberOnly,
    proofRequired = true,
    overrideReason,
    overrideType,
    originalAiStatus,
    userRole,
    isMismatch,
  } = params;

  // 1. Check for reference-only bypass attempt (Section 6 & 7 of Production Reality)
  if (hasReferenceNumberOnly) {
    return {
      allowed: false,
      reasonEn: "Settlement denied: A transaction reference number is NOT a deposit proof document. An actual uploaded or archived document is mandatory.",
      reasonAr: "تم رفض التسوية: رقم المرجع أو الحوالة ليس مستند إثبات إيداع. إرفاق مستند إثبات فعلي موثق إلزامي.",
    };
  }

  // 2. Check for unresolved proof document ID (Section 6: proofDocumentId must resolve in archive)
  if (isProofResolved === false) {
    return {
      allowed: false,
      reasonEn: "Settlement denied: The referenced proofDocumentId cannot be resolved to a valid archived document belonging to this transaction.",
      reasonAr: "تم رفض التسوية: معرّف الإثبات غير موجود في الأرشيف ولا يمكن التحقق من المستند الفعلي.",
    };
  }

  // 3. Proof document existence check
  const hasActualProof = hasValidProofDocument !== undefined ? hasValidProofDocument : Boolean(hasProof);
  if (proofRequired && !hasActualProof) {
    return {
      allowed: false,
      reasonEn: "Settlement denied: Bank deposit proof or receipt document is mandatory.",
      reasonAr: "تم رفض التسوية: إرفاق إثبات الإيداع البنكي أو إيصال السداد إلزامي.",
    };
  }

  // 2. Automatic AI match
  if (verificationStatus === "AI_VERIFIED" || verificationStatus === "MATCH") {
    return {
      allowed: true,
      reasonEn: "Settlement permitted: AI deterministic verification succeeded.",
      reasonAr: "التسوية مسموحة: تم التحقق الآلي بنجاح وتطابق تام.",
    };
  }

  // 3. Manual Verification (Standard Override when AI failed or was unavailable)
  if (verificationStatus === "MANUALLY_VERIFIED") {
    // Reason is strictly mandatory
    if (!overrideReason || !overrideReason.trim()) {
      return {
        allowed: false,
        reasonEn: "Settlement denied: Mandatory override reason is required for manual verification.",
        reasonAr: "تم رفض التسوية: يجب كتابة سبب الاعتماد اليدوي بشكل إجباري.",
      };
    }

    // Role check: Must have standard authorization
    if (!isStandardOverrideAuthorized(userRole)) {
      return {
        allowed: false,
        reasonEn: "Settlement denied: User lacks authorized permission for manual verification.",
        reasonAr: "تم رفض التسوية: المستخدم لا يملك الصلاحية المعتمدة للتحقق اليدوي.",
      };
    }

    // Protection against hiding a mismatch under standard manual verification
    if (originalAiStatus === "MISMATCH" || isMismatch) {
      return {
        allowed: false,
        reasonEn: "Settlement denied: Discrepancy (MISMATCH) detected by AI cannot be approved with standard manual verification. Escalated high-level override is required.",
        reasonAr: "تم رفض التسوية: وجود عدم تطابق (MISMATCH) لا يمكن اعتماده بالتحقق اليدوي العادي، ويتطلب اعتماداً استثنائياً عالي الصلاحية.",
      };
    }

    return {
      allowed: true,
      reasonEn: "Settlement permitted: Authorized manual verification with recorded reason.",
      reasonAr: "التسوية مسموحة: تم الاعتماد اليدوي بموجب صلاحية معتمدة وسبب موثق.",
    };
  }

  // 4. Mismatch Override (Escalated High-Level Override)
  if (verificationStatus === "OVERRIDDEN" || verificationStatus === "MANUALLY_OVERRIDDEN") {
    // Reason is strictly mandatory
    if (!overrideReason || !overrideReason.trim()) {
      return {
        allowed: false,
        reasonEn: "Settlement denied: Mandatory high-level justification reason is required for mismatch override.",
        reasonAr: "تم رفض التسوية: كتابة التبرير الإداري المفصل إلزامي عند تجاوز عدم التطابق.",
      };
    }

    // Must be high-level authorized
    if (!isHighLevelOverrideAuthorized(userRole)) {
      return {
        allowed: false,
        reasonEn: "Settlement denied: Only Super Admin or System Owner can override an AI mismatch.",
        reasonAr: "تم رفض التسوية: تجاوز عدم التطابق مقتصر حصراً على المشرف العام أو مدير النظام.",
      };
    }

    return {
      allowed: true,
      reasonEn: "Settlement permitted: Escalated high-level mismatch override approved by authorized administrator.",
      reasonAr: "التسوية مسموحة: تم اعتماد تجاوز عدم التطابق بتفويض إداري عالي ومسبب.",
    };
  }

  // 5. Any other status is denied
  if (verificationStatus === "MISMATCH") {
    return {
      allowed: false,
      reasonEn: "Settlement denied: The proof document does not match the financial record (MISMATCH). Escalated manual review required.",
      reasonAr: "تم رفض التسوية: البيانات في إثبات الإيداع لا تتطابق مع السجل المالي (عدم تطابق). يتطلب مراجعة إدارية عليا.",
    };
  }

  if (verificationStatus === "FAILED") {
    return {
      allowed: false,
      reasonEn: "Settlement denied: Proof verification failed. Manual review and authorized override required.",
      reasonAr: "تم رفض التسوية: فشل التحقق من الإثبات. يتطلب مراجعة واعتماد يدوي مخول.",
    };
  }

  if (verificationStatus === "NEEDS_REVIEW") {
    return {
      allowed: false,
      reasonEn: "Settlement denied: Verification incomplete or requires manual review.",
      reasonAr: "تم رفض التسوية: بيانات الإثبات غير مكتملة وبحاجة لمراجعة واعتماد مخول.",
    };
  }

  return {
    allowed: false,
    reasonEn: "Settlement denied: Financial proof has not been verified.",
    reasonAr: "تم رفض التسوية: لم يتم توثيق أو اعتماد إثبات المعاملة المالية.",
  };
}

/**
 * Builds a comprehensive, structured audit record payload adhering to the
 * existing ERP audit infrastructure.
 */
export function buildVerificationAuditRecord(params: {
  transactionId: string;
  entityType:
    | "OWNER_TRANSFER"
    | "PROPERTY_EXPENSE"
    | "COLLECTION"
    | "COMMISSION"
    | "DOCUMENT"
    | "FINANCIAL_TRANSACTION";
  entityName: string;
  proofDocumentId?: string;
  proofFileName?: string;
  proofHash?: string;
  verificationMethod: VerificationMethod;
  previousVerificationStatus?: string;
  aiStatus: string;
  aiExtractedValues?: Record<string, any>;
  expectedValues?: Record<string, any>;
  comparisonResults?: Record<string, any>;
  overrideReason?: string;
  overrideType?: VerificationOverrideType;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  finalStatus: FinancialVerificationStatus;
}): {
  action: AuditActionType;
  entityType: any;
  entityId: string;
  entityName: string;
  details: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  payload: VerificationAuditPayload;
} {
  const isMismatchOverride =
    params.verificationMethod === "MISMATCH_OVERRIDE" ||
    params.finalStatus === "OVERRIDDEN";

  const action: AuditActionType = isMismatchOverride
    ? "MISMATCH_OVERRIDE"
    : params.verificationMethod === "MANUAL_OVERRIDE"
    ? "MANUAL_OVERRIDE"
    : "FINANCIAL_VERIFICATION";

  const authLevel: VerificationAuthorizationLevel = isMismatchOverride
    ? "HIGH_LEVEL"
    : "STANDARD";

  const payload: VerificationAuditPayload = {
    transactionId: params.transactionId,
    entityType: params.entityType,
    proofDocumentId: params.proofDocumentId,
    proofFileName: params.proofFileName,
    proofHash: params.proofHash,
    verificationMethod: params.verificationMethod,
    previousVerificationStatus: params.previousVerificationStatus || "UNVERIFIED",
    aiStatus: params.aiStatus,
    aiExtractedValues: params.aiExtractedValues || {},
    expectedValues: params.expectedValues || {},
    comparisonResults: params.comparisonResults || {},
    overrideReason: params.overrideReason,
    overrideType: params.overrideType,
    verifiedBy: {
      userId: params.userId,
      userName: params.userName,
    },
    verifiedAt: new Date().toISOString(),
    userRole: String(params.userRole),
    authorizationLevel: authLevel,
    finalStatus: params.finalStatus,
  };

  const details = [
    `Verification Audit [${params.verificationMethod}] -> Final Status: ${params.finalStatus}`,
    `AI Result: ${params.aiStatus}`,
    params.overrideReason ? `Override Reason: ${params.overrideReason}` : null,
    params.overrideType ? `Override Type: ${params.overrideType}` : null,
    `Auth Level: ${authLevel} (Role: ${params.userRole})`,
    `Proof: ${params.proofFileName || params.proofDocumentId || "Attached"}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    action,
    entityType: params.entityType,
    entityId: params.transactionId,
    entityName: params.entityName,
    details,
    oldValue: params.previousVerificationStatus || params.aiStatus,
    newValue: params.finalStatus,
    reason: params.overrideReason,
    payload,
  };
}
