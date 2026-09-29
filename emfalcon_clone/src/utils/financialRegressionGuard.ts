import { runContinuousFinancialHealthScan } from "./continuousFinancialIntegrityMonitor";

/**
 * FINANCIAL REGRESSION GUARD
 * Protects authoritative financial engines from duplication or silent changes.
 */

export interface FinancialGovernanceFinding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  component: string;
  issueEn: string;
  issueAr: string;
  recommendationEn: string;
  recommendationAr: string;
}

export function runFinancialRegressionGuard(data: any): FinancialGovernanceFinding[] {
  const scan = runContinuousFinancialHealthScan(data);
  const findings: FinancialGovernanceFinding[] = [];

  if (scan.status === "CRITICAL") {
    findings.push({
      id: "FIN-REG-001",
      severity: "CRITICAL",
      component: "FinancialEngine",
      issueEn: "Unauthorized divergence in authoritative financial calculation detected.",
      issueAr: "تم اكتشاف اختلاف غير مصرح به في الحسابات المالية المعتمدة.",
      recommendationEn: "Revert changes to computeOwnerPayableDetails and restore from baseline.",
      recommendationAr: "تراجع عن التغييرات في computeOwnerPayableDetails واسترجعها من خط الأساس."
    });
  }

  return findings;
}
