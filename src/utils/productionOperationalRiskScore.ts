import { getIncidents } from "./productionIncidentManagement";
import { getActiveAlerts } from "./productionAlertEngine";
import { monitorProductionSla } from "./productionSlaMonitor";

/**
 * PRODUCTION OPERATIONAL RISK SCORE
 * Calculates an evidence-based risk score for the production environment.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskReport {
  score: number; // 0-100 (0 is low risk)
  level: RiskLevel;
  factors: RiskFactor[];
  lastCalculated: string;
}

export interface RiskFactor {
  nameEn: string;
  nameAr: string;
  impact: number;
  status: "NORMAL" | "CONCERNING" | "CRITICAL";
}

export function calculateOperationalRiskScore(): RiskReport {
  const incidents = getIncidents();
  const alerts = getActiveAlerts();
  const slas = monitorProductionSla();
  
  const activeIncidents = incidents.filter(i => i.status !== "CLOSED");
  const slaBreaches = slas.filter(s => s.status === "CRITICAL");
  
  let score = 0;
  const factors: RiskFactor[] = [];
  
  // Incident Risk
  if (activeIncidents.length > 0) {
    const impact = Math.min(40, activeIncidents.length * 10);
    score += impact;
    factors.push({
      nameEn: "Active Incidents",
      nameAr: "الحوادث النشطة",
      impact,
      status: impact > 20 ? "CRITICAL" : "CONCERNING"
    });
  }
  
  // Alert Risk
  if (alerts.length > 0) {
    const impact = Math.min(20, alerts.length * 5);
    score += impact;
    factors.push({
      nameEn: "System Alerts",
      nameAr: "تنبيهات النظام",
      impact,
      status: impact > 10 ? "CONCERNING" : "NORMAL"
    });
  }
  
  // SLA Risk
  if (slaBreaches.length > 0) {
    const impact = Math.min(30, slaBreaches.length * 15);
    score += impact;
    factors.push({
      nameEn: "SLA Breaches",
      nameAr: "خروقات SLA",
      impact,
      status: "CRITICAL"
    });
  }
  
  // Cap at 100
  score = Math.min(100, score);
  
  let level: RiskLevel = "LOW";
  if (score > 75) level = "CRITICAL";
  else if (score > 50) level = "HIGH";
  else if (score > 25) level = "MEDIUM";

  return {
    score,
    level,
    factors,
    lastCalculated: new Date().toISOString()
  };
}
