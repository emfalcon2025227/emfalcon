// src/services/documentNamingService.ts
/**
 * Canonical Document Naming & Policy Service
 * Emirates Falcon Real Estate Management ERP
 * Enforces systematic, audit-ready document filenames and document lifecycle policies.
 */

export type DocumentPolicyType = "SINGLE" | "MULTIPLE" | "REPLACEABLE" | "VERSIONED";

export interface DocumentNamingParams {
  category: "CHEQUES" | "CONTRACTS" | "TENANTS" | "PROPERTIES" | "MAINTENANCE" | "LEGAL" | "FINANCIAL" | "BATCH_SCANS" | "GENERAL";
  entityType: string;
  entityId: string;
  documentType?: string;
  identifier?: string; // e.g. cheque number, contract number, emirates ID
  secondaryIdentifier?: string; // e.g. tenant name, side (FRONT/BACK), installment index
  dateStr?: string; // YYYY-MM-DD
  extension?: string; // e.g. "jpg", "pdf", "png"
  version?: number;
}

export interface DocumentPolicyRule {
  category: string;
  documentType: string;
  policy: DocumentPolicyType;
  maxActiveCount?: number;
  archiveOldOnReplace: boolean;
  driveSubPath: string;
}

export class DocumentNamingService {
  /**
   * Generates a clean, normalized, safe filename based on business identity.
   */
  static generateCanonicalFileName(params: DocumentNamingParams): string {
    const ext = (params.extension || "jpg").replace(/^\./, "").toLowerCase();
    const datePart = params.dateStr || new Date().toISOString().split("T")[0];
    const cleanEntityId = (params.entityId || "SYS").replace(/[^a-zA-Z0-9_-]/g, "");

    let cleanIdent = "";
    if (params.identifier) {
      cleanIdent = params.identifier.trim().replace(/[^a-zA-Z0-9\u0621-\u064A_-]/g, "_");
    }

    let cleanSec = "";
    if (params.secondaryIdentifier) {
      cleanSec = params.secondaryIdentifier.trim().replace(/[^a-zA-Z0-9\u0621-\u064A_-]/g, "_").substring(0, 30);
    }

    const docType = (params.documentType || params.category).toUpperCase();

    let prefix = "DOC";
    switch (docType) {
      case "CHEQUE":
      case "CHEQUES":
        prefix = "CHEQUE";
        return cleanIdent
          ? `${prefix}_${cleanIdent}_${cleanEntityId}_${datePart}.${ext}`
          : `${prefix}_${cleanEntityId}_${datePart}_${Date.now().toString(36)}.${ext}`;

      case "BATCH_SCAN":
      case "FLATBED_SCAN":
        prefix = "BATCH_SCAN";
        return `${prefix}_${cleanEntityId}_${datePart}_${Date.now().toString(36)}.${ext}`;

      case "EMIRATES_ID":
      case "EID":
        prefix = "EID";
        return cleanSec
          ? `${prefix}_${cleanEntityId}_${cleanSec}_${datePart}.${ext}`
          : `${prefix}_${cleanEntityId}_${datePart}.${ext}`;

      case "CONTRACT":
      case "LEASE":
      case "CONTRACTS":
        prefix = "LEASE";
        return cleanIdent
          ? `${prefix}_${cleanIdent}_${cleanSec || cleanEntityId}_${datePart}.${ext}`
          : `${prefix}_${cleanEntityId}_${datePart}.${ext}`;

      case "BOUNCE_SLIP":
        prefix = "BOUNCE_SLIP";
        return `${prefix}_${cleanIdent || cleanEntityId}_${datePart}.${ext}`;

      case "RECEIPT":
      case "VOUCHER":
        prefix = "RECEIPT";
        return `${prefix}_${cleanIdent || cleanEntityId}_${datePart}.${ext}`;

      default:
        return `${docType}_${cleanEntityId}_${cleanIdent ? cleanIdent + "_" : ""}${datePart}.${ext}`;
    }
  }

  /**
   * Retrieves the policy rule for a specific document category and type.
   */
  static getPolicyRule(category: string, documentType: string = "GENERAL"): DocumentPolicyRule {
    const key = `${category.toUpperCase()}_${documentType.toUpperCase()}`;

    switch (key) {
      case "CHEQUES_CHEQUE":
        return {
          category: "CHEQUES",
          documentType: "CHEQUE",
          policy: "SINGLE", // 1 primary scan image per cheque record
          maxActiveCount: 1,
          archiveOldOnReplace: true,
          driveSubPath: "Emirates Falcon/Archive/Cheques",
        };

      case "BATCH_SCANS_BATCH_SCAN":
        return {
          category: "BATCH_SCANS",
          documentType: "BATCH_SCAN",
          policy: "MULTIPLE",
          archiveOldOnReplace: false,
          driveSubPath: "Emirates Falcon/Archive/BatchScans",
        };

      case "TENANTS_EMIRATES_ID":
        return {
          category: "TENANTS",
          documentType: "EMIRATES_ID",
          policy: "REPLACEABLE", // Front / Back
          archiveOldOnReplace: true,
          driveSubPath: "Emirates Falcon/Archive/Tenants/Identity",
        };

      case "CONTRACTS_LEASE":
      case "CONTRACTS_CONTRACT":
        return {
          category: "CONTRACTS",
          documentType: "LEASE",
          policy: "VERSIONED",
          archiveOldOnReplace: false,
          driveSubPath: "Emirates Falcon/Archive/Contracts",
        };

      default:
        return {
          category,
          documentType,
          policy: "MULTIPLE",
          archiveOldOnReplace: false,
          driveSubPath: `Emirates Falcon/Archive/${category}`,
        };
    }
  }
}
