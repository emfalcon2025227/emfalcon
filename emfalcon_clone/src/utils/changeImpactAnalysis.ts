/**
 * CHANGE IMPACT ANALYSIS
 * Identifies dependencies and affected modules for a proposed change.
 */

export interface ImpactAnalysis {
  modulesEn: string[];
  modulesAr: string[];
  riskFactor: number; // 0-1
  summaryEn: string;
  summaryAr: string;
}

export function analyzeChangeImpact(affected: string[]): ImpactAnalysis {
  const modulesArMap: Record<string, string> = {
    "FinancialEngine": "المحرك المالي",
    "OwnerStatement": "كشف حساب المالك",
    "TenantLease": "عقد المستأجر",
    "Reporting": "التقارير"
  };

  return {
    modulesEn: affected,
    modulesAr: affected.map(m => modulesArMap[m] || m),
    riskFactor: affected.includes("FinancialEngine") ? 0.9 : 0.3,
    summaryEn: `This change affects ${affected.length} critical modules. High testing priority recommended.`,
    summaryAr: `هذا التغيير يؤثر على ${affected.length} وحدة حرجة. يوصى بأولوية اختبار عالية.`
  };
}
