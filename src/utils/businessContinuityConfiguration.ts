
/**
 * BUSINESS CONTINUITY CONFIGURATION
 * Centralized settings for RPO, RTO, and recovery authorization.
 */

export interface ContinuityConfig {
  currency: string;
  dateFormat: string;
  rpoThresholdHours: number;
  rtoThresholdMinutes: number;
  backupFreshnessWarningHours: number;
  backupFreshnessCriticalHours: number;
  recoveryAuthorizationRequired: boolean;
  maintenanceModeActive: boolean;
}

const defaultConfig: ContinuityConfig = {
  currency: "AED",
  dateFormat: "DD/MM/YYYY",
  rpoThresholdHours: 24,
  rtoThresholdMinutes: 60,
  backupFreshnessWarningHours: 12,
  backupFreshnessCriticalHours: 48,
  recoveryAuthorizationRequired: true,
  maintenanceModeActive: false
};

let currentConfig = { ...defaultConfig };

export function getContinuityConfig(): ContinuityConfig {
  return currentConfig;
}

export function updateContinuityConfig(updates: Partial<ContinuityConfig>): void {
  currentConfig = { ...currentConfig, ...updates };
}
