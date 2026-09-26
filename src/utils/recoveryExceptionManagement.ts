/**
 * RECOVERY EXCEPTION MANAGEMENT
 * Tracks and manages issues identified during recovery drills.
 */

export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ExceptionStatus = "OPEN" | "INVESTIGATING" | "MITIGATED" | "RESOLVED" | "ACCEPTED" | "CLOSED";

export interface RecoveryException {
  id: string;
  severity: ExceptionSeverity;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  detectedAt: string;
  detectedBy: string;
  relatedDrillId?: string;
  impactEn: string;
  impactAr: string;
  recommendedActionEn: string;
  recommendedActionAr: string;
  status: ExceptionStatus;
  resolutionNotes?: string;
}

let exceptions: RecoveryException[] = [
  {
    id: "REC-EXC-20260819-001",
    severity: "MEDIUM",
    category: "PERFORMANCE",
    descriptionEn: "Recovery drill for large dataset exceeded target RTO by 12%.",
    descriptionAr: "تجاوز اختبار التعافي لمجموعة البيانات الكبيرة الوقت المستهدف بنسبة 12%.",
    detectedAt: "2026-08-19T14:30:00Z",
    detectedBy: "System Auditor",
    relatedDrillId: "DRILL-20260819-001",
    impactEn: "Slight delay in business continuity during restoration.",
    impactAr: "تأخير طفيف في استمرارية العمل أثناء عملية الاستعادة.",
    recommendedActionEn: "Optimize indexing on collection records.",
    recommendedActionAr: "تحسين الفهرسة لسجلات التحصيلات.",
    status: "INVESTIGATING"
  }
];

export function getRecoveryExceptions(): RecoveryException[] {
  return exceptions;
}

export function createRecoveryException(params: Omit<RecoveryException, "id" | "detectedAt" | "status">): RecoveryException {
  const newEx: RecoveryException = {
    id: `REC-EXC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(exceptions.length + 1).padStart(3, "0")}`,
    ...params,
    detectedAt: new Date().toISOString(),
    status: "OPEN"
  };
  exceptions.push(newEx);
  return newEx;
}

export function updateExceptionStatus(id: string, status: ExceptionStatus, notes?: string): void {
  const index = exceptions.findIndex(e => e.id === id);
  if (index !== -1) {
    exceptions[index] = {
      ...exceptions[index],
      status,
      resolutionNotes: notes || exceptions[index].resolutionNotes
    };
  }
}
