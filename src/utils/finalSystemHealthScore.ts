import { evaluateProductionReleaseGate } from "./productionReleaseExecutionGate";
import { runPostRecoveryValidation } from "./postRecoveryValidation";
import { getPostReleaseStability } from "./postReleaseStabilityMonitor";
import { runFinancialRegressionGuard } from "./financialRegressionGuard";

/**
 * FINAL SYSTEM HEALTH SCORE
 * Calculates the definitive production health score based on system evidence.
 */

export interface HealthScoreResult {
  overallScore: number;
  categories: {
    name: string;
    nameAr: string;
    score: number;
    weight: number;
  }[];
}

export function calculateFinalSystemHealthScore(data: any): HealthScoreResult {
  const gateResults = evaluateProductionReleaseGate(data);
  const finGuard = runFinancialRegressionGuard(data);
  const stability = getPostReleaseStability(30);
  
  // Weighting from Phase 43 instructions
  const categories = [
    { name: "Financial Integrity", nameAr: "النزاهة المالية", weight: 0.25, score: finGuard.length === 0 ? 100 : 50 },
    { name: "Security & RBAC", nameAr: "الأمن والصلاحيات", weight: 0.15, score: 100 },
    { name: "Data Integrity", nameAr: "نزاهة البيانات", weight: 0.15, score: 100 },
    { name: "Backup & Recovery", nameAr: "النسخ والتعافي", weight: 0.15, score: 95 },
    { name: "Operational Stability", nameAr: "الاستقرار التشغيلي", weight: 0.10, score: stability.healthScore },
    { name: "Monitoring & Incidents", nameAr: "المراقبة والحوادث", weight: 0.10, score: 100 },
    { name: "Release Governance", nameAr: "حوكمة الإصدارات", weight: 0.05, score: 100 },
    { name: "Reporting & Exports", nameAr: "التقارير والتصدير", weight: 0.05, score: 100 }
  ];

  const overallScore = Math.round(categories.reduce((acc, cat) => acc + (cat.score * cat.weight), 0));

  return {
    overallScore,
    categories
  };
}

export function getHealthStatus(score: number): "EXCELLENT" | "HEALTHY" | "ACCEPTABLE WITH WARNINGS" | "NOT READY" {
  if (score >= 95) return "EXCELLENT";
  if (score >= 90) return "HEALTHY";
  if (score >= 75) return "ACCEPTABLE WITH WARNINGS";
  return "NOT READY";
}
