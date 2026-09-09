
import { runContinuousFinancialHealthScan } from "./continuousFinancialIntegrityMonitor";
import { runContinuousDataIntegrityScan } from "./continuousDataIntegrityMonitor";
import { runConfigurationDriftCheck } from "./productionConfigurationDriftMonitor";
import { dispatchAlert } from "./productionAlertEngine";
import { processAlertForIncidents } from "./productionIncidentManagement";
import { getActiveAlerts } from "./productionAlertEngine";

/**
 * PRODUCTION AUTOMATION BRIDGE
 * Periodically runs monitors and dispatches findings to the Alert Engine.
 */
export function runProductionAutomationCycle(data: any): void {
  // 1. Run Financial Health Scan
  const finHealth = runContinuousFinancialHealthScan(data);
  finHealth.drifts.forEach(drift => {
    dispatchAlert({
      category: "FINANCIAL_INTEGRITY",
      severity: drift.severity,
      titleEn: `Financial Drift Detected: ${drift.module}`,
      titleAr: `تم اكتشاف انحراف مالي: ${drift.module}`,
      descriptionEn: drift.description,
      descriptionAr: drift.description, // Reusing description for now
      source: drift.module,
      recommendedActionEn: drift.remediation,
      recommendedActionAr: "يرجى مراجعة القيود المالية وتصحيح الانحراف."
    });
  });

  // 2. Run Data Integrity Scan
  const dataIntegrity = runContinuousDataIntegrityScan(data);
  dataIntegrity.exceptions.forEach(exc => {
    dispatchAlert({
      category: "DATA_INTEGRITY",
      severity: exc.severity,
      titleEn: `Data Integrity Issue: ${exc.type}`,
      titleAr: `مشكلة في سلامة البيانات: ${exc.type}`,
      descriptionEn: exc.description,
      descriptionAr: exc.description,
      source: exc.entityType,
      relatedRecordId: exc.entityId,
      relatedEntity: exc.entityType,
      recommendedActionEn: "Verify record relationships and remove orphans or duplicates.",
      recommendedActionAr: "يرجى التحقق من العلاقات المرجعية وإزالة السجلات اليتيمة أو المكررة."
    });
  });

  // 3. Run Configuration Drift Check
  const configDrift = runConfigurationDriftCheck();
  configDrift.drifts.forEach(drift => {
    if (drift.status === "DRIFT") {
      dispatchAlert({
        category: "CONFIGURATION_DRIFT",
        severity: drift.severity,
        titleEn: `Configuration Drift: ${drift.key}`,
        titleAr: `انحراف في الإعدادات: ${drift.key}`,
        descriptionEn: `Expected ${drift.expected}, but found ${drift.actual}.`,
        descriptionAr: `المتوقع ${drift.expected}، ولكن تم العثور على ${drift.actual}.`,
        source: "System Config",
        recommendedActionEn: "Restore the configuration to the approved baseline.",
        recommendedActionAr: "يرجى استعادة الإعدادات إلى القيم المعتمدة."
      });
    }
  });

  // 4. Process Alerts for Incidents
  const activeAlerts = getActiveAlerts();
  activeAlerts.forEach(alert => {
    processAlertForIncidents(alert);
  });
}
