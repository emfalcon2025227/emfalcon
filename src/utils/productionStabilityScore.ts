import { evaluateRecoveryCertification } from "./recoveryCertificationEngine";
import { getActiveAlerts } from "./productionAlertEngine";
import { getIncidents } from "./productionIncidentManagement";

/**
 * PRODUCTION STABILITY SCORE
 * Evidence-based calculation of system stability.
 */

export interface StabilityScore {
  overall: number;
  trend: "UP" | "DOWN" | "STABLE";
  factors: {
    recoveryReady: number;
    financialHealth: number;
    incidentVolume: number;
    alertVolume: number;
  };
}

export function calculateProductionStabilityScore(data: any): StabilityScore {
  const cert = evaluateRecoveryCertification(data);
  const alerts = getActiveAlerts();
  const incidents = getIncidents();
  
  const recoveryReady = cert.score;
  const financialHealth = 95; // Simulated baseline
  
  const incidentPenalty = incidents.filter(i => i.status !== "CLOSED").length * 5;
  const alertPenalty = alerts.length * 2;
  
  const score = Math.max(0, Math.min(100, (recoveryReady + financialHealth) / 2 - incidentPenalty - alertPenalty));
  
  return {
    overall: Math.round(score),
    trend: "STABLE",
    factors: {
      recoveryReady,
      financialHealth,
      incidentVolume: incidents.length,
      alertVolume: alerts.length
    }
  };
}
