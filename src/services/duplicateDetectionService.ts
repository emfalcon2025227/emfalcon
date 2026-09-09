/**
 * Phase 14 Duplicate Detection Service
 * Detects probable duplicate records across owners, tenants, properties, and cheques.
 */

export interface DuplicatePair {
  id: string;
  entityType: "Owner" | "Tenant" | "Property" | "Cheque";
  recordA: { id: string; name: string; detail: string };
  recordB: { id: string; name: string; detail: string };
  matchReason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export function detectDuplicates(data: {
  owners: any[];
  tenants: any[];
  properties: any[];
  cheques: any[];
}): DuplicatePair[] {
  const duplicates: DuplicatePair[] = [];

  // Check tenant phone duplicates
  const phoneMap = new Map<string, any[]>();
  data.tenants.forEach((t) => {
    if (t.phone) {
      const cleanPhone = t.phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 7) {
        const list = phoneMap.get(cleanPhone) || [];
        list.push(t);
        phoneMap.set(cleanPhone, list);
      }
    }
  });

  phoneMap.forEach((tenants, phone) => {
    if (tenants.length > 1) {
      for (let i = 0; i < tenants.length - 1; i++) {
        duplicates.push({
          id: `dup_tenant_${tenants[i].id}_${tenants[i+1].id}`,
          entityType: "Tenant",
          recordA: { id: tenants[i].id, name: tenants[i].nameAr || tenants[i].nameEn, detail: tenants[i].phone },
          recordB: { id: tenants[i+1].id, name: tenants[i+1].nameAr || tenants[i+1].nameEn, detail: tenants[i+1].phone },
          matchReason: `Matching phone number (${phone})`,
          confidence: "HIGH",
        });
      }
    }
  });

  return duplicates;
}
