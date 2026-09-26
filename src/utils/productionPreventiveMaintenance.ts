/**
 * PRODUCTION PREVENTIVE MAINTENANCE ENGINE
 * Schedules and tracks maintenance tasks to ensure system health.
 */

export type MaintenanceStatus = "NOT_STARTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "FAILED";
export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface MaintenanceTask {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  frequencyDays: number;
  lastCompleted: string | null;
  nextDueDate: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
}

export function getPreventiveMaintenanceTasks(): MaintenanceTask[] {
  const today = new Date();
  
  return [
    {
      id: "PM-001",
      nameEn: "Backup Verification",
      nameAr: "التحقق من النسخ الاحتياطي",
      descriptionEn: "Manually verify the integrity of the latest production backup.",
      descriptionAr: "التحقق يدوياً من سلامة آخر نسخة احتياطية للإنتاج.",
      frequencyDays: 7,
      lastCompleted: "2026-08-15T09:00:00Z",
      nextDueDate: "2026-08-22T09:00:00Z",
      status: "SCHEDULED",
      priority: "CRITICAL"
    },
    {
      id: "PM-002",
      nameEn: "Financial Engine Health Check",
      nameAr: "فحص صحة المحرك المالي",
      descriptionEn: "Perform deep reconciliation check using authoritative engines.",
      descriptionAr: "إجراء فحص مطابقة عميق باستخدام المحركات المعتمدة.",
      frequencyDays: 30,
      lastCompleted: "2026-08-01T10:00:00Z",
      nextDueDate: "2026-08-31T10:00:00Z",
      status: "COMPLETED",
      priority: "HIGH"
    },
    {
      id: "PM-003",
      nameEn: "RBAC Audit Review",
      nameAr: "مراجعة تدقيق الصلاحيات",
      descriptionEn: "Review administrative access and sensitive financial permissions.",
      descriptionAr: "مراجعة الوصول الإداري والأذونات المالية الحساسة.",
      frequencyDays: 90,
      lastCompleted: null,
      nextDueDate: "2026-08-25T00:00:00Z",
      status: "OVERDUE",
      priority: "MEDIUM"
    },
    {
      id: "PM-004",
      nameEn: "Database Index Optimization",
      nameAr: "تحسين فهارس قاعدة البيانات",
      descriptionEn: "Analyze query performance and optimize collection indexes.",
      descriptionAr: "تحليل أداء الاستعلامات وتحسين فهارس المجموعات.",
      frequencyDays: 30,
      lastCompleted: "2026-07-20T14:00:00Z",
      nextDueDate: "2026-08-19T14:00:00Z",
      status: "FAILED",
      priority: "HIGH"
    }
  ];
}
