
/**
 * CONTINUOUS DATA INTEGRITY MONITOR
 * Detects orphans, duplicates, and referential integrity issues.
 */
export interface IntegrityException {
  id: string;
  type: "ORPHAN" | "DUPLICATE" | "REFERENCE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  entityType: string;
  entityId: string;
}

export interface DataIntegritySnapshot {
  score: number; // 0-100
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  exceptions: IntegrityException[];
}

export function runContinuousDataIntegrityScan(data: any): DataIntegritySnapshot {
  const exceptions: IntegrityException[] = [];
  
  if (!data) return { score: 100, status: "HEALTHY", exceptions: [] };

  // 1. Orphan Detection (Example: Property without Owner)
  data.properties?.forEach((prop: any) => {
    const ownerExists = data.owners?.some((o: any) => o.id === prop.ownerId);
    if (!ownerExists) {
      exceptions.push({
        id: `INT-${Date.now()}-P-${prop.id}`,
        type: "ORPHAN",
        severity: "HIGH",
        description: `Property "${prop.name}" references a missing owner (ID: ${prop.ownerId}).`,
        entityType: "Property",
        entityId: prop.id
      });
    }
  });

  // 2. Duplicate Detection (Example: Unit code)
  const unitCodes = new Set();
  data.units?.forEach((unit: any) => {
    if (unitCodes.has(unit.code)) {
      exceptions.push({
        id: `INT-${Date.now()}-U-${unit.id}`,
        type: "DUPLICATE",
        severity: "MEDIUM",
        description: `Duplicate unit code detected: ${unit.code}`,
        entityType: "Unit",
        entityId: unit.id
      });
    }
    unitCodes.add(unit.code);
  });

  const score = Math.max(0, 100 - (exceptions.length * 5));
  let status: DataIntegritySnapshot["status"] = "HEALTHY";
  if (exceptions.some(e => e.severity === "CRITICAL" || e.severity === "HIGH")) status = "CRITICAL";
  else if (score < 95) status = "WARNING";

  return {
    score,
    status,
    exceptions
  };
}
