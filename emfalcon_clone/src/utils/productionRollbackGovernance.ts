/**
 * PRODUCTION ROLLBACK GOVERNANCE
 * Controls the process of reverting application state.
 */

export interface RollbackPlan {
  id: string;
  targetVersion: string;
  reasonEn: string;
  reasonAr: string;
  authorizedBy: string;
  status: "PENDING" | "EXECUTED" | "CANCELLED";
  timestamp: string;
}

export function requestRollback(version: string, reason: string, user: string): RollbackPlan {
  return {
    id: `ROLL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now() % 10000}`,
    targetVersion: version,
    reasonEn: reason,
    reasonAr: "تراجع طارئ بسبب عطل في الإصدار الأخير",
    authorizedBy: user,
    status: "EXECUTED",
    timestamp: new Date().toISOString()
  };
}
