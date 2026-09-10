export type Language = "ar" | "en";

export type ViewState =
  | "DASHBOARD"
  | "OWNERS"
  | "PROPERTIES"
  | "UNITS"
  | "TENANTS"
  | "LEASES"
  | "RENEW_LEASE"
  | "DEFERRED_PAYMENTS"
  | "CHEQUES"
  | "CHEQUE_OPERATIONS"
  | "BOUNCED_CHEQUES"
  | "DUE_CHEQUES"
  | "COLLECTIONS"
  | "FINANCIALS"
  | "COLLECTIONS_CENTER"
  | "CASES"
  | "HEARINGS"
  | "MAINTENANCE"
  | "REPORTS"
  | "ARCHIVE"
  | "AUDIT_LOGS"
  | "NOTIFICATIONS"
  | "DATA_RECOVERY"
  | "SETTINGS"
  | "ADMIN_CENTER"
  | "TENANT_PORTAL"
  | "OWNER_PORTAL"
  | "COMMUNICATION_CENTER"
  | "PROPERTY_REVIEW"
  | "PROPERTY_OPERATIONS"
  | "DOCUMENT_CONTROL"
  | "TASK_CENTER"
  | "OPERATIONAL_CONTROL"
  | "REAL_DATA_VALIDATION"
  | "USER_ACCEPTANCE_TESTING"
  | "PRINT_CENTER";

export type UserRole =
  | "SYSTEM_OWNER"
  | "SUPER_ADMIN"
  | "MANAGER"
  | "FINANCE"
  | "LEGAL"
  | "PROPERTY_MANAGER"
  | "DATA_ENTRY"
  | "TENANT"
  | "OWNER"
  | "PROPERTY_OWNER";

export interface UserPermissionOverride {
  id: string;
  userId: string;
  permissionId: string;
  effect: "GRANT" | "DENY";
  reason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
  status?: "ACTIVE" | "EXPIRED" | "REVOKED";
  auditId?: string;
}

export type PortalAccountStatus =
  | "NOT_PROVISIONED"
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "PASSWORD_CHANGE_REQUIRED"
  | "SUSPENDED";

export interface User {
  id: string;
  username: string;
  email: string;
  nameEn: string;
  nameAr: string;
  role: UserRole;
  phone?: string;
  tenantId?: string;
  ownerId?: string;
  permissions?: (Permission | string)[];
  userPermissionOverrides?: UserPermissionOverride[];
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  password?: string;
  mustChangePassword?: boolean;
  isFirstLoginCompleted?: boolean;
  portalAccountStatus?: PortalAccountStatus;
}

export interface CompanyLetterheadTemplate {
  id: string;
  fileName: string;
  fileType: string; // "pdf" | "png" | "jpg" | "jpeg"
  fileSize: number;
  fileUrl: string; // Base64 or DataURL
  uploadedAt: string;
  uploadedByUserId: string;
  uploadedByUserName: string;
  isActive: boolean;
  templateType: "OFFICIAL_LETTERHEAD" | string;
  notes?: string;
  storageReference?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  backgroundUrl: string;
  backgroundOpacity: number;
  customCss: string;
  visualOverrides?: string;
  createdAt: string;
}

export interface CompanyProfile {
  nameAr: string;
  nameEn: string;
  vatTrn: string;
  tradeLicenseNumber?: string;
  tradeLicenseNo?: string;
  commercialRegisterNumber?: string;
  commercialRegisterNo?: string;
  licenseExpiryDate?: string;
  address: string;
  addressAr?: string;
  addressEn?: string;
  email: string;
  phone: string;
  website?: string;
  logoUrl?: string;
  logoBase64?: string;
  logo?: string;
  logoDriveLink?: string;
  activeLetterheadId?: string;
  letterheadTemplates?: CompanyLetterheadTemplate[];
  reportBackgroundUrl?: string;
  reportBackgroundOpacity?: number;
  customReportCss?: string;
  visualOverrides?: string;
  savedReportTemplates?: ReportTemplate[];
}

export interface LegalSettings {
  defaultBouncedChequeFee: number;
  defaultLegalFeesClaimed: number;
}

export type Permission =
  | "VIEW_DASHBOARD"
  | "MANAGE_USERS"
  | "EDIT_USER"
  | "DELETE_USER"
  | "MANAGE_MASTER_DATA"
  | "MANAGE_CHEQUES"
  | "OCR_SCAN"
  | "RECORD_COLLECTIONS"
  | "MANAGE_CASES"
  | "MANAGE_HEARINGS"
  | "MANAGE_MAINTENANCE"
  | "VIEW_MAINTENANCE"
  | "CREATE_MAINTENANCE"
  | "EDIT_MAINTENANCE"
  | "DELETE_MAINTENANCE"
  | "MANAGE_MAINTENANCE_INVOICES"
  | "MANAGE_ARCHIVE"
  | "DISPATCH_NOTIFICATIONS"
  | "CONFIGURE_RISK"
  | "VIEW_REPORTS"
  | "EXPORT_DATA"
  | "IMPORT_DATA"
  | "VIEW_AUDIT_LOGS"
  | "OVERRIDE_RISK"
  | "DELETE_RECORDS"
  | "EDIT_SAVED_FINANCIAL_RECORDS"
  | "TENANT_VIEW_OWN_DATA"
  | "OWNER_VIEW_OWN_DATA"
  | "VIEW_OFFICE_PETTY_CASH"
  | "CREATE_OFFICE_PETTY_CASH_MONTH"
  | "ADD_OFFICE_EXPENSE"
  | "EDIT_OFFICE_EXPENSE"
  | "DELETE_OFFICE_EXPENSE"
  | "UPLOAD_OFFICE_PETTY_CASH_RECEIPT"
  | "CLOSE_OFFICE_PETTY_CASH_MONTH"
  | "REOPEN_OFFICE_PETTY_CASH_MONTH"
  | "MANAGE_OFFICE_EXPENSE_CATEGORIES"
  | "VIEW_OFFICE_PETTY_CASH_REPORTS"
  | "MODIFY_CLOSED_OFFICE_PETTY_CASH"
  | "MANAGE_VAT_CONFIG"
  | "MANAGE_CHART_OF_ACCOUNTS"
  | "APPROVE_FINANCIAL_EXEMPTIONS"
  | "identity.read"
  | "identity.view"
  | "identity.create"
  | "identity.update"
  | "identity.document.upload"
  | "identity.document.view"
  | "identity.settings.manage"
  | "identity.bridge.manage"
  | "VERIFICATION.MANUAL_OVERRIDE"
  | "VERIFICATION.OVERRIDE_MISMATCH";

export interface Owner {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  emiratesId: string;
  passportNo?: string;
  tradeLicenseNo?: string;
  trn?: string;
  taxRegistrationNumber?: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  accountNumber: string;
  status: "ACTIVE" | "INACTIVE";
  notes?: string;
  specialAdminFeeRate?: number;
  totalHeld?: number; // Added for atomic concurrency control
  totalPaid?: number; // Added for atomic concurrency control
  fullNameAr?: string;
  fullNameEn?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  cardNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  identitySource?: "OFFICIAL_TOOLKIT" | "UPLOADED_DOCUMENT" | "OCR";
  verificationStatus?: "VERIFIED" | "PENDING" | "EXPIRED" | "UNVERIFIED";
  captureDate?: string;
  readerInformation?: string;
  createdAt: string;
}

export type PropertyType =
  | "RESIDENTIAL_BUILDING"
  | "COMMERCIAL_BUILDING"
  | "MIXED_BUILDING"
  | "VILLA"
  | "ARABIC_HOUSE"
  | "INDUSTRIAL_LAND"
  | "COMMERCIAL_LAND"
  | "RESIDENTIAL_LAND"
  | "FARM"
  | "WAREHOUSE"
  | "SHOWROOM"
  | "RESIDENTIAL_COMPOUND"
  | "COMMERCIAL_COMPLEX"
  | "OTHER"
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "MIXED"
  | string;

export interface Property {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  ownerId: string;
  emirate: "Sharjah" | "Dubai" | "Abu Dhabi" | "Ajman" | "RAK" | "Fujairah" | "UAQ" | string;
  community: string;
  plotNumber?: string;
  buildingNo?: string;
  electricityAccountNo?: string;
  totalUnits: number;
  type: PropertyType;
  status: "ACTIVE" | "UNDER_MAINTENANCE" | "INACTIVE";
  notes?: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  unitNumber: string;
  propertyId: string;
  floor?: string;
  type: "STUDIO" | "1BR" | "2BR" | "3BR" | "4BR_PLUS" | "RETAIL" | "OFFICE" | "WAREHOUSE";
  unitType?: string;
  areaSqFt?: number;
  annualRent: number;
  status: "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  previousStatus?: "VACANT" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  currentTenantId?: string;
  currentLeaseId?: string;
  electricityMeterNo?: string;
  electricityMeter?: string;
  waterMeterNo?: string;
  createdAt: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Tenant {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  type: "INDIVIDUAL" | "CORPORATE";
  emiratesId?: string;
  passportNo?: string;
  passportNumber?: string;
  tradeLicenseNo?: string;
  nationality: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  riskFactors: string[];
  bouncedChequesCount?: number;
  totalBouncedAmount?: number;
  activeCasesCount?: number;
  status: "ACTIVE" | "BLACKLISTED" | "INACTIVE";
  notes?: string;
  specialAdminFeeRate?: number;
  fullNameAr?: string;
  fullNameEn?: string;
  dateOfBirth?: string;
  gender?: string;
  cardNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  identitySource?: "OFFICIAL_TOOLKIT" | "UPLOADED_DOCUMENT" | "OCR";
  verificationStatus?: "VERIFIED" | "PENDING" | "EXPIRED" | "UNVERIFIED";
  captureDate?: string;
  readerInformation?: string;
  createdAt: string;
}

export interface LeaseInstallment {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  chequeNumber?: string;
  chequeId?: string;
  status: "PENDING" | "CLEARED" | "BOUNCED" | "COLLECTED" | "WAIVED";
  notes?: string;
}

export interface AdminFeeExemptionPolicy {
  isExempt: boolean;
  exemptionReason?: "MANAGEMENT_DECISION" | "SPECIAL_CONTRACT_AGREEMENT" | "PROMOTIONAL_EXEMPTION" | "OWNER_REQUEST" | "TENANT_REQUEST" | "RENEWAL_INCENTIVE" | "OTHER";
  exemptionNote?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  approvedBy?: string;
  approvedAt?: string;
}

export type SecurityDepositStatus =
  | "PENDING_COLLECTION"
  | "PENDING"
  | "HELD"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "SETTLED"
  | "CARRIED_FORWARD"
  | "WAIVED";

export type SecurityDepositVerificationStatus =
  | "UNVERIFIED"
  | "PENDING_VERIFICATION"
  | "AI_VERIFIED"
  | "MANUALLY_VERIFIED"
  | "REJECTED"
  | "OVERRIDDEN"
  | "VERIFIED";

export interface SecurityDepositSettlement {
  settlementId?: string;
  settledAt: string;
  settlementDate?: string;
  settledByUserId: string;
  settledByUserName: string;
  totalHeldAmount: number;
  maintenanceDeductions: number;
  maintenanceDeduction?: number;
  rentDeductions: number;
  rentDeduction?: number;
  earlyTerminationDeductions: number;
  earlyTerminationDeduction?: number;
  otherDeductions: number;
  totalDeductions: number;
  netRefundAmount: number;
  remainingDueAmount: number;
  refundPaymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  refundReference?: string;
  refundProofDocId?: string;
  proofDocumentId?: string;
  notes?: string;
}

export interface SecurityDepositHistoryItem {
  id: string;
  date: string;
  action: "COLLECTION" | "COLLECTED" | "CARRIED_FORWARD" | "SETTLEMENT" | "SETTLED" | "REFUND" | "REFUNDED" | "VERIFICATION";
  amount: number;
  fromLeaseId?: string;
  toLeaseId?: string;
  receiptNumber?: string;
  notes?: string;
  performedBy: string;
}

export interface Lease {
  id: string;
  leaseNumber: string;
  ownerId: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  installmentsCount: number;
  chequesCount?: number;
  paymentFrequency?: string;
  securityDeposit: number;
  securityDepositStatus?: SecurityDepositStatus;
  securityDepositReceiptNumber?: string;
  securityDepositPaymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  securityDepositBankName?: string;
  securityDepositChequeNumber?: string;
  securityDepositChequeDate?: string;
  securityDepositIsUndatedCheque?: boolean;
  securityDepositCollectedDate?: string;
  securityDepositProofDocId?: string;
  securityDepositVerificationStatus?: SecurityDepositVerificationStatus | string;
  carriedForwardFromLeaseId?: string;
  carriedForwardToLeaseId?: string;
  securityDepositSettlement?: SecurityDepositSettlement;
  securityDepositHistory?: SecurityDepositHistoryItem[];
  contractStatus: "ACTIVE" | "EXPIRED" | "TERMINATED" | "RENEWED" | "UNDER_RENEWAL" | "CANCELLED" | "PENDING_AUDIT" | "PENDING_APPROVAL" | "PENDING" | "DRAFT";
  renewalDate?: string;
  ejariNumber?: string;
  installments: LeaseInstallment[];
  riskOverrideReason?: string;
  riskOverriddenBy?: string;
  leaseExpenses?: LeaseExpenseItem[];
  adminFeePolicy?: {
    owner?: AdminFeeExemptionPolicy;
    tenant?: AdminFeeExemptionPolicy;
  };
  createdAt: string;
}

export interface LeaseExpenseItem {
  id: string;
  category: PropertyExpenseCategory;
  description: string;
  amount: number;
  vatAmount?: number;
  totalAmount: number;
  dueDate: string;
  costBearer: ExpenseCostBearer;
  status: "PENDING" | "PAID" | "CANCELLED";
  notes?: string;
}

export type ChequeStatus =
  | "PENDING"
  | "CLEARED"
  | "BOUNCED"
  | "COLLECTED"
  | "CANCELLED"
  | "REPLACED"
  | "UNDER_LEGAL"
  | "DEPOSITED"
  | "POST_DATED";

export type ReturnReason =
  | "INSUFFICIENT_FUNDS"
  | "SIGNATURE_MISMATCH"
  | "ACCOUNT_CLOSED"
  | "REFER_TO_DRAWER"
  | "PAYMENT_STOPPED"
  | "POST_DATED_ERROR"
  | "IRREGULAR_ENDORSEMENT"
  | "OTHER";

export type CollectionStatus =
  | "NOT_COLLECTED"
  | "PARTIAL_COLLECTION"
  | "FULLY_COLLECTED_AFTER_BOUNCE";

export type WhatsAppActionStatus = "SENT" | "FAILED" | "PENDING_REMINDER" | "NONE";

export type ChequeCancellationType =
  | "REPLACED"
  | "SETTLED_OTHER_MEANS"
  | "CONTRACT_TERMINATED"
  | "APPROVED_WAIVER"
  | "OTHER";

export interface Cheque {
  id: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  chequeDate: string;
  dueDate: string;
  ownerId: string;
  ownerName?: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  status: ChequeStatus;
  originalStatus: "BOUNCED" | "NORMAL";
  returnReason?: ReturnReason;
  returnedDate?: string;
  bankBounceSlipNumber?: string;
  collectionStatus: CollectionStatus;
  totalApplied: number;
  outstanding: number;
  imageUrl?: string;
  documentId?: string;
  convertedToCaseId?: string;
  whatsAppStatus: WhatsAppActionStatus;
  lastReminderDate?: string;
  reminderCount: number;
  drawerName?: string;
  accountNumber?: string;
  bankAccountNumber?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncedAt?: string;
  notes?: string;
  bouncedFeeCollected?: boolean;
  bouncedFeeCollectedAmount?: number;
  createdAt: string;

  // Replacement Tracking Fields (Optional for backward compatibility)
  originalChequeId?: string;
  replacementChequeIds?: string[];
  replacementGroupId?: string;
  isReplacement?: boolean;
  replacementReason?: string;
  replacementDate?: string;

  // Cancellation Tracking Fields (Optional for backward compatibility)
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancellationSettlementRef?: string;
  cancellationType?: ChequeCancellationType;

  // Deposit Tracking Fields
  depositedDate?: string;
  depositSlipNumber?: string;
  depositedBankName?: string;
  depositProofUrl?: string;
  depositNotes?: string;
  depositedByUserId?: string;

  // Clearance / Bank Settlement Tracking Fields
  clearingDate?: string;
  clearingRef?: string;
  clearingProofUrl?: string;
  clearingNotes?: string;
  clearedByUserId?: string;

  // Audit Trail History
  auditTrail?: ChequeAuditEntry[];

  // Bounce Tracking Fields
  bounceProofUrl?: string;
  bounceNotes?: string;

  // Legacy Cheque Tracking (Optional)
  isLegacy?: boolean;

  // Source PDF & Ingestion Tracing (Document Hardening)
  sourceDocumentId?: string;
  sourcePdfId?: string;
  sourcePdfFileName?: string;
  sourcePdfPageNumber?: number;
  sourceCroppedRegion?: { x: number; y: number; width: number; height: number };
  ingestionSessionId?: string;
}

export interface ChequeAuditEntry {
  id: string;
  action?: string;
  previousStatus: ChequeStatus;
  newStatus: ChequeStatus;
  timestamp: string;
  performedBy?: string;
  performedByUserId?: string;
  userName?: string;
  reference?: string;
  referenceNumber?: string;
  slipNumber?: string;
  proofUrl?: string;
  notes?: string;
  reason?: string;
}

export type PaymentMethod =
  | "BANK_TRANSFER"
  | "CASH"
  | "CREDIT_CARD"
  | "VISA"
  | "MASTERCARD"
  | "REPLACEMENT_CHEQUE"
  | "SETTLEMENT"
  | "CHEQUE";

export interface CollectionRecord {
  id: string;
  receiptNumber: string;
  chequeId?: string;
  caseId?: string;
  leaseId?: string;
  isSecurityDepositReceipt?: boolean;
  securityDepositChequeNumber?: string;
  securityDepositBankName?: string;
  securityDepositIsUndatedCheque?: boolean;
  tenantId: string;
  ownerId: string;
  paymentDate: string;
  amountEntered: number;
  amountApplied: number;
  bouncedFeeAmount?: number;
  adminFeeAmount?: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  payerName: string;
  collectedBy: string;
  collectedByUserId: string;
  notes?: string;
  receiptUrl?: string;
  idempotencyKey?: string;
  approvalCode?: string;
  verificationToken?: string;
  isReversed?: boolean;
  reversalDate?: string;
  reversalReason?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  fileName?: string;
  createdAt: string;
}

export type CaseStatus =
  | "NEW"
  | "UNDER_REVIEW"
  | "LEGAL_NOTICE"
  | "FILED"
  | "IN_PROGRESS"
  | "HEARING_SCHEDULED"
  | "JUDGMENT_ISSUED"
  | "SETTLEMENT_IN_PROGRESS"
  | "SETTLED"
  | "CLOSED"
  | "ARCHIVED"
  | "ENFORCEMENT";

export interface HearingSession {
  id: string;
  sessionNumber: number;
  date: string;
  time: string;
  courtName: string; // e.g. Dubai Rental Dispute Center (RDSC), Abu Dhabi Judicial Dept
  courtRoom?: string;
  hearingDate?: string;
  hearingTime?: string;
  status?: string;
  sessionType: "FIRST_HEARING" | "PLEADINGS" | "EVIDENCE_SUBMISSION" | "EXPERT_REPORT" | "JUDGMENT_HEARING" | "SETTLEMENT_SESSION";
  attendees: string;
  ownerRepresentative: string;
  tenantRepresentative: string;
  attendanceStatus: "BOTH_ATTENDED" | "OWNER_ONLY" | "TENANT_ONLY" | "NONE_ATTENDED" | "POSTPONED";
  summary: string;
  decision: string;
  nextAction: string;
  nextHearingDate?: string;
  notes?: string;
  attachments?: string[];
  createdAt: string;
}

export type Hearing = HearingSession;

export interface SettlementInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  paidDate?: string;
  paymentMethod?: PaymentMethod | "CHEQUE";
  transactionReference?: string;
  chequeDetails?: {
    chequeNumber: string;
    chequeDate: string;
    bankName: string;
    clearedDate?: string;
    isCleared: boolean;
  };
}

export interface SettlementAgreement {
  id: string;
  caseId: string;
  totalAgreedAmount: number;
  installmentsCount: number;
  signedDate: string;
  status: "ACTIVE" | "FULFILLED" | "DEFAULTED";
  terms: string;
  schedule: SettlementInstallment[];
}

export interface CaseDocumentItem {
  id: string;
  caseId: string;
  title: string;
  documentType:
    | "STATEMENT_OF_CLAIM"
    | "BOUNCE_CERTIFICATE"
    | "LEASE_CONTRACT"
    | "CHEQUE_COPY"
    | "EXPERT_REPORT"
    | "JUDGMENT_DECREE"
    | "EXECUTION_ORDER"
    | "LEGAL_NOTICE"
    | "PAYMENT_RECEIPT"
    | "POWER_OF_ATTORNEY"
    | "OTHER";
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
  uploadedByName?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncedAt?: string;
  notes?: string;
}

export interface RentalCase {
  id: string;
  caseNumber: string;
  courtReferenceNumber?: string;
  tenantId: string;
  ownerId: string;
  ownerName?: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  linkedChequeIds: string[];
  linkedExpenseIds?: string[];
  includeBouncedFees?: boolean;
  includeOtherFees?: boolean;
  otherFeesAmount?: number;
  otherFeesDescription?: string;
  claimAmount: number;
  legalFeesClaimed: number;
  bouncedChequeFeePerUnit?: number;
  totalPaid: number;
  paidAmount?: number;
  outstanding: number;
  outstandingAmount?: number;
  status: CaseStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  responsibleUserId: string;
  responsibleUserName: string;
  courtName: string;
  filingDate: string;
  claimDate?: string;
  judgmentDate?: string;
  judgmentDetails?: string;
  sessions: HearingSession[];
  hearings?: HearingSession[];
  settlement?: SettlementAgreement;
  notes?: string;
  documents: string[];
  caseDocuments?: CaseDocumentItem[];
  createdAt: string;
  updatedAt: string;
}

export type Case = RentalCase;

export type DocumentCategory =
  | "OWNERS"
  | "TENANTS"
  | "PROPERTIES"
  | "UNITS"
  | "LEASES"
  | "CHEQUES"
  | "CASES"
  | "SESSIONS"
  | "PAYMENTS"
  | "MAINTENANCE"
  | "EMIRATES_ID"
  | "PASSPORT"
  | "VISA"
  | "TRADE_LICENSE"
  | "POWER_OF_ATTORNEY"
  | "TITLE_DEED"
  | "CHEQUE"
  | "OTHER";

// ==========================================
// INTEGRATED MAINTENANCE MANAGEMENT TYPES
// ==========================================

export type MaintenancePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "EMERGENCY";

export type DocumentOptimizationProfile =
  | "STANDARD"
  | "HIGH_QUALITY"
  | "LEGAL_DOCUMENT"
  | "CHEQUE"
  | "MAINTENANCE_INVOICE"
  | "RECEIPT"
  | "PHOTO";

export type OriginalFileRetentionPolicy = "KEEP_ORIGINAL" | "OPTIMIZED_ONLY";

export interface DocumentOptimizationResult {
  documentId: string;
  originalFileName: string;
  originalMimeType: string;
  originalSizeBytes: number;
  optimizedFileName: string;
  optimizedMimeType: string;
  optimizedSizeBytes: number;
  compressionApplied: boolean;
  compressionMethod: string;
  compressionQuality: number;
  sizeSavedBytes: number;
  sizeSavedPercentage: number;
  isOriginalKept: boolean;
  dataUrl: string;
  originalDataUrl?: string;
  error?: string;
  warnings?: string[];
  pdfPageCount?: number;
  imageDimensions?: { width: number; height: number };
}

export interface DocumentMetadata {
  documentId: string;
  originalFileName: string;
  originalMimeType: string;
  originalSizeBytes: number;
  optimizedFileName: string;
  optimizedMimeType: string;
  optimizedSizeBytes: number;
  compressionApplied: boolean;
  compressionMethod: string;
  compressionQuality: number;
  sizeSavedBytes: number;
  sizeSavedPercentage: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  originalDriveFileId?: string;
  optimizedDriveFileId?: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByUserId: string;
  documentCategory: DocumentCategory;
  sourceEntityType: string;
  sourceEntityId: string;
  leaseId?: string;
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
}

export type MaintenanceStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "RETURNED";

export type CostBearer =
  | "OWNER"
  | "TENANT"
  | "MANAGEMENT"
  | "PER_CONTRACT"
  | "OTHER"
  | "OFFICE"
  | "SPLIT/CUSTOM";

export interface MaintenanceTimelineEvent {
  id: string;
  eventType:
    | "CREATED"
    | "STATUS_CHANGED"
    | "TECHNICIAN_ASSIGNED"
    | "VISIT_RECORDED"
    | "WORK_LOGGED"
    | "INVOICE_ADDED"
    | "COST_UPDATED"
    | "CLOSED"
    | "NOTE_ADDED"
    | "ATTACHMENT_ADDED"
    | "RETURNED_TO_TENANT";
  titleAr: string;
  titleEn: string;
  details: string;
  timestamp: string;
  userId: string;
  userName: string;
}

export interface MaintenancePayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  receivedByUserId?: string;
  receivedByUserName?: string;
  createdAt: string;
}

export interface MaintenanceInvoice {
  id: string;
  maintenanceRequestId: string;
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  description: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  status: "PAID" | "PENDING" | "PARTIALLY_PAID";
  notes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  createdAt: string;
}

export interface MaintenanceAttachment {
  id: string;
  maintenanceRequestId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  category:
    | "BEFORE_REPAIR"
    | "AFTER_REPAIR"
    | "ISSUE_PHOTO"
    | "INVOICE"
    | "QUOTATION"
    | "TECH_REPORT"
    | "OTHER";
  uploadedAt: string;
  uploadedBy: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  notes?: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  company?: string;
  serviceType: string;
  email?: string;
  status: "ACTIVE" | "INACTIVE";
  rating?: number;
  notes?: string;
  createdAt: string;
}

export type MaintenanceFinancialStatus = 
  | "NOT_POSTED"
  | "POSTED"
  | "PARTIALLY_POSTED"
  | "REQUIRES_INVOICE"
  | "RECONCILIATION_ERROR";

export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  requestDate: string;
  requestTime: string;
  requestedBy: string;
  requesterPhone?: string;
  propertyId: string;
  propertyNameAr?: string;
  propertyNameEn?: string;
  unitId: string;
  unitNumber?: string;
  ownerId: string;
  ownerNameAr?: string;
  ownerNameEn?: string;
  tenantId?: string;
  tenantNameAr?: string;
  tenantNameEn?: string;
  tenantPhone?: string;
  leaseId?: string;
  leaseNumber?: string;
  tenantName?: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  issueDescription: string;
  notes: string[];
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  assignedTechnicianPhone?: string;
  assignedTechnicianCompany?: string;
  assignedAt?: string;
  assignedByUserId?: string;
  assignedByUserName?: string;
  visitDate?: string;
  workStartedDate?: string;
  completionDate?: string;
  technicianNotes?: string;
  workPerformed?: string;
  rejectionReason?: string;
  returnReason?: string;
  laborCost: number;
  partsCost: number;
  otherCost: number;
  totalCost: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  costBearer: CostBearer;
  splitMethod?: "PERCENTAGE" | "FIXED";
  splitOwnerVal?: number;
  splitTenantVal?: number;
  splitOfficeVal?: number;
  splitOwnerAmt?: number;
  splitTenantAmt?: number;
  splitOfficeAmt?: number;
  invoices: MaintenanceInvoice[];
  payments?: MaintenancePayment[];
  attachments: MaintenanceAttachment[];
  timeline: MaintenanceTimelineEvent[];
  financialStatus?: MaintenanceFinancialStatus;
  collectionStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  postedExpenseIds?: string[];
  postedAt?: string;
  postedByUserId?: string;
  postedByUserName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceSettings {
  delayedDaysThreshold: number;
  categories: Array<{ id: string; nameAr: string; nameEn: string; icon?: string }>;
  defaultCostBearer: CostBearer;
  slaHoursByPriority: {
    LOW: number;
    NORMAL: number;
    HIGH: number;
    URGENT: number;
    EMERGENCY?: number;
  };
  autoNotifyTenantOnStatusChange: boolean;
}

export interface ElectronicArchiveItem {
  id: string;
  fileName: string;
  category: DocumentCategory;
  documentType?: string; // e.g. "CHEQUE", "BATCH_SCAN", "EMIRATES_ID", "LEASE"
  recordId: string; // ID of the linked owner/tenant/cheque/case
  recordTitle: string;
  fileType: string;
  fileSize: number;
  fileHash: string; // SHA-256 hash to prevent duplicate files
  isPrivate: boolean;
  storagePath: string;
  uploadedByUserId?: string;
  uploadedByName?: string;
  downloadToken: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  tags: string[];
  entityType?: string;
  entityId?: string;
  uploadDate?: string;
  driveFileId?: string;
  cloudFileId?: string;
  driveWebViewLink?: string;
  driveSyncedAt?: string;
  parentDocumentId?: string; // For linking cropped cheques to parent flatbed scan
  batchId?: string;
  sourceRegion?: { x: number; y: number; width: number; height: number };
  policy?: "SINGLE" | "MULTIPLE" | "REPLACEABLE" | "VERSIONED";
  version?: number;
  createdAt: string;
  updatedAt?: string;
  syncStatus?: "PENDING" | "UPLOADING" | "SYNCED" | "FAILED" | "REQUIRES_RETRY" | "PENDING_DRIVE_SYNC";
}

export interface MessageTemplate {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  bodyAr: string;
  bodyEn: string;
  variables: string[];
}

export type NotificationScope = "INTERNAL_ONLY" | "PORTAL_APPROVED" | "PUBLIC";

export interface NotificationRecord {
  id: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS" | "PORTAL" | string;
  type?: any;
  recipient: string;
  recipientName: string;
  recipientPhone?: string;
  tenantId?: string;
  ownerId?: string;
  chequeId?: string;
  caseId?: string;
  status: "SENT" | "FAILED" | "PENDING" | "DELIVERED" | string;
  sentAt?: string;
  content: string;
  message?: string;
  responsePayload?: string;
  attemptCount?: number;
  createdAt: string;
  scope?: NotificationScope;
  isPortalVisible?: boolean;
}

export type NotificationLog = NotificationRecord;

export interface RiskConfigWeights {
  bouncedChequesCountWeight: number; // e.g. 25
  bouncedRatioWeight: number; // e.g. 20
  outstandingAmountWeight: number; // e.g. 25
  delayDaysWeight: number; // e.g. 10
  casesFiledWeight: number; // e.g. 20
  lowThreshold: number; // 0 to 30 -> LOW
  mediumThreshold: number; // 31 to 70 -> MEDIUM
  highThreshold: number; // 71 to 100 -> HIGH
  blockRenewalOnHighRisk: boolean;
  bouncedChequeWeight?: number;
  bouncedAmountWeight?: number;
  activeCasesWeight?: number;
  mediumRiskThreshold?: number;
  highRiskThreshold?: number;
}

export type RiskWeightSettings = RiskConfigWeights;

export type AuditActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "FINANCIAL_RECORD_ADD"
  | "STATUS_CHANGE"
  | "FINANCIAL_PAYMENT"
  | "OVERPAYMENT_ADJUSTMENT"
  | "CONVERT_TO_CASE"
  | "HEARING_ADDED"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_ACCESS"
  | "RISK_OVERRIDE"
  | "USER_ROLE_CHANGE"
  | "USER_STATUS_CHANGE"
  | "PASSWORD_RESET"
  | "DATA_IMPORT"
  | "FINANCIAL_RECORD_EDIT"
  | "TECHNICIAN_ASSIGNED"
  | "MAINTENANCE_STATUS_CHANGE"
  | "INVOICE_CREATED"
  | "INVOICE_PAID"
  | "COMMISSION_CREATED"
  | "COMMISSION_UPDATED"
  | "PAYMENT_ALLOCATED"
  | "PAYMENT_REVERSED"
  | "ALLOCATION_REVERSED"
  | "UPDATE_CASE_FEES_CONFIG"
  | "FINANCIAL_REVERSAL"
  | "FINANCIAL_ADJUSTMENT"
  | "FINANCIAL_POSTING"
  | "CANCEL"
  | "RECONCILIATION_PERFORMED"
  | "OWNER_TRANSFER_CREATED"
  | "OWNER_TRANSFER_STATUS_CHANGED"
  | "PROPERTY_EXPENSE_CREATED"
  | "MAINTENANCE_EXPENSE_POSTED"
  | "ADVANCE_LIQUIDATION"
  | "LINK_EXPENSE"
  | "UNLINK_EXPENSE"
  | "UPDATE_BOUNCED_FEE"
  | "NOTIFY"
  | "DOCUMENT_VIEW"
  | "RECEIPT_PRINT"
  | "EMIRATES_ID_READ_STARTED"
  | "EMIRATES_ID_READ_SUCCESS"
  | "EMIRATES_ID_READ_FAILED"
  | "EMIRATES_ID_DUPLICATE_DETECTED"
  | "EMIRATES_ID_CONFIRMED"
  | "EMIRATES_ID_UPDATED"
  | "EMIRATES_ID_DOCUMENT_UPLOADED"
  | "EMIRATES_ID_DOCUMENT_VIEWED"
  | "EMIRATES_ID_BRIDGE_CONNECTED"
  | "EMIRATES_ID_BRIDGE_DISCONNECTED"
  | "EMIRATES_ID_TOOLKIT_ERROR"
  | "FINANCIAL_PERIOD_CREATED"
  | "FINANCIAL_PERIOD_CLOSED"
  | "FINANCIAL_PERIOD_REOPENED"
  | "PERIOD_CLOSE_REJECTED"
  | "TRANSACTION_REJECTED_CLOSED_PERIOD"
  | "FINANCIAL_RECONCILIATION_STARTED"
  | "FINANCIAL_RECONCILIATION_COMPLETED"
  | "FINANCIAL_RECONCILIATION_FAILED"
  | "FINANCIAL_RECONCILIATION_EXCEPTION"
  | "FINANCIAL_CLOSING_CERTIFIED"
  | "FINANCIAL_CONTROL_SCAN_STARTED"
  | "FINANCIAL_CONTROL_SCAN_COMPLETED"
  | "FINANCIAL_EXCEPTION_DETECTED"
  | "FINANCIAL_CRITICAL_EXCEPTION_DETECTED"
  | "FINANCIAL_INTEGRITY_SNAPSHOT_CREATED"
  | "AI_DOCUMENT_EXTRACTION"
  | "AI_CAPTURE_APPROVED"
  | "FINANCIAL_VERIFICATION"
  | "MANUAL_OVERRIDE"
  | "MISMATCH_OVERRIDE";

export interface RetainedAttachment {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  category?: string;
  driveWebViewLink?: string;
  driveFileId?: string;
  uploadedAt?: string;
}

export interface HistoricalRecord {
  id: string;
  originalId: string;
  entityType: "LEASE" | "CHEQUE" | "CASE" | "TENANT" | "UNIT" | "PROPERTY" | "OWNER" | "COLLECTION" | "MAINTENANCE" | "COMMISSION" | "OWNER_TRANSFER" | "PROPERTY_EXPENSE" | "COLLECTION_ACTION" | "PAYMENT_PROMISE" | "CHART_OF_ACCOUNTS" | "MAINTENANCE_INVOICE";
  entityCode: string;
  entityTitle: string;
  statusAtDeletion?: string;
  deletedAt?: string;
  versionDate?: string;
  recordType: "DELETION" | "VERSION";
  deletedByUserId?: string;
  deletedByUserName?: string;
  deletedByUserRole?: UserRole;
  deletionReason?: string;
  retainedAttachmentsCount: number;
  retainedAttachments: RetainedAttachment[];
  snapshotData: Record<string, any>;
}

export interface DeleteRecordOptions {
  keepAttachments?: boolean;
  reason?: string;
  force?: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: AuditActionType;
  entityType:
    | "USER"
    | "OWNER"
    | "PROPERTY"
    | "UNIT"
    | "TENANT"
    | "LEASE"
    | "CHEQUE"
    | "COLLECTION"
    | "CASE"
    | "HEARING"
    | "DOCUMENT"
    | "HISTORICAL_RECORD"
    | "RISK_CONFIG"
    | "MAINTENANCE_REQUEST"
    | "MAINTENANCE_INVOICE"
    | "TECHNICIAN"
    | "MAINTENANCE_SETTINGS"
    | "COMPANY_PROFILE"
    | "COMMISSION"
    | "OWNER_TRANSFER"
    | "PROPERTY_EXPENSE"
    | "ADJUSTMENT"
    | "COLLECTION_ACTION"
    | "PAYMENT_PROMISE"
    | "FINANCIAL_TRANSACTION"
    | "PAYMENT_ALLOCATION"
    | "REVERSAL"
    | "CHART_OF_ACCOUNTS"
    | "EMIRATES_ID"
    | "FINANCIAL_PERIOD"
    | "PERIOD_CERTIFICATION"
    | "DAILY_DEPOSIT"
    | "DEPOSIT_BATCH";
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
}

// ============================================================================
// PHASE 1 ERP FINANCIAL FOUNDATION & COMMISSION ENGINE TYPES
// ============================================================================

export type VatRateStatus = "ACTIVE" | "INACTIVE" | "SCHEDULED" | "ARCHIVED";
export type VatRateCategory = "STANDARD" | "REDUCED" | "ZERO" | "EXEMPT" | "ADMIN_FEE" | "MAINTENANCE" | "GENERAL";

export interface VatRateRecord {
  id: string;
  rate: number; // e.g. 5.0
  effectiveFrom: string; // ISO date string (YYYY-MM-DD)
  category: VatRateCategory;
  status: VatRateStatus;
  createdAt: string;
  createdById: string;
  createdByName?: string;
  modificationReason?: string;
}

export interface FinancialCommissionSettings {
  defaultOwnerCommissionRate: number; // e.g. 5.0 (%)
  defaultTenantCommissionRate: number; // e.g. 5.0 (%)
  allowCustomRatePerLease: boolean;
  minCommissionAmount?: number;
}

export type CommissionPartyType = "OWNER" | "TENANT" | "THIRD_PARTY";

export type CommissionType =
  | "BROKERAGE"
  | "MANAGEMENT_FEE"
  | "RENEWAL_FEE"
  | "ADMIN_FEE"
  | "LEASING_PREMIUM"
  | "BOUNCED_CHEQUE_PENALTY"
  | "CLEANING_FEE"
  | "SECURITY_FEE"
  | "OTHER_REVENUE"
  | "ADDITIONAL";

export type CommissionCalculationBasis = "PERCENTAGE_OF_RENT" | "FIXED_AMOUNT" | "FORMULA";

export type CommissionStatus =
  | "PENDING"
  | "DUE"
  | "PARTIALLY_COLLECTED"
  | "FULLY_COLLECTED"
  | "COLLECTED"
  | "WAIVED"
  | "CANCELLED"
  | "REVERSED";

export interface CommissionObligation {
  id: string;
  businessKey: string; // leaseId:partyType:commissionType:sequenceOrPeriod
  leaseId: string;
  ownerId?: string;
  tenantId?: string;
  propertyId: string;
  unitId: string;
  
  partyType: CommissionPartyType;
  commissionType: CommissionType;
  calculationBasis: CommissionCalculationBasis;
  
  baseAmount: number; // e.g. Annual Rent value
  ratePercentage?: number; // e.g. 5.0 (for 5%)
  fixedAmount?: number; // e.g. 3000 AED
  totalCommissionAmount: number; // The authoritative obligation amount
  
  dueDate: string;
  notes?: string;
  
  // Derived/Cached balances (authoritative source: active payment_allocations)
  collectedAmount: number;
  outstandingBalance: number;
  status: CommissionStatus;
  
  createdAt: string;
  updatedAt?: string;
  createdById: string;
  createdByName?: string;
  contractualCommissionYear?: string | number;
  isVatInclusive?: boolean;
  businessKeySequence?: string; // Phase 53: Sequential tracking
  renewalSequence?: number;
  isOverride?: boolean;
  overrideReason?: string;
  overrideUserId?: string;
  overrideUserName?: string;
  feeCategory?: string;
  vatAmount?: number;
  vatRate?: number;
  netRevenueAmount?: number;
  taxTreatment?: "VAT_DEDUCTION" | "NONE";
  
  // Exemption Metadata (Phase 5.3)
  isExempt?: boolean;
  exemptionSource?: "CONTRACT_EXEMPTION";
  exemptionReason?: string;
  approvalStatus?: string;
  approvedBy?: string;
  
  collectionDate?: string;
  paymentMethod?: string;
  dailyDepositId?: string;
  referenceNumber?: string;
  transactionReference?: string;
  proofDocumentId?: string;
  verificationStatus?: string;
  verificationMethod?: string;
  verifiedAt?: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  overrideType?: string;
  updatedById?: string;
  updatedByName?: string;
  supportingDocuments?: string[];
  auditHistory?: Array<{ timestamp: string; action: string; userName: string; notes?: string }>;
}

export type PaymentAllocationTargetType =
  | "LEASE_INSTALLMENT"
  | "INVOICE"
  | "COMMISSION"
  | "CHEQUE"
  | "SETTLEMENT"
  | "UNALLOCATED_PREPAYMENT"
  | "RENT"
  | "ADMINISTRATIVE_FEE"
  | "MUNICIPALITY_FEE"
  | "SECURITY_DEPOSIT";

export type PaymentAllocationStatus = "ACTIVE" | "REVERSED";

export interface PaymentAllocation {
  id: string;
  collectionId?: string; // Foreign Key -> collections (Receipt) - Optional now
  chequeId?: string;     // Foreign Key -> cheques (If allocation is for a cheque)
  targetType: PaymentAllocationTargetType;
  targetId: string; // Foreign Key to the target entity (e.g. chequeId, commissionId, installmentId)
  targetDescription?: string;
  
  allocatedAmount: number;
  allocationDate: string;
  
  status: PaymentAllocationStatus;
  reversalReason?: string;
  reversalTimestamp?: string;
  reversedById?: string;
  
  idempotencyKey?: string;
  createdAt: string;
  createdById: string;
}

export interface FinancialReversalRecord {
  id: string;
  reversalNumber: string;
  targetType: "COLLECTION" | "PAYMENT_ALLOCATION" | "CHEQUE_PAYMENT" | "EXPENSE" | "PROPERTY_EXPENSE" | "COMMISSION" | "TRANSFER" | "SECURITY_DEPOSIT";
  targetId: string; // ID of the reversed collection or allocation
  originalAmount: number;
  reversedAmount: number;
  reason: string;
  reversalDate: string;
  reversalTimestamp: string;
  performedByUserId: string;
  performedByUserName: string;
  auditLogId?: string;
  createdAt: string;
}

export interface FinancialAdjustmentRecord {
  id: string;
  adjustmentNumber: string;
  targetEntityType: "TENANT" | "OWNER" | "LEASE" | "COMMISSION" | "CHEQUE";
  targetEntityId: string;
  adjustmentType: "CREDIT" | "DEBIT" | "DISCOUNT" | "WAIVER" | "WRITE_OFF";
  amount: number;
  reason: string;
  justificationDocumentUrl?: string;
  approvedByUserId: string;
  approvedByUserName: string;
  effectiveDate: string;
  createdAt: string;
}

export interface OwnerTransferReconciliation {
  ownerId: string;
  ownerName?: string;
  persistedHeld: number;
  derivedHeld: number;
  persistedPaid: number;
  derivedPaid: number;
  heldDiscrepancy: number;
  paidDiscrepancy: number;
  status: "MATCH" | "DISCREPANCY";
}

export interface ReconciledFinancialBalances {
  tenantBalances: Record<string, { totalDue: number; totalPaid: number; outstanding: number }>;
  ownerBalances: Record<string, { rentCollected: number; deductions: number; ownerPayable: number; transferred: number; netBalance: number }>;
  chequeBalances: Record<string, { amount: number; totalApplied: number; outstanding: number; status: ChequeStatus }>;
  commissionBalances: Record<string, { totalObligation: number; totalCollected: number; remaining: number; status: CommissionStatus }>;
  ownerTransferReconciliation: Record<string, OwnerTransferReconciliation>;
  hasDiscrepancies: boolean;
  discrepancies: string[];
}

// ============================================================================
// PHASE 19: ADVANCED ACCOUNTS RECEIVABLE & DEBT RECOVERY
// ============================================================================

export type CollectionActionType =
  | "PHONE_CALL"
  | "WHATSAPP"
  | "EMAIL"
  | "SMS"
  | "VISIT"
  | "NOTICE"
  | "PAYMENT_PROMISE"
  | "LEGAL_NOTICE"
  | "COURT_REFERRAL"
  | "OTHER";

export type CollectionActionStatus = "OPEN" | "COMPLETED" | "FAILED" | "NO_RESPONSE" | "PROMISED" | "ESCALATED" | "CANCELLED";

export interface CollectionAction {
  id: string;
  actionNumber: string;
  tenantId: string;
  leaseId: string;
  ownerId: string;
  propertyId: string;
  unitId?: string;
  
  outstandingAtTime: number;
  actionDate: string;
  actionTime?: string;
  actionType: CollectionActionType;
  status: CollectionActionStatus;
  result?: string;
  notes?: string;
  
  nextFollowUpDate?: string;
  assignedEmployeeId: string;
  assignedEmployeeName?: string;
  
  relatedPaymentId?: string;
  relatedChequeId?: string;
  relatedCaseId?: string;
  
  createdAt: string;
  createdById: string;
}

export type PromiseStatus = "ACTIVE" | "FULFILLED" | "PARTIALLY_FULFILLED" | "BROKEN" | "CANCELLED";

export interface PaymentPromise {
  id: string;
  promiseNumber: string;
  tenantId: string;
  leaseId: string;
  
  amountPromised: number;
  amountFulfilled: number;
  promiseDate: string;
  expectedPaymentDate: string;
  paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  
  status: PromiseStatus;
  notes?: string;
  
  brokenDate?: string;
  fulfillmentDate?: string;
  
  createdById: string;
  createdAt: string;
}

export type CollectionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TenantReceivablePosition {
  tenantId: string;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days91_120: number;
    days121Plus: number;
  };
  bouncedChequeAmount: number;
  administrativeFeesDue: number;
  maintenanceChargesDue: number;
  legalChargesDue: number;
  priority: CollectionPriority;
  priorityReasons: string[];
  status: "CURRENT" | "DUE_SOON" | "OVERDUE" | "SEVERELY_OVERDUE" | "LEGAL_ESCALATION" | "COLLECTION_COMPLETED";
}

export type AccountCategoryType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type AccountType = AccountCategoryType;
export type AccountNormalBalance = "DEBIT" | "CREDIT";

export interface AccountDefinition {
  id: string;
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  accountType: AccountCategoryType;
  normalBalance: AccountNormalBalance;
  parentAccountId?: string;
  description?: string;
  isActive: boolean;
  isSystemAccount?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type JournalEntryStatus = "DRAFT" | "POSTED" | "REVERSED";

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;
  credit: number;
  description?: string;
  ownerId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  tenantId?: string;
}

export interface JournalEntryRecord {
  id: string;
  entryNumber: string;
  transactionDate: string;
  postingDate: string;
  reference: string;
  sourceType:
    | "RENT_COLLECTION"
    | "ADMIN_FEE"
    | "ADMINISTRATIVE_FEE"
    | "BATCH"
    | "PROPERTY_EXPENSE"
    | "OFFICE_EXPENSE"
    | "OWNER_TRANSFER"
    | "OWNER_TRANSFER_REVERSAL"
    | "BOUNCED_CHEQUE"
    | "FINANCIAL_ADJUSTMENT"
    | "FINANCIAL_REVERSAL"
    | "SECURITY_DEPOSIT"
    | "SECURITY_DEPOSIT_SETTLEMENT"
    | "SECURITY_DEPOSIT_REFUND"
    | "MANUAL_JOURNAL";
  sourceId: string;
  description: string;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdById?: string;
  createdAt: string;
  reversalEntryId?: string;
  originalEntryId?: string;
  lines: JournalLine[];
}

export type OwnerTransferStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "COMPLETED" | "RECONCILED" | "CANCELLED" | "REVERSED";


export interface DailyDepositRecord {
  id: string;
  depositDate: string;
  transactionDate: string;
  amount: number;
  paymentSource: "COLLECTION" | "RECEIPT" | "OWNER_TRANSFER" | "CHEQUE" | "SECURITY_DEPOSIT" | "OTHER";
  sourceId: string;
  bank: string;
  bankAccount: string;
  depositReference: string;
  depositSlipNumber?: string;
  relatedOwnerId?: string;
  relatedTenantId?: string;
  relatedContractId?: string;
  depositType: "CASH" | "CHEQUE" | "BANK_TRANSFER" | "OTHER";
  proofStatus: "MISSING" | "UPLOADED" | "VERIFIED";
  reconciliationStatus: "UNRECONCILED" | "RECONCILED" | "EXCEPTION";
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  reconciledBy?: string;
  reconciledAt?: string;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "RECONCILED" | "EXCEPTION" | "REVERSED";
  notes?: string;
  proofDocumentId?: string;
  differenceAmount?: number;
}

export interface OwnerTransferRecord {
  id: string;
  transferNumber: string;
  ownerId: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  amount: number;
  transferDate: string;
  paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  bankAccountReference?: string;
  beneficiaryBankName?: string;
  beneficiaryIban?: string;
  transactionReferenceNumber?: string;
  status: OwnerTransferStatus;
  notes?: string;
  reversalReason?: string;
  reversalTimestamp?: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  paidByUserId?: string;
  paidByUserName?: string;
  idempotencyKey?: string;
  isReversed?: boolean;
  reversalRecordId?: string;
  proofDocumentId?: string;
  verificationStatus?: "AI_VERIFIED" | "MANUALLY_VERIFIED" | "OVERRIDDEN" | "MISMATCH" | "NEEDS_REVIEW" | "FAILED" | "UNVERIFIED";
  verificationMethod?: "AI_AUTOMATED" | "MANUAL_OVERRIDE" | "MISMATCH_OVERRIDE";
  overrideReason?: string;
  overrideType?: string;
  verifiedByUserId?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  aiVerificationDetails?: any;
  settledAt?: string;
  settledByUserId?: string;
  settledByName?: string;
  createdAt: string;
  createdById: string;
  createdByName?: string;
  ownerName?: string;
  updatedAt?: string;
}

export type PropertyExpenseCategory =
  | "MAINTENANCE"
  | "REPAIRS"
  | "UTILITIES"
  | "MUNICIPALITY_FEES"
  | "INSURANCE"
  | "CLEANING"
  | "SECURITY"
  | "MANAGEMENT"
  | "COMMISSION"
  | "SERVICE_CHARGES"
  | "LEGAL_FEES"
  | "OTHER";

export type ExpenseCostBearer = "OWNER" | "TENANT" | "OFFICE" | "SHARED";
export type CostBearerType = ExpenseCostBearer;

export interface PropertyExpenseRecord {
  id: string;
  expenseNumber: string;
  ownerId?: string;
  propertyId: string;
  unitId?: string;
  leaseId?: string;
  tenantId?: string;
  category: PropertyExpenseCategory;
  description: string;
  amount: number;
  vatAmount?: number;
  vatRate?: number;
  totalAmount: number;
  expenseDate: string;
  costBearer: ExpenseCostBearer;
  paymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
  vendorName?: string;
  vendorInvoiceNumber?: string;
  status: "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "REVERSED";
  sourceType?: "MAINTENANCE_REQUEST" | "LEGAL_CASE" | "LEASE_RENEWAL" | "DIRECT_INVOICE" | "UTILITY_BILL" | "MUNICIPALITY" | "OTHER";
  sourceId?: string;
  maintenanceInvoiceId?: string;
  attachmentUrl?: string;
  notes?: string;
  legalCaseId?: string;
  supportingDocuments?: string[];
  postingStatus?: "POSTED" | "NOT_POSTED";
  expenseLevel?: "PROPERTY_LEVEL" | "UNIT_LEVEL" | "LEASE_LEVEL" | "TENANT_LEVEL" | "OWNER_LEVEL" | "OFFICE_LEVEL";
  transactionReference?: string;
  proofDocumentId?: string;
  verificationStatus?: string;
  verificationMethod?: string;
  overrideReason?: string;
  overrideType?: string;
  aiVerificationDetails?: any;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  createdById: string;
  createdByName?: string;
  updatedAt?: string;
}

export interface OwnerStatementItem {
  id: string;
  date: string;
  reference: string;
  eventType:
    | "RENT_COLLECTED"
    | "OWNER_COMMISSION_DEDUCTION"
    | "PROPERTY_EXPENSE"
    | "MAINTENANCE_EXPENSE"
    | "OWNER_TRANSFER"
    | "ADJUSTMENT"
    | "REVERSAL";
  description: string;
  propertyName?: string;
  unitNumber?: string;
  leaseNumber?: string;
  tenantName?: string;
  debit: number; // Reductions to Owner Payable (Transfers, Commissions, Expenses)
  credit: number; // Additions to Owner Payable (Rent Collections)
  runningBalance: number;
  sourceEntityId?: string;
}

export interface OwnerStatementReport {
  ownerId: string;
  ownerName: string;
  propertyId?: string;
  dateFrom?: string;
  dateTo?: string;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  transactions: OwnerStatementItem[];
  generatedAt: string;
}

export interface TenantStatementItem {
  id: string;
  date: string;
  reference: string;
  eventType:
    | "RENT_CHARGE"
    | "RENT_INSTALLMENT"
    | "ADMINISTRATIVE_FEE"
    | "ATTESTATION_FEE"
    | "TENANT_COMMISSION"
    | "PAYMENT_RECEIVED"
    | "CHEQUE_CLEARED"
    | "BOUNCED_CHEQUE"
    | "SETTLEMENT_PAYMENT"
    | "TENANT_EXPENSE_CHARGE"
    | "ADJUSTMENT"
    | "REVERSAL";
  category?: "RENT" | "ADMIN_FEE" | "ATTESTATION_FEE" | "EXPENSE" | "COMMISSION" | "ADJUSTMENT" | "OTHER";
  status?: "COLLECTED" | "PDC_PENDING" | "CLEARED" | "BOUNCED" | "WAIVED" | "UNPAID";
  description: string;
  propertyName?: string;
  unitNumber?: string;
  leaseNumber?: string;
  tenantName?: string;
  debit: number; // Charges/Obligations (Rent, Commission, Bounced Cheque fees)
  credit: number; // Payments (Collections, Settled Allocations)
  runningBalance: number;
  sourceEntityId?: string;
}

export interface TenantStatementReport {
  tenantId: string;
  tenantName: string;
  leaseId?: string;
  dateFrom?: string;
  dateTo?: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number; // Outstanding Tenant Debt
  contractRentalValue?: number; // Total annual rental value of active contracts
  totalCollectedRent?: number; // Total rent actually collected
  totalPdcPending?: number; // Cheques in PDC / not yet collected
  totalAdminFees?: number; // Total administrative fees billed
  totalAttestationFees?: number; // Total contract attestation fees billed
  totalOtherFees?: number; // Other fees/expenses billed to tenant
  transactions: TenantStatementItem[];
  generatedAt: string;
}

export interface FinancialEventRecord {
  id: string;
  eventNumber: string;
  eventType: string;
  sourceEntityType: string;
  sourceEntityId: string;
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  amount: number;
  eventDate: string;
  status: "ACTIVE" | "REVERSED";
  debitAccountId?: string;
  creditAccountId?: string;
  notes?: string;
  createdAt: string;
  createdById: string;
}

// ============================================================================
// PHASE 24: ADVANCED RELATIONSHIP, DOCUMENT CONTROL, TASKS & WORKFLOWS
// ============================================================================

export type OperationalDocumentType =
  | "OWNER_DOCUMENT"
  | "TENANT_DOCUMENT"
  | "PROPERTY_DOCUMENT"
  | "UNIT_DOCUMENT"
  | "LEASE_DOCUMENT"
  | "EMIRATES_ID"
  | "PASSPORT"
  | "TRADE_LICENSE"
  | "EJARI"
  | "SECURITY_DEPOSIT"
  | "CHEQUE_COPY"
  | "INVOICE"
  | "MAINTENANCE_INVOICE"
  | "LEGAL_DOCUMENT"
  | "COURT_DOCUMENT"
  | "PAYMENT_RECEIPT"
  | "OWNER_TRANSFER_DOCUMENT"
  | "OTHER";

export type OperationalDocumentStatus =
  | "UPLOADED"
  | "VERIFIED"
  | "PENDING_VERIFICATION"
  | "EXPIRED"
  | "REJECTED"
  | "ARCHIVED";

export interface OperationalDocumentRecord {
  id: string;
  documentNumber: string;
  title: string;
  documentType: OperationalDocumentType;
  status: OperationalDocumentStatus;
  
  // Linked Entities
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  maintenanceRequestId?: string;
  legalCaseId?: string;
  financialTransactionId?: string;
  
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  
  issueDate?: string;
  expiryDate?: string;
  uploadedAt: string;
  uploadedByUserId: string;
  uploadedByUserName: string;
  verifiedAt?: string;
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  rejectionReason?: string;
  notes?: string;
  tags?: string[];
}

export type OperationalTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type OperationalTaskStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED";

export interface OperationalTask {
  id: string;
  taskNumber: string;
  title: string;
  description: string;
  
  // Relationships
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  legalCaseId?: string;
  maintenanceRequestId?: string;
  
  assignedUserId?: string;
  assignedUserName?: string;
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  dueDate: string;
  
  createdAt: string;
  createdById: string;
  createdByName?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  completionNotes?: string;
}

export type OperationalCommunicationChannel =
  | "WHATSAPP"
  | "EMAIL"
  | "MANUAL"
  | "PHONE"
  | "VISIT"
  | "NOTE"
  | "PORTAL_MESSAGE"
  | "SMS";

export type CommunicationScope = "INTERNAL_ONLY" | "PORTAL_APPROVED" | "PUBLIC";

export interface OperationalCommunicationRecord {
  id: string;
  communicationNumber?: string;
  timestamp?: string;
  channel: OperationalCommunicationChannel | string;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
  
  sender?: string;
  recipient?: string;
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  recipientName?: string;
  
  // Relationships
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  caseId?: string;
  
  subject: string;
  messageSummary?: string;
  body?: string;
  category?: string;
  deliveryStatus?: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "LOGGED" | string;
  reference?: string;
  userId?: string;
  userName?: string;
  attachments?: string[];
  scope?: CommunicationScope;
  isPortalVisible?: boolean;
  sentAt?: string;
  createdAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: any;
}

export type OperationalCommunication = OperationalCommunicationRecord;

export interface DocumentChecklistItem {
  id: string;
  titleAr: string;
  titleEn: string;
  documentType: OperationalDocumentType;
  isMandatory: boolean;
  status: "COMPLETE" | "INCOMPLETE" | "EXPIRED";
  documentId?: string;
  expiryDate?: string;
}

export interface DocumentChecklistSummary {
  entityType: "OWNER" | "TENANT" | "PROPERTY" | "UNIT" | "LEASE" | "CASE";
  entityId: string;
  entityName: string;
  totalRequired: number;
  completedCount: number;
  expiredCount: number;
  completionPercentage: number;
  items: DocumentChecklistItem[];
}

export interface UnitVacancyIntelligence {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyNameAr: string;
  propertyNameEn: string;
  ownerId: string;
  ownerNameAr: string;
  ownerNameEn: string;
  previousTenantId?: string;
  previousTenantName?: string;
  previousLeaseId?: string;
  previousAnnualRent?: number;
  vacancyStartDate: string;
  vacancyDays: number;
  lastMaintenanceDate?: string;
  estimatedPotentialRent: number;
  currentMaintenanceStatus: "NONE" | "UNDER_MAINTENANCE" | "READY";
  availableDate: string;
}

// ============================================================
// PHASE 25: OPERATIONAL CONTROL, WORKFLOW AUTOMATION & EXCEPTIONS
// ============================================================

export type OperationalExceptionSeverity = "INFORMATION" | "WARNING" | "HIGH" | "CRITICAL";

export type OperationalExceptionStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export type OperationalExceptionType =
  | "LEASE_EXPIRING_90"
  | "LEASE_EXPIRING_60"
  | "LEASE_EXPIRING_30"
  | "LEASE_EXPIRED"
  | "LEASE_RENEWAL_PENDING"
  | "DOCUMENT_EXPIRING_60"
  | "DOCUMENT_EXPIRING_30"
  | "DOCUMENT_EXPIRED"
  | "MISSING_REQUIRED_DOCUMENT"
  | "OVERDUE_TASK"
  | "TASK_DUE_SOON"
  | "BOUNCED_CHEQUE"
  | "BROKEN_PAYMENT_PROMISE"
  | "OVERDUE_COLLECTION"
  | "UNPAID_TENANT_DEBT"
  | "CRITICAL_TENANT_RISK"
  | "UNPOSTED_MAINTENANCE_EXPENSE"
  | "OPEN_MAINTENANCE_LONG"
  | "PENDING_OWNER_TRANSFER"
  | "INSUFFICIENT_PAYABLE_TRANSFER"
  | "PENDING_ADMIN_FEE"
  | "FAILED_COMMUNICATION"
  | "OPEN_LEGAL_CASE"
  | "PENDING_LEGAL_FEES"
  | "FINANCIAL_RECONCILIATION_MISMATCH";

export interface OperationalException {
  id: string;
  exceptionNumber: string;
  dedupeKey: string;
  type: OperationalExceptionType;
  severity: OperationalExceptionSeverity;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sourceEntity: "LEASE" | "DOCUMENT" | "TASK" | "CHEQUE" | "COLLECTION" | "PROMISE" | "MAINTENANCE" | "TRANSFER" | "FEE" | "TENANT" | "PROPERTY" | "UNIT" | "OWNER" | "COMMUNICATION" | "CASE";
  sourceRecordId: string;
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  chequeId?: string;
  caseId?: string;
  amount?: number;
  dueDate?: string;
  status: OperationalExceptionStatus;
  assignedUserId?: string;
  assignedUserName?: string;
  actionRoute?: {
    view: ViewState;
    subId?: string;
    entityType?: string;
  };
  resolutionNotes?: string;
  dismissalReason?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  resolvedAt?: string;
  createdAt: string;
  createdById?: string;
  createdByName?: string;
}

export interface OperationalControlKPIs {
  overdueTasks: number;
  tasksDueToday: number;
  tasksDue3Days: number;
  tasksDue7Days: number;
  expiringLeases: number;
  pendingRenewals: number;
  expiringDocuments: number;
  missingRequiredDocuments: number;
  openMaintenanceRequests: number;
  unpostedMaintenanceExpenses: number;
  pendingPropertyExpenses: number;
  outstandingTenantBalances: number;
  bouncedCheques: number;
  brokenPaymentPromises: number;
  openLegalCases: number;
  pendingLegalFees: number;
  pendingOwnerTransfers: number;
  pendingAdminFees: number;
  pendingCollectionFollowups: number;
  failedCommunications: number;
  criticalExceptionsCount: number;
  highExceptionsCount: number;
  warningExceptionsCount: number;
  totalActiveExceptions: number;
}

export interface DailyWorklistItem {
  id: string;
  section:
    | "OVERDUE"
    | "DUE_TODAY"
    | "DUE_NEXT_3_DAYS"
    | "DUE_NEXT_7_DAYS"
    | "HIGH_PRIORITY"
    | "CRITICAL_EXCEPTIONS"
    | "PENDING_APPROVALS"
    | "PENDING_COLLECTIONS"
    | "DOCUMENT_EXPIRIES"
    | "RENEWALS"
    | "MAINTENANCE"
    | "LEGAL_FOLLOWUP";
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  entityName: string;
  entityType: string;
  entityId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  severity?: OperationalExceptionSeverity;
  dueDate?: string;
  responsibleUser?: string;
  status: string;
  amount?: number;
  actionRoute: {
    view: ViewState;
    entityId?: string;
    entityType?: "OWNER" | "PROPERTY" | "UNIT" | "TENANT" | "LEASE" | "CASE" | "MAINTENANCE" | "COLLECTION" | "DOCUMENT" | "TASK" | "TRANSFER" | "FEE";
  };
}

export type OperationalReportType =
  | "OPERATIONAL_TASKS"
  | "OVERDUE_TASKS"
  | "EXCEPTIONS"
  | "DOCUMENT_EXPIRY"
  | "MISSING_DOCUMENTS"
  | "LEASE_RENEWAL_PIPELINE"
  | "COLLECTION_FOLLOWUP"
  | "PAYMENT_PROMISES"
  | "BOUNCED_CHEQUE_FOLLOWUP"
  | "MAINTENANCE_FOLLOWUP"
  | "LEGAL_FOLLOWUP"
  | "COMMUNICATION_ACTIVITY"
  | "VACANCY_OPERATIONS"
  | "PROPERTY_OPERATIONAL_PERFORMANCE";

// ============================================================================
// PHASE 45: INTEGRATED LEASE RENEWAL, NOTIFICATIONS & FINANCIAL CONTROL
// ============================================================================

export type LeaseRenewalStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type RenewalDurationOption = "1_YEAR" | "2_YEARS" | "3_YEARS" | "CUSTOM";

export interface RenewalChequeDetail {
  chequeNumber: string;
  bankName: string;
  amount: number;
  chequeDate: string;
  dueDate: string;
  drawerName?: string;
  accountNumber?: string;
  imageBase64?: string;
  documentId?: string;
}

export interface RenewalDeferredDetail {
  deferredAmount: number;
  expectedDueDate: string; // MANDATORY for Deferred payments
  deferralReason: string;
  responsiblePerson: string;
  responsibleUserId?: string;
  followUpDate: string;
  allowedDays: number;
}

export interface RenewalAdvanceDetail {
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD";
  receiptNumber?: string;
  transactionReference?: string;
  paidDate?: string;
}

export interface RenewalPaymentItem {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paymentMethod: PaymentMethod | "DEFERRED";
  isAdvance?: boolean;
  chequeDetails?: RenewalChequeDetail;
  deferredDetails?: RenewalDeferredDetail;
  advanceDetails?: RenewalAdvanceDetail;
  status: "PENDING" | "COLLECTED" | "BOUNCED" | "WAIVED";
  notes?: string;
}

export interface LeaseRenewalRecord {
  id: string;
  renewalNumber: string;
  originalLeaseId: string;
  originalLeaseNumber: string;
  newLeaseId?: string;
  newLeaseNumber?: string;
  
  // Parties & Unit
  ownerId: string;
  ownerNameAr?: string;
  ownerNameEn?: string;
  propertyId: string;
  propertyNameAr?: string;
  propertyNameEn?: string;
  unitId: string;
  unitNumber?: string;
  tenantId: string;
  tenantNameAr?: string;
  tenantNameEn?: string;

  // Rent Comparison
  currentAnnualRent: number;
  newAnnualRent: number;
  increaseAmount: number;
  increasePercentage: number;
  increaseReason?: string;

  // Duration & Dates
  durationOption: RenewalDurationOption;
  customDurationMonths?: number;
  originalStartDate: string;
  originalEndDate: string;
  newStartDate: string;
  newEndDate: string;

  // Installments & Payments
  installmentsCount: number;
  paymentFrequency?: string;
  paymentSchedule: RenewalPaymentItem[];
  securityDeposit?: number;
  ejariNumber?: string;

  // Workflow & Approvals
  status: LeaseRenewalStatus;
  rejectionReason?: string;
  
  // Audit & Responsibility
  createdById: string;
  createdByName: string;
  createdAt: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  updatedAt?: string;
  
  notes?: string;
  attachedDocumentIds?: string[];

  // Optional admin fees to be recorded on approval
  includeAdminFees?: boolean;
  ownerFeeEnabled?: boolean;
  ownerFeeBasis?: "PERCENTAGE_OF_RENT" | "FIXED_AMOUNT";
  ownerFeeRate?: number;
  ownerFeeFixed?: number;
  ownerFeeDueDate?: string;
  ownerFeeImmediateCollection?: boolean;
  ownerFeePaymentMethod?: PaymentMethod;
  ownerFeeReference?: string;
  ownerFeeCollectionAmount?: number;
  ownerFeeNotes?: string;

  tenantFeeEnabled?: boolean;
  tenantFeeBasis?: "PERCENTAGE_OF_RENT" | "FIXED_AMOUNT";
  tenantFeeRate?: number;
  tenantFeeFixed?: number;
  tenantFeeDueDate?: string;
  tenantFeeImmediateCollection?: boolean;
  tenantFeePaymentMethod?: PaymentMethod;
  tenantFeeReference?: string;
  tenantFeeCollectionAmount?: number;
  tenantFeeNotes?: string;
  
  leaseExpenses?: LeaseExpenseItem[];
  adminFeePolicy?: {
    owner?: AdminFeeExemptionPolicy;
    tenant?: AdminFeeExemptionPolicy;
  };
}

export interface DeferredPaymentRecord {
  id: string;
  deferredNumber: string;
  leaseId: string;
  leaseNumber?: string;
  renewalId?: string;
  tenantId: string;
  tenantName?: string;
  tenantPhone?: string;
  ownerId: string;
  ownerName?: string;
  propertyId: string;
  propertyName?: string;
  unitId: string;
  unitNumber?: string;
  
  deferredAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  expectedDueDate: string; // MANDATORY
  deferralReason: string;
  responsiblePerson: string;
  responsibleUserId?: string;
  followUpDate: string;
  allowedDays: number;
  
  status: "PENDING" | "DUE_SOON" | "OVERDUE" | "COLLECTED" | "CANCELLED";
  collectionReceiptId?: string;
  collectedAt?: string;
  collectedByUserId?: string;
  collectedByUserName?: string;
  
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface ChequeSecurityConfirmationParams {
  chequeId: string;
  action: "COLLECT" | "BOUNCE" | "CANCEL" | "CASH_SETTLEMENT" | "BANK_TRANSFER_SETTLEMENT" | "CARD_SETTLEMENT" | "RECOVERY";
  paymentMethod?: PaymentMethod;
  collectionDate?: string;
  transactionReference?: string;
  payerName?: string;
  returnReason?: ReturnReason;
  notes?: string;
}

// ==========================================
// OFFICE PETTY CASH MODULE TYPES
// ==========================================

export type PettyCashCarryForwardOption =
  | "CARRY_FORWARD"
  | "RETURN_TO_OWNER"
  | "DO_NOT_CARRY";

export interface OfficePettyCashMonth {
  id: string;
  month: number; // 1-12
  year: number; // e.g. 2026
  openingAmount: number;
  totalExpenses: number;
  closingBalance: number; // openingAmount - totalExpenses
  carryForwardOption?: PettyCashCarryForwardOption;
  status: "OPEN" | "CLOSED";
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  closedBy?: string;
  closedAt?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  actualCashCounted?: number;
  reconciliationDifference?: number;
  reconciliationNotes?: string;
  reconciliationStatus?: "RECONCILED" | "DISCREPANCY" | string;
}

export interface OfficePettyCashReceiptDocument {
  id?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fileUrl: string; // base64 / DataURL
  uploadedAt: string;
  uploadedBy: string;
}

export interface OfficePettyCashExpense {
  id: string;
  monthId: string;
  expenseNumber: string; // e.g. EXP-2026-08-001
  date: string; // YYYY-MM-DD
  categoryId: string;
  categoryNameArabic?: string;
  categoryNameEnglish?: string;
  description: string;
  amount: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "OTHER" | string;
  payee?: string;
  refNumber?: string;
  notes?: string;
  receiptDocument?: OfficePettyCashReceiptDocument;
  receiptDocumentId?: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface OfficePettyCashCategory {
  id: string;
  nameArabic: string;
  nameEnglish: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SaqrOfficeConfig {
  officeNameAr: string;
  officeNameEn: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  currency: string;
  updatedAt?: string;
}

export interface SaqrOfficeManualTransaction {
  id: string;
  date: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  category: "ADMIN_FEE" | "BOUNCED_PENALTY" | "CLEANING" | "GUARD" | "OTHER_INCOME" | "OTHER_EXPENSE";
  description: string;
  referenceNumber?: string;
  uploadedBy: string;
  createdAt: string;
}

// ============================================================================
// PHASE 14 — POST-PRODUCTION GOVERNANCE & OPERATIONAL CONTINUITY TYPES
// ============================================================================

export type GovernanceHealthStatus = "HEALTHY" | "WARNING" | "CRITICAL" | "OPERATIONAL_STABLE";

export interface FinancialIntegritySnapshot {
  id: string;
  snapshotDate: string; // YYYY-MM-DD
  generatedAt: string; // ISO Timestamp
  generatedByUserId?: string;
  generatedByUserName?: string;
  totalActiveAdminFees: number;
  collectedGross: number;
  outstandingGross: number;
  recognizedNetRevenue: number;
  recognizedVat: number;
  masterVariance: number; // Must be 0.00 AED
  vatVariance: number; // Must be 0.00 AED
  officeLedgerVariance: number; // Must be 0.00 AED
  ownerStatementVariance: number; // Must be 0.00 AED
  tenantStatementVariance: number; // Must be 0.00 AED
  exceptionCount: number;
  pendingApprovalCount: number;
  reversalCount: number;
  cancellationCount: number;
  status: GovernanceHealthStatus;
  notes?: string;
}

export type ProductionIncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProductionIncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";

export interface ProductionIncident {
  id: string;
  incidentNumber: string; // e.g. INC-2026-001
  detectedAt: string;
  detectedBy: string;
  severity: ProductionIncidentSeverity;
  module:
    | "ADMIN_FEE_POLICY"
    | "VAT_CALCULATION"
    | "CASH_COLLECTION"
    | "OWNER_TRANSFERS"
    | "TENANT_STATEMENT"
    | "SAQR_OFFICE_LEDGER"
    | "REVERSALS"
    | "PERMISSIONS"
    | "EXPORT_ENGINE"
    | "DATABASE_SYNC"
    | "SYSTEM_GENERAL";
  description: string;
  affectedEntity?: string;
  financialImpactAed: number;
  varianceAed: number;
  status: ProductionIncidentStatus;
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  auditReferences?: string[];
  createdAt: string;
  updatedAt?: string;
}

export type ChangeRequestRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ChangeRequestApprovalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTING"
  | "COMPLETED"
  | "ROLLED_BACK"
  | "CLOSED";

export interface ProductionChangeRequest {
  id: string;
  changeRequestNumber: string; // e.g. CR-2026-001
  title: string;
  description: string;
  businessJustification: string;
  requestedBy: string;
  requestedAt: string;
  affectedModules: string[];
  riskLevel: ChangeRequestRiskLevel;
  financialImpactAssessment: string;
  regressionPlan: string;
  approvalStatus: ChangeRequestApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  implementationStatus: "NOT_STARTED" | "IN_PROGRESS" | "DEPLOYED" | "ROLLED_BACK";
  implementationDate?: string;
  rollbackPlan: string;
  postChangeReconciliation: "CERTIFIED_ZERO_VARIANCE" | "PENDING_VERIFICATION" | "VARIANCE_DETECTED";
  finalCertification?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinancialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  openedBy: string;
  closedAt?: string;
  closedBy?: string;
  auditMetadata?: {
    reference?: string;
    reason?: string;
  };
}

export interface ProductionHealthMetric {
  category: "ENGINE" | "DATABASE" | "SECURITY" | "RECONCILIATION" | "BACKUP";
  nameAr: string;
  nameEn: string;
  status: "OPTIMAL" | "ATTENTION" | "ALERT";
  value: string;
  detailsAr: string;
  detailsEn: string;
  lastCheckedAt: string;
}

// ============================================================================
// PHASE 50: FINANCIAL PERIOD CLOSING RECONCILIATION & FORENSIC CERTIFICATION
// ============================================================================

export type ReconciliationArea =
  | "GENERAL_LEDGER"
  | "COLLECTIONS"
  | "OWNER_PAYABLE"
  | "DAILY_DEPOSITS"
  | "VAT"
  | "CHEQUES"
  | "LEGAL_COLLECTIONS"
  | "REVERSALS_ADJUSTMENTS";

export type ReconciliationAreaStatus = "PASS" | "WARNING" | "FAIL";

export type OverallReconciliationStatus = "RECONCILED" | "RECONCILED_WITH_WARNINGS" | "NOT_RECONCILED";

export type ForensicRecommendedAction =
  | "REVERSAL"
  | "ADJUSTMENT"
  | "SETTLEMENT"
  | "RECONCILIATION"
  | "INVESTIGATION";

export interface ForensicDifferenceItem {
  id: string;
  periodId: string;
  periodName: string;
  module: ReconciliationArea;
  transactionReference: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  transactionDate: string;
  currentStatus: string;
  relatedJournalReference?: string;
  recommendedAction: ForensicRecommendedAction;
  descriptionAr: string;
  descriptionEn: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface AreaReconciliationResult {
  area: ReconciliationArea;
  nameAr: string;
  nameEn: string;
  status: ReconciliationAreaStatus;
  totalExpected: number;
  totalActual: number;
  difference: number;
  exceptionsCount: number;
  warningsCount: number;
  detailsAr: string;
  detailsEn: string;
  differences: ForensicDifferenceItem[];
}

export interface PeriodReconciliationReport {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  periodStatus: "OPEN" | "CLOSED";
  reconciledAt: string;
  reconciledByUserId: string;
  reconciledByUserName: string;
  overallStatus: OverallReconciliationStatus;
  totalCollections: number;
  totalExpenses: number;
  totalOwnerPayable: number;
  totalOwnerTransfers: number;
  totalVat: number;
  totalJournalDebits: number;
  totalJournalCredits: number;
  journalDifference: number;
  totalExceptions: number;
  totalWarnings: number;
  areaResults: AreaReconciliationResult[];
  allDifferences: ForensicDifferenceItem[];
  canCertify: boolean;
}

export interface ForensicClosingCertification {
  id: string;
  certificateNumber: string;
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  certifiedAt: string;
  certifiedByUserId: string;
  certifiedByUserName: string;
  overallStatus: "RECONCILED" | "RECONCILED_WITH_WARNINGS";
  totalCollections: number;
  totalExpenses: number;
  totalOwnerPayable: number;
  totalOwnerTransfers: number;
  totalVat: number;
  totalJournalDebits: number;
  totalJournalCredits: number;
  difference: number;
  exceptionsCount: number;
  warningsCount: number;
  certificationStatus: "CERTIFIED" | "CERTIFIED_WITH_WARNINGS";
  notes?: string;
  snapshotHash: string;
  matrixSummary: {
    area: ReconciliationArea;
    nameAr: string;
    nameEn: string;
    status: ReconciliationAreaStatus;
    difference: number;
    exceptions: number;
  }[];
  createdAt: string;
}

// ============================================================================
// PHASE 51: CONTINUOUS FINANCIAL CONTROL, AUDIT & EXECUTIVE INTEGRITY CENTER
// ============================================================================

export type FinancialIntegrityStatus = "HEALTHY" | "WARNING" | "CRITICAL" | "LOCKED";

export type FinancialExceptionCategory =
  | "UNBALANCED_JOURNAL"
  | "DUPLICATE_COLLECTION"
  | "DUPLICATE_RECEIPT"
  | "OWNER_PAYABLE_MISMATCH"
  | "OWNER_TRANSFER_MISMATCH"
  | "DAILY_DEPOSIT_MISMATCH"
  | "CHEQUE_RECONCILIATION_EXCEPTION"
  | "RETURNED_CHEQUE_EXCEPTION"
  | "LEGAL_CASE_BALANCE_EXCEPTION"
  | "VAT_RECONCILIATION_EXCEPTION"
  | "CLOSED_PERIOD_ATTEMPT"
  | "IMMUTABILITY_EXCEPTION"
  | "REVERSAL_EXCEPTION"
  | "ORPHAN_FINANCIAL_RECORD"
  | "PERIOD_CERTIFICATION_EXCEPTION";

export type FinancialExceptionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type FinancialExceptionStatus =
  | "DETECTED"
  | "UNDER_REVIEW"
  | "RESOLVED_BY_REVERSAL"
  | "RESOLVED_BY_ADJUSTMENT"
  | "MONITORED";

export interface FinancialControlException {
  id: string;
  category: FinancialExceptionCategory;
  severity: FinancialExceptionSeverity;
  detectedAt: string;
  affectedModule: string;
  affectedRecordReference: string;
  financialAmount?: number;
  descriptionAr: string;
  descriptionEn: string;
  recommendedGovernanceAction: "REVERSAL" | "ADJUSTMENT" | "SETTLEMENT" | "INVESTIGATION" | "MONITORING" | "RECONCILIATION";
  status: FinancialExceptionStatus;
  auditReference?: string;
}

export interface ContinuousFinancialControlSummary {
  overallIntegrityStatus: FinancialIntegrityStatus;
  evaluatedAt: string;
  evaluatedByUserId?: string;
  evaluatedByUserName?: string;
  currentOpenPeriod?: FinancialPeriod;
  lastReconciliation?: PeriodReconciliationReport;
  lastForensicCertification?: ForensicClosingCertification;
  totalCollections: number;
  totalOwnerPayables: number;
  totalOwnerTransfers: number;
  totalDailyDeposits: number;
  outstandingChequesAmount: number;
  outstandingChequesCount: number;
  returnedChequesAmount: number;
  returnedChequesCount: number;
  activeLegalCasesAmount: number;
  activeLegalCasesCount: number;
  vatLiability: number;
  reversalsCount: number;
  adjustmentsCount: number;
  criticalExceptionsCount: number;
  warningExceptionsCount: number;
  exceptions: FinancialControlException[];
  snapshotHash: string;
  isLocked: boolean;
  lockReason?: string;
  modulesHealth: {
    generalLedger: "HEALTHY" | "WARNING" | "CRITICAL";
    collections: "HEALTHY" | "WARNING" | "CRITICAL";
    ownerAccounts: "HEALTHY" | "WARNING" | "CRITICAL";
    dailyDeposits: "HEALTHY" | "WARNING" | "CRITICAL";
    chequesAndLegal: "HEALTHY" | "WARNING" | "CRITICAL";
    vatAndTax: "HEALTHY" | "WARNING" | "CRITICAL";
    periodGovernance: "HEALTHY" | "WARNING" | "CRITICAL";
  };
}

export interface ContinuousControlForensicSnapshot {
  id: string;
  snapshotNumber: string;
  timestamp: string;
  evaluatedByUserId: string;
  evaluatedByUserName: string;
  integrityStatus: FinancialIntegrityStatus;
  summary: ContinuousFinancialControlSummary;
  snapshotHash: string;
  createdAt: string;
}








export interface DepositBatchRecord {
  id: string;
  name: string;
  fundCategory: "OFFICE" | "OWNER" | "SECURITY_DEPOSIT";
  itemIds: string[];
  totalAmount: number;
  createdAt: string;
  status: "PENDING_PROOF" | "VERIFIED" | "REJECTED";
  proofId?: string;
  createdBy?: string;
}
