import { getFinalProductionBaseline } from "./finalProductionBaseline";
import { calculateFinalSystemHealthScore } from "./finalSystemHealthScore";

/**
 * FINAL PRODUCTION ACCEPTANCE CERTIFICATE
 * Generates the definitive certification for Emirates Falcon ERP.
 */

export interface AcceptanceCertificate {
  certificateId: string;
  companyEn: string;
  companyAr: string;
  appVersion: string;
  releaseId: string;
  fingerprint: string;
  acceptanceDate: string;
  healthScore: number;
  status: "FINAL PRODUCTION ACCEPTED" | "FINAL ACCEPTED WITH WARNINGS" | "ACCEPTANCE BLOCKED";
  certifiedBy: string;
}

export function generateFinalAcceptanceCertificate(data: any, adminUser: string): AcceptanceCertificate {
  const baseline = getFinalProductionBaseline();
  const health = calculateFinalSystemHealthScore(data);
  
  let status: AcceptanceCertificate["status"] = "FINAL PRODUCTION ACCEPTED";
  if (health.overallScore < 75) status = "ACCEPTANCE BLOCKED";
  else if (health.overallScore < 95) status = "FINAL ACCEPTED WITH WARNINGS";

  return {
    certificateId: `CERT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${(Date.now() % 10000).toString().padStart(3, '0')}`,
    companyEn: "Emirates Falcon Real Estate",
    companyAr: "صقر الإمارات للعقارات",
    appVersion: baseline.appVersion,
    releaseId: baseline.releaseId,
    fingerprint: baseline.releaseFingerprint,
    acceptanceDate: new Date().toISOString(),
    healthScore: health.overallScore,
    status,
    certifiedBy: adminUser
  };
}
