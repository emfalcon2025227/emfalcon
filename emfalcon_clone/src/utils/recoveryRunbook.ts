/**
 * RECOVERY RUNBOOK
 * Structured procedures for disaster recovery.
 */

export interface RunbookStep {
  step: number;
  titleEn: string;
  titleAr: string;
  actionEn: string;
  actionAr: string;
  responsible: string;
}

export const recoveryRunbook: RunbookStep[] = [
  {
    step: 1,
    titleEn: "Incident Detection",
    titleAr: "اكتشاف الحادث",
    actionEn: "Identify service interruption and activate incident management team.",
    actionAr: "تحديد انقطاع الخدمة وتفعيل فريق إدارة الحوادث.",
    responsible: "On-Call Admin"
  },
  {
    step: 2,
    titleEn: "Financial Protection",
    titleAr: "الحماية المالية",
    actionEn: "Enable Financial Fail-Safe Mode (READ-ONLY) to prevent data corruption.",
    actionAr: "تفعيل وضع الأمان المالي (للقراءة فقط) لمنع فساد البيانات.",
    responsible: "Financial Officer"
  },
  {
    step: 3,
    titleEn: "Backup Selection",
    titleAr: "اختيار النسخة الاحتياطية",
    actionEn: "Locate the latest verified backup and confirm its integrity score.",
    actionAr: "تحديد أحدث نسخة احتياطية موثقة والتأكد من درجة تكاملها.",
    responsible: "Database Admin"
  },
  {
    step: 4,
    titleEn: "Isolated Drill",
    titleAr: "اختبار معزول",
    actionEn: "Run a non-destructive recovery drill to verify restorable state.",
    actionAr: "إجراء اختبار تعافي غير مدمر للتأكد من حالة الاستعادة.",
    responsible: "System Architect"
  },
  {
    step: 5,
    titleEn: "Financial Reconciliation",
    titleAr: "المطابقة المالية",
    actionEn: "Run post-recovery financial verification against the authoritative engine.",
    actionAr: "إجراء التحقق المالي بعد الاستعادة مقابل المحرك المالي المعتمد.",
    responsible: "Auditor"
  },
  {
    step: 6,
    titleEn: "Approval & Restore",
    titleAr: "الموافقة والاستعادة",
    actionEn: "Obtain formal administrator approval to initiate production restoration.",
    actionAr: "الحصول على موافقة رسمية من المسؤول لبدء عملية استعادة الإنتاج.",
    responsible: "System Administrator"
  }
];
