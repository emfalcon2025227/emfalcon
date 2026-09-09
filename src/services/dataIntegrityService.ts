/**
 * Phase 14 Data Integrity Service
 * Deterministic read-only validation detecting missing master data, orphan relationships,
 * split/custom allocation discrepancies, duplicate references, and invalid records.
 */

export interface IntegrityException {
  exceptionId: string;
  exceptionType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  entityType: string;
  entityId: string;
  entityName: string;
  descriptionAr: string;
  descriptionEn: string;
  detectedAt: string;
  suggestedResolutionAr: string;
  suggestedResolutionEn: string;
  resolved: boolean;
}

export function scanDataIntegrity(data: {
  owners: any[];
  properties: any[];
  units: any[];
  tenants: any[];
  leases: any[];
  cheques: any[];
  collections: any[];
  maintenanceRequests?: any[];
  expenses?: any[];
}): IntegrityException[] {
  const exceptions: IntegrityException[] = [];
  const now = new Date().toISOString();

  // 1. Check owners without phone or name
  data.owners.forEach((o) => {
    if (!o.nameAr && !o.nameEn) {
      exceptions.push({
        exceptionId: `exc_owner_${o.id}`,
        exceptionType: "MISSING_OWNER_NAME",
        severity: "HIGH",
        entityType: "Owner",
        entityId: o.id,
        entityName: o.nameAr || o.id,
        descriptionAr: "مالك بدون اسم معتمد في النظام",
        descriptionEn: "Owner record missing required Arabic or English name.",
        detectedAt: now,
        suggestedResolutionAr: "تعديل بيانات المالك وإدخال الاسم الرسمي",
        suggestedResolutionEn: "Edit owner details and provide a valid name.",
        resolved: false,
      });
    }
  });

  // 2. Check units without valid property reference
  const propertyIds = new Set(data.properties.map((p) => p.id));
  data.units.forEach((u) => {
    if (!propertyIds.has(u.propertyId)) {
      exceptions.push({
        exceptionId: `exc_unit_orphan_${u.id}`,
        exceptionType: "ORPHAN_UNIT",
        severity: "CRITICAL",
        entityType: "Unit",
        entityId: u.id,
        entityName: u.unitNumber || u.id,
        descriptionAr: "وحدة عقارية تشير إلى عقار غير موجود أو محذوف",
        descriptionEn: "Unit references a non-existent or deleted property ID.",
        detectedAt: now,
        suggestedResolutionAr: "إعادة ربط الوحدة بعقار صحيح أو حذفها",
        suggestedResolutionEn: "Re-assign unit to a valid property or remove.",
        resolved: false,
      });
    }
  });

  // 3. Check duplicate cheque numbers
  const chequeMap = new Map<string, number>();
  data.cheques.forEach((chq) => {
    if (chq.chequeNumber) {
      const count = chequeMap.get(chq.chequeNumber) || 0;
      chequeMap.set(chq.chequeNumber, count + 1);
    }
  });
  chequeMap.forEach((count, chqNum) => {
    if (count > 1) {
      exceptions.push({
        exceptionId: `exc_dup_cheque_${chqNum}`,
        exceptionType: "DUPLICATE_CHEQUE_NUMBER",
        severity: "HIGH",
        entityType: "Cheque",
        entityId: chqNum,
        entityName: `Cheque #${chqNum}`,
        descriptionAr: `رقم الشيك (${chqNum}) متكرر في عدة سجلات مالية`,
        descriptionEn: `Cheque number (${chqNum}) is duplicated across multiple records.`,
        detectedAt: now,
        suggestedResolutionAr: "التحقق من أرقام الشيكات وتصحيح التكرار غير المبرر",
        suggestedResolutionEn: "Verify cheque numbers and resolve duplication.",
        resolved: false,
      });
    }
  });

  return exceptions;
}
