
/**
 * FINANCIAL FAIL-SAFE MODE
 * Controls the operating state of financial modules during abnormal conditions.
 */

export type FinancialFailSafeState = "NORMAL" | "PROTECTED" | "READ_ONLY" | "RECOVERY_LOCK" | "EMERGENCY";

let currentState: FinancialFailSafeState = "NORMAL";
let lockReason: string = "";

export function getFinancialFailSafeState(): { state: FinancialFailSafeState, reason: string } {
  return { state: currentState, reason: lockReason };
}

export function setFinancialFailSafeState(state: FinancialFailSafeState, reason: string = ""): void {
  currentState = state;
  lockReason = reason;
}

export function isFinancialActionAllowed(action: string): boolean {
  if (currentState === "NORMAL") return true;
  if (currentState === "READ_ONLY") return false;
  if (currentState === "RECOVERY_LOCK") return action === "SYSTEM_READ";
  
  // PROTECTED mode might allow limited actions
  if (currentState === "PROTECTED") {
    const highRiskActions = ["DELETE", "REVERSE", "TRANSFER", "BULK_IMPORT"];
    return !highRiskActions.includes(action);
  }

  return false;
}
