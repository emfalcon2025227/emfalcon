import {
  Owner,
  Property,
  Unit,
  Tenant,
  Lease,
  Cheque,
  RentalCase,
  CollectionRecord,
  ElectronicArchiveItem,
  MaintenanceRequest,
} from "../types";
import { isOccupyingLeaseStatus } from "./unitOccupancyGovernance";

export type EntityIntegrityType =
  | "TENANT"
  | "OWNER"
  | "PROPERTY"
  | "UNIT"
  | "LEASE"
  | "CHEQUE"
  | "CASE"
  | "MAINTENANCE";

export interface IntegrityBlockerItem {
  id: string;
  title: string;
  subtitle?: string;
  statusBadge?: string;
  amount?: number;
  date?: string;
  extraInfo?: string;
}

export interface IntegrityBlockerCategory {
  key: string;
  titleAr: string;
  titleEn: string;
  iconType: "lease" | "cheque" | "case" | "unit" | "property" | "money" | "alert";
  severity: "BLOCKING" | "WARNING";
  count: number;
  totalAmount?: number;
  descriptionAr: string;
  descriptionEn: string;
  resolutionGuidanceAr: string;
  resolutionGuidanceEn: string;
  items: IntegrityBlockerItem[];
}

export interface DeleteIntegrityCheckResult {
  canDelete: boolean;
  hasWarnings: boolean;
  totalBlockersCount: number;
  totalWarningsCount: number;
  blockers: IntegrityBlockerCategory[];
  warnings: IntegrityBlockerCategory[];
  summaryMessageAr: string;
  summaryMessageEn: string;
}

interface DataCollectionsSnapshot {
  tenants: Tenant[];
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  cheques: Cheque[];
  cases: RentalCase[];
  maintenanceRequests?: MaintenanceRequest[];
  collections?: CollectionRecord[];
  archive?: ElectronicArchiveItem[];
}

/**
 * Validates whether an entity can be safely deleted without violating referential integrity,
 * financial accountability, or contract continuity.
 */
export function checkEntityDeleteIntegrity(
  entityType: EntityIntegrityType,
  entityId: string,
  data: DataCollectionsSnapshot
): DeleteIntegrityCheckResult {
  const blockers: IntegrityBlockerCategory[] = [];
  const warnings: IntegrityBlockerCategory[] = [];

  const {
    tenants = [],
    owners = [],
    properties = [],
    units = [],
    leases = [],
    cheques = [],
    cases = [],
    maintenanceRequests = [],
    archive = [],
  } = data;

  switch (entityType) {
    // -------------------------------------------------------------
    // 1. TENANT INTEGRITY CHECK
    // -------------------------------------------------------------
    case "TENANT": {
      const tenant = tenants.find((t) => t.id === entityId);
      const tenantName = tenant ? tenant.nameAr || tenant.nameEn : entityId;

      // 1.1 Active or Renewed Leases
      const activeLeases = leases.filter(
        (l) =>
          l.tenantId === entityId &&
          l.contractStatus !== "TERMINATED" &&
          l.contractStatus !== "CANCELLED"
      );
      if (activeLeases.length > 0) {
        const totalRent = activeLeases.reduce((sum, l) => sum + (l.annualRent || 0), 0);
        blockers.push({
          key: "active_leases",
          titleAr: "عقود إيجار سارية ونشطة",
          titleEn: "Active / Renewed Lease Contracts",
          iconType: "lease",
          severity: "BLOCKING",
          count: activeLeases.length,
          totalAmount: totalRent,
          descriptionAr: `يوجد لدى المستأجر (${activeLeases.length}) عقد إيجار نشط أو قيد التجديد بإجمالي قيمة إيجارية ${totalRent.toLocaleString()} درهم.`,
          descriptionEn: `Tenant has (${activeLeases.length}) active or renewed lease contracts with total rent value AED ${totalRent.toLocaleString()}.`,
          resolutionGuidanceAr: "يجب أولاً إنهاء العقود الإيجارية السارية (تسوية العقد أو إخلائه) من شاشة العقود قبل الحذف.",
          resolutionGuidanceEn: "Terminate or expire active lease contracts before attempting to delete this tenant.",
          items: activeLeases.map((l) => {
            const prop = properties.find((p) => p.id === l.propertyId);
            const unt = units.find((u) => u.id === l.unitId);
            return {
              id: l.id,
              title: `عقد #${l.leaseNumber}`,
              subtitle: `${prop?.nameAr || prop?.nameEn || "عقار"} - وحدة ${unt?.unitNumber || ""}`,
              statusBadge: l.contractStatus,
              amount: l.annualRent,
              date: `${l.startDate} إلى ${l.endDate}`,
              extraInfo: l.ejariNumber ? `Ejari: ${l.ejariNumber}` : undefined,
            };
          }),
        });
      }

      // 1.2 Uncleared / Outstanding / Bounced / Under Legal Cheques
      const pendingCheques = cheques.filter((c) => {
        if (c.tenantId !== entityId) return false;
        // Block if not fully cleared or has outstanding dues
        const isUnclearedStatus = [
          "PENDING",
          "DEPOSITED",
          "BOUNCED",
          "UNDER_LEGAL",
        ].includes(c.status);
        const hasOutstanding = (c.outstanding || 0) > 0;
        return isUnclearedStatus || hasOutstanding;
      });

      if (pendingCheques.length > 0) {
        const totalOutstanding = pendingCheques.reduce(
          (sum, c) => sum + (c.outstanding !== undefined ? c.outstanding : c.amount || 0),
          0
        );
        blockers.push({
          key: "pending_cheques",
          titleAr: "شيكات مستحقة أو معلقة أو مرتجعة",
          titleEn: "Pending / Bounced / Legal Cheques",
          iconType: "cheque",
          severity: "BLOCKING",
          count: pendingCheques.length,
          totalAmount: totalOutstanding,
          descriptionAr: `مسجل على المستأجر (${pendingCheques.length}) شيك معلق أو مرتجع أو قيد التحصيل بإجمالي التزامات ${totalOutstanding.toLocaleString()} درهم.`,
          descriptionEn: `Tenant is linked to (${pendingCheques.length}) uncleared, bounced, or legal cheques totaling AED ${totalOutstanding.toLocaleString()} outstanding.`,
          resolutionGuidanceAr: "يجب تحصيل المبالغ المستحقة وتسوية الشيكات بالكامل قبل التمكن من حذف حساب المستأجر.",
          resolutionGuidanceEn: "Collect outstanding amounts and clear all registered cheques before deleting tenant.",
          items: pendingCheques.map((c) => ({
            id: c.id,
            title: `شيك #${c.chequeNumber} (${c.bankName})`,
            subtitle: `تاريخ الاستحقاق: ${c.dueDate}`,
            statusBadge: c.status,
            amount: c.outstanding !== undefined ? c.outstanding : c.amount,
            date: c.dueDate,
            extraInfo: c.returnReason ? `سبب الإرجاع: ${c.returnReason}` : undefined,
          })),
        });
      }

      // 1.3 Active Court / Rental Dispute Cases
      const activeCases = cases.filter(
        (cs) =>
          cs.tenantId === entityId &&
          cs.status !== "CLOSED" &&
          cs.status !== "ARCHIVED" &&
          cs.status !== "SETTLED"
      );
      if (activeCases.length > 0) {
        const totalClaims = activeCases.reduce((sum, cs) => sum + (cs.outstanding || cs.claimAmount || 0), 0);
        blockers.push({
          key: "active_cases",
          titleAr: "دعاوى وقضايا إيجارية مفتوحة",
          titleEn: "Open Rental Court Cases",
          iconType: "case",
          severity: "BLOCKING",
          count: activeCases.length,
          totalAmount: totalClaims,
          descriptionAr: `توجد (${activeCases.length}) قضية إيجارية نشطة قيد التداول القضائي ضد هذا المستأجر بإجمالي مطالبات ${totalClaims.toLocaleString()} درهم.`,
          descriptionEn: `There are (${activeCases.length}) active legal cases open against this tenant totaling AED ${totalClaims.toLocaleString()}.`,
          resolutionGuidanceAr: "يجب صدور حكم نهائي وإغلاق أو حفظ ملف الدعوى القضائية في النظام أولاً.",
          resolutionGuidanceEn: "Legal cases must be closed, settled, or archived before removing the tenant.",
          items: activeCases.map((cs) => ({
            id: cs.id,
            title: `قضية #${cs.caseNumber}`,
            subtitle: `${cs.courtName} - الأطراف: ${cs.responsibleUserName || "مستشار قانوني"}`,
            statusBadge: cs.status,
            amount: cs.outstanding || cs.claimAmount,
            date: cs.filingDate,
            extraInfo: cs.courtReferenceNumber ? `رقم المحكمة: ${cs.courtReferenceNumber}` : undefined,
          })),
        });
      }

      // 1.4 Occupied Units
      const occupiedUnits = units.filter((u) => u.currentTenantId === entityId);
      if (occupiedUnits.length > 0) {
        blockers.push({
          key: "occupied_units",
          titleAr: "وحدات عقارية مشغولة حالياً",
          titleEn: "Currently Occupied Real Estate Units",
          iconType: "unit",
          severity: "BLOCKING",
          count: occupiedUnits.length,
          descriptionAr: `المستأجر يشغل حالياً (${occupiedUnits.length}) وحدة عقارية داخل النظام.`,
          descriptionEn: `Tenant is currently occupying (${occupiedUnits.length}) real estate units.`,
          resolutionGuidanceAr: "يجب إجراء إخلاء الوحدة وتغيير حالتها إلى شاغرة (VACANT) قبل إمكانية الحذف.",
          resolutionGuidanceEn: "Vacate the units and set status to VACANT prior to deletion.",
          items: occupiedUnits.map((u) => {
            const prop = properties.find((p) => p.id === u.propertyId);
            return {
              id: u.id,
              title: `وحدة #${u.unitNumber}`,
              subtitle: `${prop?.nameAr || prop?.nameEn || "العقار"} (طابق: ${u.floor || "الأرضي"})`,
              statusBadge: u.status,
              amount: u.annualRent,
            };
          }),
        });
      }

      // Warnings (Expired leases, past archived records)
      const historicalLeases = leases.filter(
        (l) =>
          l.tenantId === entityId &&
          (l.contractStatus === "EXPIRED" || l.contractStatus === "TERMINATED")
      );
      if (historicalLeases.length > 0) {
        warnings.push({
          key: "historical_leases",
          titleAr: "سجلات عقود منتهية سابقة",
          titleEn: "Historical Expired Leases",
          iconType: "lease",
          severity: "WARNING",
          count: historicalLeases.length,
          descriptionAr: `يوجد (${historicalLeases.length}) عقد منتهي سابق للمستأجر، سيتم حفظ أثرها بالأرشيف التاريخي.`,
          descriptionEn: `There are (${historicalLeases.length}) expired historical leases that will remain in audit history.`,
          resolutionGuidanceAr: "لا تمنع الحذف؛ سيتم الاحتفاظ بالسجل التاريخي تلقائياً.",
          resolutionGuidanceEn: "Non-blocking; historical snapshots are preserved automatically.",
          items: historicalLeases.map((l) => ({
            id: l.id,
            title: `عقد منتهي #${l.leaseNumber}`,
            subtitle: `الفترة: ${l.startDate} إلى ${l.endDate}`,
            statusBadge: l.contractStatus,
            amount: l.annualRent,
          })),
        });
      }

      break;
    }

    // -------------------------------------------------------------
    // 2. OWNER INTEGRITY CHECK
    // -------------------------------------------------------------
    case "OWNER": {
      // 2.1 Registered Properties
      const ownedProperties = properties.filter((p) => p.ownerId === entityId);
      if (ownedProperties.length > 0) {
        const totalUnitsCount = ownedProperties.reduce(
          (sum, p) => sum + (units.filter((u) => u.propertyId === p.id).length || p.totalUnits || 0),
          0
        );
        blockers.push({
          key: "owned_properties",
          titleAr: "عقارات وأراضٍ مسجلة باسم المالك",
          titleEn: "Registered Properties & Buildings",
          iconType: "property",
          severity: "BLOCKING",
          count: ownedProperties.length,
          descriptionAr: `مسجل باسم المالك (${ownedProperties.length}) عقار بإجمالي (${totalUnitsCount}) وحدة سكنية وتجارية.`,
          descriptionEn: `Owner holds (${ownedProperties.length}) properties with (${totalUnitsCount}) total units.`,
          resolutionGuidanceAr: "يجب نقل ملكية العقارات لمالك آخر أو حذف العقارات التابعة أولاً.",
          resolutionGuidanceEn: "Transfer property ownership or delete child properties prior to removing this owner.",
          items: ownedProperties.map((p) => {
            const pUnits = units.filter((u) => u.propertyId === p.id);
            return {
              id: p.id,
              title: `${p.nameAr || p.nameEn} (${p.code})`,
              subtitle: `${p.emirate || "الإمارات"} - ${p.community || ""} (عدد الوحدات: ${pUnits.length || p.totalUnits})`,
              statusBadge: p.status,
              extraInfo: p.plotNumber ? `رقم الأرض: ${p.plotNumber}` : undefined,
            };
          }),
        });
      }

      // 2.2 Active Leases on Owner's Properties
      const ownerPropertyIds = ownedProperties.map((p) => p.id);
      const activeOwnerLeases = leases.filter(
        (l) =>
          (l.ownerId === entityId || ownerPropertyIds.includes(l.propertyId)) &&
          l.contractStatus !== "TERMINATED" &&
          l.contractStatus !== "CANCELLED"
      );
      if (activeOwnerLeases.length > 0) {
        const totalRent = activeOwnerLeases.reduce((sum, l) => sum + (l.annualRent || 0), 0);
        blockers.push({
          key: "owner_active_leases",
          titleAr: "عقود إيجار نشطة بأملاك المالك",
          titleEn: "Active Leases on Owner Properties",
          iconType: "lease",
          severity: "BLOCKING",
          count: activeOwnerLeases.length,
          totalAmount: totalRent,
          descriptionAr: `توجد (${activeOwnerLeases.length}) عقود إيجارية نشطة تابعة للمالك بإيراد سنوي ${totalRent.toLocaleString()} درهم.`,
          descriptionEn: `There are (${activeOwnerLeases.length}) active leases generating AED ${totalRent.toLocaleString()} annual rent.`,
          resolutionGuidanceAr: "يجب تسوية العقود الإيجارية السارية وإنهاؤها أو نقلها قبل حذف المالك.",
          resolutionGuidanceEn: "Settle or reassign active contracts before deleting owner.",
          items: activeOwnerLeases.map((l) => {
            const tnt = tenants.find((t) => t.id === l.tenantId);
            return {
              id: l.id,
              title: `عقد #${l.leaseNumber}`,
              subtitle: `المستأجر: ${tnt?.nameAr || tnt?.nameEn || "مستأجر"}`,
              statusBadge: l.contractStatus,
              amount: l.annualRent,
              date: `${l.startDate} إلى ${l.endDate}`,
            };
          }),
        });
      }

      // 2.3 Uncleared Cheques
      const ownerPendingCheques = cheques.filter(
        (c) =>
          (c.ownerId === entityId || ownerPropertyIds.includes(c.propertyId)) &&
          (["PENDING", "DEPOSITED", "BOUNCED", "UNDER_LEGAL"].includes(c.status) || (c.outstanding || 0) > 0)
      );
      if (ownerPendingCheques.length > 0) {
        const totalOutstanding = ownerPendingCheques.reduce((sum, c) => sum + (c.outstanding || c.amount || 0), 0);
        blockers.push({
          key: "owner_pending_cheques",
          titleAr: "شيكات ومستحقات معلقة للمالك",
          titleEn: "Pending / Bounced Cheques under Owner",
          iconType: "cheque",
          severity: "BLOCKING",
          count: ownerPendingCheques.length,
          totalAmount: totalOutstanding,
          descriptionAr: `يوجد (${ownerPendingCheques.length}) شيك معلق أو قيد التحصيل لصالح المالك بإجمالي ${totalOutstanding.toLocaleString()} درهم.`,
          descriptionEn: `Owner is linked to (${ownerPendingCheques.length}) pending/unsettled cheques totaling AED ${totalOutstanding.toLocaleString()}.`,
          resolutionGuidanceAr: "يجب تسوية وتحصيل كافة الشيكات والمستحقات المعلقة أولاً.",
          resolutionGuidanceEn: "Clear all financial cheques before deleting owner.",
          items: ownerPendingCheques.map((c) => ({
            id: c.id,
            title: `شيك #${c.chequeNumber}`,
            subtitle: `البنك: ${c.bankName}`,
            statusBadge: c.status,
            amount: c.outstanding || c.amount,
            date: c.dueDate,
          })),
        });
      }

      // 2.4 Active Cases
      const ownerActiveCases = cases.filter(
        (cs) =>
          (cs.ownerId === entityId || ownerPropertyIds.includes(cs.propertyId)) &&
          cs.status !== "CLOSED" &&
          cs.status !== "ARCHIVED" &&
          cs.status !== "SETTLED"
      );
      if (ownerActiveCases.length > 0) {
        blockers.push({
          key: "owner_active_cases",
          titleAr: "دعاوى وقضايا إيجارية مفتوحة",
          titleEn: "Active Legal Cases for Owner",
          iconType: "case",
          severity: "BLOCKING",
          count: ownerActiveCases.length,
          descriptionAr: `يوجد (${ownerActiveCases.length}) قضية جارية مسجلة باسم أو عقارات هذا المالك.`,
          descriptionEn: `There are (${ownerActiveCases.length}) active court cases for this owner.`,
          resolutionGuidanceAr: "يجب إغلاق الدعاوى القضائية العالقة أولاً قبل حذف حساب المالك.",
          resolutionGuidanceEn: "Close or archive legal cases prior to deleting owner.",
          items: ownerActiveCases.map((cs) => ({
            id: cs.id,
            title: `قضية #${cs.caseNumber}`,
            subtitle: cs.courtName,
            statusBadge: cs.status,
            amount: cs.claimAmount,
          })),
        });
      }
      break;
    }

    // -------------------------------------------------------------
    // 3. PROPERTY INTEGRITY CHECK
    // -------------------------------------------------------------
    case "PROPERTY": {
      // 3.1 Registered Units
      const propUnits = units.filter((u) => u.propertyId === entityId);
      if (propUnits.length > 0) {
        const occupiedCount = propUnits.filter((u) => u.status === "OCCUPIED").length;
        blockers.push({
          key: "property_units",
          titleAr: "وحدات عقارية مسجلة بالعقار",
          titleEn: "Registered Units in Property",
          iconType: "unit",
          severity: "BLOCKING",
          count: propUnits.length,
          descriptionAr: `يحتوي هذا العقار على (${propUnits.length}) وحدة مسجلة (منها ${occupiedCount} وحدة مشغولة حالياً).`,
          descriptionEn: `This property contains (${propUnits.length}) registered units (${occupiedCount} currently occupied).`,
          resolutionGuidanceAr: "يجب حذف أو نقل الوحدات العقارية التابعة لهذا العقار قبل إمكانية حذفه.",
          resolutionGuidanceEn: "Delete or transfer registered units before removing this property.",
          items: propUnits.map((u) => ({
            id: u.id,
            title: `وحدة #${u.unitNumber} (${u.unitType || u.type})`,
            subtitle: `طابق: ${u.floor || "الأرضي"} - الإيجار: ${(u.annualRent || 0).toLocaleString()} د.إ`,
            statusBadge: u.status,
            amount: u.annualRent,
          })),
        });
      }

      // 3.2 Active Leases on Property
      const propActiveLeases = leases.filter(
        (l) =>
          l.propertyId === entityId &&
          l.contractStatus !== "TERMINATED" &&
          l.contractStatus !== "CANCELLED"
      );
      if (propActiveLeases.length > 0) {
        blockers.push({
          key: "property_leases",
          titleAr: "عقود إيجار سارية بالعقار",
          titleEn: "Active Leases in Property",
          iconType: "lease",
          severity: "BLOCKING",
          count: propActiveLeases.length,
          descriptionAr: `يوجد (${propActiveLeases.length}) عقد إيجار سارٍ ومسجل داخل هذا العقار.`,
          descriptionEn: `There are (${propActiveLeases.length}) active leases inside this property.`,
          resolutionGuidanceAr: "يجب إنهاء كافة عقود الإيجار السارية بالعقار قبل حذفه.",
          resolutionGuidanceEn: "Terminate all active contracts in this property.",
          items: propActiveLeases.map((l) => {
            const tnt = tenants.find((t) => t.id === l.tenantId);
            return {
              id: l.id,
              title: `عقد #${l.leaseNumber}`,
              subtitle: `المستأجر: ${tnt?.nameAr || tnt?.nameEn || ""}`,
              statusBadge: l.contractStatus,
              amount: l.annualRent,
              date: `${l.startDate} إلى ${l.endDate}`,
            };
          }),
        });
      }

      // 3.3 Active Cheques
      const propCheques = cheques.filter(
        (c) =>
          c.propertyId === entityId &&
          (["PENDING", "DEPOSITED", "BOUNCED", "UNDER_LEGAL"].includes(c.status) || (c.outstanding || 0) > 0)
      );
      if (propCheques.length > 0) {
        blockers.push({
          key: "property_cheques",
          titleAr: "شيكات معلقة مرتبطة بالعقار",
          titleEn: "Pending Cheques for Property",
          iconType: "cheque",
          severity: "BLOCKING",
          count: propCheques.length,
          descriptionAr: `يوجد (${propCheques.length}) شيك معلق أو غير مسوى مرتبط بوحدات هذا العقار.`,
          descriptionEn: `There are (${propCheques.length}) outstanding cheques linked to this property.`,
          resolutionGuidanceAr: "يجب تسوية وتحصيل الشيكات المرتبطة أولاً.",
          resolutionGuidanceEn: "Clear pending cheques prior to property deletion.",
          items: propCheques.map((c) => ({
            id: c.id,
            title: `شيك #${c.chequeNumber}`,
            subtitle: `البنك: ${c.bankName}`,
            statusBadge: c.status,
            amount: c.outstanding || c.amount,
            date: c.dueDate,
          })),
        });
      }
      break;
    }

    // -------------------------------------------------------------
    // 4. UNIT INTEGRITY CHECK
    // -------------------------------------------------------------
    case "UNIT": {
      const unit = units.find((u) => u.id === entityId);

      // 4.1 Unit is currently OCCUPIED or has Active Lease
      const unitActiveLease = leases.find(
        (l) => l.unitId === entityId && isOccupyingLeaseStatus(l.contractStatus)
      );

      if (unit?.status === "OCCUPIED" || unitActiveLease || unit?.currentTenantId) {
        const tenant = tenants.find((t) => t.id === (unitActiveLease?.tenantId || unit?.currentTenantId));
        blockers.push({
          key: "unit_occupied",
          titleAr: "الوحدة مشغولة ومؤجرة حالياً",
          titleEn: "Unit is Currently Occupied",
          iconType: "unit",
          severity: "BLOCKING",
          count: 1,
          descriptionAr: `الوحدة مشغولة بمستأجر فعلي (${tenant?.nameAr || tenant?.nameEn || "مستأجر"}) وعقد إيجار نشط (${unitActiveLease?.leaseNumber || "سارٍ"}).`,
          descriptionEn: `Unit is occupied by tenant (${tenant?.nameEn || "Tenant"}) under active lease (${unitActiveLease?.leaseNumber || "Active"}).`,
          resolutionGuidanceAr: "يجب إنهاء العقد وإخلاء الوحدة وتغيير حالتها إلى شاغرة (VACANT) قبل إمكانية الحذف.",
          resolutionGuidanceEn: "Terminate the lease, vacate the unit, and set status to VACANT before deleting.",
          items: [
            {
              id: entityId,
              title: `وحدة #${unit?.unitNumber || entityId}`,
              subtitle: `المستأجر الحالي: ${tenant?.nameAr || tenant?.nameEn || "مجهول"} - عقد #${unitActiveLease?.leaseNumber || "N/A"}`,
              statusBadge: unit?.status || "OCCUPIED",
              amount: unitActiveLease?.annualRent || unit?.annualRent,
            },
          ],
        });
      }

      // 4.2 Uncleared Cheques on Unit
      const unitCheques = cheques.filter(
        (c) =>
          c.unitId === entityId &&
          (["PENDING", "DEPOSITED", "BOUNCED", "UNDER_LEGAL"].includes(c.status) || (c.outstanding || 0) > 0)
      );
      if (unitCheques.length > 0) {
        blockers.push({
          key: "unit_cheques",
          titleAr: "شيكات معلقة مرتبطة بالوحدة",
          titleEn: "Pending Cheques for Unit",
          iconType: "cheque",
          severity: "BLOCKING",
          count: unitCheques.length,
          descriptionAr: `توجد (${unitCheques.length}) شيكات معلقة أو مرتجعة مرتبطة بهذه الوحدة.`,
          descriptionEn: `There are (${unitCheques.length}) unsettled cheques associated with this unit.`,
          resolutionGuidanceAr: "يجب تسوية الشيكات المعلقة قبل إزالة الوحدة.",
          resolutionGuidanceEn: "Settle pending cheques before deleting the unit.",
          items: unitCheques.map((c) => ({
            id: c.id,
            title: `شيك #${c.chequeNumber}`,
            subtitle: `المبلغ: ${(c.outstanding || c.amount || 0).toLocaleString()} د.إ`,
            statusBadge: c.status,
            amount: c.outstanding || c.amount,
          })),
        });
      }
      break;
    }

    // -------------------------------------------------------------
    // 5. LEASE INTEGRITY CHECK
    // -------------------------------------------------------------
    case "LEASE": {
      const lease = leases.find((l) => l.id === entityId);

      // 5.1 Contract is ACTIVE / RENEWED
      if (lease && (lease.contractStatus === "ACTIVE" || lease.contractStatus === "RENEWED")) {
        blockers.push({
          key: "lease_active_status",
          titleAr: "عقد الإيجار سارٍ وفعال",
          titleEn: "Lease Contract is Currently Active",
          iconType: "lease",
          severity: "BLOCKING",
          count: 1,
          totalAmount: lease.annualRent,
          descriptionAr: `عقد الإيجار #${lease.leaseNumber} بحالة سارية (${lease.contractStatus}) حتى تاريخ ${lease.endDate}.`,
          descriptionEn: `Lease #${lease.leaseNumber} is active until ${lease.endDate}.`,
          resolutionGuidanceAr: "لا يمكن حذف عقد سارٍ؛ يجب أولاً إنهاء العقد (TERMINATED) أو تحويله إلى منتهٍ (EXPIRED) من خيارات التعديل.",
          resolutionGuidanceEn: "Change status to TERMINATED or EXPIRED before deleting.",
          items: [
            {
              id: lease.id,
              title: `عقد #${lease.leaseNumber}`,
              subtitle: `الفترة: ${lease.startDate} إلى ${lease.endDate}`,
              statusBadge: lease.contractStatus,
              amount: lease.annualRent,
            },
          ],
        });
      }

      // 5.2 Uncleared / Bounced Cheques linked to Lease
      const leaseCheques = cheques.filter(
        (c) =>
          c.leaseId === entityId &&
          (["PENDING", "DEPOSITED", "BOUNCED", "UNDER_LEGAL"].includes(c.status) || (c.outstanding || 0) > 0)
      );
      if (leaseCheques.length > 0) {
        const totalOutstanding = leaseCheques.reduce((sum, c) => sum + (c.outstanding || c.amount || 0), 0);
        blockers.push({
          key: "lease_uncleared_cheques",
          titleAr: "شيكات غير محصلة أو مرتجعة بالعقد",
          titleEn: "Uncleared / Bounced Cheques on Lease",
          iconType: "cheque",
          severity: "BLOCKING",
          count: leaseCheques.length,
          totalAmount: totalOutstanding,
          descriptionAr: `يوجد بالعقد (${leaseCheques.length}) شيك غير محصل أو مرتجع بإجمالي مستحق ${totalOutstanding.toLocaleString()} درهم.`,
          descriptionEn: `Contract contains (${leaseCheques.length}) pending or bounced cheques with outstanding balance of AED ${totalOutstanding.toLocaleString()}.`,
          resolutionGuidanceAr: "يجب تسوية الشيكات المتبقية والتحصيلات قبل إمكانية حذف العقد.",
          resolutionGuidanceEn: "Reconcile or clear all cheques linked to this lease contract.",
          items: leaseCheques.map((c) => ({
            id: c.id,
            title: `شيك #${c.chequeNumber} (${c.bankName})`,
            subtitle: `تاريخ الاستحقاق: ${c.dueDate}`,
            statusBadge: c.status,
            amount: c.outstanding || c.amount,
            date: c.dueDate,
          })),
        });
      }

      // 5.3 Active Cases linked to Lease
      const leaseCases = cases.filter(
        (cs) =>
          cs.leaseId === entityId &&
          cs.status !== "CLOSED" &&
          cs.status !== "ARCHIVED" &&
          cs.status !== "SETTLED"
      );
      if (leaseCases.length > 0) {
        blockers.push({
          key: "lease_active_cases",
          titleAr: "قضايا ومنازعات إيجارية قائمة على هذا العقد",
          titleEn: "Active Legal Dispute Cases on Lease",
          iconType: "case",
          severity: "BLOCKING",
          count: leaseCases.length,
          descriptionAr: `هذا العقد محل نزاع في (${leaseCases.length}) دعوى قضائية مفتوحة بالمحكمة.`,
          descriptionEn: `This lease is subject to (${leaseCases.length}) open court cases.`,
          resolutionGuidanceAr: "يجب إغلاق الدعاوى القضائية المفتوحة قبل حذف العقد.",
          resolutionGuidanceEn: "Close the linked court cases first.",
          items: leaseCases.map((cs) => ({
            id: cs.id,
            title: `قضية #${cs.caseNumber}`,
            subtitle: cs.courtName,
            statusBadge: cs.status,
            amount: cs.claimAmount,
          })),
        });
      }
      break;
    }

    // -------------------------------------------------------------
    // 6. CHEQUE INTEGRITY CHECK
    // -------------------------------------------------------------
    case "CHEQUE": {
      const cheque = cheques.find((c) => c.id === entityId);

      // 6.1 Converted to or Linked in Active Court Case
      const linkedActiveCase = cases.find(
        (cs) =>
          (cs.linkedChequeIds?.includes(entityId) || cheque?.convertedToCaseId === cs.id) &&
          cs.status !== "CLOSED" &&
          cs.status !== "ARCHIVED"
      );

      if (cheque?.status === "UNDER_LEGAL" || linkedActiveCase) {
        blockers.push({
          key: "cheque_under_legal",
          titleAr: "الشيك مقيد ضمن قضية ومنازعة قضائية جارية",
          titleEn: "Cheque Linked to Active Court Case",
          iconType: "case",
          severity: "BLOCKING",
          count: 1,
          descriptionAr: `هذا الشيك سند تنفيذي مقيد ضمن القضية القضائية #${linkedActiveCase?.caseNumber || "نشطة"} بمحكمة ${linkedActiveCase?.courtName || "مركز فض المنازعات"}.`,
          descriptionEn: `Cheque is a legal instrument filed under active Court Case #${linkedActiveCase?.caseNumber || "Active"}.`,
          resolutionGuidanceAr: "يجب فك ارتباط الشيك من القضية أو إغلاق ملف القضية القضائية أولاً قبل الحذف.",
          resolutionGuidanceEn: "Unlink the cheque from the case or close the legal case before deleting this cheque.",
          items: [
            {
              id: entityId,
              title: `شيك #${cheque?.chequeNumber}`,
              subtitle: `القضية: #${linkedActiveCase?.caseNumber || "جارية"} - ${linkedActiveCase?.courtName || ""}`,
              statusBadge: "UNDER_LEGAL",
              amount: cheque?.outstanding || cheque?.amount,
            },
          ],
        });
      }

      // 6.2 Partial Collection Applied
      if (cheque && cheque.totalApplied > 0 && cheque.outstanding > 0) {
        warnings.push({
          key: "cheque_partial_collection",
          titleAr: "تنبيه: توجد دفعات مالية محصلة جزئياً",
          titleEn: "Partial Collections Recorded",
          iconType: "money",
          severity: "WARNING",
          count: 1,
          totalAmount: cheque.totalApplied,
          descriptionAr: `تم تسجيل سندات قبض وتحصيل جزئي بمبلغ ${cheque.totalApplied.toLocaleString()} درهم على هذا الشيك (المتبقي: ${cheque.outstanding.toLocaleString()} د.إ).`,
          descriptionEn: `Partial collection receipts totaling AED ${cheque.totalApplied.toLocaleString()} are recorded on this cheque.`,
          resolutionGuidanceAr: "تأكد من مراجعة السجلات المالية وسندات القبض قبل الحذف.",
          resolutionGuidanceEn: "Review receipts before deleting this partially collected cheque.",
          items: [
            {
              id: entityId,
              title: `تحصيل جزئي: ${cheque.totalApplied.toLocaleString()} د.إ`,
              subtitle: `المتبقي: ${cheque.outstanding.toLocaleString()} د.إ`,
              statusBadge: cheque.collectionStatus,
              amount: cheque.totalApplied,
            },
          ],
        });
      }
      break;
    }

    // -------------------------------------------------------------
    // 7. LEGAL CASE INTEGRITY CHECK
    // -------------------------------------------------------------
    case "CASE": {
      const caseItem = cases.find((c) => c.id === entityId);

      // 7.1 Active Status (Not closed / Not archived)
      if (
        caseItem &&
        caseItem.status !== "CLOSED" &&
        caseItem.status !== "ARCHIVED" &&
        caseItem.status !== "SETTLED"
      ) {
        blockers.push({
          key: "case_active_status",
          titleAr: "القضية قيد التداول القضائي ولم تُغلق",
          titleEn: "Case is in Active Litigation",
          iconType: "case",
          severity: "BLOCKING",
          count: 1,
          totalAmount: caseItem.outstanding || caseItem.claimAmount,
          descriptionAr: `القضية #${caseItem.caseNumber} بحالة نشطة (${caseItem.status}) لدى ${caseItem.courtName} بمطالبة مالية قدرها ${(caseItem.outstanding || caseItem.claimAmount || 0).toLocaleString()} درهم.`,
          descriptionEn: `Case #${caseItem.caseNumber} is active in (${caseItem.courtName}) with claim AED ${(caseItem.outstanding || caseItem.claimAmount || 0).toLocaleString()}.`,
          resolutionGuidanceAr: "يجب تحديث حالة القضية إلى مغلقة (CLOSED) أو تسوية مكتملة (SETTLED) أو مؤرشفة (ARCHIVED) قبل الحذف.",
          resolutionGuidanceEn: "Update case status to CLOSED, SETTLED, or ARCHIVED prior to deletion.",
          items: [
            {
              id: caseItem.id,
              title: `دعوى #${caseItem.caseNumber}`,
              subtitle: `${caseItem.courtName} - جلسات مسجلة: ${caseItem.sessions?.length || 0}`,
              statusBadge: caseItem.status,
              amount: caseItem.outstanding || caseItem.claimAmount,
            },
          ],
        });
      }

      // 7.2 Active Settlement with Pending Installments
      if (
        caseItem?.settlement &&
        caseItem.settlement.status === "ACTIVE"
      ) {
        const unpaidSchedule = (caseItem.settlement.schedule || []).filter((s) => s.status !== "PAID");
        if (unpaidSchedule.length > 0) {
          const unpaidTotal = unpaidSchedule.reduce((sum, s) => sum + s.amount, 0);
          blockers.push({
            key: "case_active_settlement",
            titleAr: "اتفاقية تسوية نشطة بأقساط متبقية",
            titleEn: "Active Settlement Agreement with Pending Dues",
            iconType: "money",
            severity: "BLOCKING",
            count: unpaidSchedule.length,
            totalAmount: unpaidTotal,
            descriptionAr: `توجد اتفاقية تسوية سارية بها (${unpaidSchedule.length}) قسط متبقٍ بإجمالي ${unpaidTotal.toLocaleString()} درهم.`,
            descriptionEn: `There is an active settlement with (${unpaidSchedule.length}) unpaid installments totaling AED ${unpaidTotal.toLocaleString()}.`,
            resolutionGuidanceAr: "يجب استكمال سداد أقساط التسوية بالكامل أو إلغاء الاتفاقية قبل الحذف.",
            resolutionGuidanceEn: "Fulfill all settlement installments or cancel agreement before deleting.",
            items: unpaidSchedule.map((s, idx) => ({
              id: `stl-${idx}`,
              title: `قسط تسوية #${idx + 1}`,
              subtitle: `استحقاق: ${s.dueDate}`,
              amount: s.amount,
              date: s.dueDate,
            })),
          });
        }
      }
      break;
    }

    // -------------------------------------------------------------
    // 8. MAINTENANCE INTEGRITY CHECK
    // -------------------------------------------------------------
    case "MAINTENANCE": {
      const maintItem = maintenanceRequests.find((m) => m.id === entityId);
      if (maintItem) {
        // 8.1 Active / In-progress maintenance request
        if (maintItem.status === "OPEN" || maintItem.status === "IN_PROGRESS") {
          blockers.push({
            key: "maint_active",
            titleAr: "طلب الصيانة قيد المتابعة أو التنفيذ",
            titleEn: "Maintenance Request is Active / In Progress",
            iconType: "alert",
            severity: "BLOCKING",
            count: 1,
            descriptionAr: `طلب الصيانة #${maintItem.requestNumber} بحالة نشطة (${maintItem.status}) ومكلف به فني أو قيد الإصلاح.`,
            descriptionEn: `Maintenance request #${maintItem.requestNumber} is currently ${maintItem.status}.`,
            resolutionGuidanceAr: "يجب إغلاق طلب الصيانة بتغيير حالته إلى منجز (COMPLETED) أو ملغي (CANCELLED) أو مرفوض (REJECTED) قبل الحذف.",
            resolutionGuidanceEn: "Mark request as COMPLETED, CANCELLED, or REJECTED prior to deletion.",
            items: [
              {
                id: maintItem.id,
                title: `طلب #${maintItem.requestNumber}`,
                subtitle: `${maintItem.category} - ${maintItem.priority}`,
                statusBadge: maintItem.status,
                amount: maintItem.totalCost,
              },
            ],
          });
        }

        // 8.2 Invoices with pending payment or registered
        if (maintItem.invoices && maintItem.invoices.length > 0) {
          const unpaidInvoices = maintItem.invoices.filter((inv) => inv.status !== "PAID");
          if (unpaidInvoices.length > 0) {
            const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
            blockers.push({
              key: "maint_unpaid_invoices",
              titleAr: "فواتير صيانة غير مسددة",
              titleEn: "Unpaid Maintenance Invoices",
              iconType: "money",
              severity: "BLOCKING",
              count: unpaidInvoices.length,
              totalAmount: unpaidTotal,
              descriptionAr: `توجد (${unpaidInvoices.length}) فواتير غير مسددة مسجلة على طلب الصيانة بإجمالي ${unpaidTotal.toLocaleString()} درهم.`,
              descriptionEn: `There are (${unpaidInvoices.length}) unpaid invoices on this request totaling AED ${unpaidTotal.toLocaleString()}.`,
              resolutionGuidanceAr: "يجب تسوية أو سداد الفواتير المسجلة قبل حذف الطلب.",
              resolutionGuidanceEn: "Settle or pay recorded invoices before deleting request.",
              items: unpaidInvoices.map((inv) => ({
                id: inv.id,
                title: `فاتورة #${inv.invoiceNumber}`,
                subtitle: `المورد: ${inv.vendorName}`,
                statusBadge: inv.status,
                amount: inv.totalAmount,
              })),
            });
          }
        }
      }
      break;
    }
  }

  const totalBlockersCount = blockers.reduce((sum, b) => sum + b.count, 0);
  const totalWarningsCount = warnings.reduce((sum, w) => sum + w.count, 0);
  const canDelete = blockers.length === 0;
  const hasWarnings = warnings.length > 0;

  const summaryMessageAr = canDelete
    ? "السجل مؤهل للحذف والنقل للأرشيف التاريخي (لا توجد ارتباطات أو التزامات نشطة تعيقه)."
    : `يمنع النظام حذف هذا السجل لوجود (${blockers.length}) موانع رئيسية و (${totalBlockersCount}) ارتباطات نشطة. يرجى معالجة الموانع أولاً.`;

  const summaryMessageEn = canDelete
    ? "Record is clean and ready for deletion & historical archival."
    : `System prevented deletion due to (${blockers.length}) blocking constraints and (${totalBlockersCount}) active dependencies.`;

  return {
    canDelete,
    hasWarnings,
    totalBlockersCount,
    totalWarningsCount,
    blockers,
    warnings,
    summaryMessageAr,
    summaryMessageEn,
  };
}
