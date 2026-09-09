/**
 * PRODUCTION DATA GROWTH MONITOR
 * Monitors record counts and provides warnings when thresholds are exceeded.
 */

export interface GrowthPoint {
  collection: string;
  count: number;
  growthRate: number; // records per month
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

export function monitorDataGrowth(data: any): GrowthPoint[] {
  const collections = [
    { name: "owners", data: data.owners },
    { name: "properties", data: data.properties },
    { name: "units", data: data.units },
    { name: "tenants", data: data.tenants },
    { name: "leases", data: data.leases },
    { name: "collections", data: data.collections },
    { name: "expenses", data: data.propertyExpenses },
    { name: "auditLogs", data: data.auditLogs },
    { name: "archive", data: data.archive },
  ];

  return collections.map(c => {
    const count = c.data?.length || 0;
    let status: GrowthPoint["status"] = "NORMAL";
    
    // Simple logic: warn if collections or audit logs grow beyond arbitrary limits
    if (c.name === "auditLogs" && count > 100000) status = "WARNING";
    if (c.name === "collections" && count > 50000) status = "WARNING";
    
    return {
      collection: c.name,
      count,
      growthRate: count > 100 ? 5.2 : 0.5, // Simulated growth rate
      status
    };
  });
}
