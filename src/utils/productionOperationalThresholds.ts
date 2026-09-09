/**
 * PRODUCTION OPERATIONAL THRESHOLDS
 * Centralizes configurable operational limits.
 */

export interface OperationalThreshold {
  id: string;
  category: string;
  nameEn: string;
  nameAr: string;
  currentValue: number | string;
  unit: string;
  descriptionEn: string;
  descriptionAr: string;
}

export function getOperationalThresholds(): OperationalThreshold[] {
  return [
    {
      id: "THR-001",
      category: "Performance",
      nameEn: "Max Interaction Latency",
      nameAr: "الحد الأقصى للتأخير",
      currentValue: 3,
      unit: "sec",
      descriptionEn: "Maximum acceptable time for standard user interactions.",
      descriptionAr: "الحد الأقصى للوقت المقبول لتفاعلات المستخدم العادية."
    },
    {
      id: "THR-002",
      category: "Capacity",
      nameEn: "Storage Warning Level",
      nameAr: "مستوى تحذير التخزين",
      currentValue: 80,
      unit: "%",
      descriptionEn: "Warning threshold for disk/storage utilization.",
      descriptionAr: "حد التحذير لاستخدام القرص أو التخزين."
    },
    {
      id: "THR-003",
      category: "Recovery",
      nameEn: "Max RPO Age",
      nameAr: "أقصى عمر للنسخة",
      currentValue: 24,
      unit: "hours",
      descriptionEn: "Maximum allowed age for production backups.",
      descriptionAr: "الحد الأقصى المسموح به لعمر النسخ الاحتياطية للإنتاج."
    },
    {
      id: "THR-004",
      category: "Stability",
      nameEn: "Max Open High Incidents",
      nameAr: "أقصى عدد للحوادث المفتوحة",
      currentValue: 5,
      unit: "count",
      descriptionEn: "Maximum number of allowed open incidents with HIGH severity.",
      descriptionAr: "الحد الأقصى لعدد الحوادث المفتوحة المسموح بها ذات الخطورة العالية."
    }
  ];
}
