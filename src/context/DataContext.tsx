import React, { createContext, useContext, useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from "../lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, deleteField, runTransaction, getDocs } from "firebase/firestore";
import { useLanguage } from "./LanguageContext";
import {
  isOccupyingLeaseStatus,
  getUnitOccupyingLeases,
  getUnitEffectiveOccupancy,
  validateUnitAvailabilityForLease,
  reconcileAllUnitsOccupancy,
  UnitOccupancySummary,
  UnitAvailabilityValidationResult,
  UnitReconciliationMismatch,
  OCCUPYING_LEASE_STATUSES,
  NON_OCCUPYING_LEASE_STATUSES
} from "../utils/unitOccupancyGovernance";
export {
  isOccupyingLeaseStatus,
  getUnitOccupyingLeases,
  getUnitEffectiveOccupancy,
  validateUnitAvailabilityForLease,
  reconcileAllUnitsOccupancy,
  OCCUPYING_LEASE_STATUSES,
  NON_OCCUPYING_LEASE_STATUSES
};
export type {
  UnitOccupancySummary,
  UnitAvailabilityValidationResult,
  UnitReconciliationMismatch
};
import {
  Owner,
  Property,
  Unit,
  Tenant,
  Lease,
  LeaseInstallment,
  Cheque,
  ChequeAuditEntry,
  CollectionRecord,
  RentalCase,
  ElectronicArchiveItem,
  NotificationRecord, MessageTemplate,
  RiskConfigWeights,
  AuditLogEntry,
  ChequeStatus,
  ChequeCancellationType,
  ReturnReason,
  PaymentMethod,
  CaseStatus,
  HearingSession,
  SettlementAgreement,
  RiskLevel,
  DocumentCategory,
  CaseDocumentItem,
  HistoricalRecord,
  RetainedAttachment,
  DeleteRecordOptions,
  MaintenanceRequest,
  MaintenanceInvoice,
  MaintenancePayment,
  MaintenanceAttachment,
  Technician,
  MaintenanceSettings,
  MaintenancePriority,
  MaintenanceStatus,
  CostBearer,
  MaintenanceTimelineEvent,
  CompanyProfile,
  CompanyLetterheadTemplate,
  CommissionObligation,
  CommissionStatus,
  CollectionStatus,
  PaymentAllocation,
  PaymentAllocationTargetType,
  FinancialReversalRecord,
  FinancialAdjustmentRecord,
  ReconciledFinancialBalances,
  AccountDefinition,
  OwnerTransferRecord,
  DailyDepositRecord,
  DepositBatchRecord,
  PropertyExpenseRecord,
  OwnerStatementReport,
  TenantStatementReport,
  OwnerTransferStatus,
  ExpenseCostBearer,
  MaintenanceFinancialStatus,
  CollectionAction,
  PaymentPromise,
  TenantReceivablePosition,
  CollectionPriority,
  LeaseRenewalRecord,
  LeaseRenewalStatus,
  DeferredPaymentRecord,
  RenewalPaymentItem,
  ChequeSecurityConfirmationParams,
  OfficePettyCashMonth,
  OfficePettyCashExpense,
  OfficePettyCashCategory,
  PettyCashCarryForwardOption,
  LegalSettings,
  SaqrOfficeConfig,
  SaqrOfficeManualTransaction,
  VatRateRecord,
  VatRateCategory,
  VatRateStatus,
  JournalEntryRecord,
  JournalLine,
  JournalEntryStatus,
  FinancialPeriod,
  PeriodReconciliationReport,
  ForensicClosingCertification,
  OperationalCommunicationRecord,
  SecurityDepositStatus,
  SecurityDepositSettlement,
  SecurityDepositHistoryItem,
} from "../types";
import {
  reconcileFinancialPeriod,
  createForensicClosingCertification,
} from "../services/periodReconciliationEngine";
import {
  validateJournalEntry,
  buildReversalJournalEntry,
  buildRentCollectionJournal,
  buildAdminFeeJournal,
  buildOwnerTransferJournal,
  buildOwnerTransferReversalJournal,
  buildPropertyExpenseJournal,
  buildBouncedChequeJournal,
  buildSecurityDepositCollectionJournal,
  buildSecurityDepositSettlementJournal,
  buildSecurityDepositRefundJournal,
  buildBankDepositJournal,
} from "../services/journalEngine";
import { uploadFileToGoogleDrive, getAccessToken } from "../services/googleDriveService";
import { DocumentStorageService, DocumentUploadOptions } from "../services/documentStorageService";
import { OCRService } from "../services/ocr/ocrEngine";
import { safeFetchJson } from "../utils/safeApiFetch";
import { normalizeArabicText } from "../utils/arabicTextNormalizer";
import {
  normalizeChequeNumber,
  isSameChequeNumber,
  findLinkedChequeForInstallment,
  findMatchingLeaseAndInstallment,
} from "../utils/chequeUtils";
import { isCardPayment } from "../utils/paymentUtils";
import {
  FinancialVerificationStatus,
  VerificationMethod,
  VerificationOverrideType,
  evaluateSettlementGate,
  buildVerificationAuditRecord,
} from "../services/verificationPolicyService";
import {
  generateCommissionBusinessKey,
  isDuplicateCommission,
  validatePaymentAllocations,
  computeChequeDerivedBalance,
  computeCommissionDerivedBalance,
  recalculateAllFinancialBalances,
  INITIAL_CHART_OF_ACCOUNTS,
  INITIAL_FINANCIAL_PERIODS,
  getApplicableVatRate,
  computeOwnerPayableDetails,
  generateOwnerStatement,
  generateTenantStatement,
  validateOwnerTransfer,
  calculateCommissionAmount,
  DEFAULT_COMMISSION_SETTINGS,
  createExpenseFromMaintenance,
  OwnerPayableDetails,
  validateTransactionPeriod,
  validateFinancialPeriodClosing,
  canCreateFinancialPeriod,
} from "../services/financialEngine";

/**
 * Generates a sequential code for various system entities.
 * Ensures numbers follow 1, 2, 3... pattern within a year and prefix.
 */
export const generateSequentialNumber = (
  existingItems: any[] = [],
  field: string,
  prefix: string,
  padding: number = 4,
  includeYear: boolean = false
): string => {
  const currentYear = new Date().getFullYear();
  const yearPrefix = includeYear ? `${currentYear}-` : "";
  const fullPrefix = `${prefix}${yearPrefix}`;

  let maxNum = 0;

  if (Array.isArray(existingItems) && existingItems.length > 0) {
    for (const item of existingItems) {
      if (!item) continue;
      const val = item[field];
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.startsWith(fullPrefix)) {
          const numPart = trimmed.slice(fullPrefix.length).replace(/[^0-9].*$/, "");
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        } else if (trimmed.startsWith(prefix)) {
          const numPart = trimmed.slice(prefix.length).replace(/[^0-9].*$/, "");
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        } else {
          // Check for numbers inside or at the end
          const matches = trimmed.match(/\d+/g);
          if (matches && matches.length > 0) {
            const lastMatch = parseInt(matches[matches.length - 1], 10);
            if (!isNaN(lastMatch) && lastMatch > maxNum && lastMatch < 1000000) {
              maxNum = lastMatch;
            }
          }
        }
      } else if (typeof val === "number") {
        if (val > maxNum) maxNum = val;
      }
    }
  }

  const nextNumber = maxNum + 1;
  return `${fullPrefix}${nextNumber.toString().padStart(padding, "0")}`;
};
import {
  checkEntityDeleteIntegrity,
  DeleteIntegrityCheckResult,
  EntityIntegrityType,
} from "../utils/integrityChecker";
import {
  INITIAL_OWNERS,
  INITIAL_PROPERTIES,
  INITIAL_UNITS,
  INITIAL_TENANTS,
  INITIAL_LEASES,
  INITIAL_CHEQUES,
  INITIAL_COLLECTIONS,
  INITIAL_CASES,
  INITIAL_ARCHIVE,
  INITIAL_NOTIFICATIONS,
  INITIAL_RISK_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_HISTORICAL_RECORDS,
  INITIAL_MAINTENANCE_REQUESTS,
  INITIAL_TECHNICIANS,
  INITIAL_MAINTENANCE_SETTINGS,
  INITIAL_LEGAL_SETTINGS,
} from "../data/seedData";
import { useAuth } from "./AuthContext";

export interface DataContextType {

  isQuotaExceeded: boolean;
  isDataLoaded: boolean;
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  cheques: Cheque[];
  collections: CollectionRecord[];
  cases: RentalCase[];
  maintenanceRequests: MaintenanceRequest[];
  technicians: Technician[];
  maintenanceSettings: MaintenanceSettings;
  archive: ElectronicArchiveItem[];
  notifications: NotificationRecord[];
  messageTemplates: MessageTemplate[];
  updateMessageTemplate: (id: string, patch: Partial<MessageTemplate>) => void;
  riskConfig: RiskConfigWeights;
  riskWeights?: RiskConfigWeights;
  auditLogs: AuditLogEntry[];
  historicalRecords: HistoricalRecord[];
  financialPeriods: FinancialPeriod[];
  companyProfile: CompanyProfile;
  updateCompanyProfile: (profile: CompanyProfile) => void;
  activeLetterheadTemplate?: CompanyLetterheadTemplate;
  addCompanyLetterheadTemplate: (templateData: Omit<CompanyLetterheadTemplate, "id" | "uploadedAt" | "uploadedByUserId" | "uploadedByUserName">) => { success: boolean; template?: CompanyLetterheadTemplate; error?: string };
  setActiveCompanyLetterhead: (templateId: string) => { success: boolean; error?: string };
  deleteCompanyLetterheadTemplate: (templateId: string) => { success: boolean; error?: string };

  // ERP Phase 1 Financial Foundation & Commissions
  commissions: CommissionObligation[];
  commissionObligations: CommissionObligation[];
  paymentAllocations: PaymentAllocation[];
  financialReversals: FinancialReversalRecord[];
  financialAdjustments: FinancialAdjustmentRecord[];

  // ERP Phase 2: VAT Rate History & Management
  vatRates: VatRateRecord[];
  addVatRate: (data: Omit<VatRateRecord, "id" | "createdAt" | "createdById" | "createdByName">) => { success: boolean; error?: string };
  updateVatRate: (id: string, patch: Partial<VatRateRecord>, reason?: string) => { success: boolean; error?: string };
  deleteVatRate: (id: string, reason?: string) => { success: boolean; error?: string };

  // ERP Phase 2: Chart of Accounts, Owner Transfers, Property Expenses & Statements
  chartOfAccounts: AccountDefinition[];

  dailyDeposits: DailyDepositRecord[];
  depositBatches: DepositBatchRecord[];
  createDepositBatch: (batch: DepositBatchRecord) => void;
  updateDepositBatch: (id: string, patch: Partial<DepositBatchRecord>) => void;
  addDailyDeposit: (deposit: Omit<DailyDepositRecord, "id" | "createdAt" | "createdBy">) => Promise<{ success: boolean; error?: string; id?: string }>;
  updateDailyDeposit: (id: string, updates: Partial<DailyDepositRecord>) => Promise<{ success: boolean; error?: string }>;
  ownerTransfers: OwnerTransferRecord[];
  propertyExpenses: PropertyExpenseRecord[];

  // ERP Phase 19: Advanced Accounts Receivable & Debt Recovery
  collectionActions: CollectionAction[];
  paymentPromises: PaymentPromise[];

  addCollectionAction: (data: Omit<CollectionAction, "id" | "actionNumber" | "createdAt" | "createdById">) => { success: boolean; action?: CollectionAction; error?: string };
  updateCollectionAction: (id: string, patch: Partial<CollectionAction>, modificationReason?: string) => { success: boolean; error?: string };
  addPaymentPromise: (data: Omit<PaymentPromise, "id" | "promiseNumber" | "createdAt" | "createdById" | "amountFulfilled">) => { success: boolean; promise?: PaymentPromise; error?: string };
  updatePaymentPromise: (id: string, patch: Partial<PaymentPromise>, modificationReason?: string) => { success: boolean; error?: string };
  fulfillPaymentPromise: (promiseId: string, amount: number) => { success: boolean; error?: string };
  getTenantReceivablePosition: (tenantId: string) => TenantReceivablePosition;

  addOwnerTransfer: (data: Omit<OwnerTransferRecord, "id" | "transferNumber" | "createdAt" | "createdById" | "createdByName"> & { createdById?: string; createdByName?: string }) => Promise<{ success: boolean; transfer?: OwnerTransferRecord; error?: string }>;
  updateOwnerTransfer: (id: string, patch: Partial<OwnerTransferRecord>, modificationReason?: string) => Promise<{ success: boolean; error?: string }>;
  updateOwnerTransferStatus: (transferId: string, newStatus: OwnerTransferStatus, notes?: string, modificationReason?: string) => Promise<{ success: boolean; error?: string }>;
  settleOwnerTransfer: (params: {
    transferId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
  }) => Promise<{ success: boolean; error?: string }>;
  cancelOwnerTransfer: (transferId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  reverseOwnerTransfer: (transferId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  addPropertyExpense: (data: Omit<PropertyExpenseRecord, "id" | "expenseNumber" | "totalAmount" | "createdAt" | "createdById" | "createdByName"> & { createdById?: string; createdByName?: string }) => { success: boolean; expense?: PropertyExpenseRecord; error?: string };
  settlePropertyExpense: (params: any) => Promise<{ success: boolean; error?: string }>;
  updatePropertyExpense: (id: string, patch: Partial<PropertyExpenseRecord>, modificationReason?: string) => { success: boolean; error?: string };
  reversePropertyExpense: (expenseId: string, reason: string) => { success: boolean; error?: string };
  deletePropertyExpense: (expenseId: string) => Promise<{ success: boolean; error?: string }>;
  addAccountDefinition: (data: Omit<AccountDefinition, "id" | "createdAt">) => { success: boolean; account?: AccountDefinition; error?: string };
  updateAccountDefinition: (id: string, patch: Partial<AccountDefinition>, modificationReason?: string) => { success: boolean; error?: string };

  addFinancialPeriod: (data: Omit<FinancialPeriod, "id" | "openedAt" | "openedBy" | "status">) => { success: boolean; period?: FinancialPeriod; error?: string };
  closeFinancialPeriod: (id: string, reason?: string) => { success: boolean; error?: string };
  reopenFinancialPeriod: (id: string, reason: string) => { success: boolean; error?: string };
  deleteFinancialPeriod: (id: string) => { success: boolean; error?: string };
  periodCertifications: ForensicClosingCertification[];
  runPeriodReconciliation: (periodId: string) => { success: boolean; report?: PeriodReconciliationReport; error?: string };
  generatePeriodCertification: (periodId: string, notes?: string) => Promise<{ success: boolean; certification?: ForensicClosingCertification; error?: string }>;

  journalEntries: JournalEntryRecord[];
  postJournalEntry: (entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">) => { success: boolean; entry?: JournalEntryRecord; error?: string };
  reverseJournalEntry: (id: string, reason: string) => { success: boolean; reversalEntry?: JournalEntryRecord; error?: string };
  updateJournalEntry: (id: string, patch: Partial<JournalEntryRecord>) => { success: boolean; error?: string };
  deleteJournalEntry: (id: string) => { success: boolean; error?: string };
  getOwnerPayable: (ownerId: string) => OwnerPayableDetails;
  getOwnerStatement: (ownerId: string, filters?: { propertyId?: string; dateFrom?: string; dateTo?: string }) => OwnerStatementReport;
  getTenantStatement: (tenantId: string, filters?: { leaseId?: string; dateFrom?: string; dateTo?: string }) => TenantStatementReport;

  addCommissionObligation: (data: Omit<CommissionObligation, "id" | "businessKey" | "collectedAmount" | "outstandingBalance" | "status" | "createdAt" | "createdById" | "createdByName" | "createdById" | "createdByName"> & { createdById?: string; createdByName?: string; businessKeySequence?: string }) => { success: boolean; commission?: CommissionObligation; error?: string };
  updateCommissionObligation: (id: string, patch: Partial<CommissionObligation>, modificationReason?: string) => { success: boolean; error?: string };
  collectAdministrativeFee: (
    id: string,
    amount: number,
    paymentMethod: PaymentMethod,
    referenceNumber?: string,
    notes?: string,
    idempotencyKey?: string,
    options?: {
      sourceWorkflow?: "DAILY_DEPOSITS" | "DIRECT_SETTLEMENT" | "SETTLEMENT_GATE";
      proofDocumentId?: string;
      dailyDepositId?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  settleAdministrativeFee: (params: {
    commissionId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
    paymentMethod?: PaymentMethod;
    dailyDepositId?: string;
    linkedDailyDeposit?: DailyDepositRecord;
  }) => Promise<{ success: boolean; error?: string }>;
  reverseCommissionObligation: (id: string, reason: string) => { success: boolean; error?: string };
  deleteCommissionObligation: (id: string, options?: DeleteRecordOptions) => void;
  collectSecurityDeposit: (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    isUndatedCheque?: boolean;
    payerName?: string;
    transactionReference?: string;
    notes?: string;
    proofBase64?: string;
    proofFileName?: string;
  }) => Promise<{ success: boolean; receipt?: CollectionRecord; journalEntry?: JournalEntryRecord; error?: string }>;
  settleSecurityDeposit: (params: {
    leaseId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
    paymentMethod?: PaymentMethod;
  }) => Promise<{ success: boolean; error?: string }>;
  refundOrSettleSecurityDeposit: (params: {
    leaseId: string;
    deductions: {
      rentDeduction?: number;
      maintenanceDeduction?: number;
      earlyTerminationDeduction?: number;
      otherDeductions?: number;
    };
    refundPaymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    refundReference?: string;
    proofBase64?: string;
    proofFileName?: string;
    notes?: string;
  }) => Promise<{ success: boolean; settlement?: SecurityDepositSettlement; journalEntry?: JournalEntryRecord; error?: string }>;
  allocatePaymentToTargets: (params: {
    collectionId: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; allocatedCount: number; error?: string }>;
  reversePaymentReceipt: (collectionId: string, reason: string) => { success: boolean; reversal?: FinancialReversalRecord; error?: string };
  processUnifiedPayment: (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    payerName: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    chequeId?: string;
    chequeDetails?: {
      chequeNumber: string;
      chequeDate: string;
      bankName: string;
      accountHolder?: string;
      depositDate?: string;
      depositReference?: string;
    };
    attachment?: {
      fileName: string;
      driveFileId?: string;
      driveWebViewLink?: string;
    };
    approvalCode?: string;
    fromCase?: boolean;
    userId?: string;
    userName?: string;
  }) => Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }>;
  recordLeasePayment: (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    payerName: string;
    paymentDate: string;
    referenceNumber?: string;
    approvalCode?: string;
    notes?: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    chequeDetails?: {
      chequeNumber: string;
      chequeDate: string;
      bankName: string;
      accountHolder?: string;
      depositDate?: string;
      depositReference?: string;
    };
    attachment?: {
      fileName: string;
      driveFileId?: string;
      driveWebViewLink?: string;
    };
  }) => Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }>;
  liquidateUnallocatedAdvance: (params: {
    leaseId: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    notes?: string;
  }) => Promise<{ success: boolean; allocatedCount: number; error?: string }>;
  reverseSinglePaymentAllocation: (allocationId: string, reason: string) => { success: boolean; error?: string };
  recordFinancialAdjustment: (params: Omit<FinancialAdjustmentRecord, "id" | "adjustmentNumber" | "createdAt">) => { success: boolean; adjustment?: FinancialAdjustmentRecord; error?: string };
  reconcileSystemFinancialBalances: (shouldLogAudit?: boolean) => ReconciledFinancialBalances;
  checkFinancialEditPermission: (entityType: AuditLogEntry["entityType"], modificationReason?: string) => { allowed: boolean; error?: string };

  // Master Data CRUD
  addOwner: (owner: Omit<Owner, "id" | "createdAt">) => Owner;
  updateOwner: (id: string, patch: Partial<Owner>) => void;
  deleteOwner: (id: string, options?: DeleteRecordOptions) => void;
  addProperty: (prop: Omit<Property, "id" | "createdAt">) => Property;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  deleteProperty: (id: string, options?: DeleteRecordOptions) => void;
  addUnit: (unit: Omit<Unit, "id" | "createdAt">) => Unit;
  updateUnit: (id: string, patch: Partial<Unit>) => void;
  deleteUnit: (id: string, options?: DeleteRecordOptions) => void;
  addTenant: (tenant: Omit<Tenant, "id" | "createdAt" | "riskScore" | "riskLevel" | "riskFactors">) => Tenant;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  deleteTenant: (id: string, options?: DeleteRecordOptions) => void;
  addLease: (lease: Omit<Lease, "id" | "createdAt">) => Lease;
  updateLease: (id: string, patch: Partial<Lease>) => void;
  deleteLease: (id: string, options?: DeleteRecordOptions) => void;
  renewLease: (leaseId: string, newEndDate: string, annualRent: number, overrideReason?: string) => void;
  validateUnitAvailability: (unitId: string, options?: { targetLeaseId?: string; renewalOriginalLeaseId?: string; isRenewal?: boolean }) => UnitAvailabilityValidationResult;
  getUnitOccupancyStatus: (unitId: string) => UnitOccupancySummary;
  reconcileUnitOccupancy: () => { reconciledCount: number; mismatches: UnitReconciliationMismatch[] };

  // PHASE 45: Lease Renewal & Deferred Payments
  leaseRenewals: LeaseRenewalRecord[];
  deferredPayments: DeferredPaymentRecord[];
  createLeaseRenewal: (data: Omit<LeaseRenewalRecord, "id" | "renewalNumber" | "createdAt" | "createdById" | "createdByName" | "status">) => { success: boolean; renewal?: LeaseRenewalRecord; error?: string };
  updateLeaseRenewal: (id: string, patch: Partial<LeaseRenewalRecord>, modificationReason?: string) => { success: boolean; error?: string };
  approveLeaseRenewal: (id: string, reviewNotes?: string) => { success: boolean; renewal?: LeaseRenewalRecord; newLease?: Lease; error?: string };
  rejectLeaseRenewal: (id: string, rejectionReason: string) => { success: boolean; error?: string };
  recordDeferredPayment: (data: Omit<DeferredPaymentRecord, "id" | "deferredNumber" | "collectedAmount" | "outstandingAmount" | "status" | "createdAt" | "createdById" | "createdByName">) => { success: boolean; deferred?: DeferredPaymentRecord; error?: string };
  collectDeferredPayment: (params: { deferredId: string; amount: number; paymentMethod: PaymentMethod; transactionReference?: string; notes?: string }) => Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }>;
  cancelDeferredPayment: (deferredId: string, reason: string) => { success: boolean; error?: string };
  updateChequeWithSafetyConfirmation: (params: ChequeSecurityConfirmationParams) => Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }>;
  dispatchRenewalNotification: (renewalId: string, channel?: "WHATSAPP" | "EMAIL" | "PORTAL") => Promise<{ success: boolean; message: string }>;
  dispatchPaymentReceiptNotification: (receiptId: string, channel?: "WHATSAPP" | "EMAIL") => Promise<{ success: boolean; message: string }>;
  dispatchChequeReminderNotification: (chequeId: string, reminderType: "SEVEN_DAYS_BEFORE" | "FIVE_DAYS_BEFORE" | "DUE_TODAY" | "OVERDUE") => Promise<{ success: boolean; message: string }>;
  runAutomatedChequeReminders: () => Promise<{ success: boolean; count: number }>;
  dispatchDeferredReminderNotification: (deferredId: string, targetType?: "TENANT" | "RESPONSIBLE_EMPLOYEE") => Promise<{ success: boolean; message: string }>;
  dispatchNewLeaseNotification: (leaseId: string) => Promise<{ success: boolean; message: string }>;
  dispatchChequeCollectedNotification: (chequeId: string) => Promise<{ success: boolean; message: string }>;

  // Cheque Management
  addCheque: (chequeData: Omit<Cheque, "id" | "createdAt" | "totalApplied" | "outstanding" | "whatsAppStatus" | "reminderCount">) => Cheque;
  updateCheque: (id: string, patch: Partial<Cheque>, modificationReason?: string) => { success: boolean; error?: string };
  deleteCheque: (id: string, options?: DeleteRecordOptions) => void;
  updateChequeStatus: (
    id: string,
    newStatus: ChequeStatus,
    modificationReason?: string,
    returnedDate?: string,
    fromCase?: boolean,
    additionalData?: {
      returnReason?: ReturnReason;
      bankBounceSlipNumber?: string;
      bounceProofUrl?: string;
      reference?: string;
      proofUrl?: string;
      notes?: string;
    }
  ) => { success: boolean; error?: string };
  depositCheque: (params: { chequeId: string; depositedDate: string; depositSlipNumber?: string; depositedBankName?: string; depositProofUrl?: string; notes?: string; userId?: string; userName?: string; }) => Promise<{ success: boolean; error?: string }>;
  clearCheque: (params: { chequeId: string; clearingDate: string; clearingRef?: string; clearingProofUrl?: string; notes?: string; userId?: string; userName?: string; }) => Promise<{ success: boolean; error?: string }>;
  checkDuplicateCheque: (chequeNumber: string, drawerName?: string, leaseId?: string, tenantId?: string, amount?: number) => Cheque | undefined;
  bulkUpdateCheques: (ids: string[], patch: Partial<Cheque>) => void;
  replaceCheque: (params: {
    originalChequeId: string;
    replacementCheques: Array<{
      chequeNumber: string;
      bankName: string;
      amount: number;
      chequeDate: string;
      dueDate: string;
      drawerName?: string;
      accountNumber?: string;
      notes?: string;
    }>;
    reason: string;
    date?: string;
  }) => { success: boolean; newCheques?: Cheque[]; error?: string };
  cancelCheque: (params: {
    chequeId: string;
    cancellationType: ChequeCancellationType;
    reason: string;
    settlementRef?: string;
    userId?: string;
  }) => { success: boolean; error?: string };
  
  extractChequeOCR: (imageBase64: string, mimeType?: string) => Promise<any>;
  extractChequeBatchOCR: (payload: { imageBase64?: string; images?: string[]; mimeType?: string }) => Promise<any>;
  extractDocumentOCR: (documentType: string, imageBase64: string, mimeType?: string) => Promise<any>;

  markInstallmentAsBounced: (leaseId: string, installmentNumber: number, reason?: string) => { success: boolean; cheque?: Cheque; error?: string };
  updateLeaseInstallmentStatus: (leaseId: string, installmentNumber: number, status: "PENDING" | "CLEARED" | "BOUNCED" | "COLLECTED" | "WAIVED", chequeId?: string) => { success: boolean; error?: string };

  // Collections
  recordCollection: (params: {
    chequeId: string;
    amountEntered: number;
    bouncedFeeAmount?: number;
    paymentMethod: PaymentMethod;
    payerName: string;
    notes?: string;
    transactionReference?: string;
    approvalCode?: string;
    fromCase?: boolean;
  }) => Promise<{ success: boolean; appliedAmount: number; isOverpayment: boolean; receipt?: CollectionRecord; error?: string }>;
  deleteCollection: (id: string, options?: DeleteRecordOptions) => void;

  // Cases & Hearings
  addCase: (caseData: Omit<RentalCase, "id" | "createdAt" | "updatedAt">) => void;
  convertChequesToCase: (params: {
    chequeIds: string[];
    courtName: string;
    responsibleUserId: string;
    responsibleUserName: string;
    courtReferenceNumber?: string;
    legalFeesClaimed?: number;
    notes?: string;
  }) => RentalCase;
  linkChequesToCase: (
    caseId: string,
    chequeIds: string[],
    reason?: string
  ) => { success: boolean; linkedCount: number; error?: string };
  unlinkChequeFromCase: (
    caseId: string,
    chequeId: string,
    reason?: string
  ) => { success: boolean; error?: string };
  createCaseFromCheque: (params: {
    chequeId: string;
    caseNumber?: string;
    courtName?: string;
    courtReferenceNumber?: string;
    emirate?: string;
    city?: string;
    responsibleUserId?: string;
    responsibleUserName?: string;
    legalFeesClaimed?: number;
    notes?: string;
  }) => RentalCase;
  updateCaseStatus: (caseId: string, status: CaseStatus) => { success: boolean; error?: string };
  deleteCase: (id: string, options?: DeleteRecordOptions) => void;
  linkExpenseToCase: (caseId: string, expenseId: string, reason?: string) => { success: boolean; error?: string };
  linkMultipleExpensesToCase: (caseId: string, expenseIds: string[], reason?: string) => { success: boolean; error?: string };
  unlinkExpenseFromCase: (caseId: string, expenseId: string, reason?: string) => { success: boolean; error?: string };
  updateCaseBouncedFee: (caseId: string, feePerUnit: number, reason?: string) => { success: boolean; error?: string };
  updateCaseFeesConfig: (caseId: string, updates: { includeBouncedFees?: boolean; includeOtherFees?: boolean; otherFeesAmount?: number; otherFeesDescription?: string; }) => { success: boolean; error?: string };
  addHearingSession: (caseId: string, sessionData: Omit<HearingSession, "id" | "createdAt">) => void;
  addHearingToCase?: (caseId: string, hearingData: any) => void;
  updateHearingSession: (caseId: string, sessionId: string, patch: Partial<HearingSession>) => void;
  saveSettlement: (caseId: string, settlementData: Omit<SettlementAgreement, "id">) => void;
  saveSettlementAgreement?: (caseId: string, agreement: any) => void;
  paySettlementInstallment: (caseId: string, installmentId: string, paymentData: { 
    amount?: number;
    method: PaymentMethod | "CHEQUE"; 
    date: string; 
    reference?: string;
    chequeDetails?: { chequeNumber: string; chequeDate: string; bankName: string };
  }) => void;
  clearSettlementCheque: (caseId: string, installmentId: string) => void;
  updateSettlementCheque: (caseId: string, installmentId: string, chequeData: { chequeNumber: string; chequeDate: string; bankName: string }) => void;

  // Historical Records & Archiving
  deleteHistoricalRecord: (id: string) => void;
  restoreHistoricalRecord: (id: string) => { success: boolean; message?: string };
  checkDeleteIntegrity: (entityType: EntityIntegrityType, entityId: string) => DeleteIntegrityCheckResult;

  // Case Documents
  addCaseDocument: (
    caseId: string,
    doc: Omit<CaseDocumentItem, "id" | "uploadedAt">,
    syncToDrive?: boolean
  ) => Promise<{ success: boolean; document?: CaseDocumentItem; driveLink?: string; error?: string }>;
  deleteCaseDocument: (caseId: string, docId: string) => void;
  syncCaseDocumentToDrive: (caseId: string, docId: string) => Promise<{ success: boolean; driveLink?: string; error?: string }>;

  // Cheque Images & Google Drive Sync
  uploadChequeImage: (
    chequeId: string,
    imageBase64: string,
    syncToDrive?: boolean
  ) => Promise<{ success: boolean; driveLink?: string; error?: string }>;
  syncChequeToDrive: (chequeId: string) => Promise<{ success: boolean; driveLink?: string; error?: string }>;
  deleteChequeImage: (chequeId: string) => void;

  // Archive
  addArchiveItem: (item: Omit<ElectronicArchiveItem, "id" | "createdAt" | "downloadToken" | "fileHash"> & { fileHash?: string }) => ElectronicArchiveItem;
  uploadAndArchiveDocument: (
    source: string | File,
    options: DocumentUploadOptions
  ) => Promise<ElectronicArchiveItem>;
  deleteArchiveItem: (id: string) => void;
  generateSecureDownloadToken: (id: string) => string;
  syncArchiveItemToDrive: (id: string) => Promise<{ success: boolean; driveLink?: string; error?: string }>;

  // Notifications & Operational Communications
  operationalCommunications: OperationalCommunicationRecord[];
  addOperationalCommunication: (data: Omit<OperationalCommunicationRecord, "id" | "createdAt"> & { id?: string; createdAt?: string }) => Promise<{ success: boolean; id?: string }>;
  dispatchWhatsAppReminder: (chequeId: string) => Promise<{ success: boolean; message: string }>;
  dispatchEmailReminder: (chequeId: string) => Promise<{ success: boolean; message: string }>;

  // Risk
  updateRiskConfig: (newWeights: Partial<RiskConfigWeights>) => void;
  updateRiskWeights?: (newWeights: Partial<RiskConfigWeights>) => void;
  recalculateTenantRisk: (tenantId: string) => void;

  // Import & Batch Deduplication
  importBatchData: (type: "OWNERS" | "TENANTS" | "PROPERTIES" | "CHEQUES" | "LEASES", records: any[]) => { total: number; successCount: number; errors: string[] };
  importOwnersBatch: (records: Array<{
    code?: string;
    nameEn: string;
    nameAr: string;
    emiratesId?: string;
    email?: string;
    phone?: string;
    bankName?: string;
    iban?: string;
    accountNumber?: string;
    status?: "ACTIVE" | "INACTIVE";
    notes?: string;
  }>) => Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }>;
  importTenantsBatch: (records: Array<{
    code?: string;
    nameEn: string;
    nameAr: string;
    type?: "INDIVIDUAL" | "CORPORATE";
    email?: string;
    phone?: string;
    emiratesId?: string;
    passportNumber?: string;
    tradeLicenseNo?: string;
    nationality?: string;
    status?: "ACTIVE" | "INACTIVE" | "BLACKLISTED";
  }>) => Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }>;

  // Maintenance Management
  addMaintenanceRequest: (
    data: Omit<MaintenanceRequest, "id" | "requestNumber" | "createdAt" | "updatedAt" | "timeline" | "invoices" | "attachments" | "notes"> & {
      notes?: string[] | string;
      invoices?: MaintenanceInvoice[];
      attachments?: MaintenanceAttachment[];
    }
  ) => MaintenanceRequest;
  updateMaintenanceRequest: (id: string, patch: Partial<MaintenanceRequest>) => void;
  deleteMaintenanceRequest: (id: string, options?: DeleteRecordOptions) => void;
  updateMaintenanceStatus: (id: string, newStatus: MaintenanceStatus, notes?: string, completionDate?: string) => void;
  postMaintenanceExpense: (
    requestId: string,
    options?: { overrideUser?: { id: string; name: string }; forceRepost?: boolean }
  ) => {
    success: boolean;
    status: MaintenanceFinancialStatus;
    postedExpenses?: PropertyExpenseRecord[];
    error?: string;
    alreadyPosted?: boolean;
  };
  assignTechnicianToRequest: (requestId: string, technicianId: string, notes?: string) => void;
  addMaintenanceInvoice: (requestId: string, invoice: Omit<MaintenanceInvoice, "id" | "createdAt" | "maintenanceRequestId">) => void;
  addMaintenancePayment: (requestId: string, payment: Omit<MaintenancePayment, "id" | "createdAt" | "receivedByUserId" | "receivedByUserName">) => void;
  updateMaintenanceInvoice: (requestId: string, invoiceId: string, patch: Partial<MaintenanceInvoice>) => void;
  deleteMaintenanceInvoice: (requestId: string, invoiceId: string) => void;
  addMaintenanceAttachment: (requestId: string, attachment: Omit<MaintenanceAttachment, "id" | "uploadedAt" | "uploadedBy" | "maintenanceRequestId">) => Promise<{ success: boolean; attachment?: MaintenanceAttachment; driveLink?: string; error?: string }>;
  deleteMaintenanceAttachment: (requestId: string, attachmentId: string) => void;
  addMaintenanceNote: (requestId: string, noteText: string) => void;
  addTechnician: (data: Omit<Technician, "id" | "createdAt">) => Technician;
  updateTechnician: (id: string, patch: Partial<Technician>) => void;
  deleteTechnician: (id: string) => void;
  updateMaintenanceSettings: (settings: Partial<MaintenanceSettings>) => void;
  legalSettings: LegalSettings;
  updateLegalSettings: (settings: Partial<LegalSettings>) => void;

  // Notifications
  addNotification: (notification: Omit<NotificationRecord, "id" | "createdAt">) => NotificationRecord;
  logAudit: (
    action: AuditLogEntry["action"],
    entityType: AuditLogEntry["entityType"],
    entityId: string,
    entityName: string,
    details: string,
    oldValue?: string,
    newValue?: string
  ) => void;

  // Admin DB Actions
  clearTable: (tableName: string) => void;
  resetDatabase: () => Promise<void> | void;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (jsonStr: string) => boolean;

  // Office Petty Cash Module
  officePettyCashMonths: OfficePettyCashMonth[];
  officePettyCashExpenses: OfficePettyCashExpense[];
  officePettyCashCategories: OfficePettyCashCategory[];
  addOfficePettyCashMonth: (data: Omit<OfficePettyCashMonth, "id" | "totalExpenses" | "closingBalance" | "status" | "createdAt" | "createdBy">) => { success: boolean; month?: OfficePettyCashMonth; error?: string };
  updateOfficePettyCashMonth: (id: string, patch: Partial<OfficePettyCashMonth>, modificationReason?: string) => { success: boolean; error?: string };
  closeOfficePettyCashMonth: (
    id: string,
    carryForwardOption: PettyCashCarryForwardOption,
    notes?: string,
    actualCashCounted?: number,
    reconciliationDifference?: number,
    reconciliationStatus?: string
  ) => { success: boolean; error?: string };
  reopenOfficePettyCashMonth: (id: string, reason?: string) => { success: boolean; error?: string };
  addOfficePettyCashExpense: (data: Omit<OfficePettyCashExpense, "id" | "expenseNumber" | "createdAt" | "createdBy">) => { success: boolean; expense?: OfficePettyCashExpense; error?: string };
  updateOfficePettyCashExpense: (id: string, patch: Partial<OfficePettyCashExpense>, modificationReason?: string) => { success: boolean; error?: string };
  deleteOfficePettyCashExpense: (id: string, modificationReason?: string) => { success: boolean; error?: string };
  addOfficePettyCashCategory: (data: Omit<OfficePettyCashCategory, "id" | "active" | "createdAt">) => { success: boolean; category?: OfficePettyCashCategory; error?: string };
  updateOfficePettyCashCategory: (id: string, patch: Partial<OfficePettyCashCategory>) => { success: boolean; error?: string };

  // Saqr Office Account Module
  saqrOfficeConfig: SaqrOfficeConfig;
  saqrOfficeManualTransactions: SaqrOfficeManualTransaction[];
  updateSaqrOfficeConfig: (patch: Partial<SaqrOfficeConfig>) => void;
  addOfficeSaqrTransaction: (tx: SaqrOfficeManualTransaction) => void;
  deleteOfficeSaqrTransaction: (id: string) => void;


  // Sequence Number Generators
  getNextOwnerCode: () => string;
  getNextTenantCode: () => string;
  getNextPropertyCode: () => string;
  getNextLeaseNumber: () => string;
  getNextReceiptNumber: () => string;
  getNextCaseNumber: () => string;
  getNextExpenseNumber: () => string;
  getNextTransferNumber: () => string;
  getNextDepositBatchNumber: () => string;
  getNextMaintenanceRequestNumber: () => string;
  getNextMaintenanceInvoiceNumber: () => string;
  getNextReversalNumber: () => string;
  getNextRenewalNumber: () => string;
  getNextDeferredNumber: () => string;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  nameAr: "صقر الامارات للعقارات",
  nameEn: "Emirates Falcon Real Estate",
  vatTrn: "100293847500003",
  tradeLicenseNumber: "88412",
  tradeLicenseNo: "88412",
  commercialRegisterNumber: "928374-B",
  commercialRegisterNo: "928374-B",
  licenseExpiryDate: "2028-12-31",
  address: "الشارقة، خورفكان، شارع الكورنيش",
  addressAr: "الشارقة، خورفكان، شارع الكورنيش",
  addressEn: "Corniche Street, Khorfakkan, Sharjah, UAE",
  email: "info@emiratesfalcon.ae",
  phone: "+971 4 123 4567",
  website: "www.emiratesfalcon.ae",
  logoUrl: "https://lh3.googleusercontent.com/d/1kBQRAzMLvisn4bjDnaehnAEQLiRyVjgp",
  logoBase64: "https://lh3.googleusercontent.com/d/1kBQRAzMLvisn4bjDnaehnAEQLiRyVjgp",
  logo: "https://lh3.googleusercontent.com/d/1kBQRAzMLvisn4bjDnaehnAEQLiRyVjgp",
};

function safeLoadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === "undefined" || saved === "null") return fallback;
    return JSON.parse(saved);
  } catch (err) {
    console.warn(`[DataContext] Failed to parse ${key} from storage, resetting to default.`, err);
    return fallback;
  }
}

function stripLargeBase64ForStorage(obj: any, depth = 0): any {
  if (depth > 12 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // Strip large base64 data strings from localStorage to prevent quota overflow
    if (obj.startsWith("data:") && obj.length > 500) {
      return "[ATTACHMENT_SAVED_IN_CLOUD]";
    }
    if (obj.length > 20000) {
      return obj.substring(0, 1000) + "... [Truncated for local cache]";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripLargeBase64ForStorage(item, depth + 1));
  }
  if (typeof obj === "object") {
    const res: any = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        res[k] = stripLargeBase64ForStorage(obj[k], depth + 1);
      }
    }
    return res;
  }
  return obj;
}

function safeSaveToStorage(key: string, data: any): void {
  try {
    const sanitized = stripLargeBase64ForStorage(data);
    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (err: any) {
    console.warn(`[DataContext] localStorage quota exceeded while saving ${key}. Performing safe cache compaction.`, err);
    try {
      // Clear non-critical or legacy caches from localStorage to free up browser quota
      const nonCriticalKeys = [
        "ef_archive_v12",
        "ef_audit_logs_v12",
        "ef_historical_records_v12",
        "ef_notifications_v12",
        "ef_property_expenses_v12",
        "ef_collections_v12",
      ];
      // Also purge any outdated version keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("ef_") || k.startsWith("form_layout_")) && !k.endsWith("_v12") && k !== key) {
          localStorage.removeItem(k);
        }
      }
      // If the failing key is not one of the non-critical ones, clear non-critical items
      if (!nonCriticalKeys.includes(key)) {
        nonCriticalKeys.forEach((k) => localStorage.removeItem(k));
      }
      // Retry writing stripped version
      const sanitized = stripLargeBase64ForStorage(data);
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (fallbackErr) {
      // Catch silently to guarantee the application never crashes on quota errors
      console.warn(`[DataContext] Could not save ${key} to localStorage; continuing with in-memory state.`, fallbackErr);
    }
  }
}

const INITIAL_PETTY_CASH_CATEGORIES: OfficePettyCashCategory[] = [
  { id: "cat-groceries", nameArabic: "البقالة ومستلزمات المكتب", nameEnglish: "Groceries & Office Supplies", active: true, createdAt: new Date().toISOString() },
  { id: "cat-electricity", nameArabic: "الكهرباء", nameEnglish: "Electricity", active: true, createdAt: new Date().toISOString() },
  { id: "cat-water", nameArabic: "المياه", nameEnglish: "Water", active: true, createdAt: new Date().toISOString() },
  { id: "cat-telephone", nameArabic: "الهاتف", nameEnglish: "Telephone", active: true, createdAt: new Date().toISOString() },
  { id: "cat-internet", nameArabic: "الإنترنت", nameEnglish: "Internet", active: true, createdAt: new Date().toISOString() },
  { id: "cat-utilities", nameArabic: "الخدمات والمرافق العامة", nameEnglish: "Utilities", active: true, createdAt: new Date().toISOString() },
  { id: "cat-hospitality", nameArabic: "الضيافة والترحيب", nameEnglish: "Hospitality", active: true, createdAt: new Date().toISOString() },
  { id: "cat-cleaning", nameArabic: "النظافة ومستلزمات النظافة", nameEnglish: "Cleaning", active: true, createdAt: new Date().toISOString() },
  { id: "cat-stationery", nameArabic: "القرطاسية والمكتبية", nameEnglish: "Stationery", active: true, createdAt: new Date().toISOString() },
  { id: "cat-printing", nameArabic: "الطباعة والتصوير", nameEnglish: "Printing & Photocopying", active: true, createdAt: new Date().toISOString() },
  { id: "cat-transportation", nameArabic: "النقل والمواصلات", nameEnglish: "Transportation", active: true, createdAt: new Date().toISOString() },
  { id: "cat-minor-maint", nameArabic: "صيانة بسيطة وطارئة", nameEnglish: "Minor Maintenance", active: true, createdAt: new Date().toISOString() },
  { id: "cat-govt-fees", nameArabic: "الرسوم الحكومية والمعاملات", nameEnglish: "Government Fees", active: true, createdAt: new Date().toISOString() },
  { id: "cat-other", nameArabic: "مصاريف أخرى", nameEnglish: "Other", active: true, createdAt: new Date().toISOString() },
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dailyDeposits, setDailyDeposits] = useState<DailyDepositRecord[]>([]);
  const [depositBatches, setDepositBatches] = useState<DepositBatchRecord[]>([]);
  const createDepositBatch = (batch: DepositBatchRecord) => {
    setDepositBatches(prev => [batch, ...prev]);
    safeSetDoc(doc(db, "deposit_batches", batch.id), batch);
    logAudit("FINANCIAL_RECORD_ADD", "DEPOSIT_BATCH", batch.id, `حافظة إيداع #${batch.id}`, "تم إنشاء حافظة إيداع جديدة");
  };

  const updateDepositBatch = (id: string, patch: Partial<DepositBatchRecord>) => {
    setDepositBatches(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    safeSetDoc(doc(db, "deposit_batches", id), patch, { merge: true });
    logAudit("FINANCIAL_RECORD_EDIT", "DEPOSIT_BATCH", id, `حافظة إيداع #${id}`, "تم تحديث حالة حافظة الإيداع");
  };

  const { currentUser, hasPermission } = useAuth();
  const { t } = useLanguage();
  const { language } = useLanguage();

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    // Artificial brief loading state to prevent UI flashes during initial load
    const timer = setTimeout(() => setIsDataLoaded(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const [owners, setOwners] = useState<Owner[]>(() => {
    return safeLoadFromStorage("ef_owners_v12", INITIAL_OWNERS);
  });

  const [properties, setProperties] = useState<Property[]>(() => {
    return safeLoadFromStorage("ef_properties_v12", INITIAL_PROPERTIES);
  });

  const [units, setUnits] = useState<Unit[]>(() => {
    return safeLoadFromStorage("ef_units_v12", INITIAL_UNITS);
  });

  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const raw: Tenant[] = safeLoadFromStorage("ef_tenants_v12", INITIAL_TENANTS);
    return raw.map((t) => ({
      ...t,
      riskFactors: t.riskFactors || [],
      bouncedChequesCount: t.bouncedChequesCount || 0,
      totalBouncedAmount: t.totalBouncedAmount || 0,
      activeCasesCount: t.activeCasesCount || 0,
    }));
  });

  const [leases, setLeases] = useState<Lease[]>(() => {
    return safeLoadFromStorage("ef_leases_v12", INITIAL_LEASES);
  });

  const [cheques, setCheques] = useState<Cheque[]>(() => {
    const raw: Cheque[] = safeLoadFromStorage("ef_cheques_v12", INITIAL_CHEQUES);
    return raw.map((c) => {
      const amount = typeof c.amount === "number" ? c.amount : Number(c.amount) || 0;
      const totalApplied = typeof c.totalApplied === "number" ? c.totalApplied : Number(c.totalApplied) || 0;
      const outstanding = typeof c.outstanding === "number" && !isNaN(c.outstanding) ? c.outstanding : Math.max(0, amount - totalApplied);
      const originalStatus = c.originalStatus || (c.status === "BOUNCED" ? "BOUNCED" : "NORMAL");
      return {
        ...c,
        amount,
        totalApplied,
        outstanding,
        originalStatus,
      };
    });
  });

  const [collections, setCollections] = useState<CollectionRecord[]>(() => {
    return safeLoadFromStorage("ef_collections_v12", []);
  });

  const [cases, setCases] = useState<RentalCase[]>(() => {
    const raw: RentalCase[] = safeLoadFromStorage("ef_cases_v12", []);
    return raw.map((c) => {
      const sess = c.sessions || c.hearings || [];
      return {
        ...c,
        paidAmount: c.paidAmount ?? c.totalPaid ?? 0,
        outstandingAmount: c.outstandingAmount ?? c.outstanding ?? 0,
        sessions: sess,
        hearings: sess,
        linkedChequeIds: c.linkedChequeIds || [],
        documents: c.documents || [],
        caseDocuments: c.caseDocuments || [],
      };
    });
  });

  const [archive, setArchive] = useState<ElectronicArchiveItem[]>(() => {
    return safeLoadFromStorage("ef_archive_v12", []);
  });

  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => {
    return safeLoadFromStorage("ef_notifications_v12", []);
  });

  const [riskConfig, setRiskConfig] = useState<RiskConfigWeights>(() => {
    return safeLoadFromStorage("ef_risk_config_v12", INITIAL_RISK_CONFIG);
  });

  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([
    {
      id: "CHEQUE_COLLECTED",
      nameAr: "شيك محصل",
      nameEn: "Cheque Collected",
      type: "FINANCIAL",
      bodyAr: "عزيزي {tenantName}، تم بنجاح تحصيل الشيك رقم {chequeNumber} بمبلغ {chequeAmount} درهم. شكراً لك.",
      bodyEn: "Dear {tenantName}, your cheque {chequeNumber} for AED {chequeAmount} has been successfully collected. Thank you.",
      variables: ["{tenantName}", "{chequeNumber}", "{chequeAmount}"]
    },
    {
      id: "CHEQUE_BOUNCED",
      nameAr: "شيك مرتجع",
      nameEn: "Cheque Bounced",
      type: "FINANCIAL",
      bodyAr: "عزيزي {tenantName}، نأسف لإبلاغكم بارتجاع الشيك رقم {chequeNumber} بمبلغ {chequeAmount} درهم. يرجى المبادرة بالتسوية.",
      bodyEn: "Dear {tenantName}, we regret to inform you that cheque {chequeNumber} for AED {chequeAmount} has bounced. Please arrange settlement.",
      variables: ["{tenantName}", "{chequeNumber}", "{chequeAmount}"]
    },
    {
      id: "LEASE_RENEWED",
      nameAr: "تجديد عقد الإيجار",
      nameEn: "Lease Renewed",
      type: "LEASE",
      bodyAr: "عزيزي {tenantName}، تم بنجاح تجديد عقد الإيجار رقم {leaseNumber}. تم إرفاق إيصال الدفع. شكراً لثقتكم.",
      bodyEn: "Dear {tenantName}, your lease {leaseNumber} has been successfully renewed. Payment receipt is attached.",
      variables: ["{tenantName}", "{leaseNumber}"]
    },
    {
      id: "NEW_LEASE",
      nameAr: "عقد إيجار جديد",
      nameEn: "New Lease",
      type: "LEASE",
      bodyAr: "عزيزي {tenantName}، نرحب بك. تم تسجيل عقد الإيجار الجديد رقم {leaseNumber}. مرفق الإيصال.",
      bodyEn: "Dear {tenantName}, welcome. Your new lease {leaseNumber} is registered. Receipt attached.",
      variables: ["{tenantName}", "{leaseNumber}"]
    },
    {
      id: "APPROACHING_DUE",
      nameAr: "تذكير بقرب موعد استحقاق الشيك",
      nameEn: "Cheque Due Reminder",
      type: "FINANCIAL",
      bodyAr: "عزيزي {tenantName}، تذكير بموعد استحقاق الشيك رقم {chequeNumber} بمبلغ {chequeAmount} درهم وتاريخ استحقاقه {dueDate}.",
      bodyEn: "Dear {tenantName}, reminder for cheque {chequeNumber} for AED {chequeAmount} due on {dueDate}.",
      variables: ["{tenantName}", "{chequeNumber}", "{chequeAmount}", "{dueDate}"]
    }
  ]);

  const updateMessageTemplate = (id: string, patch: Partial<MessageTemplate>) => {
    setMessageTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    // Save to firestore logic can be added here
  };

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    return safeLoadFromStorage("ef_audit_logs_v12", []);
  });

  const [historicalRecords, setHistoricalRecords] = useState<HistoricalRecord[]>(() => {
    return safeLoadFromStorage("ef_historical_records_v12", []);
  });

  const [financialPeriods, setFinancialPeriods] = useState<FinancialPeriod[]>(() => {
    const loaded = safeLoadFromStorage<FinancialPeriod[]>("ef_financial_periods_v1", []);
    return loaded && loaded.length > 0 ? loaded : INITIAL_FINANCIAL_PERIODS;
  });

  const [periodCertifications, setPeriodCertifications] = useState<ForensicClosingCertification[]>(() => {
    return safeLoadFromStorage("ef_period_certifications_v1", []);
  });

  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(() => {
    return safeLoadFromStorage("ef_maintenance_requests_v12", []);
  });

  const [technicians, setTechnicians] = useState<Technician[]>(() => {
    return safeLoadFromStorage("ef_technicians_v12", []);
  });

  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSettings>(() => {
    return safeLoadFromStorage("ef_maintenance_settings_v12", INITIAL_MAINTENANCE_SETTINGS);
  });
  
  const [legalSettings, setLegalSettings] = useState<LegalSettings>(() => {
    return safeLoadFromStorage("ef_legal_settings_v12", INITIAL_LEGAL_SETTINGS);
  });

  const [commissions, setCommissions] = useState<CommissionObligation[]>(() => {
    return safeLoadFromStorage("ef_commissions_v12", []);
  });

  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>(() => {
    return safeLoadFromStorage("ef_payment_allocations_v12", []);
  });

  const [financialReversals, setFinancialReversals] = useState<FinancialReversalRecord[]>(() => {
    return safeLoadFromStorage("ef_financial_reversals_v12", []);
  });

  const checkCaseControlledCheque = (chequeId: string): { isControlled: boolean; caseId?: string; caseNumber?: string } => {
    const chq = cheques.find(c => c.id === chequeId);
    if (!chq || !chq.convertedToCaseId) {
      return { isControlled: false };
    }
    const linkedCase = cases.find(c => c.id === chq.convertedToCaseId);
    if (!linkedCase) {
      return { isControlled: false };
    }
    const isControlled = linkedCase.status !== "CLOSED" && linkedCase.status !== "ARCHIVED";
    if (isControlled) {
      return { isControlled: true, caseId: linkedCase.id, caseNumber: linkedCase.caseNumber };
    }
    return { isControlled: false };
  };

  const [financialAdjustments, setFinancialAdjustments] = useState<FinancialAdjustmentRecord[]>(() => {
    return safeLoadFromStorage("ef_financial_adjustments_v12", []);
  });

  const [chartOfAccounts, setChartOfAccounts] = useState<AccountDefinition[]>(() => {
    return safeLoadFromStorage("ef_chart_of_accounts_v12", INITIAL_CHART_OF_ACCOUNTS);
  });

  const [journalEntries, setJournalEntries] = useState<JournalEntryRecord[]>(() => {
    return safeLoadFromStorage("ef_journal_entries_v12", []);
  });

  const [ownerTransfers, setOwnerTransfers] = useState<OwnerTransferRecord[]>(() => {
    return safeLoadFromStorage("ef_owner_transfers_v12", []);
  });

  const [propertyExpenses, setPropertyExpenses] = useState<PropertyExpenseRecord[]>(() => {
    return safeLoadFromStorage("ef_property_expenses_v12", []);
  });

  const [collectionActions, setCollectionActions] = useState<CollectionAction[]>(() => {
    return safeLoadFromStorage("ef_collection_actions_v12", []);
  });

  const [paymentPromises, setPaymentPromises] = useState<PaymentPromise[]>(() => {
    return safeLoadFromStorage("ef_payment_promises_v12", []);
  });

  const [leaseRenewals, setLeaseRenewals] = useState<LeaseRenewalRecord[]>(() => {
    return safeLoadFromStorage("ef_lease_renewals_v12", []);
  });

  const [deferredPayments, setDeferredPayments] = useState<DeferredPaymentRecord[]>(() => {
    return safeLoadFromStorage("ef_deferred_payments_v12", []);
  });

  const [officePettyCashMonths, setOfficePettyCashMonths] = useState<OfficePettyCashMonth[]>(() => {
    return safeLoadFromStorage("ef_office_petty_cash_months_v12", []);
  });

  const [officePettyCashExpenses, setOfficePettyCashExpenses] = useState<OfficePettyCashExpense[]>(() => {
    return safeLoadFromStorage("ef_office_petty_cash_expenses_v12", []);
  });

  const [officePettyCashCategories, setOfficePettyCashCategories] = useState<OfficePettyCashCategory[]>(() => {
    return safeLoadFromStorage("ef_office_petty_cash_categories_v12", INITIAL_PETTY_CASH_CATEGORIES);
  });

  const [saqrOfficeConfig, setSaqrOfficeConfig] = useState<SaqrOfficeConfig>(() => {
    return safeLoadFromStorage("ef_saqr_office_config_v1", {
      officeNameAr: "مكتب صقر الامارات للعقارات",
      officeNameEn: "Saqr Al Emirates Real Estate Office",
      bankName: "بنك أبوظبي التجاري (ADCB)",
      accountNumber: "10987654321001",
      iban: "AE330330000010987654321",
      currency: "AED",
    });
  });

  const [saqrOfficeManualTransactions, setSaqrOfficeManualTransactions] = useState<SaqrOfficeManualTransaction[]>(() => {
    return safeLoadFromStorage("ef_saqr_office_manual_tx_v1", []);
  });

  const [vatRates, setVatRates] = useState<VatRateRecord[]>(() => {
    const raw = safeLoadFromStorage("ef_vat_rates_v12", []);
    if (raw.length === 0) {
      return [{
        id: "vat-initial",
        rate: 5.0,
        effectiveFrom: "2026-01-01",
        category: "ADMIN_FEE",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        createdById: "system",
        createdByName: "System",
      }];
    }
    return raw;
  });


  const [operationalCommunications, setOperationalCommunications] = useState<OperationalCommunicationRecord[]>(() => {
    return safeLoadFromStorage("ef_operational_communications_v12", []);
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    const parsed = safeLoadFromStorage<CompanyProfile>("ef_company_profile_v12", DEFAULT_COMPANY_PROFILE);
    if (!parsed.addressAr || parsed.addressAr === "دبي، الإمارات العربية المتحدة") {
      parsed.addressAr = DEFAULT_COMPANY_PROFILE.addressAr;
      parsed.address = DEFAULT_COMPANY_PROFILE.address;
      parsed.addressEn = DEFAULT_COMPANY_PROFILE.addressEn;
    }
    return { ...DEFAULT_COMPANY_PROFILE, ...parsed };
  });

  // Sync to localStorage safely
  useEffect(() => { safeSaveToStorage("ef_owners_v12", owners); }, [owners]);
  useEffect(() => { safeSaveToStorage("ef_properties_v12", properties); }, [properties]);
  useEffect(() => { safeSaveToStorage("ef_units_v12", units); }, [units]);
  useEffect(() => { safeSaveToStorage("ef_tenants_v12", tenants); }, [tenants]);
  useEffect(() => { safeSaveToStorage("ef_leases_v12", leases); }, [leases]);
  useEffect(() => { safeSaveToStorage("ef_cheques_v12", cheques); }, [cheques]);
  useEffect(() => { safeSaveToStorage("ef_collections_v12", collections); }, [collections]);
  useEffect(() => { safeSaveToStorage("ef_cases_v12", cases); }, [cases]);
  useEffect(() => { safeSaveToStorage("ef_maintenance_requests_v12", maintenanceRequests); }, [maintenanceRequests]);
  useEffect(() => { safeSaveToStorage("ef_technicians_v12", technicians); }, [technicians]);
  useEffect(() => { safeSaveToStorage("ef_maintenance_settings_v12", maintenanceSettings); }, [maintenanceSettings]);
  useEffect(() => { safeSaveToStorage("ef_legal_settings_v12", legalSettings); }, [legalSettings]);
  useEffect(() => { safeSaveToStorage("ef_commissions_v12", commissions); }, [commissions]);
  useEffect(() => { safeSaveToStorage("ef_payment_allocations_v12", paymentAllocations); }, [paymentAllocations]);
  useEffect(() => { safeSaveToStorage("ef_financial_reversals_v12", financialReversals); }, [financialReversals]);
  useEffect(() => { safeSaveToStorage("ef_financial_adjustments_v12", financialAdjustments); }, [financialAdjustments]);
  useEffect(() => { safeSaveToStorage("ef_chart_of_accounts_v12", chartOfAccounts); }, [chartOfAccounts]);
  useEffect(() => { safeSaveToStorage("ef_journal_entries_v12", journalEntries); }, [journalEntries]);
  useEffect(() => { safeSaveToStorage("ef_owner_transfers_v12", ownerTransfers); }, [ownerTransfers]);
  useEffect(() => { safeSaveToStorage("ef_property_expenses_v12", propertyExpenses); }, [propertyExpenses]);
  useEffect(() => { safeSaveToStorage("ef_collection_actions_v12", collectionActions); }, [collectionActions]);
  useEffect(() => { safeSaveToStorage("ef_payment_promises_v12", paymentPromises); }, [paymentPromises]);
  useEffect(() => { safeSaveToStorage("ef_lease_renewals_v12", leaseRenewals); }, [leaseRenewals]);
  useEffect(() => { safeSaveToStorage("ef_deferred_payments_v12", deferredPayments); }, [deferredPayments]);
  useEffect(() => { safeSaveToStorage("ef_office_petty_cash_months_v12", officePettyCashMonths); }, [officePettyCashMonths]);
  useEffect(() => { safeSaveToStorage("ef_office_petty_cash_expenses_v12", officePettyCashExpenses); }, [officePettyCashExpenses]);
  useEffect(() => { safeSaveToStorage("ef_office_petty_cash_categories_v12", officePettyCashCategories); }, [officePettyCashCategories]);
  useEffect(() => { safeSaveToStorage("ef_saqr_office_config_v1", saqrOfficeConfig); }, [saqrOfficeConfig]);
  useEffect(() => { safeSaveToStorage("ef_saqr_office_manual_tx_v1", saqrOfficeManualTransactions); }, [saqrOfficeManualTransactions]);
  useEffect(() => { safeSaveToStorage("ef_vat_rates_v12", vatRates); }, [vatRates]);
  useEffect(() => { safeSaveToStorage("ef_financial_periods_v1", financialPeriods); }, [financialPeriods]);
  useEffect(() => { safeSaveToStorage("ef_period_certifications_v1", periodCertifications); }, [periodCertifications]);

  useEffect(() => { safeSaveToStorage("ef_archive_v12", archive); }, [archive]);
  useEffect(() => { safeSaveToStorage("ef_notifications_v12", notifications); }, [notifications]);
  useEffect(() => { safeSaveToStorage("ef_operational_communications_v12", operationalCommunications); }, [operationalCommunications]);
  useEffect(() => { safeSaveToStorage("ef_risk_config_v12", riskConfig); }, [riskConfig]);
  useEffect(() => { safeSaveToStorage("ef_audit_logs_v12", auditLogs); }, [auditLogs]);
  useEffect(() => { safeSaveToStorage("ef_historical_records_v12", historicalRecords); }, [historicalRecords]);
  useEffect(() => { if (companyProfile) safeSaveToStorage("ef_company_profile_v12", companyProfile); }, [companyProfile]);

  // Safe Firestore document setter that automatically sanitizes undefined fields
  const safeSetDoc = async (documentRef: any, data: any, options?: { merge?: boolean }) => {
    try {
      let cleanData = sanitizeForFirestore(data);
      const path = documentRef?.path || "";

      // Recursively strip or truncate large base64 data URLs to prevent exceeding Firestore 1MB document size limit
      const stripOrTruncateLargeFields = (obj: any, currentDepth = 0): any => {
        if (currentDepth > 15) return obj; // Prevent infinite recursion loops
        if (obj === null || obj === undefined) return obj;

        if (typeof obj === "string") {
          // Check for large base64 data URLs (typically starts with "data:")
          if (obj.startsWith("data:") && obj.length > 50000) {
            // In historicalRecords snapshots, we strip base64 completely to preserve database health and prevent duplicates
            if (path.includes("historicalRecords")) {
              return "[مستند مؤرشف ومحفوظ في الأرشيف الرئيسي لتوفير المساحة | Document archived in main archive for space saving]";
            }
            // For other collections, if a base64 string is extremely large (exceeding ~1MB string size), truncate it to avoid hard crashes
            if (obj.length > 1000000) {
              return obj.substring(0, 50000) + "... [تم تقليص الملف لتجاوز الحد الأقصى لحجم المستند في قاعدة البيانات | Truncated to avoid exceeding Firestore 1MB limit]";
            }
          }
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.map((item) => stripOrTruncateLargeFields(item, currentDepth + 1));
        }

        if (typeof obj === "object") {
          // Preserve special Firestore constructor classes like FieldValue
          if (obj.constructor && obj.constructor.name && obj.constructor.name.includes("FieldValue")) {
            return obj;
          }
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = stripOrTruncateLargeFields(value, currentDepth + 1);
          }
          return cleaned;
        }

        return obj;
      };

      cleanData = stripOrTruncateLargeFields(cleanData);

      if (options) {
        await setDoc(documentRef, cleanData, options);
      } else {
        await setDoc(documentRef, cleanData);
      }
    } catch (err) {
      console.error("Firestore safeSetDoc error:", err);
    }
  };

  const safeDeleteDoc = async (documentRef: any) => {
    try {
      await deleteDoc(documentRef);
    } catch (error: any) {
      console.error("Firestore deleteDoc error:", error);
    }
  };

  // Real-time Firestore Sync across devices and users
  useEffect(() => {
    const checkQuotaError = (err: any) => {
      const errMsg = err?.message || String(err);
      if (
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("exhausted") ||
        errMsg.toLowerCase().includes("limit") ||
        errMsg.toLowerCase().includes("billing")
      ) {
        setIsQuotaExceeded(true);
      }
    };

    const createErrorHandler = (colName: string, fallback: any, setter: any) => {
      return (err: any) => {
        handleFirestoreError(err, OperationType.GET, colName);
        checkQuotaError(err);
        setter((prev: any) => (prev && prev.length > 0 ? prev : (fallback || [])));
      };
    };

    const handleChequeError = (err: any) => {
      handleFirestoreError(err, OperationType.GET, "cheques");
      checkQuotaError(err);
      setCheques((prev) => (prev && prev.length > 0 ? prev : []));
    };

    const handleCaseError = (err: any) => {
      handleFirestoreError(err, OperationType.GET, "cases");
      checkQuotaError(err);
      setCases((prev) => (prev && prev.length > 0 ? prev : []));
    };

    const seedCollectionIfEmpty = async (colName: string, initialData: any[]) => {
      try {
        for (const item of initialData) {
          const cleanItem = sanitizeForFirestore(item);
          await setDoc(doc(db, colName, item.id || `item-${Date.now()}`), cleanItem, { merge: true });
        }
      } catch (e) {
        console.error(`Error seeding ${colName}:`, e);
      }
    };

    const unsubOwners = onSnapshot(collection(db, "owners"), (snap) => {
      if (snap.empty) {
        setOwners([]);
      } else {
        const items: Owner[] = [];
        snap.forEach(d => items.push(d.data() as Owner));
        setOwners(items);
      }
    }, createErrorHandler("owners", [], setOwners));

    const unsubProps = onSnapshot(collection(db, "properties"), (snap) => {
      if (snap.empty) {
        setProperties([]);
      } else {
        const items: Property[] = [];
        snap.forEach(d => items.push(d.data() as Property));
        setProperties(items);
      }
    }, createErrorHandler("properties", [], setProperties));

    const unsubUnits = onSnapshot(collection(db, "units"), (snap) => {
      if (snap.empty) {
        setUnits([]);
      } else {
        const items: Unit[] = [];
        snap.forEach(d => items.push(d.data() as Unit));
        setUnits(items);
      }
    }, createErrorHandler("units", [], setUnits));

    const unsubTenants = onSnapshot(collection(db, "tenants"), (snap) => {
      if (snap.empty) {
        setTenants([]);
      } else {
        const items: Tenant[] = [];
        snap.forEach(d => items.push(d.data() as Tenant));
        setTenants(items);
      }
    }, createErrorHandler("tenants", [], setTenants));

    const unsubLeases = onSnapshot(collection(db, "leases"), (snap) => {
      if (snap.empty) {
        setLeases([]);
      } else {
        const items: Lease[] = [];
        snap.forEach(d => items.push(d.data() as Lease));
        setLeases(items);
      }
    }, createErrorHandler("leases", [], setLeases));

    const unsubCheques = onSnapshot(collection(db, "cheques"), (snap) => {
      if (snap.empty) {
        setCheques([]);
      } else {
        const items: Cheque[] = [];
        snap.forEach(d => {
          const c = d.data() as Cheque;
          const amount = typeof c.amount === "number" ? c.amount : Number(c.amount) || 0;
          const totalApplied = typeof c.totalApplied === "number" ? c.totalApplied : Number(c.totalApplied) || 0;
          const outstanding = typeof c.outstanding === "number" && !isNaN(c.outstanding) ? c.outstanding : Math.max(0, amount - totalApplied);
          const originalStatus = c.originalStatus || (c.status === "BOUNCED" ? "BOUNCED" : "NORMAL");
          items.push({
            ...c,
            amount,
            totalApplied,
            outstanding,
            originalStatus,
          });
        });
        setCheques(items);
      }
    }, handleChequeError);

    const unsubCollections = onSnapshot(collection(db, "collections"), (snap) => {
      if (snap.empty) {
        setCollections([]);
      } else {
        const items: CollectionRecord[] = [];
        snap.forEach(d => items.push(d.data() as CollectionRecord));
        setCollections(items);
      }
    }, createErrorHandler("collections", [], setCollections));

    const unsubCases = onSnapshot(collection(db, "cases"), (snap) => {
      if (snap.empty) {
        setCases([]);
      } else {
        const items: RentalCase[] = [];
        snap.forEach(d => items.push(d.data() as RentalCase));
        setCases(items.map((c) => {
          const sess = c.sessions || c.hearings || [];
          return {
            ...c,
            paidAmount: c.paidAmount ?? c.totalPaid ?? 0,
            outstandingAmount: c.outstandingAmount ?? c.outstanding ?? 0,
            sessions: sess,
            hearings: sess,
            linkedChequeIds: c.linkedChequeIds || [],
            documents: c.documents || [],
            caseDocuments: c.caseDocuments || [],
          };
        }));
      }
    }, handleCaseError);

    const unsubArchive = onSnapshot(collection(db, "archive"), (snap) => {
      if (snap.empty) {
        setArchive([]);
      } else {
        const items: ElectronicArchiveItem[] = [];
        snap.forEach(d => items.push(d.data() as ElectronicArchiveItem));
        setArchive(items);
      }
    }, createErrorHandler("archive", [], setArchive));

    const unsubNotifications = onSnapshot(collection(db, "notifications"), (snap) => {
      if (snap.empty) {
        setNotifications([]);
      } else {
        const items: NotificationRecord[] = [];
        snap.forEach(d => items.push(d.data() as NotificationRecord));
        setNotifications(items);
      }
    }, createErrorHandler("notifications", [], setNotifications));

    const unsubAudit = onSnapshot(collection(db, "auditLogs"), (snap) => {
      if (snap.empty) {
        setAuditLogs([]);
      } else {
        const items: AuditLogEntry[] = [];
        snap.forEach(d => items.push(d.data() as AuditLogEntry));
        setAuditLogs(items);
      }
    }, createErrorHandler("auditLogs", [], setAuditLogs));

    const unsubHist = onSnapshot(collection(db, "historicalRecords"), (snap) => {
      if (snap.empty) {
        setHistoricalRecords([]);
      } else {
        const items: HistoricalRecord[] = [];
        snap.forEach(d => items.push(d.data() as HistoricalRecord));
        setHistoricalRecords(items);
      }
    }, createErrorHandler("historicalRecords", [], setHistoricalRecords));

    const unsubMaint = onSnapshot(collection(db, "maintenance_requests"), (snap) => {
      if (snap.empty) {
        setMaintenanceRequests([]);
      } else {
        const items: MaintenanceRequest[] = [];
        snap.forEach(d => items.push(d.data() as MaintenanceRequest));
        setMaintenanceRequests(items);
      }
    }, createErrorHandler("maintenance_requests", [], setMaintenanceRequests));

    const unsubTechs = onSnapshot(collection(db, "technicians"), (snap) => {
      if (snap.empty) {
        setTechnicians([]);
      } else {
        const items: Technician[] = [];
        snap.forEach(d => items.push(d.data() as Technician));
        setTechnicians(items);
      }
    }, createErrorHandler("technicians", [], setTechnicians));

    const unsubCommissions = onSnapshot(collection(db, "commissions"), (snap) => {
      if (!snap.empty) {
        const items: CommissionObligation[] = [];
        snap.forEach(d => items.push(d.data() as CommissionObligation));
        setCommissions(items);
      }
    }, createErrorHandler("commissions", [], setCommissions));

    const unsubAllocations = onSnapshot(collection(db, "payment_allocations"), (snap) => {
      if (!snap.empty) {
        const items: PaymentAllocation[] = [];
        snap.forEach(d => items.push(d.data() as PaymentAllocation));
        setPaymentAllocations(items);
      }
    }, createErrorHandler("payment_allocations", [], setPaymentAllocations));

    const unsubReversals = onSnapshot(collection(db, "financial_reversals"), (snap) => {
      if (!snap.empty) {
        const items: FinancialReversalRecord[] = [];
        snap.forEach(d => items.push(d.data() as FinancialReversalRecord));
        setFinancialReversals(items);
      }
    }, createErrorHandler("financial_reversals", [], setFinancialReversals));

    const unsubAdjustments = onSnapshot(collection(db, "financial_adjustments"), (snap) => {
      if (!snap.empty) {
        const items: FinancialAdjustmentRecord[] = [];
        snap.forEach(d => items.push(d.data() as FinancialAdjustmentRecord));
        setFinancialAdjustments(items);
      }
    }, createErrorHandler("financial_adjustments", [], setFinancialAdjustments));

    const unsubTransfers = onSnapshot(collection(db, "owner_transfers"), (snap) => {
      if (!snap.empty) {
        const items: OwnerTransferRecord[] = [];
        snap.forEach(d => items.push(d.data() as OwnerTransferRecord));
        setOwnerTransfers(items);
      }
    }, createErrorHandler("owner_transfers", [], setOwnerTransfers));

    const unsubExpenses = onSnapshot(collection(db, "property_expenses"), (snap) => {
      if (!snap.empty) {
        const items: PropertyExpenseRecord[] = [];
        snap.forEach(d => items.push(d.data() as PropertyExpenseRecord));
        setPropertyExpenses(items);
      }
    }, createErrorHandler("property_expenses", [], setPropertyExpenses));

    const unsubCollectionActions = onSnapshot(collection(db, "collection_actions"), (snap) => {
      if (!snap.empty) {
        const items: CollectionAction[] = [];
        snap.forEach(d => items.push(d.data() as CollectionAction));
        setCollectionActions(items);
      }
    }, createErrorHandler("collection_actions", [], setCollectionActions));

    const unsubPaymentPromises = onSnapshot(collection(db, "payment_promises"), (snap) => {
      if (!snap.empty) {
        const items: PaymentPromise[] = [];
        snap.forEach(d => items.push(d.data() as PaymentPromise));
        setPaymentPromises(items);
      }
    }, createErrorHandler("payment_promises", [], setPaymentPromises));

    const unsubRenewals = onSnapshot(collection(db, "lease_renewals"), (snap) => {
      if (!snap.empty) {
        const items: LeaseRenewalRecord[] = [];
        snap.forEach(d => items.push(d.data() as LeaseRenewalRecord));
        setLeaseRenewals(items);
      }
    }, createErrorHandler("lease_renewals", [], setLeaseRenewals));

    const unsubDeferred = onSnapshot(collection(db, "deferred_payments"), (snap) => {
      if (!snap.empty) {
        const items: DeferredPaymentRecord[] = [];
        snap.forEach(d => items.push(d.data() as DeferredPaymentRecord));
        setDeferredPayments(items);
      }
    }, createErrorHandler("deferred_payments", [], setDeferredPayments));

    const unsubCOA = onSnapshot(collection(db, "chart_of_accounts"), (snap) => {
      if (snap.empty) {
        seedCollectionIfEmpty("chart_of_accounts", INITIAL_CHART_OF_ACCOUNTS);
        setChartOfAccounts(INITIAL_CHART_OF_ACCOUNTS);
      } else {
        const items: AccountDefinition[] = [];
        snap.forEach(d => items.push(d.data() as AccountDefinition));
        setChartOfAccounts(items);
      }
    }, createErrorHandler("chart_of_accounts", INITIAL_CHART_OF_ACCOUNTS, setChartOfAccounts));

    const unsubJournals = onSnapshot(collection(db, "journal_entries"), (snap) => {
      if (!snap.empty) {
        const items: JournalEntryRecord[] = [];
        snap.forEach(d => items.push(d.data() as JournalEntryRecord));
        setJournalEntries(items);
      }
    }, createErrorHandler("journal_entries", [], setJournalEntries));

    const unsubPettyCashMonths = onSnapshot(collection(db, "office_petty_cash_months"), (snap) => {
      if (!snap.empty) {
        const items: OfficePettyCashMonth[] = [];
        snap.forEach(d => items.push(d.data() as OfficePettyCashMonth));
        setOfficePettyCashMonths(items);
      }
    }, createErrorHandler("office_petty_cash_months", [], setOfficePettyCashMonths));

    const unsubPettyCashExpenses = onSnapshot(collection(db, "office_petty_cash_expenses"), (snap) => {
      if (!snap.empty) {
        const items: OfficePettyCashExpense[] = [];
        snap.forEach(d => items.push(d.data() as OfficePettyCashExpense));
        setOfficePettyCashExpenses(items);
      }
    }, createErrorHandler("office_petty_cash_expenses", [], setOfficePettyCashExpenses));

    const unsubPettyCashCategories = onSnapshot(collection(db, "office_petty_cash_categories"), (snap) => {
      if (snap.empty) {
        seedCollectionIfEmpty("office_petty_cash_categories", INITIAL_PETTY_CASH_CATEGORIES);
        setOfficePettyCashCategories(INITIAL_PETTY_CASH_CATEGORIES);
      } else {
        const items: OfficePettyCashCategory[] = [];
        snap.forEach(d => items.push(d.data() as OfficePettyCashCategory));
        setOfficePettyCashCategories(items);
      }
    }, createErrorHandler("office_petty_cash_categories", INITIAL_PETTY_CASH_CATEGORIES, setOfficePettyCashCategories));

    const unsubVatRates = onSnapshot(collection(db, "vatRates"), (snap) => {
      if (snap.empty) {
        const initialVat = [{
          id: "vat-initial",
          rate: 5.0,
          effectiveFrom: "2026-01-01",
          category: "ADMIN_FEE" as VatRateCategory,
          status: "ACTIVE" as VatRateStatus,
          createdAt: new Date().toISOString(),
          createdById: "system",
          createdByName: "System",
        }];
        seedCollectionIfEmpty("vatRates", initialVat);
        setVatRates(initialVat);
      } else {
        const items: VatRateRecord[] = [];
        snap.forEach(d => items.push(d.data() as VatRateRecord));
        setVatRates(items);
      }
    }, createErrorHandler("vatRates", [], setVatRates));

    const unsubFinancialPeriods = onSnapshot(collection(db, "financial_periods"), (snap) => {
      if (snap.empty) {
        seedCollectionIfEmpty("financial_periods", INITIAL_FINANCIAL_PERIODS);
        setFinancialPeriods(INITIAL_FINANCIAL_PERIODS);
      } else {
        const items: FinancialPeriod[] = [];
        snap.forEach(d => items.push(d.data() as FinancialPeriod));
        // If loaded periods are non-empty, ensure any missing standard years are also present
        const yearMap = new Set(items.map(p => p.startDate.split("-")[0]));
        const missingInitial = INITIAL_FINANCIAL_PERIODS.filter(p => !yearMap.has(p.startDate.split("-")[0]));
        const merged = [...items, ...missingInitial];
        setFinancialPeriods(merged);
      }
    }, createErrorHandler("financial_periods", INITIAL_FINANCIAL_PERIODS, setFinancialPeriods));

    const unsubPeriodCertifications = onSnapshot(collection(db, "period_certifications"), (snap) => {
      if (!snap.empty) {
        const items: ForensicClosingCertification[] = [];
        snap.forEach(d => items.push(d.data() as ForensicClosingCertification));
        setPeriodCertifications(items);
      }
    }, createErrorHandler("period_certifications", [], setPeriodCertifications));

    const unsubCompanyProfile = onSnapshot(doc(db, "settings", "companyProfile"), (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as CompanyProfile;
        setCompanyProfile({ ...DEFAULT_COMPANY_PROFILE, ...remoteData });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "settings/companyProfile");
      checkQuotaError(err);
    });

    return () => {
      unsubCompanyProfile();
      unsubFinancialPeriods();
      unsubPeriodCertifications();
      unsubVatRates();
      unsubOwners();
      unsubProps();
      unsubUnits();
      unsubTenants();
      unsubLeases();
      unsubCheques();
      unsubCollections();
      unsubCases();
      unsubArchive();
      unsubNotifications();
      unsubAudit();
      unsubHist();
      unsubMaint();
      unsubTechs();
      unsubCommissions();
      unsubAllocations();
      unsubReversals();
      unsubAdjustments();
      unsubTransfers();
      unsubExpenses();
      unsubCollectionActions();
      unsubPaymentPromises();
      unsubRenewals();
      unsubDeferred();
      unsubCOA();
      unsubJournals();
      unsubPettyCashMonths();
      unsubPettyCashExpenses();
      unsubPettyCashCategories();
    };
  }, []);

  // Audit Logger
  const logAudit = (
    action: AuditLogEntry["action"],
    entityType: AuditLogEntry["entityType"],
    entityId: string,
    entityName: string,
    details: string,
    oldValue?: string,
    newValue?: string,
    reason?: string
  ) => {
    const entry: AuditLogEntry = {
      id: "aud-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      action,
      entityType,
      entityId,
      entityName,
      userId: currentUser?.id || "sys",
      userName: currentUser?.nameEn || "System User",
      userRole: currentUser?.role || "SUPER_ADMIN",
      timestamp: new Date().toISOString(),
      details,
      ...(oldValue !== undefined ? { oldValue } : {}),
      ...(newValue !== undefined ? { newValue } : {}),
      ...(reason !== undefined ? { reason } : {}),
    };
    setAuditLogs((prev) => [entry, ...prev]);
    safeSetDoc(doc(db, "auditLogs", entry.id), entry);
  };

  // Helper for Saving Snapshots into Historical Records (Versioning & Deletion Archive)
  const saveEntitySnapshot = (
    entityType: HistoricalRecord["entityType"],
    entity: any,
    recordType: "DELETION" | "VERSION",
    options?: DeleteRecordOptions
  ): HistoricalRecord | undefined => {
    if (!entity) return undefined;
    const isDeletion = recordType === "DELETION";
    const keepAttachments = options?.keepAttachments !== false;

    // Find any linked archive items
    const linkedDocs = archive.filter(
      (a) => a.recordId === entity.id || a.entityId === entity.id
    );

    // Extract attachments
    const retainedAttachments: RetainedAttachment[] = [];

    // Add from archive collection
    linkedDocs.forEach((d) => {
      retainedAttachments.push({
        id: d.id,
        fileName: d.fileName,
        fileUrl: d.previewUrl,
        fileSize: d.fileSize,
        category: d.category,
        driveWebViewLink: d.driveWebViewLink,
        driveFileId: d.driveFileId,
        uploadedAt: d.createdAt,
      });
    });

    // Check direct file fields (e.g. cheque imageUrl, caseDocuments)
    if (entity.imageUrl && !retainedAttachments.some((a) => a.fileUrl === entity.imageUrl)) {
      retainedAttachments.push({
        id: "att-chq-" + entity.id,
        fileName: `Cheque_${entity.chequeNumber || entity.id}_Scan.png`,
        fileUrl: entity.imageUrl,
        category: "CHEQUES",
        driveWebViewLink: entity.driveWebViewLink,
        driveFileId: entity.driveFileId,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (Array.isArray(entity.caseDocuments)) {
      entity.caseDocuments.forEach((cd: any) => {
        if (!retainedAttachments.some((a) => a.id === cd.id)) {
          retainedAttachments.push({
            id: cd.id,
            fileName: cd.fileName || cd.title || "Case Document",
            fileUrl: cd.fileUrl || cd.url,
            category: "CASES",
            driveWebViewLink: cd.driveWebViewLink,
            driveFileId: cd.driveFileId,
            uploadedAt: cd.uploadedAt,
          });
        }
      });
    }

    // Handle archive collection based on user choice
    if (isDeletion) {
      if (keepAttachments) {
        // Tag existing archive items as historical
        setArchive((prev) =>
          prev.map((a) => {
            if (a.recordId === entity.id || a.entityId === entity.id) {
              return {
                ...a,
                recordTitle: a.recordTitle.startsWith("[سجل تاريخي محفوظ]")
                  ? a.recordTitle
                  : `[سجل تاريخي محفوظ] ${a.recordTitle}`,
              };
            }
            return a;
          })
        );
      } else {
        // User opted to delete attachments
        if (linkedDocs.length > 0) {
          const linkedIds = new Set(linkedDocs.map((d) => d.id));
          setArchive((prev) => prev.filter((a) => !linkedIds.has(a.id)));
          linkedDocs.forEach((d) => {
            deleteDoc(doc(db, "archive", d.id)).catch(() => {});
          });
        }
      }
    }

    // Determine entity code, title, and current status
    let entityCode = entity.id;
    let entityTitle = "";
    let currentStatus = "ACTIVE";

    switch (entityType) {
      case "LEASE":
        entityCode = entity.leaseNumber || entity.id;
        entityTitle = `عقد إيجار #${entity.leaseNumber || entity.id}`;
        currentStatus = entity.contractStatus || "ACTIVE";
        break;
      case "CHEQUE":
        entityCode = entity.chequeNumber || entity.id;
        entityTitle = `شيك رقم #${entity.chequeNumber} (${entity.bankName || ""}) - ${entity.drawerName || ""}`;
        currentStatus = entity.status || "PENDING";
        break;
      case "CASE":
        entityCode = entity.caseNumber || entity.courtReferenceNumber || entity.id;
        entityTitle = `قضية رقم #${entity.caseNumber || entity.id} - ${entity.courtName || ""}`;
        currentStatus = entity.status || "OPEN";
        break;
      case "TENANT":
        entityCode = entity.code || entity.id;
        entityTitle = `${entity.nameAr || entity.nameEn || "مستأجر"} (${entity.code || ""})`;
        currentStatus = entity.riskLevel || entity.status || "ACTIVE";
        break;
      case "UNIT":
        entityCode = entity.unitNumber || entity.id;
        entityTitle = `وحدة رقم ${entity.unitNumber}`;
        currentStatus = entity.status || "VACANT";
        break;
      case "PROPERTY":
        entityCode = entity.code || entity.id;
        entityTitle = `${entity.nameAr || entity.nameEn || "عقار"} (${entity.code || ""})`;
        currentStatus = entity.type || "ACTIVE";
        break;
      case "OWNER":
        entityCode = entity.code || entity.id;
        entityTitle = `${entity.nameAr || entity.nameEn || "مالك"} (${entity.code || ""})`;
        currentStatus = "ACTIVE";
        break;
      case "COLLECTION":
        entityCode = entity.receiptNumber || entity.id;
        entityTitle = `سند قبض #${entity.receiptNumber || entity.id} - ${entity.payerName || ""}`;
        currentStatus = entity.paymentMethod || "COLLECTED";
        break;
      case "MAINTENANCE":
        entityCode = entity.requestNumber || entity.id;
        entityTitle = `طلب صيانة #${entity.requestNumber || entity.id} - ${entity.category || ""}`;
        currentStatus = entity.status || "OPEN";
        break;
    }

    let snapshotData = JSON.parse(JSON.stringify(entity));
    if (entityType === "MAINTENANCE") {
      const u = units.find((x) => x.id === entity.unitId);
      const p = properties.find((x) => x.id === entity.propertyId);
      const o = owners.find((x) => x.id === entity.ownerId);
      const t = tenants.find((x) => x.id === entity.tenantId);
      const tech = technicians.find((x) => x.id === entity.technicianId);
      snapshotData = {
        ...snapshotData,
        unitSnapshot: u ? JSON.parse(JSON.stringify(u)) : undefined,
        propertySnapshot: p ? JSON.parse(JSON.stringify(p)) : undefined,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        tenantSnapshot: t ? JSON.parse(JSON.stringify(t)) : undefined,
        technicianSnapshot: tech ? JSON.parse(JSON.stringify(tech)) : undefined,
      };
    } else if (entityType === "LEASE") {
      const t = tenants.find((x) => x.id === entity.tenantId);
      const o = owners.find((x) => x.id === entity.ownerId);
      const p = properties.find((x) => x.id === entity.propertyId);
      const u = units.find((x) => x.id === entity.unitId);
      snapshotData = {
        ...snapshotData,
        tenantSnapshot: t ? JSON.parse(JSON.stringify(t)) : undefined,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        propertySnapshot: p ? JSON.parse(JSON.stringify(p)) : undefined,
        unitSnapshot: u ? JSON.parse(JSON.stringify(u)) : undefined,
        tenantNameAr: t?.nameAr || snapshotData.tenantNameAr,
        tenantNameEn: t?.nameEn || snapshotData.tenantNameEn,
        tenantPhone: t?.phone || snapshotData.tenantPhone,
        tenantEmail: t?.email || snapshotData.tenantEmail,
        tenantEmiratesId: t?.emiratesId || snapshotData.tenantEmiratesId,
        ownerNameAr: o?.nameAr || snapshotData.ownerNameAr,
        ownerNameEn: o?.nameEn || snapshotData.ownerNameEn,
        ownerName: o?.nameAr || o?.nameEn || snapshotData.ownerName,
        ownerPhone: o?.phone || snapshotData.ownerPhone,
        ownerEmail: o?.email || snapshotData.ownerEmail,
        propertyNameAr: p?.nameAr || snapshotData.propertyNameAr,
        propertyNameEn: p?.nameEn || snapshotData.propertyNameEn,
        propertyAddress: p ? [p.emirate, p.community, p.plotNumber ? `Plot ${p.plotNumber}` : ""].filter(Boolean).join(" - ") : snapshotData.propertyAddress,
        unitNumber: u?.unitNumber || snapshotData.unitNumber,
        floor: u?.floor || snapshotData.floor,
        areaSqFt: u?.areaSqFt || snapshotData.areaSqFt,
      };
    } else if (entityType === "CHEQUE") {
      const t = tenants.find((x) => x.id === entity.tenantId);
      const o = owners.find((x) => x.id === entity.ownerId);
      const p = properties.find((x) => x.id === entity.propertyId);
      const u = units.find((x) => x.id === entity.unitId);
      snapshotData = {
        ...snapshotData,
        tenantSnapshot: t ? JSON.parse(JSON.stringify(t)) : undefined,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        propertySnapshot: p ? JSON.parse(JSON.stringify(p)) : undefined,
        unitSnapshot: u ? JSON.parse(JSON.stringify(u)) : undefined,
        tenantName: t?.nameAr || t?.nameEn || snapshotData.tenantName,
        ownerName: o?.nameAr || o?.nameEn || snapshotData.ownerName,
        propertyName: p?.nameAr || p?.nameEn || snapshotData.propertyName,
        unitNumber: u?.unitNumber || snapshotData.unitNumber,
      };
    } else if (entityType === "CASE") {
      const t = tenants.find((x) => x.id === entity.tenantId);
      const o = owners.find((x) => x.id === entity.ownerId);
      const p = properties.find((x) => x.id === entity.propertyId);
      const u = units.find((x) => x.id === entity.unitId);
      snapshotData = {
        ...snapshotData,
        tenantSnapshot: t ? JSON.parse(JSON.stringify(t)) : undefined,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        propertySnapshot: p ? JSON.parse(JSON.stringify(p)) : undefined,
        unitSnapshot: u ? JSON.parse(JSON.stringify(u)) : undefined,
        tenantName: t?.nameAr || t?.nameEn || snapshotData.tenantName,
        ownerName: o?.nameAr || o?.nameEn || snapshotData.ownerName,
        propertyName: p?.nameAr || p?.nameEn || snapshotData.propertyName,
        unitNumber: u?.unitNumber || snapshotData.unitNumber,
      };
    } else if (entityType === "UNIT") {
      const p = properties.find((x) => x.id === entity.propertyId);
      const o = owners.find((x) => x.id === p?.ownerId);
      snapshotData = {
        ...snapshotData,
        propertySnapshot: p ? JSON.parse(JSON.stringify(p)) : undefined,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        propertyName: p?.nameAr || p?.nameEn || snapshotData.propertyName,
        ownerName: o?.nameAr || o?.nameEn || snapshotData.ownerName,
      };
    } else if (entityType === "PROPERTY") {
      const o = owners.find((x) => x.id === entity.ownerId);
      snapshotData = {
        ...snapshotData,
        ownerSnapshot: o ? JSON.parse(JSON.stringify(o)) : undefined,
        ownerName: o?.nameAr || o?.nameEn || snapshotData.ownerName,
      };
    }

    const histRecord: HistoricalRecord = {
      id: "hist-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      originalId: entity.id,
      entityType,
      entityCode,
      entityTitle,
      recordType,
      statusAtDeletion: isDeletion ? currentStatus : undefined,
      deletedAt: isDeletion ? new Date().toISOString() : undefined,
      versionDate: !isDeletion ? new Date().toISOString() : undefined,
      deletedByUserId: currentUser?.id || "usr-admin",
      deletedByUserName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      deletedByUserRole: currentUser?.role || "SUPER_ADMIN",
      deletionReason: options?.reason,
      retainedAttachmentsCount: retainedAttachments.length,
      retainedAttachments: retainedAttachments,
      snapshotData: snapshotData,
    };

    setHistoricalRecords((prev) => [histRecord, ...prev]);
    safeSetDoc(doc(db, "historicalRecords", histRecord.id), histRecord);

    logAudit(
      isDeletion ? "DELETE" : "UPDATE",
      "HISTORICAL_RECORD",
      histRecord.id,
      entityTitle,
      isDeletion 
        ? `تم حذف ${entityTitle} وحفظه في السجلات التاريخية بحالة (${currentStatus}). تم الاحتفاظ بـ (${histRecord.retainedAttachmentsCount}) مرفق.`
        : `تم حفظ نسخة احتياطية (Version) لـ ${entityTitle} قبل التعديل.`
    );

    return histRecord;
  };

  const archiveEntityToHistory = (
    entityType: HistoricalRecord["entityType"],
    entity: any,
    options?: DeleteRecordOptions
  ): HistoricalRecord | undefined => {
    return saveEntitySnapshot(entityType, entity, "DELETION", options);
  };

  const restoreHistoricalRecord = (id: string): { success: boolean; message?: string } => {
    const record = historicalRecords.find((r) => r.id === id);
    if (!record || !record.snapshotData) {
      return { success: false, message: "Record not found in historical archive" };
    }

    const data = record.snapshotData;

    switch (record.entityType) {
      case "LEASE":
        setLeases((prev) => [data as Lease, ...prev.filter((l) => l.id !== data.id)]);
        safeSetDoc(doc(db, "leases", data.id), data);
        if (data.unitId && isOccupyingLeaseStatus(data.contractStatus)) {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === data.unitId
                ? {
                    ...u,
                    status: "OCCUPIED",
                    currentTenantId: data.tenantId,
                    currentLeaseId: data.id,
                  }
                : u
            )
          );
        }
        break;
      case "CHEQUE":
        setCheques((prev) => [data as Cheque, ...prev.filter((c) => c.id !== data.id)]);
        safeSetDoc(doc(db, "cheques", data.id), data);
        break;
      case "CASE":
        setCases((prev) => [data as RentalCase, ...prev.filter((c) => c.id !== data.id)]);
        safeSetDoc(doc(db, "cases", data.id), data);
        break;
      case "TENANT":
        setTenants((prev) => [data as Tenant, ...prev.filter((t) => t.id !== data.id)]);
        safeSetDoc(doc(db, "tenants", data.id), data);
        break;
      case "UNIT":
        setUnits((prev) => [data as Unit, ...prev.filter((u) => u.id !== data.id)]);
        safeSetDoc(doc(db, "units", data.id), data);
        break;
      case "PROPERTY":
        setProperties((prev) => [data as Property, ...prev.filter((p) => p.id !== data.id)]);
        safeSetDoc(doc(db, "properties", data.id), data);
        break;
      case "OWNER":
        setOwners((prev) => [data as Owner, ...prev.filter((o) => o.id !== data.id)]);
        safeSetDoc(doc(db, "owners", data.id), data);
        break;
      case "COLLECTION":
        setCollections((prev) => [data as CollectionRecord, ...prev.filter((c) => c.id !== data.id)]);
        safeSetDoc(doc(db, "collections", data.id), data);
        break;
      case "MAINTENANCE":
        setMaintenanceRequests((prev) => [data as MaintenanceRequest, ...prev.filter((m) => m.id !== data.id)]);
        safeSetDoc(doc(db, "maintenance_requests", data.id), data);
        break;
    }

    // Remove from historicalRecords if it was a deletion
    if (record.recordType === "DELETION") {
      setHistoricalRecords((prev) => prev.filter((r) => r.id !== id));
      deleteDoc(doc(db, "historicalRecords", id)).catch(() => {});
    }

    logAudit(
      "STATUS_CHANGE",
      "HISTORICAL_RECORD",
      record.id,
      record.entityTitle,
      record.recordType === "DELETION" 
        ? `تم استعادة سجل محذوف: ${record.entityTitle}`
        : `تم الرجوع عن تعديل واستعادة نسخة سابقة: ${record.entityTitle}`
    );

    return { 
      success: true, 
      message: record.recordType === "DELETION" 
        ? `تم استعادة السجل بنجاح` 
        : `تم الرجوع عن التعديلات بنجاح` 
    };
  };

  const deleteHistoricalRecord = (id: string) => {
    const record = historicalRecords.find((r) => r.id === id);
    setHistoricalRecords((prev) => prev.filter((r) => r.id !== id));
    deleteDoc(doc(db, "historicalRecords", id)).catch(() => {});
    if (record) {
      logAudit(
        "DELETE",
        "HISTORICAL_RECORD",
        id,
        record.entityTitle,
        `تم مسح السجل التاريخي نهائياً: ${record.entityTitle}`
      );
    }
  };

  // Helper for dynamic Tenant Risk Scoring
  const calculateTenantRisk = (tntId: string, customWeights = riskConfig): { score: number; level: RiskLevel; factors: string[] } => {
    const tenantCheques = cheques.filter((c) => c.tenantId === tntId);
    const tenantCases = cases.filter((c) => c.tenantId === tntId && c.status !== "CLOSED" && c.status !== "ARCHIVED");
    const totalChequesCount = tenantCheques.length;
    const bouncedCheques = tenantCheques.filter((c) => c.originalStatus === "BOUNCED");
    const bouncedCount = bouncedCheques.length;
    const totalOutstanding = bouncedCheques.reduce((sum, c) => sum + c.outstanding, 0);

    const factors: string[] = [];

    if (totalChequesCount === 0) {
      return { score: 10, level: "LOW", factors: ["No historical cheque records (New Tenant)"] };
    }

    const bounceRatio = totalChequesCount > 0 ? (bouncedCount / totalChequesCount) : 0;
    
    // Compute normalized subscores (0 - 100)
    let bouncedCountScore = Math.min(bouncedCount * 30, 100);
    let ratioScore = Math.min(bounceRatio * 100, 100);
    let outstandingScore = Math.min((totalOutstanding / 100000) * 100, 100);
    let casesScore = Math.min(tenantCases.length * 50, 100);

    const totalWeight =
      customWeights.bouncedChequesCountWeight +
      customWeights.bouncedRatioWeight +
      customWeights.outstandingAmountWeight +
      customWeights.delayDaysWeight +
      customWeights.casesFiledWeight;

    const weightedScore = Math.round(
      (bouncedCountScore * customWeights.bouncedChequesCountWeight +
        ratioScore * customWeights.bouncedRatioWeight +
        outstandingScore * customWeights.outstandingAmountWeight +
        casesScore * customWeights.casesFiledWeight) /
        totalWeight
    );

    const finalScore = Math.max(5, Math.min(weightedScore, 100));

    if (bouncedCount > 0) factors.push(`${bouncedCount} returned cheques historically`);
    if (totalOutstanding > 0) factors.push(`AED ${totalOutstanding.toLocaleString()} currently outstanding`);
    if (tenantCases.length > 0) factors.push(`${tenantCases.length} active rental dispute case(s)`);
    if (factors.length === 0) factors.push("Clean payment compliance track record");

    let level: RiskLevel = "LOW";
    if (finalScore > customWeights.mediumThreshold) {
      level = "HIGH";
    } else if (finalScore > customWeights.lowThreshold) {
      level = "MEDIUM";
    }

    return { score: finalScore, level, factors };
  };

  const recalculateTenantRisk = (tenantId: string) => {
    const risk = calculateTenantRisk(tenantId);
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, riskScore: risk.score, riskLevel: risk.level, riskFactors: risk.factors } : t))
    );
  };

  // Automatically recalculate and link tenant risk whenever cheques, cases, or riskConfig change
  useEffect(() => {
    setTenants((prev) => {
      let changed = false;
      const nextTenants = prev.map((t) => {
        const risk = calculateTenantRisk(t.id, riskConfig);
        if (t.riskScore === risk.score && t.riskLevel === risk.level) {
          return t;
        }
        changed = true;
        return {
          ...t,
          riskScore: risk.score,
          riskLevel: risk.level,
          riskFactors: risk.factors,
        };
      });
      return changed ? nextTenants : prev;
    });
  }, [cheques, cases, riskConfig]);

  // -------------------------------------------------------------
  // Master Data Methods with Duplicate Prevention & Data Integrity
  // -------------------------------------------------------------

  // Helper normalization functions for duplicate checking & data integrity using central Arabic normalizer
  const normalizeText = (str?: string): string => {
    return normalizeArabicText(str, true);
  };

  const normalizePhone = (phone?: string): string => {
    if (!phone) return "";
    return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
  };

  const normalizeIdNumber = (idStr?: string): string => {
    if (!idStr) return "";
    return idStr.replace(/[^\w]/g, "").toUpperCase();
  };

  const addOwner = (data: Omit<Owner, "id" | "createdAt">): Owner => {
    const newOwner: Owner = {
      ...data,
      id: "ow-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      createdAt: new Date().toISOString(),
    };
    setOwners((prev) => [newOwner, ...prev]);
    safeSetDoc(doc(db, "owners", newOwner.id), newOwner);
    logAudit("CREATE", "OWNER", newOwner.id, newOwner.nameEn, `Created new owner profile ${newOwner.nameEn} (${newOwner.code})`);
    return newOwner;
  };

  const updateOwner = (id: string, patch: Partial<Owner>) => {
    const owner = owners.find((o) => o.id === id);
    if (owner) {
      saveEntitySnapshot("OWNER", owner, "VERSION");
    }
    setOwners((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated = { ...o, ...patch };
          safeSetDoc(doc(db, "owners", id), updated, { merge: true });
          
          // Cross-table update: Update ownerName in related cases
          if (patch.nameEn || patch.nameAr) {
            const newName = language === "ar" ? (patch.nameAr || o.nameAr) : (patch.nameEn || o.nameEn);
            setCases((prevCases) =>
              prevCases.map((c) => {
                if (c.ownerId === id) {
                  const updatedCase = { ...c, ownerName: newName };
                  safeSetDoc(doc(db, "cases", c.id), updatedCase, { merge: true });
                  return updatedCase;
                }
                return c;
              })
            );
          }
          
          if (patch.trn !== undefined && patch.trn !== o.trn) {
            logAudit("UPDATE", "OWNER", id, o.nameEn, `Updated TRN from ${o.trn || "غير مسجل"} to ${patch.trn || "غير مسجل"}`);
          }

          if (patch.specialAdminFeeRate !== undefined && patch.specialAdminFeeRate !== o.specialAdminFeeRate) {
            logAudit("UPDATE", "OWNER", id, o.nameEn, `Updated Special Admin Fee Rate from ${o.specialAdminFeeRate ?? "Default"}% to ${patch.specialAdminFeeRate}%`);
          }
          
          logAudit("UPDATE", "OWNER", id, o.nameEn, `Updated owner details`);
          return updated;
        }
        return o;
      })
    );
  };


  const updateCompanyProfile = (profile: CompanyProfile) => {
    const fullProfile = { ...DEFAULT_COMPANY_PROFILE, ...profile };
    setCompanyProfile(fullProfile);
    safeSetDoc(doc(db, "settings", "companyProfile"), fullProfile, { merge: true });
    logAudit("UPDATE", "COMPANY_PROFILE", "COMPANY_PROFILE", "Company Profile", "تم تحديث بيانات ملف الشركة المركزي");
  };

  const activeLetterheadTemplate = (companyProfile?.letterheadTemplates || []).find(
    (t) => t.isActive || t.id === companyProfile?.activeLetterheadId
  );

  const addCompanyLetterheadTemplate = (
    templateData: Omit<CompanyLetterheadTemplate, "id" | "uploadedAt" | "uploadedByUserId" | "uploadedByUserName">
  ): { success: boolean; template?: CompanyLetterheadTemplate; error?: string } => {
    try {
      const existingTemplates = companyProfile?.letterheadTemplates || [];
      const isFirst = existingTemplates.length === 0;

      const newTemplate: CompanyLetterheadTemplate = {
        ...templateData,
        id: "lh_" + Date.now() + "_" + crypto.randomUUID().split("-")[0],
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: currentUser?.id || "sys",
        uploadedByUserName: currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام",
        isActive: templateData.isActive !== undefined ? templateData.isActive : isFirst,
      };

      let updatedTemplates = [...existingTemplates];
      if (newTemplate.isActive) {
        updatedTemplates = updatedTemplates.map((t) => ({ ...t, isActive: false }));
      }
      updatedTemplates.unshift(newTemplate);

      const updatedProfile: CompanyProfile = {
        ...companyProfile,
        letterheadTemplates: updatedTemplates,
        activeLetterheadId: newTemplate.isActive ? newTemplate.id : companyProfile?.activeLetterheadId,
      };

      updateCompanyProfile(updatedProfile);
      logAudit(
        "DOCUMENT_UPLOAD",
        "COMPANY_PROFILE",
        newTemplate.id,
        newTemplate.fileName,
        `تم رفع ورقة رسمية جديدة للشركة: ${newTemplate.fileName}`
      );

      return { success: true, template: newTemplate };
    } catch (err: any) {
      console.error("Error adding letterhead template:", err);
      return { success: false, error: err?.message || "فشل رفع القالب" };
    }
  };

  const setActiveCompanyLetterhead = (
    templateId: string
  ): { success: boolean; error?: string } => {
    try {
      const existingTemplates = companyProfile?.letterheadTemplates || [];
      const target = existingTemplates.find((t) => t.id === templateId);
      if (!target) {
        return { success: false, error: "القالب غير موجود" };
      }

      const updatedTemplates = existingTemplates.map((t) => ({
        ...t,
        isActive: t.id === templateId,
      }));

      const updatedProfile: CompanyProfile = {
        ...companyProfile,
        letterheadTemplates: updatedTemplates,
        activeLetterheadId: templateId,
      };

      updateCompanyProfile(updatedProfile);
      logAudit(
        "UPDATE",
        "COMPANY_PROFILE",
        templateId,
        target.fileName,
        `تم اعتماد الورقة الرسمية كقالب رسمي نشط: ${target.fileName}`
      );

      return { success: true };
    } catch (err: any) {
      console.error("Error setting active letterhead:", err);
      return { success: false, error: err?.message || "فشل اعتماد القالب" };
    }
  };

  const deleteCompanyLetterheadTemplate = (
    templateId: string
  ): { success: boolean; error?: string } => {
    try {
      const existingTemplates = companyProfile?.letterheadTemplates || [];
      const target = existingTemplates.find((t) => t.id === templateId);
      if (!target) {
        return { success: false, error: "القالب غير موجود" };
      }

      const filteredTemplates = existingTemplates.filter((t) => t.id !== templateId);
      let newActiveId = companyProfile?.activeLetterheadId;

      if (target.isActive || companyProfile?.activeLetterheadId === templateId) {
        if (filteredTemplates.length > 0) {
          filteredTemplates[0].isActive = true;
          newActiveId = filteredTemplates[0].id;
        } else {
          newActiveId = undefined;
        }
      }

      const updatedProfile: CompanyProfile = {
        ...companyProfile,
        letterheadTemplates: filteredTemplates,
        activeLetterheadId: newActiveId,
      };

      updateCompanyProfile(updatedProfile);
      logAudit(
        "DELETE",
        "COMPANY_PROFILE",
        templateId,
        target.fileName,
        `تم حذف قالب الورقة الرسمية: ${target.fileName}`
      );

      return { success: true };
    } catch (err: any) {
      console.error("Error deleting letterhead template:", err);
      return { success: false, error: err?.message || "فشل حذف القالب" };
    }
  };

  const checkFinancialEditPermission = (entityType: AuditLogEntry["entityType"], modificationReason?: string): { allowed: boolean; error?: string } => {
    const financialEntities: AuditLogEntry["entityType"][] = [
      "CHEQUE", "COLLECTION", "MAINTENANCE_INVOICE", "COMMISSION", 
      "OWNER_TRANSFER", "PROPERTY_EXPENSE", "ADJUSTMENT", 
      "FINANCIAL_TRANSACTION", "PAYMENT_ALLOCATION", "REVERSAL",
      "CHART_OF_ACCOUNTS"
    ];
    
    if (financialEntities.includes(entityType)) {
      if (!hasPermission("EDIT_SAVED_FINANCIAL_RECORDS")) {
        console.warn(`[Security Guard] Unauthorized attempt to edit saved financial record (${entityType})`);
        return { 
          allowed: false, 
          error: language === "ar" ? "غير مصرح لك بتعديل السجلات المالية المحفوظة" : "Unauthorized to edit saved financial records" 
        };
      }
      if (!modificationReason || modificationReason.trim() === "") {
        return { 
          allowed: false, 
          error: language === "ar" ? "يجب إدخال سبب التعديل بشكل إلزامي لحفظ التغييرات" : "Modification reason is mandatory to save changes" 
        };
      }
    }
    return { allowed: true };
  };

  const checkDeleteIntegrity = (entityType: EntityIntegrityType, entityId: string): DeleteIntegrityCheckResult => {
    return checkEntityDeleteIntegrity(entityType, entityId, {
      tenants,
      owners,
      properties,
      units,
      leases,
      cheques,
      cases,
      maintenanceRequests,
      collections,
      archive,
    });
  };

  const deleteOwner = (id: string, options?: DeleteRecordOptions) => {
    const owner = owners.find(o => o.id === id);
    if (!owner) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("OWNER", id);
      if (!check.canDelete) {
        logAudit("DELETE", "OWNER", id, owner.nameEn, `Blocked deletion of owner due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Owner ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("OWNER", owner, options);
    setOwners((prev) => prev.filter((o) => o.id !== id));
    deleteDoc(doc(db, "owners", id)).catch(() => {});
  };

  const addProperty = (data: Omit<Property, "id" | "createdAt">): Property => {
    const newProp: Property = {
      ...data,
      id: "prop-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      createdAt: new Date().toISOString(),
    };
    setProperties((prev) => [newProp, ...prev]);
    safeSetDoc(doc(db, "properties", newProp.id), newProp);
    logAudit("CREATE", "PROPERTY", newProp.id, newProp.nameEn, `Added new property ${newProp.nameEn}`);
    return newProp;
  };

  const updateProperty = (id: string, patch: Partial<Property>) => {
    const property = properties.find((p) => p.id === id);
    if (property) {
      saveEntitySnapshot("PROPERTY", property, "VERSION");
    }
    setProperties((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...patch };
          safeSetDoc(doc(db, "properties", id), updated, { merge: true });
          return updated;
        }
        return p;
      })
    );
    logAudit("UPDATE", "PROPERTY", id, "Property", "Updated property details");
  };

  const deleteProperty = (id: string, options?: DeleteRecordOptions) => {
    const property = properties.find(p => p.id === id);
    if (!property) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("PROPERTY", id);
      if (!check.canDelete) {
        logAudit("DELETE", "PROPERTY", id, property.nameEn, `Blocked deletion of property due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Property ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("PROPERTY", property, options);
    setProperties((prev) => prev.filter((p) => p.id !== id));
    deleteDoc(doc(db, "properties", id)).catch(() => {});
  };

  const addUnit = (data: Omit<Unit, "id" | "createdAt">): Unit => {
    const newUnit: Unit = {
      ...data,
      id: "unt-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      createdAt: new Date().toISOString(),
    };
    setUnits((prev) => [newUnit, ...prev]);
    safeSetDoc(doc(db, "units", newUnit.id), newUnit);
    logAudit("CREATE", "UNIT", newUnit.id, `Unit ${newUnit.unitNumber}`, `Added unit ${newUnit.unitNumber}`);
    return newUnit;
  };

  const updateUnit = (id: string, patch: Partial<Unit>) => {
    const unit = units.find((u) => u.id === id);
    if (unit) {
      saveEntitySnapshot("UNIT", unit, "VERSION");
    }

    // OCCUPANCY GOVERNANCE: Check if unit is occupied by an uncancelled/unterminated lease
    const occupyingLeases = getUnitOccupyingLeases(id, leases);
    const hasOccupyingLease = occupyingLeases.length > 0;

    if (hasOccupyingLease && patch.status === "VACANT") {
      const activeLease = occupyingLeases[0];
      const msgAr = `⚠️ حظر تغيير حالة الوحدة: لا يمكن تغيير حالة الوحدة رقم (${unit?.unitNumber || id}) إلى شاغرة (VACANT) لأنها مرتبطة بعقد إيجار قائم #${activeLease.leaseNumber} بحالة [${activeLease.contractStatus}]. انتهاء مدة العقد لا يجعل الوحدة شاغرة؛ يجب فسخ العقد أو إلغاؤه رسمياً من إدارة العقود أولاً.`;
      const msgEn = `⚠️ Unit Occupancy Protection: Cannot set unit #${unit?.unitNumber || id} to VACANT because lease #${activeLease.leaseNumber} is active/uncancelled [${activeLease.contractStatus}]. Lease must be cancelled or terminated first.`;
      
      alert(language === "ar" ? msgAr : msgEn);
      // Enforce status to remain OCCUPIED and retain tenant link
      patch.status = "OCCUPIED";
      patch.currentTenantId = activeLease.tenantId;
      patch.currentLeaseId = activeLease.id;

      logAudit(
        "STATUS_CHANGE",
        "UNIT",
        id,
        `Unit ${unit?.unitNumber || id}`,
        `Attempted to manually set unit to VACANT while occupying lease #${activeLease.leaseNumber} exists. Action overridden to OCCUPIED.`
      );
    }

    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, ...patch };
          safeSetDoc(doc(db, "units", id), updated, { merge: true });
          
          // If status was changed manually to VACANT/MAINTENANCE and NO occupying lease exists, clear linked lease info
          if ((patch.status === "VACANT" || patch.status === "MAINTENANCE") && !hasOccupyingLease) {
            const clearedUnit = {
              ...updated,
              currentTenantId: deleteField() as any,
              currentLeaseId: deleteField() as any,
            };
            safeSetDoc(doc(db, "units", id), clearedUnit, { merge: true });
            return clearedUnit;
          }
          
          return updated;
        }
        return u;
      })
    );
    logAudit("UPDATE", "UNIT", id, "Unit", "Updated unit details");
  };

  const deleteUnit = (id: string, options?: DeleteRecordOptions) => {
    const unit = units.find(u => u.id === id);
    if (!unit) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("UNIT", id);
      if (!check.canDelete) {
        logAudit("DELETE", "UNIT", id, `Unit ${unit.unitNumber}`, `Blocked deletion of unit due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Unit ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("UNIT", unit, options);
    setUnits((prev) => prev.filter((u) => u.id !== id));
    deleteDoc(doc(db, "units", id)).catch(() => {});
  };

  const addTenant = (data: Omit<Tenant, "id" | "createdAt" | "riskScore" | "riskLevel" | "riskFactors">): Tenant => {
    const newTenant: Tenant = {
      ...data,
      id: "tnt-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      riskScore: 10,
      riskLevel: "LOW",
      riskFactors: ["New tenant profile created"],
      bouncedChequesCount: 0,
      totalBouncedAmount: 0,
      activeCasesCount: 0,
      createdAt: new Date().toISOString(),
    };
    setTenants((prev) => [newTenant, ...prev]);
    safeSetDoc(doc(db, "tenants", newTenant.id), newTenant);
    logAudit("CREATE", "TENANT", newTenant.id, newTenant.nameEn, `Created tenant profile ${newTenant.nameEn}`);

    // Automated notification dispatch to tenant upon creating tenant profile
    if (newTenant.email) {
      setTimeout(() => {
        fetch("/api/notifications/dispatch-tenant-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: newTenant.email,
            tenantNameAr: newTenant.nameAr,
            tenantNameEn: newTenant.nameEn,
            tenantCode: newTenant.code,
            phone: newTenant.phone,
            idNumber: newTenant.emiratesId || newTenant.passportNo || newTenant.tradeLicenseNo || "",
            nationality: newTenant.nationality,
          }),
        }).catch((err) => console.error("Auto welcome email failed:", err));
      }, 100);
    }

    return newTenant;
  };

  const updateTenant = (id: string, patch: Partial<Tenant>) => {
    const tenant = tenants.find((t) => t.id === id);
    if (tenant) {
      saveEntitySnapshot("TENANT", tenant, "VERSION");
    }
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...patch };
          safeSetDoc(doc(db, "tenants", id), updated, { merge: true });
          
          // Cross-table update: Update drawerName in related cheques if it was matching the old name
          if (patch.nameEn || patch.nameAr) {
            setCheques((prevCheques) =>
              prevCheques.map((c) => {
                if (c.tenantId === id) {
                  const updatedCheque = { 
                    ...c, 
                    drawerName: language === "ar" ? (patch.nameAr || t.nameAr) : (patch.nameEn || t.nameEn)
                  };
                  safeSetDoc(doc(db, "cheques", c.id), updatedCheque, { merge: true });
                  return updatedCheque;
                }
                return c;
              })
            );
          }
          
          return updated;
        }
        return t;
      })
    );
    logAudit("UPDATE", "TENANT", id, "Tenant", "Updated tenant profile");

    if (patch.specialAdminFeeRate !== undefined && patch.specialAdminFeeRate !== tenant?.specialAdminFeeRate) {
      logAudit("UPDATE", "TENANT", id, tenant?.nameEn || "Tenant", `Updated Special Admin Fee Rate from ${tenant?.specialAdminFeeRate ?? "Default"}% to ${patch.specialAdminFeeRate}%`);
    }
    
    // Auto-recalculate risk if key fields change
    if (patch.emiratesId || patch.tradeLicenseNo || patch.phone) {
      setTimeout(() => recalculateTenantRisk(id), 200);
    }
  };

  const deleteTenant = (id: string, options?: DeleteRecordOptions) => {
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("TENANT", id);
      if (!check.canDelete) {
        logAudit("DELETE", "TENANT", id, tenant.nameEn, `Blocked deletion of tenant due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Tenant ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("TENANT", tenant, options);
    setTenants((prev) => prev.filter((t) => t.id !== id));
    deleteDoc(doc(db, "tenants", id)).catch(() => {});
  };

  const addLease = (data: Omit<Lease, "id" | "createdAt">): Lease => {
    const isAuthorized =
      !currentUser ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      currentUser.role === "PROPERTY_MANAGER" ||
      currentUser.role === "DATA_ENTRY" ||
      hasPermission("LEASES.CREATE") ||
      hasPermission("MANAGE_MASTER_DATA");

    if (!isAuthorized) {
      const msg = language === "ar" 
        ? "خطأ: ليس لديك صلاحية لإضافة أو تحرير العقود. هذه الصلاحية حصرية للمصرح لهم فقط."
        : "Error: You do not have permission to add or modify leases.";
      alert(msg);
      throw new Error(msg);
    }

    // AUTHORITATIVE UNIT OCCUPANCY VALIDATION & DUPLICATE LEASE PREVENTION
    if (data.unitId) {
      const validation = validateUnitAvailabilityForLease({
        unitId: data.unitId,
        units,
        leases,
        language: (language as any) || "ar",
      });

      if (!validation.isAvailable) {
        logAudit(
          "STATUS_CHANGE",
          "LEASE",
          "BLOCKED",
          data.leaseNumber || "NEW",
          `Blocked duplicate lease creation on unit ${data.unitId}: ${validation.blockReasonAr}`
        );
        addNotification({
          channel: "PORTAL",
          recipient: "الإدارة",
          recipientName: "System Integrity Watchdog",
          status: "SENT",
          content: `🚨 ${validation.blockReasonAr}`,
          sentAt: new Date().toISOString(),
        });
        const errMessage = language === "ar" ? validation.blockReasonAr : validation.blockReasonEn;
        alert(errMessage);
        throw new Error(errMessage);
      }

      if (validation.isIntegrityMismatch) {
        logAudit(
          "STATUS_CHANGE",
          "UNIT",
          data.unitId,
          "OCCUPANCY_MISMATCH_DETECTED",
          validation.mismatchDetails || "Unit status mismatch reconciled."
        );
      }
    }

    const newLease: Lease = {
      ...data,
      id: "lse-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      createdAt: new Date().toISOString(),
    };
    setLeases((prev) => [newLease, ...prev]);
    safeSetDoc(doc(db, "leases", newLease.id), newLease);

    // Process additional lease expenses if provided
    if (newLease.leaseExpenses && newLease.leaseExpenses.length > 0) {
      const nowIso = new Date().toISOString();
      const userId = currentUser?.id || "sys-01";
      const userName = currentUser?.nameAr || currentUser?.nameEn || "System Admin";

      newLease.leaseExpenses.forEach((exp, idx) => {
        const expRecord: PropertyExpenseRecord = {
          id: `exp-${Date.now()}-${idx}`,
          expenseNumber: `EXP-${new Date().getFullYear()}-${crypto.randomUUID().split("-")[0]}`,
          ownerId: newLease.ownerId,
          propertyId: newLease.propertyId,
          unitId: newLease.unitId,
          leaseId: newLease.id,
          tenantId: newLease.tenantId,
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          vatAmount: exp.vatAmount,
          totalAmount: exp.totalAmount,
          expenseDate: exp.dueDate,
          costBearer: exp.costBearer,
          status: "PENDING_PAYMENT",
          createdAt: nowIso,
          createdById: userId,
          createdByName: userName,
          notes: exp.notes,
          expenseLevel: "LEASE_LEVEL",
        };
        setPropertyExpenses((prev) => [expRecord, ...prev]);
        safeSetDoc(doc(db, "property_expenses", expRecord.id), expRecord);
      });
    }

    // If unit is assigned and lease status is occupying (ACTIVE, EXPIRED, RENEWED, etc.), mark unit as OCCUPIED
    const isActiveLease = isOccupyingLeaseStatus(newLease.contractStatus);
    if (newLease.unitId && isActiveLease) {
      setUnits((prevUnits) =>
        prevUnits.map((u) => {
          if (u.id === newLease.unitId) {
            const prevStat = u.status !== "OCCUPIED" ? u.status : (u.previousStatus || "VACANT");
            const updatedUnit: Unit = {
              ...u,
              previousStatus: prevStat,
              status: "OCCUPIED",
              currentTenantId: newLease.tenantId,
              currentLeaseId: newLease.id,
            };
            safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
            return updatedUnit;
          }
          return u;
        })
      );
    }

    logAudit("CREATE", "LEASE", newLease.id, newLease.leaseNumber, `Created lease contract ${newLease.leaseNumber}`);

    // Automated notification dispatch for new lease to tenant and owner
    setTimeout(() => {
      try {
        const tnt = tenants.find((t) => t.id === newLease.tenantId);
        const prop = properties.find((p) => p.id === newLease.propertyId);
        const own = owners.find((o) => o.id === (prop ? prop.ownerId : ""));
        const unt = units.find((u) => u.id === newLease.unitId);

        if ((tnt && tnt.email) || (own && own.email)) {
          fetch("/api/notifications/dispatch-lease", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: tnt?.email || own?.email || "",
              ownerEmail: own?.email,
              actionType: "CREATE",
              tenantNameAr: tnt?.nameAr || "المستأجر",
              tenantNameEn: tnt?.nameEn || "Tenant",
              ownerNameAr: own?.nameAr || "المالك",
              ownerNameEn: own?.nameEn || "Owner",
              leaseNumber: newLease.leaseNumber,
              propertyName: prop ? prop.nameAr : "N/A",
              unitNumber: unt ? unt.unitNumber : "N/A",
              startDate: newLease.startDate,
              endDate: newLease.endDate,
              rentAmount: newLease.annualRent,
              paymentFrequency: newLease.paymentFrequency,
            }),
          }).catch((err) => console.error("Auto lease email failed:", err));
        }
      } catch (err) {
        console.error("Auto lease notification error:", err);
      }
    }, 100);

    return newLease;
  };

  const updateLease = (id: string, patch: Partial<Lease>) => {
    const isAuthorized =
      !currentUser ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      currentUser.role === "PROPERTY_MANAGER" ||
      currentUser.role === "DATA_ENTRY" ||
      hasPermission("LEASES.CREATE") ||
      hasPermission("LEASES.RENEW") ||
      hasPermission("LEASES.EDIT" as any) ||
      hasPermission("MANAGE_MASTER_DATA");

    if (!isAuthorized) {
      const msg = language === "ar" 
        ? "خطأ: ليس لديك صلاحية لتعديل العقود. هذه الصلاحية حصرية للمصرح لهم فقط."
        : "Error: You do not have permission to modify leases.";
      alert(msg);
      throw new Error(msg);
    }

    const lease = leases.find((l) => l.id === id);
    if (lease) {
      saveEntitySnapshot("LEASE", lease, "VERSION");
    }

    // VALIDATE UNIT CHANGE IF ASSIGNING TO A NEW UNIT
    if (patch.unitId && lease && patch.unitId !== lease.unitId) {
      const validation = validateUnitAvailabilityForLease({
        unitId: patch.unitId,
        targetLeaseId: id,
        units,
        leases,
        language: (language as any) || "ar",
      });

      if (!validation.isAvailable) {
        const errMessage = language === "ar" ? validation.blockReasonAr : validation.blockReasonEn;
        alert(errMessage);
        throw new Error(errMessage);
      }
    }

    let oldLease: Lease | undefined;
    let updatedLeaseList: Lease[] = [];

    setLeases((prev) => {
      const next = prev.map((l) => {
        if (l.id === id) {
          oldLease = l;
          const updated = { ...l, ...patch };
          safeSetDoc(doc(db, "leases", id), updated, { merge: true });
          return updated;
        }
        return l;
      });
      updatedLeaseList = next;
      return next;
    });

    // Synchronize unit occupancy status
    if (oldLease) {
      const newUnitId = patch.unitId !== undefined ? patch.unitId : oldLease.unitId;
      const newTenantId = patch.tenantId !== undefined ? patch.tenantId : oldLease.tenantId;
      const newStatus = patch.contractStatus !== undefined ? patch.contractStatus : oldLease.contractStatus;
      const unitChanged = patch.unitId !== undefined && patch.unitId !== oldLease.unitId;

      setUnits((prevUnits) =>
        prevUnits.map((u) => {
          // 1. If unit changed, release the previous unit to its original status (VACANT or MAINTENANCE) if no other occupying lease exists
          if (unitChanged && u.id === oldLease!.unitId) {
            // Check if another occupying lease exists on the old unit
            const otherActiveLease = updatedLeaseList.find(
              (l) => l.id !== id && l.unitId === oldLease!.unitId && isOccupyingLeaseStatus(l.contractStatus)
            );

            if (otherActiveLease) {
              const updatedUnit: Unit = {
                ...u,
                status: "OCCUPIED",
                currentTenantId: otherActiveLease.tenantId,
                currentLeaseId: otherActiveLease.id,
              };
              safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
              return updatedUnit;
            } else {
              const revertedStatus = u.previousStatus && u.previousStatus !== "OCCUPIED" ? u.previousStatus : "VACANT";
              const updatedUnit: Unit = {
                ...u,
                status: revertedStatus,
                currentTenantId: deleteField() as any,
                currentLeaseId: deleteField() as any,
              };
              safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
              return updatedUnit;
            }
          }

          // 2. Update current / target unit
          if (u.id === newUnitId) {
            if (!isOccupyingLeaseStatus(newStatus)) {
              // Status is TERMINATED or CANCELLED -> Release unit unless another occupying lease exists
              const otherActiveLease = updatedLeaseList.find(
                (l) => l.id !== id && l.unitId === newUnitId && isOccupyingLeaseStatus(l.contractStatus)
              );

              if (otherActiveLease) {
                const updatedUnit: Unit = {
                  ...u,
                  status: "OCCUPIED",
                  currentTenantId: otherActiveLease.tenantId,
                  currentLeaseId: otherActiveLease.id,
                };
                safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
                return updatedUnit;
              } else {
                const revertedStatus = u.previousStatus && u.previousStatus !== "OCCUPIED" ? u.previousStatus : "VACANT";
                const updatedUnit: Unit = {
                  ...u,
                  status: revertedStatus,
                  currentTenantId: deleteField() as any,
                  currentLeaseId: deleteField() as any,
                };
                safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
                return updatedUnit;
              }
            } else {
              // Status is ACTIVE, RENEWED, UNDER_RENEWAL, EXPIRED, etc. -> Unit remains/becomes OCCUPIED
              const prevStat = u.status !== "OCCUPIED" ? u.status : (u.previousStatus || "VACANT");
              const updatedUnit: Unit = {
                ...u,
                previousStatus: prevStat,
                status: "OCCUPIED",
                currentTenantId: newTenantId,
                currentLeaseId: id,
              };
              safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
              return updatedUnit;
            }
          }

          return u;
        })
      );
    }

    logAudit("UPDATE", "LEASE", id, "Lease", "Updated lease details");
  };

  const deleteLease = (id: string, options?: DeleteRecordOptions) => {
    const isAuthorized =
      !currentUser ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      hasPermission("DELETE_RECORDS") ||
      hasPermission("MANAGE_MASTER_DATA");

    if (!isAuthorized) {
      const msg = language === "ar" 
        ? "خطأ: ليس لديك صلاحية لحذف العقود."
        : "Error: You do not have permission to delete leases.";
      alert(msg);
      throw new Error(msg);
    }

    const lease = leases.find((l) => l.id === id);
    if (!lease) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("LEASE", id);
      if (!check.canDelete) {
        logAudit("DELETE", "LEASE", id, lease.leaseNumber, `Blocked deletion of lease contract due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Lease ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("LEASE", lease, options);
    const remainingLeases = leases.filter((l) => l.id !== id);
    setLeases(remainingLeases);
    deleteDoc(doc(db, "leases", id)).catch(() => {});

    if (lease) {
      if (lease.unitId) {
        setUnits((prevUnits) =>
          prevUnits.map((u) => {
            if (u.id === lease.unitId) {
              // Check if any other occupying lease exists on this unit
              const otherActiveLease = remainingLeases.find(
                (l) => l.unitId === lease.unitId && isOccupyingLeaseStatus(l.contractStatus)
              );

              if (otherActiveLease) {
                const updatedUnit: Unit = {
                  ...u,
                  status: "OCCUPIED",
                  currentTenantId: otherActiveLease.tenantId,
                  currentLeaseId: otherActiveLease.id,
                };
                safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
                return updatedUnit;
              } else {
                const revertedStatus = u.previousStatus && u.previousStatus !== "OCCUPIED" ? u.previousStatus : "VACANT";
                const updatedUnit: Unit = {
                  ...u,
                  status: revertedStatus,
                  currentTenantId: deleteField() as any,
                  currentLeaseId: deleteField() as any,
                };
                safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
                return updatedUnit;
              }
            }
            return u;
          })
        );
      }
    }
  };

  const renewLease = (leaseId: string, newEndDate: string, annualRent: number, overrideReason?: string) => {
    const isAuthorized =
      !currentUser ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      currentUser.role === "PROPERTY_MANAGER" ||
      hasPermission("LEASES.RENEW") ||
      hasPermission("LEASES.CREATE") ||
      hasPermission("MANAGE_MASTER_DATA");

    if (!isAuthorized) {
      const msg = language === "ar" 
        ? "خطأ: ليس لديك صلاحية لتجديد العقود."
        : "Error: You do not have permission to renew leases.";
      alert(msg);
      throw new Error(msg);
    }

    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) return;

    const tenant = tenants.find((t) => t.id === lease.tenantId);
    const isHighRisk = tenant && tenant.riskLevel === "HIGH";

    const updated = {
      ...lease,
      endDate: newEndDate,
      annualRent,
      contractStatus: "RENEWED" as const,
      riskOverrideReason: isHighRisk ? overrideReason : (deleteField() as any),
      riskOverriddenBy: isHighRisk ? currentUser?.nameEn : (deleteField() as any),
    };

    setLeases((prev) => prev.map((l) => (l.id === leaseId ? updated : l)));
    safeSetDoc(doc(db, "leases", leaseId), updated, { merge: true });

    if (lease.unitId) {
      setUnits((prevUnits) =>
        prevUnits.map((u) => {
          if (u.id === lease.unitId) {
            const updatedUnit: Unit = {
              ...u,
              status: "OCCUPIED",
              currentTenantId: lease.tenantId,
              currentLeaseId: leaseId,
            };
            safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
            return updatedUnit;
          }
          return u;
        })
      );
    }

    if (isHighRisk && overrideReason) {
      logAudit(
        "RISK_OVERRIDE",
        "LEASE",
        leaseId,
        lease.leaseNumber,
        `Approved renewal for HIGH RISK tenant ${tenant?.nameEn}. Justification: ${overrideReason}`,
        "HIGH_RISK_WARNING",
        "RENEWED_WITH_OVERRIDE"
      );
    } else {
      logAudit("UPDATE", "LEASE", leaseId, lease.leaseNumber, `Renewed lease contract until ${newEndDate}`);
    }

    // Automated notification dispatch for renewed lease to tenant and owner
    setTimeout(() => {
      try {
        const tnt = tenants.find((t) => t.id === lease.tenantId);
        const prop = properties.find((p) => p.id === lease.propertyId);
        const own = owners.find((o) => o.id === (prop ? prop.ownerId : ""));
        const unt = units.find((u) => u.id === lease.unitId);

        if ((tnt && tnt.email) || (own && own.email)) {
          fetch("/api/notifications/dispatch-lease", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: tnt?.email || own?.email || "",
              ownerEmail: own?.email,
              actionType: "RENEW",
              tenantNameAr: tnt?.nameAr || "المستأجر",
              tenantNameEn: tnt?.nameEn || "Tenant",
              ownerNameAr: own?.nameAr || "المالك",
              ownerNameEn: own?.nameEn || "Owner",
              leaseNumber: lease.leaseNumber,
              propertyName: prop ? prop.nameAr : "N/A",
              unitNumber: unt ? unt.unitNumber : "N/A",
              startDate: lease.startDate,
              endDate: newEndDate,
              rentAmount: annualRent,
              paymentFrequency: lease.paymentFrequency,
            }),
          }).catch((err) => console.error("Auto lease renewal email failed:", err));
        }
      } catch (err) {
        console.error("Auto lease renewal notification error:", err);
      }
    }, 100);
  };

  // -------------------------------------------------------------
  // PHASE 45: Integrated Lease Renewal Engine & Workflow
  // -------------------------------------------------------------

  const createLeaseRenewal = (
    data: Omit<LeaseRenewalRecord, "id" | "renewalNumber" | "createdAt" | "createdById" | "createdByName" | "status">
  ): { success: boolean; renewal?: LeaseRenewalRecord; error?: string } => {
    // 1. Mandatory check: Expected Due Date for Deferred payment methods
    const hasDeferredWithoutDate = (data.paymentSchedule || []).some(
      (item) => item.paymentMethod === "DEFERRED" && (!item.deferredDetails?.expectedDueDate || item.deferredDetails.expectedDueDate.trim() === "")
    );
    if (hasDeferredWithoutDate) {
      return {
        success: false,
        error: language === "ar" ? "تاريخ الاستحقاق المتوقع إلزامي لجميع الدفعات المؤجلة (Deferred)" : "Expected Due Date is mandatory for all Deferred payments",
      };
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام";

    const newRenewal: LeaseRenewalRecord = {
      ...data,
      id: "rnw-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      renewalNumber: generateSequentialNumber(leaseRenewals, "renewalNumber", "RNW-"),
      status: "PENDING_APPROVAL",
      createdById: userId,
      createdByName: userName,
      createdAt: nowIso,
    };

    // Update original lease status to UNDER_RENEWAL
    setLeases((prev) =>
      prev.map((l) => {
        if (l.id === data.originalLeaseId && l.contractStatus !== "RENEWED") {
          const updatedLease = { ...l, contractStatus: "UNDER_RENEWAL" as const };
          safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });
          return updatedLease;
        }
        return l;
      })
    );

    setLeaseRenewals((prev) => [newRenewal, ...prev]);
    safeSetDoc(doc(db, "lease_renewals", newRenewal.id), newRenewal);

    logAudit(
      "CREATE",
      "LEASE",
      newRenewal.id,
      `طلب تجديد عقد #${newRenewal.renewalNumber}`,
      `تم إنشاء طلب تجديد لعقد الإيجار #${newRenewal.originalLeaseNumber} بإيجار جديد ${newRenewal.newAnnualRent.toLocaleString()} درهم (نسبة الزيادة: ${(newRenewal.increasePercentage || 0).toFixed(2)}%) وحالته قيد الاعتماد.`
    );

    // Operational notification for management
    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: "PORTAL" as any,
      recipient: "الإدارة المالية والعقارية",
      recipientName: "مدير النظام",
      type: "OTHER" as any,
      status: "SENT",
      sentAt: nowIso,
      content: `طلب تجديد عقد جديد #${newRenewal.renewalNumber} بانتظار المراجعة والاعتماد. (المستأجر: ${newRenewal.tenantNameAr || newRenewal.tenantNameEn})`,
      createdAt: nowIso,
    };
    setNotifications((prev) => [notif, ...prev]);

    return { success: true, renewal: newRenewal };
  };

  const updateLeaseRenewal = (
    id: string,
    patch: Partial<LeaseRenewalRecord>,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const target = leaseRenewals.find((r) => r.id === id);
    if (!target) return { success: false, error: "Renewal record not found" };

    if (target.status === "APPROVED") {
      const checkPerm = checkFinancialEditPermission("LEASE", modificationReason);
      if (!checkPerm.allowed) {
        return { success: false, error: checkPerm.error };
      }
    }

    const updated: LeaseRenewalRecord = {
      ...target,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setLeaseRenewals((prev) => prev.map((r) => (r.id === id ? updated : r)));
    safeSetDoc(doc(db, "lease_renewals", id), updated, { merge: true });

    logAudit(
      "UPDATE",
      "LEASE",
      id,
      `تحديث طلب تجديد #${target.renewalNumber}`,
      `تم تعديل بيانات طلب التجديد #${target.renewalNumber}. الأسباب: ${modificationReason || "تحديث البيانات"}`,
      JSON.stringify(target),
      JSON.stringify(updated),
      modificationReason
    );

    return { success: true };
  };

  const approveLeaseRenewal = (
    id: string,
    reviewNotes?: string
  ): { success: boolean; renewal?: LeaseRenewalRecord; newLease?: Lease; error?: string } => {
    const isAuthorized =
      !currentUser ||
      currentUser?.role === "SYSTEM_OWNER" ||
      currentUser?.role === "SUPER_ADMIN" ||
      currentUser?.role === "MANAGER" ||
      hasPermission("EDIT_SAVED_FINANCIAL_RECORDS") ||
      hasPermission("MANAGE_MASTER_DATA");

    if (!isAuthorized) {
      return {
        success: false,
        error: language === "ar" ? "غير مصرح لك باعتماد تجديد العقود. الصلاحية مقتصرة على الإدارة." : "Unauthorized to approve lease renewals.",
      };
    }

    const renewal = leaseRenewals.find((r) => r.id === id);
    if (!renewal) return { success: false, error: "Renewal record not found" };
    if (renewal.status === "APPROVED") return { success: false, error: "Renewal is already approved" };

    const originalLease = leases.find((l) => l.id === renewal.originalLeaseId);
    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    // 1. Build installments for the new lease
    const generatedInstallments = (renewal.paymentSchedule || []).map((item, idx) => ({
      installmentNumber: idx + 1,
      amount: item.amount,
      dueDate: item.dueDate,
      paymentMethod: item.paymentMethod as any,
      status: item.isAdvance ? ("COLLECTED" as const) : ("PENDING" as const),
      notes: item.notes,
    }));

    // 2. Create the renewed Lease
    const newLeaseId = "lse-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const newLeaseNumber = generateSequentialNumber(leases, "leaseNumber", "EFR-CON-", 4, false);

    const depositAmount = renewal.securityDeposit || originalLease?.securityDeposit || 0;
    const hasOriginalDeposit = Boolean(originalLease && (originalLease.securityDeposit || 0) > 0);

    const createdLease: Lease = {
      id: newLeaseId,
      leaseNumber: newLeaseNumber,
      ownerId: renewal.ownerId,
      propertyId: renewal.propertyId,
      unitId: renewal.unitId,
      tenantId: renewal.tenantId,
      startDate: renewal.newStartDate,
      endDate: renewal.newEndDate,
      annualRent: renewal.newAnnualRent,
      installmentsCount: renewal.installmentsCount,
      chequesCount: (renewal.paymentSchedule || []).filter((p) => p.paymentMethod === "CHEQUE").length,
      paymentFrequency: renewal.paymentFrequency,
      securityDeposit: depositAmount,
      contractStatus: "ACTIVE",
      ejariNumber: renewal.ejariNumber || originalLease?.ejariNumber,
      installments: generatedInstallments,
      createdAt: nowIso,
      // Security Deposit Renewal Carry-Forward Governance
      carriedForwardFromLeaseId: hasOriginalDeposit ? originalLease?.id : undefined,
      securityDepositStatus: hasOriginalDeposit ? "HELD" : (depositAmount > 0 ? "PENDING" : undefined),
      securityDepositReceiptNumber: originalLease?.securityDepositReceiptNumber,
      securityDepositPaymentMethod: originalLease?.securityDepositPaymentMethod,
      securityDepositBankName: originalLease?.securityDepositBankName,
      securityDepositChequeNumber: originalLease?.securityDepositChequeNumber,
      securityDepositChequeDate: originalLease?.securityDepositChequeDate,
      securityDepositIsUndatedCheque: originalLease?.securityDepositIsUndatedCheque,
      securityDepositCollectedDate: originalLease?.securityDepositCollectedDate,
      securityDepositProofDocId: originalLease?.securityDepositProofDocId,
      securityDepositVerificationStatus: originalLease?.securityDepositVerificationStatus,
      securityDepositHistory: hasOriginalDeposit ? [
        ...(originalLease?.securityDepositHistory || []),
        {
          id: `sd-hist-${Date.now()}`,
          date: nowIso,
          action: "CARRIED_FORWARD" as const,
          amount: depositAmount,
          fromLeaseId: originalLease?.id,
          toLeaseId: newLeaseId,
          performedBy: userName,
          notes: "تنبيه: يتم ترحيل رصيد التأمين المحتجز من العقد الأصلي دون إنشاء قيد مالي مكرر أو مطالبة المستأجر بدفع تأمين إضافي.",
        }
      ] : [],
    };

    // Add the new lease and mark original lease as RENEWED with carried forward deposit
    const updatedOriginalLease = originalLease ? {
      ...originalLease,
      contractStatus: "RENEWED" as const,
      carriedForwardToLeaseId: newLeaseId,
      securityDepositStatus: (originalLease.securityDeposit || 0) > 0 ? ("CARRIED_FORWARD" as const) : originalLease.securityDepositStatus,
    } : null;

    if (originalLease && (originalLease.securityDeposit || 0) !== depositAmount) {
      const diff = depositAmount - (originalLease.securityDeposit || 0);
      recordFinancialAdjustment({
        targetEntityType: "LEASE",
        targetEntityId: newLeaseId,
        adjustmentType: diff > 0 ? "DEBIT" : "CREDIT",
        amount: Math.abs(diff),
        reason: `تعديل قيمة تأمين الصيانة عند تجديد العقد. القيمة الأصلية: ${originalLease.securityDeposit || 0}، القيمة الجديدة: ${depositAmount}`,
        approvedByUserId: userId,
        approvedByUserName: userName,
        effectiveDate: nowIso.split("T")[0]
      });
    }

    setLeases((prev) => [
      createdLease,
      ...prev.map((l) => (l.id === renewal.originalLeaseId && updatedOriginalLease ? updatedOriginalLease : l)),
    ]);
    safeSetDoc(doc(db, "leases", createdLease.id), sanitizeForFirestore(createdLease));
    if (updatedOriginalLease) {
      safeSetDoc(doc(db, "leases", updatedOriginalLease.id), sanitizeForFirestore(updatedOriginalLease), { merge: true });
    }

    // Ensure unit remains OCCUPIED with the new active lease
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === renewal.unitId) {
          const updatedUnit = {
            ...u,
            status: "OCCUPIED" as const,
            currentTenantId: renewal.tenantId,
            currentLeaseId: createdLease.id,
          };
          safeSetDoc(doc(db, "units", u.id), updatedUnit, { merge: true });
          return updatedUnit;
        }
        return u;
      })
    );

    // 3. Generate Cheques, Deferred Records & Advance Payments
    const createdCheques: Cheque[] = [];
    const createdDeferred: DeferredPaymentRecord[] = [];
    const createdReceipts: CollectionRecord[] = [];
    const createdExpenses: PropertyExpenseRecord[] = [];

    (renewal.paymentSchedule || []).forEach((item, idx) => {
      if (item.paymentMethod === "CHEQUE" && item.chequeDetails) {
        const chq: Cheque = {
          id: "chq-" + Date.now() + "-" + idx,
          chequeNumber: item.chequeDetails.chequeNumber || `CHQ-${crypto.randomUUID().split("-")[0]}`,
          bankName: item.chequeDetails.bankName || "UAE Bank",
          amount: item.amount,
          chequeDate: item.chequeDetails.chequeDate || item.dueDate,
          dueDate: item.chequeDetails.dueDate || item.dueDate,
          ownerId: renewal.ownerId,
          tenantId: renewal.tenantId,
          propertyId: renewal.propertyId,
          unitId: renewal.unitId,
          leaseId: createdLease.id,
          status: "POST_DATED",
          originalStatus: "NORMAL",
          collectionStatus: "NOT_COLLECTED",
          totalApplied: 0,
          outstanding: item.amount,
          drawerName: item.chequeDetails.drawerName,
          accountNumber: item.chequeDetails.accountNumber,
          whatsAppStatus: "NONE",
          reminderCount: 0,
          notes: `شيك تجديد عقد #${newLeaseNumber}`,
          createdAt: nowIso,
        };
        createdCheques.push(chq);
        safeSetDoc(doc(db, "cheques", chq.id), chq);
      } else if (item.paymentMethod === "DEFERRED" && item.deferredDetails) {
        const def: DeferredPaymentRecord = {
          id: "def-" + Date.now() + "-" + idx,
          deferredNumber: generateSequentialNumber([...deferredPayments, ...createdDeferred], "deferredNumber", "DEF-", 4, false),
          leaseId: createdLease.id,
          leaseNumber: newLeaseNumber,
          renewalId: renewal.id,
          tenantId: renewal.tenantId,
          tenantName: renewal.tenantNameAr || renewal.tenantNameEn,
          ownerId: renewal.ownerId,
          ownerName: renewal.ownerNameAr || renewal.ownerNameEn,
          propertyId: renewal.propertyId,
          propertyName: renewal.propertyNameAr || renewal.propertyNameEn,
          unitId: renewal.unitId,
          unitNumber: renewal.unitNumber,
          deferredAmount: item.amount,
          collectedAmount: 0,
          outstandingAmount: item.amount,
          expectedDueDate: item.deferredDetails.expectedDueDate,
          deferralReason: item.deferredDetails.deferralReason || "دفعة مؤجلة عند تجديد العقد",
          responsiblePerson: item.deferredDetails.responsiblePerson || userName,
          responsibleUserId: item.deferredDetails.responsibleUserId || userId,
          followUpDate: item.deferredDetails.followUpDate || item.deferredDetails.expectedDueDate,
          allowedDays: item.deferredDetails.allowedDays || 30,
          status: "PENDING",
          createdById: userId,
          createdByName: userName,
          createdAt: nowIso,
          notes: item.notes,
        };
        createdDeferred.push(def);
        safeSetDoc(doc(db, "deferred_payments", def.id), def);
      } else if (item.isAdvance && item.advanceDetails) {
        const colReceipt: CollectionRecord = {
          id: "col-" + Date.now() + "-" + idx,
          receiptNumber: generateSequentialNumber([...collections, ...createdReceipts], "receiptNumber", "RCP-", 4, false),
          tenantId: renewal.tenantId,
          ownerId: renewal.ownerId,
          paymentDate: item.advanceDetails.paidDate || new Date().toISOString().split("T")[0],
          amountEntered: item.amount,
          amountApplied: item.amount,
          paymentMethod: item.advanceDetails.paymentMethod,
          transactionReference: item.advanceDetails.transactionReference,
          payerName: renewal.tenantNameAr || renewal.tenantNameEn || "Tenant",
          collectedBy: userName,
          collectedByUserId: userId,
          notes: `دفعة مقدمة عند تجديد العقد #${newLeaseNumber}`,
          createdAt: nowIso,
        };
        createdReceipts.push(colReceipt);
        setCollections((prev) => [colReceipt, ...prev]);
        safeSetDoc(doc(db, "collections", colReceipt.id), colReceipt);
      }
    });

    // 5. Send Tenant Notification
    const tenantObj = tenants.find((t) => t.id === renewal.tenantId);
    const notifContent = `عزيزي المستأجر ${tenantObj?.nameAr || renewal.tenantNameAr || ""}\nتم اعتماد تجديد عقد الإيجار الخاص بكم بنجاح.\nرقم العقد الجديد: ${newLeaseNumber}\nالفترة: من ${renewal.newStartDate} إلى ${renewal.newEndDate}\nقيمة الإيجار السنوي: ${Number(renewal.newAnnualRent || 0).toLocaleString()} درهم\nعدد الدفعات: ${renewal.installmentsCount}\nشكراً لتعاملكم مع شركة صقر الإمارات للعقارات.`;

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: "WHATSAPP",
      recipient: tenantObj?.phone || "+971500000000",
      recipientName: tenantObj?.nameAr || renewal.tenantNameAr || "Tenant",
      tenantId: renewal.tenantId,
      type: "OTHER",
      status: "SENT",
      sentAt: nowIso,
      content: notifContent,
      createdAt: nowIso,
    };
    setNotifications((prev) => [notif, ...prev]);

    logAudit(
      "UPDATE",
      "LEASE",
      createdLease.id,
      `اعتماد تجديد عقد #${newLeaseNumber}`,
      `تم اعتماد طلب التجديد #${renewal.renewalNumber} وتفعيل العقد الجديد #${newLeaseNumber} بإيجار ${Number(renewal.newAnnualRent || 0).toLocaleString()} AED من قبل ${userName}.`
    );

    // Record optional commission/admin fees from renewal record
    if (renewal.includeAdminFees) {
      const currentCommissionYear = new Date(renewal.newStartDate).getFullYear().toString();
      
      if (renewal.ownerFeeEnabled) {
        const ownerFeeAmount = renewal.ownerFeeBasis === "PERCENTAGE_OF_RENT"
          ? Math.round((renewal.newAnnualRent * Number(renewal.ownerFeeRate || 0)) / 100)
          : Number(renewal.ownerFeeFixed || 0);

        if (ownerFeeAmount > 0) {
          const ownerRes = addCommissionObligation({
            leaseId: createdLease.id,
            businessKeySequence: "RENEWAL_OWNER",
            ownerId: renewal.ownerId,
            propertyId: renewal.propertyId,
            unitId: renewal.unitId,
            partyType: "OWNER",
            commissionType: "ADMIN_FEE",
            calculationBasis: renewal.ownerFeeBasis || "PERCENTAGE_OF_RENT",
            baseAmount: renewal.newAnnualRent,
            ratePercentage: renewal.ownerFeeBasis === "PERCENTAGE_OF_RENT" ? Number(renewal.ownerFeeRate) : undefined,
            fixedAmount: renewal.ownerFeeBasis === "FIXED_AMOUNT" ? Number(renewal.ownerFeeFixed) : undefined,
            totalCommissionAmount: ownerFeeAmount,
            dueDate: renewal.ownerFeeDueDate || renewal.newStartDate,
            notes: language === "ar"
              ? `الرسوم الإدارية السنوية للمكتب من المالك لتجديد عقد ${currentCommissionYear}`
              : `Annual Administrative Renewal Fees for Owner for ${currentCommissionYear}`,
            contractualCommissionYear: currentCommissionYear,
            renewalSequence: 2,
            isOverride: false,
            createdById: userId,
            createdByName: userName,
          });

          // Immediate Collection if specified on renewal
          if (ownerRes.success && ownerRes.commission && renewal.ownerFeeImmediateCollection) {
            collectAdministrativeFee(
              ownerRes.commission.id,
              renewal.ownerFeeCollectionAmount || ownerFeeAmount,
              renewal.ownerFeePaymentMethod || "BANK_TRANSFER",
              renewal.ownerFeeReference,
              renewal.ownerFeeNotes || (language === "ar" ? `تحصيل رسوم إدارية فورية للمالك عند تجديد العقد #${newLeaseNumber}` : `Immediate admin fee collection on renewal #${newLeaseNumber}`)
            );
          }
        }
      }

      if (renewal.tenantFeeEnabled) {
        const tenantFeeAmount = renewal.tenantFeeBasis === "PERCENTAGE_OF_RENT"
          ? Math.round((renewal.newAnnualRent * Number(renewal.tenantFeeRate || 0)) / 100)
          : Number(renewal.tenantFeeFixed || 0);

        if (tenantFeeAmount > 0) {
          const tenantRes = addCommissionObligation({
            leaseId: createdLease.id,
            businessKeySequence: "RENEWAL_TENANT",
            tenantId: renewal.tenantId,
            propertyId: renewal.propertyId,
            unitId: renewal.unitId,
            partyType: "TENANT",
            commissionType: "ADMIN_FEE",
            calculationBasis: renewal.tenantFeeBasis || "PERCENTAGE_OF_RENT",
            baseAmount: renewal.newAnnualRent,
            ratePercentage: renewal.tenantFeeBasis === "PERCENTAGE_OF_RENT" ? Number(renewal.tenantFeeRate) : undefined,
            fixedAmount: renewal.tenantFeeBasis === "FIXED_AMOUNT" ? Number(renewal.tenantFeeFixed) : undefined,
            totalCommissionAmount: tenantFeeAmount,
            dueDate: renewal.tenantFeeDueDate || renewal.newStartDate,
            notes: language === "ar"
              ? `الرسوم الإدارية السنوية للمكتب من المستأجر لتجديد عقد ${currentCommissionYear}`
              : `Annual Administrative Renewal Fees for Tenant for ${currentCommissionYear}`,
            contractualCommissionYear: currentCommissionYear,
            renewalSequence: 2,
            isOverride: false,
            createdById: userId,
            createdByName: userName,
          });

          // Immediate Collection if specified on renewal
          if (tenantRes.success && tenantRes.commission && renewal.tenantFeeImmediateCollection) {
            collectAdministrativeFee(
              tenantRes.commission.id,
              renewal.tenantFeeCollectionAmount || tenantFeeAmount,
              renewal.tenantFeePaymentMethod || "BANK_TRANSFER",
              renewal.tenantFeeReference,
              renewal.tenantFeeNotes || (language === "ar" ? `تحصيل رسوم إدارية فورية للمستأجر عند تجديد العقد #${newLeaseNumber}` : `Immediate admin fee collection on renewal #${newLeaseNumber}`)
            );
          }
        }
      }
    }

    // 6. Record Additional Lease Expenses
    if (renewal.leaseExpenses && renewal.leaseExpenses.length > 0) {
      renewal.leaseExpenses.forEach((exp, idx) => {
        const expRecord: PropertyExpenseRecord = {
          id: `exp-${Date.now()}-${idx}`,
          expenseNumber: generateSequentialNumber([...propertyExpenses, ...createdExpenses], "expenseNumber", "EXP-", 4, false),
          ownerId: renewal.ownerId,
          propertyId: renewal.propertyId,
          unitId: renewal.unitId,
          leaseId: createdLease.id,
          tenantId: renewal.tenantId,
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          vatAmount: exp.vatAmount,
          totalAmount: exp.totalAmount,
          expenseDate: exp.dueDate,
          costBearer: exp.costBearer,
          status: "PENDING_PAYMENT",
          createdAt: nowIso,
          createdById: userId,
          createdByName: userName,
          notes: exp.notes,
          expenseLevel: "LEASE_LEVEL",
        };
        createdExpenses.push(expRecord);
        setPropertyExpenses((prev) => [expRecord, ...prev]);
        safeSetDoc(doc(db, "property_expenses", expRecord.id), expRecord);
      });
    }

    const updatedRenewal: LeaseRenewalRecord = {
      ...renewal,
      status: "APPROVED",
      newLeaseId: createdLease.id,
      newLeaseNumber: createdLease.leaseNumber,
      approvedById: userId,
      approvedByName: userName,
      approvedAt: nowIso,
      updatedAt: nowIso,
    };

    setLeaseRenewals((prev) => prev.map((r) => (r.id === renewal.id ? updatedRenewal : r)));
    safeSetDoc(doc(db, "lease_renewals", renewal.id), updatedRenewal, { merge: true });

    return { success: true, renewal: updatedRenewal, newLease: createdLease };
  };

  const rejectLeaseRenewal = (
    id: string,
    rejectionReason: string
  ): { success: boolean; error?: string } => {
    const target = leaseRenewals.find((r) => r.id === id);
    if (!target) return { success: false, error: "Renewal record not found" };

    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام";
    const nowIso = new Date().toISOString();

    const updated: LeaseRenewalRecord = {
      ...target,
      status: "REJECTED",
      rejectionReason: rejectionReason || "تم الرفض من قبل الإدارة",
      reviewedById: userId,
      reviewedByName: userName,
      reviewedAt: nowIso,
      updatedAt: nowIso,
    };

    // Revert original lease status back to ACTIVE if it was UNDER_RENEWAL
    setLeases((prev) =>
      prev.map((l) => {
        if (l.id === target.originalLeaseId && l.contractStatus === "UNDER_RENEWAL") {
          const revertedLease = { ...l, contractStatus: "ACTIVE" as const };
          safeSetDoc(doc(db, "leases", l.id), revertedLease, { merge: true });
          return revertedLease;
        }
        return l;
      })
    );

    setLeaseRenewals((prev) => prev.map((r) => (r.id === id ? updated : r)));
    safeSetDoc(doc(db, "lease_renewals", id), updated, { merge: true });

    logAudit(
      "UPDATE",
      "LEASE",
      id,
      `رفض طلب تجديد #${target.renewalNumber}`,
      `تم رفض طلب التجديد #${target.renewalNumber}. السبب: ${rejectionReason}`
    );

    return { success: true };
  };

  const recordDeferredPayment = (
    data: Omit<DeferredPaymentRecord, "id" | "deferredNumber" | "collectedAmount" | "outstandingAmount" | "status" | "createdAt" | "createdById" | "createdByName">
  ): { success: boolean; deferred?: DeferredPaymentRecord; error?: string } => {
    if (!data.expectedDueDate || data.expectedDueDate.trim() === "") {
      return {
        success: false,
        error: language === "ar" ? "تاريخ الاستحقاق المتوقع إلزامي للدفعات المؤجلة" : "Expected Due Date is mandatory for Deferred payments",
      };
    }

    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام";
    const nowIso = new Date().toISOString();

    const newDef: DeferredPaymentRecord = {
      ...data,
      id: "def-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      deferredNumber: generateSequentialNumber(deferredPayments, "deferredNumber", "DEF-"),
      collectedAmount: 0,
      outstandingAmount: data.deferredAmount,
      status: "PENDING",
      createdById: userId,
      createdByName: userName,
      createdAt: nowIso,
    };

    setDeferredPayments((prev) => [newDef, ...prev]);
    safeSetDoc(doc(db, "deferred_payments", newDef.id), newDef);

    logAudit(
      "CREATE",
      "LEASE",
      newDef.id,
      `تسجيل دفعة مؤجلة #${newDef.deferredNumber}`,
      `تم تسجيل دفعة مؤجلة بمبلغ ${newDef.deferredAmount.toLocaleString()} AED للمستأجر ${newDef.tenantName} تستحق بتاريخ ${newDef.expectedDueDate}.`
    );

    return { success: true, deferred: newDef };
  };

  const collectDeferredPayment = async (params: {
    deferredId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    notes?: string;
  }): Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }> => {
    const target = deferredPayments.find((d) => d.id === params.deferredId);
    if (!target) return { success: false, error: "Deferred payment not found" };
    if (target.status === "COLLECTED") return { success: false, error: "Deferred payment is already collected" };

    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مسؤول التحصيل";
    const nowIso = new Date().toISOString();

    const newCollected = target.collectedAmount + params.amount;
    const newOutstanding = Math.max(0, target.deferredAmount - newCollected);
    const isFullyCollected = newOutstanding <= 0.01;

    // Create real financial receipt
    const receipt: CollectionRecord = {
      id: "col-" + Date.now(),
      receiptNumber: generateSequentialNumber(collections, "receiptNumber", "RCP-"),
      tenantId: target.tenantId,
      ownerId: target.ownerId,
      paymentDate: new Date().toISOString().split("T")[0],
      amountEntered: params.amount,
      amountApplied: params.amount,
      paymentMethod: params.paymentMethod,
      transactionReference: params.transactionReference,
      payerName: target.tenantName || "Tenant",
      collectedBy: userName,
      collectedByUserId: userId,
      notes: params.notes || `تحصيل دفعة مؤجلة #${target.deferredNumber}`,
      createdAt: nowIso,
    };

    setCollections((prev) => [receipt, ...prev]);
    safeSetDoc(doc(db, "collections", receipt.id), receipt);

    const updatedDef: DeferredPaymentRecord = {
      ...target,
      collectedAmount: newCollected,
      outstandingAmount: newOutstanding,
      status: isFullyCollected ? "COLLECTED" : "PENDING",
      collectionReceiptId: receipt.id,
      collectedAt: isFullyCollected ? nowIso : target.collectedAt,
      collectedByUserId: userId,
      collectedByUserName: userName,
      updatedAt: nowIso,
      notes: params.notes ? (target.notes ? `${target.notes} | ${params.notes}` : params.notes) : target.notes,
    };

    setDeferredPayments((prev) => prev.map((d) => (d.id === params.deferredId ? updatedDef : d)));
    safeSetDoc(doc(db, "deferred_payments", params.deferredId), updatedDef, { merge: true });

    logAudit(
      "FINANCIAL_PAYMENT",
      "COLLECTION",
      receipt.id,
      `تحصيل دفعة مؤجلة #${target.deferredNumber}`,
      `تم تحصيل مبلغ ${params.amount.toLocaleString()} AED من الدفعة المؤجلة #${target.deferredNumber} للمستأجر ${target.tenantName} (${params.paymentMethod}).`
    );

    return { success: true, receipt };
  };

  const cancelDeferredPayment = (
    deferredId: string,
    reason: string
  ): { success: boolean; error?: string } => {
    const target = deferredPayments.find((d) => d.id === deferredId);
    if (!target) return { success: false, error: "Deferred payment not found" };

    const checkPerm = checkFinancialEditPermission("LEASE", reason);
    if (!checkPerm.allowed) return { success: false, error: checkPerm.error };

    const updated: DeferredPaymentRecord = {
      ...target,
      status: "CANCELLED",
      notes: target.notes ? `${target.notes} | تم الإلغاء: ${reason}` : `تم الإلغاء: ${reason}`,
      updatedAt: new Date().toISOString(),
    };

    setDeferredPayments((prev) => prev.map((d) => (d.id === deferredId ? updated : d)));
    safeSetDoc(doc(db, "deferred_payments", deferredId), updated, { merge: true });

    logAudit(
      "UPDATE",
      "LEASE",
      deferredId,
      `إلغاء دفعة مؤجلة #${target.deferredNumber}`,
      `تم إلغاء الدفعة المؤجلة #${target.deferredNumber}. السبب: ${reason}`
    );

    return { success: true };
  };

  const processUnifiedPayment = async (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    payerName: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    chequeId?: string;
    chequeDetails?: {
      chequeNumber: string;
      chequeDate: string;
      bankName: string;
      accountHolder?: string;
      depositDate?: string;
      depositReference?: string;
    };
    attachment?: {
      fileName: string;
      driveFileId?: string;
      driveWebViewLink?: string;
    };
    approvalCode?: string; // Add approvalCode
    fromCase?: boolean;
  }): Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }> => {
    // 1. Idempotency Guard (Prevent duplicate collections on same lease obligation / reference / cheque)
    const ref = params.referenceNumber?.trim() || params.chequeDetails?.chequeNumber?.trim() || params.chequeId;
    if (ref) {
      const isDuplicate = collections.some((col) => {
        const isSameRef = col.transactionReference?.trim() === ref || col.chequeId === params.chequeId;
        const isSameAmount = Math.abs(col.amountEntered - params.amount) < 0.01;
        return isSameRef && isSameAmount;
      });
      if (isDuplicate) {
        return {
          success: false,
          error: language === "ar"
            ? `محاولة تحصيل مزدوج مرفوضة: يوجد سند قبض سابق مرتبط بهذا الشيك أو الارجاع أو المرجع.`
            : `Double collection rejected: A collection record already exists for this reference or cheque.`,
        };
      }
    }

    // 2. Remaining Balance Guard (Authoritative Check)
    const currentBalances = recalculateAllFinancialBalances({
      owners, leases, cheques, collections, commissions: [], paymentAllocations, reversals: financialReversals, adjustments: [], ownerTransfers: []
    });

    // 2.1 Financial Period Validation
    const periodCheck = validateTransactionPeriod(params.paymentDate, financialPeriods);
    if (!periodCheck.allowed) {
      return {
        success: false,
        error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn,
      };
    }
    
    // Validate that the total payment amount does not exceed the valid outstanding obligations on the lease
    const tenantBalance = currentBalances.tenantBalances[params.leaseId];
    if (tenantBalance && params.amount > (tenantBalance.outstanding || 0) + 0.01) {
      return {
        success: false,
        error: language === "ar"
          ? `مبلغ التحصيل (${params.amount.toLocaleString()} د.إ) يتجاوز الرصيد المستحق الفعلي (${(tenantBalance.outstanding || 0).toLocaleString()} د.إ).`
          : `Collection amount (${params.amount.toLocaleString()} AED) exceeds the actual outstanding balance (${(tenantBalance.outstanding || 0).toLocaleString()} AED).`,
      };
    }

    if (isCardPayment(params.paymentMethod) && !params.approvalCode) {
      return {
        success: false,
        error: language === "ar"
          ? "يجب إدخال رقم الموافقة (Approval Code) عند الدفع بالبطاقة الائتمانية."
          : "Approval Code is mandatory for card payments.",
      };
    }

    if (params.chequeId) {
      const caseCheck = checkCaseControlledCheque(params.chequeId);
      if (caseCheck.isControlled && !params.fromCase) {
        return {
          success: false,
          error: language === "ar"
            ? `هذا الشيك محجوز على ذمة قضية قانونية مفتوحة رقم ${caseCheck.caseNumber}، ولا يمكن تحصيله إلا من داخل القضية.`
            : `This cheque is reserved under open legal case #${caseCheck.caseNumber} and can only be collected from inside the case.`,
        };
      }
    }

    for (const alloc of params.allocations) {
      if (alloc.targetType === "CHEQUE") {
        const chq = cheques.find(c => c.id === alloc.targetId);
        if (chq) {
          const caseCheck = checkCaseControlledCheque(chq.id);
          if (caseCheck.isControlled && !params.fromCase) {
            return {
              success: false,
              error: language === "ar"
                ? `هذا الشيك محجوز على ذمة قضية قانونية مفتوحة رقم ${caseCheck.caseNumber}، ولا يمكن تحصيله إلا من داخل القضية.`
                : `This cheque is reserved under open legal case #${caseCheck.caseNumber} and can only be collected from inside the case.`,
            };
          }
          if (chq.status === "COLLECTED" || chq.outstanding <= 0) {
            return {
              success: false,
              error: language === "ar"
                ? `رفض العملية: الشيك رقم ${chq.chequeNumber} مدفوع ومحصل بالكامل مسبقاً.`
                : `Operation rejected: Cheque #${chq.chequeNumber} is already fully collected.`,
            };
          }
          if (alloc.amount > chq.outstanding + 0.01) {
            return {
              success: false,
              error: language === "ar"
                ? `رفض العملية: المبلغ المطلوب (${alloc.amount}) يتجاوز الرصيد المتبقي للشيك (${chq.outstanding}).`
                : `Operation rejected: Requested amount (${alloc.amount}) exceeds cheque outstanding balance (${chq.outstanding}).`,
            };
          }
        }
      } else if (alloc.targetType === "LEASE_INSTALLMENT") {
        const [lId, instNumStr] = alloc.targetId.split(":");
        const instNum = parseInt(instNumStr);
        const l = leases.find(le => le.id === lId);
        if (l && l.installments) {
          const inst = l.installments.find(i => i.installmentNumber === instNum);
          if (inst) {
            if (inst.chequeId) {
              const caseCheck = checkCaseControlledCheque(inst.chequeId);
              if (caseCheck.isControlled && !params.fromCase) {
                return {
                  success: false,
                  error: language === "ar"
                    ? `هذا القسط مرتبِط بشيك راجع محجوز على ذمة قضية قانونية مفتوحة رقم ${caseCheck.caseNumber}، ولا يمكن تحصيله إلا من داخل القضية.`
                    : `This installment is linked to a bounced cheque reserved under open legal case #${caseCheck.caseNumber} and can only be collected from inside the case.`,
                };
              }
            }
            const alreadyAllocated = paymentAllocations
              .filter(p => p.targetType === "LEASE_INSTALLMENT" && p.targetId === alloc.targetId && p.status === "ACTIVE")
              .reduce((sum, p) => sum + p.allocatedAmount, 0);
            const remaining = Math.max(0, inst.amount - alreadyAllocated);
            if (remaining <= 0 || inst.status === "COLLECTED") {
              return {
                success: false,
                error: language === "ar"
                  ? `رفض العملية: القسط الإيجاري رقم ${instNum} مدفوع بالكامل مسبقاً أو رصيده صفر.`
                  : `Operation rejected: Installment #${instNum} is already fully paid or has zero balance.`,
              };
            }
            if (alloc.amount > remaining + 0.01) {
              return {
                success: false,
                error: language === "ar"
                  ? `رفض العملية: المبلغ المطلوب (${alloc.amount}) يتجاوز الرصيد المتبقي للقسط (${remaining}).`
                  : `Operation rejected: Requested amount (${alloc.amount}) exceeds installment remaining balance (${remaining}).`,
              };
            }
          }
        }
      }
    }

    // 3. If Cheque method, create the authoritative Cheque entity
    let createdChequeId = "";
    let newlyCreatedCheque: Cheque | null = null;
    if (params.paymentMethod === "CHEQUE" && params.chequeDetails) {
      const leaseObj = leases.find((l) => l.id === params.leaseId);
      const prop = leaseObj ? properties.find((p) => p.id === leaseObj.propertyId) : null;
      const newChq: Cheque = {
        id: "chq-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
        chequeNumber: params.chequeDetails.chequeNumber,
        bankName: params.chequeDetails.bankName,
        amount: params.amount,
        chequeDate: params.chequeDetails.chequeDate,
        dueDate: params.chequeDetails.chequeDate,
        ownerId: leaseObj?.ownerId || "owner-01",
        ownerName: prop ? prop.ownerId : "Owner",
        tenantId: leaseObj?.tenantId || "tenant-01",
        propertyId: leaseObj?.propertyId || "prop-01",
        unitId: leaseObj?.unitId || "unit-01",
        leaseId: params.leaseId,
        status: params.chequeDetails.depositDate ? "DEPOSITED" : "PENDING",
        originalStatus: "NORMAL",
        collectionStatus: "NOT_COLLECTED",
        totalApplied: 0,
        outstanding: params.amount,
        whatsAppStatus: "NONE",
        reminderCount: 0,
        drawerName: params.chequeDetails.accountHolder || params.payerName,
        driveFileId: params.attachment?.driveFileId,
        driveWebViewLink: params.attachment?.driveWebViewLink,
        notes: params.notes,
        createdAt: new Date().toISOString(),
      };
      createdChequeId = newChq.id;
      newlyCreatedCheque = newChq;
      safeSetDoc(doc(db, "cheques", newChq.id), newChq);

      logAudit("CREATE", "CHEQUE", newChq.id, newChq.chequeNumber, `Created Cheque #${newChq.chequeNumber} for Lease Contract ${params.leaseId}`);
    }

    const leaseObj = leases.find((l) => l.id === params.leaseId);
    const totalAllocated = params.allocations.reduce((sum, a) => sum + a.amount, 0);
    const reference = params.referenceNumber?.trim() || params.chequeDetails?.chequeNumber?.trim();

    // 4. Create the main CollectionRecord
    const receipt: CollectionRecord = {
      id: "col-" + Date.now(),
      receiptNumber: generateSequentialNumber(collections, "receiptNumber", "RCP-"),
      chequeId: createdChequeId || params.chequeId || "DIRECT_COLLECTIONS",
      tenantId: leaseObj?.tenantId || "tenant-01",
      ownerId: leaseObj?.ownerId || "owner-01",
      paymentDate: params.paymentDate,
      amountEntered: params.amount,
      amountApplied: totalAllocated,
      paymentMethod: params.paymentMethod,
      transactionReference: reference || undefined,
      approvalCode: isCardPayment(params.paymentMethod) ? params.approvalCode : undefined,
      payerName: params.payerName || "Tenant Representative",
      collectedBy: currentUser?.nameEn || "Finance Officer",
      collectedByUserId: currentUser?.id || "usr-03",
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    if (params.attachment) {
      (receipt as any).driveFileId = params.attachment.driveFileId;
      (receipt as any).driveWebViewLink = params.attachment.driveWebViewLink;
      (receipt as any).fileName = params.attachment.fileName;
    }

    setCollections((prev) => [receipt, ...prev]);
    safeSetDoc(doc(db, "collections", receipt.id), receipt);

    // 5. Create PaymentAllocations and update targets
    const createdAllocations: PaymentAllocation[] = [];
    const commissionsToUpdate = new Map<string, CommissionObligation>();
    const chequesToUpdate = new Map<string, Cheque>();
    const leasesToUpdate = new Map<string, Lease>();

    // Seed newly created cheque if exists
    if (newlyCreatedCheque) {
      chequesToUpdate.set(newlyCreatedCheque.id, newlyCreatedCheque);
    }

    for (const item of params.allocations) {
      const alloc: PaymentAllocation = {
        id: "pal-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
        collectionId: receipt.id,
        targetType: item.targetType,
        targetId: item.targetId,
        targetDescription: item.targetDescription,
        allocatedAmount: item.amount,
        allocationDate: params.paymentDate,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        createdById: currentUser?.id || "system",
      };
      createdAllocations.push(alloc);
      safeSetDoc(doc(db, "payment_allocations", alloc.id), alloc);

      if (item.targetType === "COMMISSION") {
        const c = commissionsToUpdate.get(item.targetId) || commissions.find((com) => com.id === item.targetId);
        if (c) {
          const newCollected = c.collectedAmount + item.amount;
          const newRemaining = Math.max(0, c.totalCommissionAmount - newCollected);
          const status: CommissionObligation["status"] =
            newRemaining <= 0.0001 ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED";
          const updatedCom: CommissionObligation = {
            ...c,
            collectedAmount: newCollected,
            outstandingBalance: newRemaining,
            status,
            updatedAt: new Date().toISOString(),
          };
          commissionsToUpdate.set(c.id, updatedCom);
          safeSetDoc(doc(db, "commissions", c.id), updatedCom, { merge: true });
        }
      } else if (item.targetType === "CHEQUE") {
        const c = chequesToUpdate.get(item.targetId) || cheques.find((chq) => chq.id === item.targetId);
        if (c) {
          const newTotalApplied = c.totalApplied + item.amount;
          const newOutstanding = Math.max(0, c.amount - newTotalApplied);
          const isFullyCollected = newOutstanding <= 0.0001;
          const updatedChq: Cheque = {
            ...c,
            totalApplied: newTotalApplied,
            outstanding: newOutstanding,
            collectionStatus: isFullyCollected
              ? ("FULLY_COLLECTED_AFTER_BOUNCE" as const)
              : ("PARTIAL_COLLECTION" as const),
            status: isFullyCollected ? ("COLLECTED" as const) : c.status,
          };
          chequesToUpdate.set(c.id, updatedChq);
          safeSetDoc(doc(db, "cheques", c.id), updatedChq, { merge: true });

          // Also update corresponding lease installment status if fully collected
          if (isFullyCollected && c.leaseId) {
            const l = leasesToUpdate.get(c.leaseId) || leases.find((lea) => lea.id === c.leaseId);
            if (l) {
              const updatedInstallments = (l.installments || []).map((inst) => {
                const isMatch = inst.chequeId === c.id || 
                                (!inst.chequeId && c.chequeNumber && inst.chequeNumber === c.chequeNumber);
                if (isMatch) {
                  return { ...inst, status: "COLLECTED" as const };
                }
                return inst;
              });
              const updatedLease = { ...l, installments: updatedInstallments };
              leasesToUpdate.set(l.id, updatedLease);
              safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });
            }
          }
        }
      } else if (item.targetType === "LEASE_INSTALLMENT") {
        const [lId, instNumStr] = item.targetId.split(":");
        const instNum = parseInt(instNumStr);
        const l = leasesToUpdate.get(lId) || leases.find((lea) => lea.id === lId);
        
        let linkedChequeId: string | null = null;
        if (l) {
          let instList = l.installments && l.installments.length > 0
            ? [...l.installments]
            : Array.from({ length: l.installmentsCount || 1 }).map((_, idx) => {
                const startD = new Date(l.startDate);
                startD.setMonth(startD.getMonth() + Math.round((12 / (l.installmentsCount || 1)) * idx));
                return {
                  installmentNumber: idx + 1,
                  dueDate: startD.toISOString().split("T")[0],
                  amount: Math.round((l.annualRent / (l.installmentsCount || 1)) * 100) / 100,
                  status: "PENDING" as const,
                };
              });

          instList = instList.map((inst) => {
            if (inst.installmentNumber === instNum) {
              if ((inst as any).chequeId) linkedChequeId = (inst as any).chequeId;
              
              const otherAllocated = paymentAllocations
                .filter((p) => p.targetType === "LEASE_INSTALLMENT" && p.targetId === item.targetId && p.status === "ACTIVE")
                .reduce((sum, p) => sum + p.allocatedAmount, 0);
              const totalAllocatedToInst = otherAllocated + item.amount;

              let status: "PENDING" | "CLEARED" | "BOUNCED" | "COLLECTED" | "WAIVED" = "PENDING";
              if (totalAllocatedToInst >= inst.amount - 0.01) {
                status = "COLLECTED";
              }
              return { ...inst, status };
            }
            return inst;
          });

          const updatedLease = { ...l, installments: instList };
          leasesToUpdate.set(l.id, updatedLease);
          safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });
        }

        // Sync cheque status if a cheque was linked to this installment
        if (linkedChequeId) {
          const c = chequesToUpdate.get(linkedChequeId) || cheques.find((chq) => chq.id === linkedChequeId);
          if (c) {
            const newTotalApplied = c.totalApplied + item.amount;
            const newOutstanding = Math.max(0, c.amount - newTotalApplied);
            const isFullyCollected = newOutstanding <= 0.0001;
            const collectionStatus: CollectionStatus = isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION";
            const status: ChequeStatus = isFullyCollected ? "COLLECTED" : c.status;
            const updated: Cheque = {
              ...c,
              totalApplied: newTotalApplied,
              outstanding: newOutstanding,
              collectionStatus,
              status,
            };
            chequesToUpdate.set(c.id, updated);
            safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
          }
        }
      }
    }

    if (createdChequeId) {
      const c = chequesToUpdate.get(createdChequeId) || cheques.find((chq) => chq.id === createdChequeId);
      if (c) {
        const isFully = totalAllocated >= c.amount - 0.01;
        const chqCollectionStatus: CollectionStatus = isFully ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION";
        const chqStatus: ChequeStatus = isFully ? "COLLECTED" : "PENDING";
        const updated: Cheque = {
          ...c,
          totalApplied: totalAllocated,
          outstanding: Math.max(0, c.amount - totalAllocated),
          collectionStatus: chqCollectionStatus,
          status: chqStatus,
        };
        chequesToUpdate.set(c.id, updated);
        safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
      }
    }

    // Pure React state updates
    if (commissionsToUpdate.size > 0) {
      setCommissions((prev) => prev.map((c) => commissionsToUpdate.get(c.id) || c));
    }

    if (chequesToUpdate.size > 0) {
      setCheques((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const updatedList = prev.map((c) => chequesToUpdate.get(c.id) || c);
        // Add new cheques not in prev
        const newCheques = Array.from(chequesToUpdate.values()).filter((c) => !existingIds.has(c.id));
        return [...newCheques, ...updatedList];
      });
    }

    if (leasesToUpdate.size > 0) {
      setLeases((prev) => prev.map((l) => leasesToUpdate.get(l.id) || l));
    }

    setPaymentAllocations((prev) => [...createdAllocations, ...prev]);

    // 6. Register/link derived receipt document in Electronic Archive (reusing existing Electronic Archive)
    const existingArchiveDoc = archive.find((a) => a.recordId === receipt.id || a.entityId === receipt.id);
    if (!existingArchiveDoc) {
      addArchiveItem({
        fileName: `Receipt_${receipt.receiptNumber}.pdf`,
        category: "PAYMENTS",
        recordId: receipt.id,
        recordTitle: `Official Payment Receipt #${receipt.receiptNumber} (${receipt.paymentMethod})`,
        fileType: "application/pdf",
        fileSize: 128000,
        isPrivate: true,
        storagePath: `receipts/${receipt.tenantId}/${receipt.receiptNumber}.pdf`,
        uploadedByUserId: currentUser?.id || "usr-03",
        uploadedByName: currentUser?.nameEn || "Finance Officer",
        previewUrl: `#receipt-${receipt.id}`,
        tags: ["PAYMENT_RECEIPT", receipt.paymentMethod, receipt.tenantId, receipt.ownerId || ""],
        entityType: "COLLECTION",
        entityId: receipt.id,
        uploadDate: new Date().toISOString().split("T")[0],
        driveFileId: receipt.driveFileId,
        driveWebViewLink: receipt.driveWebViewLink,
      });
    }

    logAudit(
      "FINANCIAL_PAYMENT",
      "COLLECTION",
      receipt.id,
      `Receipt #${receipt.receiptNumber}`,
      `Recorded ${params.paymentMethod} collection of ${params.amount.toLocaleString()} AED for Lease Contract ${leaseObj?.leaseNumber || params.leaseId}. ` +
        `Allocated ${totalAllocated.toLocaleString()} AED across ${params.allocations.length} targets.`
    );

    return { success: true, receipt };
    return { success: true, receipt };
  };

  const updateChequeWithSafetyConfirmation = async (
    params: ChequeSecurityConfirmationParams
  ): Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }> => {
    const target = cheques.find((c) => c.id === params.chequeId);
    if (!target) return { success: false, error: "Cheque not found" };

    const userId = currentUser?.id || "sys-01";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مسؤول النظام";
    const nowIso = new Date().toISOString();

    if (["COLLECT", "CASH_SETTLEMENT", "BANK_TRANSFER_SETTLEMENT", "CARD_SETTLEMENT", "RECOVERY"].includes(params.action)) {
      if (target.status === "COLLECTED" || target.outstanding <= 0) {
        return {
          success: false,
          error: language === "ar"
            ? `رفض العملية: الشيك رقم ${target.chequeNumber} مدفوع ومحصل مسبقاً.`
            : `Operation rejected: Cheque #${target.chequeNumber} is already collected.`,
        };
      }
      const existingCol = collections.find(c => c.chequeId === target.id);
      if (existingCol && ["COLLECT", "CASH_SETTLEMENT", "BANK_TRANSFER_SETTLEMENT", "CARD_SETTLEMENT"].includes(params.action)) {
        return {
          success: false,
          error: language === "ar"
            ? `دفعة مكررة مرفوضة: الشيك رقم ${target.chequeNumber} تم تسويته مسبقاً برقم سند قبض #${existingCol.receiptNumber}.`
            : `Duplicate collection rejected: Cheque #${target.chequeNumber} was already settled with receipt #${existingCol.receiptNumber}.`,
        };
      }
    }

    if (params.action === "BOUNCE") {
      const updatedChq: Cheque = {
        ...target,
        status: "BOUNCED",
        originalStatus: "BOUNCED",
        returnReason: params.returnReason || "INSUFFICIENT_FUNDS",
        returnedDate: params.collectionDate || new Date().toISOString().split("T")[0],
        whatsAppStatus: "PENDING_REMINDER",
      };
      setCheques((prev) => prev.map((c) => (c.id === target.id ? updatedChq : c)));
      safeSetDoc(doc(db, "cheques", target.id), updatedChq, { merge: true });

      logAudit(
        "UPDATE",
        "CHEQUE",
        target.id,
        `إرجاع الشيك #${target.chequeNumber}`,
        `تم تأكيد إرجاع الشيك #${target.chequeNumber} لسبب (${params.returnReason || "INSUFFICIENT_FUNDS"}).`
      );

      return { success: true };
    }

    let pMethod: PaymentMethod = "CHEQUE";
    if (params.action === "CASH_SETTLEMENT") pMethod = "CASH";
    else if (params.action === "BANK_TRANSFER_SETTLEMENT") pMethod = "BANK_TRANSFER";
    else if (params.action === "CARD_SETTLEMENT") pMethod = "CREDIT_CARD";
    else if (params.action === "COLLECT") pMethod = params.paymentMethod || "CHEQUE";
    else if (params.action === "RECOVERY") pMethod = params.paymentMethod || "BANK_TRANSFER";

    const collectAmount = target.outstanding || target.amount;

    return processUnifiedPayment({
      leaseId: target.leaseId,
      amount: collectAmount,
      paymentMethod: pMethod,
      payerName: params.payerName || target.drawerName || "Tenant",
      paymentDate: params.collectionDate || new Date().toISOString().split("T")[0],
      referenceNumber: params.transactionReference || target.chequeNumber,
      notes: params.notes || `تسوية الشيك رقم ${target.chequeNumber} (${params.action})`,
      chequeId: target.id,
      allocations: [
        {
          targetType: "CHEQUE",
          targetId: target.id,
          amount: collectAmount,
          targetDescription: `الشيك رقم ${target.chequeNumber}`,
        },
      ],
    });
  };

  const dispatchRenewalNotification = async (
    renewalId: string,
    channel: "WHATSAPP" | "EMAIL" | "PORTAL" = "WHATSAPP"
  ): Promise<{ success: boolean; message: string }> => {
    const rnw = leaseRenewals.find((r) => r.id === renewalId);
    if (!rnw) return { success: false, message: "Renewal not found" };

    const tenant = tenants.find((t) => t.id === rnw.tenantId);
    
    let msgContent = `عزيزي المستأجر ${tenant?.nameAr || rnw.tenantNameAr || ""}\nنفيدكم بأنه تم اعتماد تجديد عقد الإيجار رقم ${rnw.newLeaseNumber || rnw.originalLeaseNumber}\nالقيمة السنوية: ${Number(rnw.newAnnualRent || 0).toLocaleString()} درهم\nالفترة: من ${rnw.newStartDate} إلى ${rnw.newEndDate}\nصقر الإمارات للعقارات.`;

    const tpl = messageTemplates.find(t => t.id === "LEASE_RENEWED");
    if (tpl) {
      msgContent = (language === "ar" ? tpl.bodyAr : tpl.bodyEn)
        .replace(/{tenantName}/g, tenant?.nameAr || tenant?.nameEn || rnw.tenantNameAr || rnw.tenantNameEn || "Tenant")
        .replace(/{leaseNumber}/g, rnw.newLeaseNumber || rnw.originalLeaseNumber || "");
    }

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: channel as any,
      recipient: channel === "EMAIL" ? (tenant?.email || "tenant@email.ae") : (tenant?.phone || "+971500000000"),
      recipientName: tenant?.nameAr || rnw.tenantNameAr || "Tenant",
      tenantId: rnw.tenantId,
      type: "OTHER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: msgContent,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [notif, ...prev]);
    return { success: true, message: language === "ar" ? "تم إرسال إشعار التجديد للمستأجر بنجاح" : "Renewal notification delivered" };
  };

  const dispatchPaymentReceiptNotification = async (
    receiptId: string,
    channel: "WHATSAPP" | "EMAIL" = "WHATSAPP"
  ): Promise<{ success: boolean; message: string }> => {
    const rec = collections.find((c) => c.id === receiptId);
    if (!rec) return { success: false, message: "Receipt not found" };

    const tenant = tenants.find((t) => t.id === rec.tenantId);
    const msgContent = `سند قبض إلكتروني #${rec.receiptNumber}\nالمستلم من: ${rec.payerName}\nالمبلغ: ${rec.amountEntered.toLocaleString()} درهم\nالتاريخ: ${rec.paymentDate}\nطريقة الدفع: ${rec.paymentMethod}\nشركة صقر الإمارات للعقارات.`;

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: channel as any,
      recipient: channel === "EMAIL" ? (tenant?.email || "tenant@email.ae") : (tenant?.phone || "+971500000000"),
      recipientName: rec.payerName,
      tenantId: rec.tenantId,
      type: "OTHER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: msgContent,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [notif, ...prev]);
    return { success: true, message: language === "ar" ? "تم إرسال سند القبض للمستأجر بنجاح" : "Receipt notification sent" };
  };

  const dispatchChequeReminderNotification = async (
    chequeId: string,
    reminderType: "SEVEN_DAYS_BEFORE" | "FIVE_DAYS_BEFORE" | "DUE_TODAY" | "OVERDUE"
  ): Promise<{ success: boolean; message: string }> => {
    const chq = cheques.find((c) => c.id === chequeId);
    if (!chq) return { success: false, message: "Cheque not found" };

    const tenant = tenants.find((t) => t.id === chq.tenantId);
    const daysText = reminderType === "SEVEN_DAYS_BEFORE" ? "خلال 7 أيام" : reminderType === "FIVE_DAYS_BEFORE" ? "خلال 5 أيام" : reminderType === "DUE_TODAY" ? "اليوم" : "متأخر";
    
    let msgContent = `عزيزي ${tenant?.nameAr || tenant?.nameEn || "المستأجر"}، تذكير بموعد استحقاق الشيك رقم ${chq.chequeNumber} المسحوب على بنك ${chq.bankName} بمبلغ ${chq.amount.toLocaleString()} درهم وتاريخ استحقاقه ${chq.dueDate} (${daysText}). يرجى التأكد من توفر الرصيد الكافي.`;
    
    const tpl = messageTemplates.find(t => t.id === "APPROACHING_DUE");
    if (tpl) {
      msgContent = (language === "ar" ? tpl.bodyAr : tpl.bodyEn)
        .replace(/{tenantName}/g, tenant?.nameAr || tenant?.nameEn || "Tenant")
        .replace(/{chequeNumber}/g, chq.chequeNumber)
        .replace(/{chequeAmount}/g, chq.amount.toLocaleString())
        .replace(/{dueDate}/g, chq.dueDate);
    }

    try {
      // 1. Dispatch actual email via SMTP
      if (tenant?.email) {
        await fetch("/api/notifications/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "email",
            recipient: tenant.email,
            template: "APPROACHING_DUE",
            tenantName: tenant.nameAr || tenant.nameEn,
            chequeNumber: chq.chequeNumber,
            amountAED: chq.amount,
            dueDate: chq.dueDate,
            customMessage: msgContent
          }),
        });
      }
    } catch (err) {
      console.error("Failed to trigger SMTP for cheque reminder", err);
    }

    const notif: NotificationRecord = {
      id: "notif-" + Date.now() + crypto.randomUUID().split("-")[0],
      channel: "EMAIL",
      recipient: tenant?.email || tenant?.phone || "+971500000000",
      recipientName: tenant?.nameAr || tenant?.nameEn || "Tenant",
      tenantId: chq.tenantId,
      chequeId: chq.id,
      type: "SEVEN_DAY_REMINDER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: msgContent,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [notif, ...prev]);
    safeSetDoc(doc(db, "notifications", notif.id), notif);

    // Update cheque reminder count
    const updatedChq = { ...chq, reminderCount: (chq.reminderCount || 0) + 1, whatsAppStatus: "SENT" as const };
    setCheques((prev) => prev.map((c) => c.id === chq.id ? updatedChq : c));
    safeSetDoc(doc(db, "cheques", chq.id), updatedChq, { merge: true });

    return { success: true, message: language === "ar" ? `تم إرسال تذكير الشيك (${daysText}) بنجاح عبر SMTP` : "Cheque reminder sent via SMTP" };
  };

  const runAutomatedChequeReminders = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 7);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    let sentCount = 0;

    for (const chq of cheques) {
      if (chq.status === "PENDING" && chq.dueDate === targetDateStr) {
        // Check if we already sent a reminder for this cheque recently to prevent duplicates
        const alreadySent = notifications.some(
          (n) => n.chequeId === chq.id && n.type === "SEVEN_DAY_REMINDER" && n.createdAt.startsWith(today.toISOString().split("T")[0])
        );

        if (!alreadySent) {
          await dispatchChequeReminderNotification(chq.id, "SEVEN_DAYS_BEFORE");
          sentCount++;
        }
      }
    }
    
    if (sentCount > 0) {
      console.log(`[Auto Reminders] Sent ${sentCount} reminders for cheques due in 7 days.`);
    }
    return { success: true, count: sentCount };
  };

  const dispatchDeferredReminderNotification = async (
    deferredId: string,
    targetType: "TENANT" | "RESPONSIBLE_EMPLOYEE" = "TENANT"
  ): Promise<{ success: boolean; message: string }> => {
    const def = deferredPayments.find((d) => d.id === deferredId);
    if (!def) return { success: false, message: "Deferred payment not found" };

    const tenant = tenants.find((t) => t.id === def.tenantId);
    const msgContent =
      targetType === "TENANT"
        ? `تذكير: نود تذكيركم بموعد سداد الدفعة المؤجلة بمبلغ ${def.outstandingAmount.toLocaleString()} درهم المستحقة في تاريخ ${def.expectedDueDate} لعقد الإيجار #${def.leaseNumber || ""}.`
        : `تنبيه متابعة: الدفعة المؤجلة #${def.deferredNumber} للمستأجر ${def.tenantName} بمبلغ ${def.outstandingAmount.toLocaleString()} درهم مستحقة بتاريخ ${def.expectedDueDate}. يرجى المتابعة والتحصيل.`;

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: targetType === "TENANT" ? "WHATSAPP" : ("PORTAL" as any),
      recipient: targetType === "TENANT" ? (tenant?.phone || "+971500000000") : (def.responsiblePerson || "Employee"),
      recipientName: targetType === "TENANT" ? (tenant?.nameAr || def.tenantName || "Tenant") : def.responsiblePerson,
      tenantId: def.tenantId,
      type: "OTHER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: msgContent,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [notif, ...prev]);
    return { success: true, message: language === "ar" ? "تم إرسال التنبيه بنجاح" : "Deferred reminder sent" };
  };

  // -------------------------------------------------------------
  // Cheque Management Methods
  // -------------------------------------------------------------

  const checkDuplicateCheque = (
    chequeNumber: string,
    drawerName?: string,
    leaseId?: string,
    tenantId?: string,
    amount?: number
  ): Cheque | undefined => {
    const cleanNum = (chequeNumber || "").trim().toLowerCase();
    if (!cleanNum) return undefined;

    return cheques.find((c) => {
      // 1. Must match cheque number
      const existingChequeNum = (c.chequeNumber || "").trim().toLowerCase();
      if (existingChequeNum !== cleanNum) {
        return false;
      }

      // 2. Check Drawer / Writer Name (اسم كاتب الشيك / الساحب) or Tenant
      let drawerMatches = false;
      const targetDrawer = (drawerName || "").trim().toLowerCase();
      const existingDrawer = (c.drawerName || "").trim().toLowerCase();
      const existingTenant = tenants.find((t) => t.id === c.tenantId);
      const tenantAr = (existingTenant?.nameAr || "").trim().toLowerCase();
      const tenantEn = (existingTenant?.nameEn || "").trim().toLowerCase();

      if (targetDrawer) {
        drawerMatches =
          (existingDrawer !== "" && (existingDrawer.includes(targetDrawer) || targetDrawer.includes(existingDrawer))) ||
          (tenantAr !== "" && (tenantAr.includes(targetDrawer) || targetDrawer.includes(tenantAr))) ||
          (tenantEn !== "" && (tenantEn.includes(targetDrawer) || targetDrawer.includes(tenantEn)));
      }

      if (!drawerMatches && tenantId) {
        drawerMatches = c.tenantId === tenantId;
      }

      // If drawer info isn't available anywhere, we fallback to true so we don't accidentally miss if other strong fields match
      if (!targetDrawer && !tenantId) {
        drawerMatches = true;
      }

      // 3. Check Lease Contract (عقد الإيجار)
      let leaseMatches = false;
      if (leaseId && leaseId.trim() !== "") {
        leaseMatches = c.leaseId === leaseId.trim();
      } else {
        // If leaseId was not explicitly set or selected, check tenant match
        leaseMatches = Boolean(tenantId && c.tenantId === tenantId);
      }

      // Match is confirmed only when Cheque Number, Drawer Name, AND Lease Contract match
      return drawerMatches && leaseMatches;
    });
  };

  /**
   * Synchronizes a cheque's state bidirectionally with corresponding lease installment schedule.
   */
  const syncChequeWithLease = (cheque: Cheque, newStatus?: ChequeStatus) => {
    const effectiveStatus = newStatus || cheque.status;
    let instStatus: "PENDING" | "CLEARED" | "BOUNCED" | "COLLECTED" | "WAIVED" = "PENDING";
    if (effectiveStatus === "COLLECTED" || effectiveStatus === "CLEARED") {
      instStatus = "COLLECTED";
    } else if (effectiveStatus === "BOUNCED" || effectiveStatus === "UNDER_LEGAL") {
      instStatus = "BOUNCED";
    } else if (effectiveStatus === "CANCELLED") {
      if (cheque.cancellationType === "APPROVED_WAIVER" || cheque.cancellationType === "CONTRACT_TERMINATED") {
        instStatus = "WAIVED";
      } else if (cheque.cancellationType === "SETTLED_OTHER_MEANS") {
        instStatus = "COLLECTED";
      } else {
        instStatus = "PENDING";
      }
    } else if (effectiveStatus === "REPLACED") {
      instStatus = "PENDING";
    } else if (effectiveStatus === "PENDING" || effectiveStatus === "POST_DATED" || effectiveStatus === "DEPOSITED") {
      instStatus = "PENDING";
    }

    setLeases((prevLeases) => {
      let leaseUpdated = false;
      const newLeases = prevLeases.map((l) => {
        const isDirectLease = cheque.leaseId && (l.id === cheque.leaseId || l.leaseNumber === cheque.leaseId);
        const isTenantMatch = l.tenantId === cheque.tenantId && (!cheque.propertyId || l.propertyId === cheque.propertyId);

        if (isDirectLease || isTenantMatch || !cheque.leaseId) {
          if (!l.installments || l.installments.length === 0) return l;

          let installmentMatched = false;
          const updatedInstallments = l.installments.map((inst) => {
            const isMatch =
              (inst.chequeId && inst.chequeId === cheque.id) ||
              isSameChequeNumber(inst.chequeNumber, cheque.chequeNumber) ||
              (isDirectLease && inst.dueDate === cheque.dueDate && Math.abs((inst.amount || 0) - (cheque.amount || 0)) < 1.0);

            if (isMatch) {
              installmentMatched = true;
              return {
                ...inst,
                status: instStatus,
                chequeId: effectiveStatus === "CANCELLED" && cheque.cancellationType !== "SETTLED_OTHER_MEANS" && cheque.cancellationType !== "APPROVED_WAIVER" ? undefined : cheque.id,
                chequeNumber: inst.chequeNumber || cheque.chequeNumber,
              };
            }
            return inst;
          });

          if (installmentMatched) {
            leaseUpdated = true;
            const updatedLease = { ...l, installments: updatedInstallments };
            safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });

            // If cheque was missing leaseId or propertyId, link it back
            if (!cheque.leaseId || cheque.leaseId !== l.id) {
              cheque.leaseId = l.id;
              cheque.propertyId = cheque.propertyId || l.propertyId;
              cheque.unitId = cheque.unitId || l.unitId;
              safeSetDoc(
                doc(db, "cheques", cheque.id),
                {
                  leaseId: l.id,
                  propertyId: l.propertyId,
                  unitId: l.unitId,
                },
                { merge: true }
              );
            }

            return updatedLease;
          }
        }
        return l;
      });

      return leaseUpdated ? newLeases : prevLeases;
    });
  };

  const addCheque = (
    chequeData: Omit<Cheque, "id" | "createdAt" | "totalApplied" | "outstanding" | "whatsAppStatus" | "reminderCount">
  ): Cheque => {
    const isBounced = chequeData.status === "BOUNCED" || chequeData.originalStatus === "BOUNCED";
    const initialStatus = chequeData.status;

    const newCheque: Cheque = {
      ...chequeData,
      id: "chq-" + Date.now(),
      originalStatus: isBounced ? "BOUNCED" : "NORMAL",
      collectionStatus: isBounced ? "NOT_COLLECTED" : "NOT_COLLECTED",
      totalApplied: 0,
      outstanding: chequeData.amount,
      whatsAppStatus: isBounced ? "PENDING_REMINDER" : "NONE",
      reminderCount: 0,
      createdAt: new Date().toISOString(),
    };

    setCheques((prev) => [newCheque, ...prev]);
    safeSetDoc(doc(db, "cheques", newCheque.id), newCheque);

    // Sync with corresponding lease installment immediately
    syncChequeWithLease(newCheque, newCheque.status);

    logAudit(
      "CREATE",
      "CHEQUE",
      newCheque.id,
      `Cheque #${newCheque.chequeNumber}`,
      `Created cheque record #${newCheque.chequeNumber} for AED ${newCheque.amount.toLocaleString()} (Status: ${initialStatus})`
    );

    // If bounced, trigger notification simulation and recalculate risk
    if (isBounced) {
      setTimeout(() => {
        recalculateTenantRisk(newCheque.tenantId);
      }, 200);
    }

    return newCheque;
  };

  const updateCheque = (id: string, patch: Partial<Cheque>, modificationReason?: string): { success: boolean; error?: string } => {
    const target = cheques.find((c) => c.id === id);
    if (!target) return { success: false, error: "Cheque not found" };

    // Check if critical financial values are being changed
    const hasFinancialChanges =
      (patch.amount !== undefined && patch.amount !== target.amount) ||
      (patch.chequeDate !== undefined && patch.chequeDate !== target.chequeDate) ||
      (patch.propertyId !== undefined && patch.propertyId !== target.propertyId) ||
      (patch.tenantId !== undefined && patch.tenantId !== target.tenantId) ||
      (patch.leaseId !== undefined && patch.leaseId !== target.leaseId);

    if (hasFinancialChanges) {
      return {
        success: false,
        error: language === "ar"
          ? "القيم المالية الأساسية للشيك غير قابلة للتعديل المباشر بموجب قواعد الحوكمة المالية الصارمة."
          : "Core financial properties of a cheque are immutable under strict financial governance rules."
      };
    }

    const check = checkFinancialEditPermission("CHEQUE", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("CHEQUE", target, "VERSION");

    const updated = { ...target, ...patch };
    setCheques((prev) => prev.map((c) => (c.id === id ? updated : c)));
    safeSetDoc(doc(db, "cheques", id), updated, { merge: true });

    // Sync with corresponding lease installment
    syncChequeWithLease(updated, patch.status);

    logAudit(
      "FINANCIAL_RECORD_EDIT", 
      "CHEQUE", 
      id, 
      `Cheque #${target.chequeNumber}`, 
      `Modified cheque fields: ${Object.keys(patch).join(", ")}`,
      JSON.stringify(target),
      JSON.stringify(updated),
      modificationReason
    );
    return { success: true };
  };

  const deleteCheque = (id: string, options?: DeleteRecordOptions) => {
    const msg = language === "ar"
      ? "الشيكات المسجلة في النظام غير قابلة للحذف لضمان سلامة السجلات المالية ومطابقتها."
      : "Registered cheques in the system are immutable and cannot be deleted to ensure financial trace integrity.";
    alert(msg);
    return;
  };

  const updateChequeStatus = (
    id: string,
    newStatus: ChequeStatus,
    modificationReason?: string,
    returnedDate?: string,
    fromCase?: boolean,
    additionalData?: {
      returnReason?: ReturnReason;
      bankBounceSlipNumber?: string;
      bounceProofUrl?: string;
      reference?: string;
      proofUrl?: string;
      notes?: string;
    }
  ): { success: boolean; error?: string } => {
    const target = cheques.find((c) => c.id === id);
    if (!target) return { success: false, error: "Cheque not found" };

    const caseCheck = checkCaseControlledCheque(id);
    if (caseCheck.isControlled && !fromCase && (newStatus === "COLLECTED" || newStatus === "CLEARED")) {
      return {
        success: false,
        error: language === "ar"
          ? `عذراً، هذا الشيك محجوز على ذمة قضية قانونية مفتوحة ولا يمكن تعديل حالته إلى محصل/مسوى يدوياً إلا من داخل القضية.`
          : `Sorry, this cheque is reserved under an active legal case and its status cannot be changed to Collected/Cleared manually except from the linked case.`,
      };
    }

    const check = checkFinancialEditPermission("CHEQUE", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("CHEQUE", target, "VERSION");

    const wasBouncedEver = target.originalStatus === "BOUNCED" || newStatus === "BOUNCED";
    const oldStatus = target.status;
    const nowIso = new Date().toISOString();

    const auditEntry: ChequeAuditEntry = {
      id: "aud-" + Date.now(),
      previousStatus: oldStatus,
      newStatus: newStatus,
      timestamp: nowIso,
      performedBy: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      performedByUserId: currentUser?.id || "system",
      notes: additionalData?.notes || modificationReason,
      reason: modificationReason,
      reference: additionalData?.reference || additionalData?.bankBounceSlipNumber,
      slipNumber: additionalData?.bankBounceSlipNumber || additionalData?.reference,
      proofUrl: additionalData?.proofUrl || additionalData?.bounceProofUrl,
    };

    const isCleared = newStatus === "CLEARED" || newStatus === "COLLECTED";

    const updated: Cheque = {
      ...target,
      status: newStatus,
      originalStatus: wasBouncedEver ? "BOUNCED" : target.originalStatus,
      returnedDate: returnedDate || (newStatus === "BOUNCED" ? new Date().toISOString().split("T")[0] : target.returnedDate),
      whatsAppStatus: newStatus === "BOUNCED" ? "PENDING_REMINDER" : target.whatsAppStatus,
      outstanding: isCleared ? 0 : target.outstanding,
      totalApplied: isCleared ? target.amount : target.totalApplied,
      returnReason: additionalData?.returnReason || target.returnReason,
      bankBounceSlipNumber: additionalData?.bankBounceSlipNumber || target.bankBounceSlipNumber,
      bounceProofUrl: additionalData?.bounceProofUrl || target.bounceProofUrl,
      auditTrail: [auditEntry, ...(target.auditTrail || [])],
    };

    setCheques((prev) => prev.map((c) => (c.id === id ? updated : c)));
    safeSetDoc(doc(db, "cheques", id), updated, { merge: true });

    // Bidirectional sync with lease installment
    syncChequeWithLease(updated, newStatus);

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "CHEQUE",
      id,
      `Cheque #${target.chequeNumber}`,
      `Changed cheque status from ${oldStatus} to ${newStatus}`,
      oldStatus,
      newStatus,
      modificationReason
    );

    setTimeout(() => {
      recalculateTenantRisk(target.tenantId);
    }, 150);

    return { success: true };
  };

  const depositCheque = async (params: {
    chequeId: string;
    depositedDate: string;
    depositSlipNumber?: string;
    depositedBankName?: string;
    depositProofUrl?: string;
    notes?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const targetRef = doc(db, "cheques", params.chequeId);
        const targetSnap = await transaction.get(targetRef);
        if (!targetSnap.exists()) throw new Error("Cheque not found");
        const target = targetSnap.data() as Cheque;

        const caseCheck = checkCaseControlledCheque(params.chequeId);
        if (caseCheck.isControlled) {
          throw new Error(language === "ar" ? `عذراً، هذا الشيك محجوز على ذمة قضية.` : `Sorry, this cheque is reserved under an active legal case.`);
        }

        if (target.status === "DEPOSITED") throw new Error(language === "ar" ? "الشيك مودع مسبقاً." : "This cheque is already deposited.");
        if (target.status === "CLEARED" || target.status === "COLLECTED") throw new Error(language === "ar" ? "لا يمكن إيداع شيك مسوى مسبقاً." : "This cheque has already been cleared or collected.");
        if (target.status === "CANCELLED" || target.status === "REPLACED") throw new Error(language === "ar" ? `لا يمكن إيداع شيك غير سارٍ (${target.status}).` : `Cannot deposit a ${target.status} cheque.`);

        if (!params.depositProofUrl && !params.depositSlipNumber) throw new Error(language === "ar" ? "يجب إرفاق إثبات الإيداع أو إدخال رقم الحافظة." : "Bank deposit proof or slip number is required.");

        const oldStatus = target.status;
        const nowIso = new Date().toISOString();

        const auditEntry: ChequeAuditEntry = {
          id: "aud-" + Date.now(),
          previousStatus: oldStatus,
          newStatus: "DEPOSITED",
          timestamp: nowIso,
          performedBy: params.userName || currentUser?.nameAr || currentUser?.nameEn || "System User",
          performedByUserId: params.userId || currentUser?.id || "system",
          reference: params.depositSlipNumber,
          proofUrl: params.depositProofUrl,
          notes: params.notes,
        };

        const updated: Cheque = {
          ...target,
          status: "DEPOSITED",
          depositedDate: params.depositedDate,
          depositSlipNumber: params.depositSlipNumber || target.depositSlipNumber,
          depositedBankName: params.depositedBankName || target.depositedBankName,
          depositProofUrl: params.depositProofUrl || target.depositProofUrl,
          depositNotes: params.notes || target.depositNotes,
          auditTrail: [auditEntry, ...(target.auditTrail || [])],
        };

        transaction.set(targetRef, sanitizeForFirestore(updated), { merge: true });

        return updated;
      });

      setCheques((prev) => prev.map((c) => (c.id === params.chequeId ? result : c)));
      syncChequeWithLease(result, "DEPOSITED");

      logAudit("FINANCIAL_RECORD_EDIT", "CHEQUE", params.chequeId, `Cheque #${result.chequeNumber}`, `Deposited in bank.`);

      return { success: true };
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const clearCheque = async (params: {
    chequeId: string;
    clearingDate: string;
    clearingRef?: string;
    clearingProofUrl?: string;
    notes?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const targetRef = doc(db, "cheques", params.chequeId);
        const targetSnap = await transaction.get(targetRef);
        if (!targetSnap.exists()) throw new Error("Cheque not found");
        const target = targetSnap.data() as Cheque;

        const caseCheck = checkCaseControlledCheque(params.chequeId);
        if (caseCheck.isControlled) {
          throw new Error(language === "ar" ? `عذراً، هذا الشيك محجوز على ذمة قضية.` : `Sorry, this cheque is reserved under an active legal case.`);
        }

        if (target.status === "CLEARED") throw new Error(language === "ar" ? "الشيك تمت مقاصته وصرفه في الحساب البنكي مسبقاً." : "This cheque has already been cleared.");
        if (target.status === "COLLECTED") throw new Error(language === "ar" ? "تم تحصيل هذا الشيك مسبقاً بموجب سند قبض." : "This cheque has already been collected.");
        if (target.status === "CANCELLED" || target.status === "REPLACED") throw new Error(language === "ar" ? `لا يمكن مقاصة شيك غير سارٍ (${target.status}).` : `Cannot clear a ${target.status} cheque.`);

        if (!params.clearingProofUrl) throw new Error(language === "ar" ? "يجب إرفاق إثبات المقاصة / التحصيل البنكي لاعتماد الصرف." : "Bank clearing proof is strictly required.");
        if (!params.clearingRef || !params.clearingRef.trim()) throw new Error(language === "ar" ? "يجب إدخال رقم المرجع المصرفي لعملية المقاصة البنكية." : "Bank clearing reference number is required.");

        const oldStatus = target.status;
        const nowIso = new Date().toISOString();

        const auditEntry: ChequeAuditEntry = {
          id: "aud-" + Date.now(),
          previousStatus: oldStatus,
          newStatus: "CLEARED",
          timestamp: nowIso,
          performedBy: params.userName || currentUser?.nameAr || currentUser?.nameEn || "System User",
          performedByUserId: params.userId || currentUser?.id || "system",
          reference: params.clearingRef,
          proofUrl: params.clearingProofUrl,
          notes: params.notes,
        };

        const updated: Cheque = {
          ...target,
          status: "CLEARED",
          clearingDate: params.clearingDate,
          clearingRef: params.clearingRef || target.clearingRef,
          clearingProofUrl: params.clearingProofUrl || target.clearingProofUrl,
          clearingNotes: params.notes || target.clearingNotes,
          clearedByUserId: params.userId || currentUser?.id || "system",
          outstanding: 0,
          totalApplied: target.amount,
          auditTrail: [auditEntry, ...(target.auditTrail || [])],
        };

        transaction.set(targetRef, sanitizeForFirestore(updated), { merge: true });

        const colId = "col-" + Date.now();
        const receiptNumber = generateSequentialNumber(collections, "receiptNumber", "RCP-", 4, false);
        const receipt: CollectionRecord = {
          id: colId,
          receiptNumber: receiptNumber,
          chequeId: target.id,
          tenantId: target.tenantId,
          ownerId: target.ownerId,
          paymentDate: params.clearingDate,
          amountEntered: target.amount,
          amountApplied: target.amount,
          paymentMethod: "BANK_TRANSFER",
          transactionReference: params.clearingRef,
          notes: params.notes,
          payerName: (target as any).tenantNameEn || "Tenant",
          collectedBy: params.userName || currentUser?.nameEn || "System",
          collectedByUserId: params.userId || currentUser?.id || "sys",
          createdAt: nowIso,
        };
        transaction.set(doc(db, "collections", colId), sanitizeForFirestore(receipt));

        const allocId = "pal-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
        const alloc: PaymentAllocation = {
          id: allocId,
          collectionId: colId,
          targetType: "CHEQUE",
          targetId: target.id,
          allocatedAmount: target.amount,
          allocationDate: params.clearingDate,
          status: "ACTIVE",
          createdById: params.userId || currentUser?.id || "system",

          createdAt: nowIso,
        };
        transaction.set(doc(db, "payment_allocations", allocId), sanitizeForFirestore(alloc));

        return { updated, receipt, alloc };
      });

      setCheques((prev) => prev.map((c) => (c.id === params.chequeId ? result.updated : c)));
      setCollections((prev) => [result.receipt, ...prev]);
      setPaymentAllocations((prev) => [...prev, result.alloc]);

      syncChequeWithLease(result.updated, "CLEARED");
      dispatchChequeCollectedNotification(result.updated.id);

      logAudit("FINANCIAL_RECORD_EDIT", "CHEQUE", params.chequeId, `Cheque #${result.updated.chequeNumber}`, `Cleared and reconciled in bank.`);
      setTimeout(() => { recalculateTenantRisk(result.updated.tenantId); }, 150);

      return { success: true };
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const bulkUpdateCheques = (ids: string[], patch: Partial<Cheque>) => {
    setCheques((prev) =>
      prev.map((c) => {
        if (ids.includes(c.id)) {
          const updated = { ...c, ...patch };
          safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
          syncChequeWithLease(updated, patch.status);
          return updated;
        }
        return c;
      })
    );
    logAudit("UPDATE", "CHEQUE", ids.join(","), `Bulk Cheques (${ids.length})`, `Bulk updated ${ids.length} cheques`);
  };

  /**
   * Replaces a cheque (Bounced, Pending, or Post-Dated) with one or more replacement cheques.
   * - Preserves the original cheque record (never deletes it)
   * - Updates original cheque status to "REPLACED", sets outstanding to 0 (to avoid double liability)
   * - Creates new replacement cheque(s) in the central 'cheques' collection
   * - Links each replacement cheque with originalChequeId, isReplacement: true, replacementReason, replacementDate
   * - Validates total replacement amounts equal the original cheque's target balance
   * - Synchronizes the linked Lease Installment schedule: replaces the old installment reference or splits into multiple installments
   * - Preserves the underlying rent obligation until settled
   * - Atomically persists across cheques and leases
   * - Logs full audit trail
   */
  const replaceCheque = (params: {
    originalChequeId: string;
    replacementCheques: Array<{
      chequeNumber: string;
      bankName: string;
      amount: number;
      chequeDate: string;
      dueDate: string;
      drawerName?: string;
      accountNumber?: string;
      notes?: string;
      existingChequeId?: string;
    }>;
    reason: string;
    date?: string;
  }): { success: boolean; newCheques?: Cheque[]; error?: string } => {
    const origCheque = cheques.find((c) => c.id === params.originalChequeId);
    if (!origCheque) {
      return { success: false, error: "الشيك الأصلي غير موجود" };
    }

    const caseCheck = checkCaseControlledCheque(params.originalChequeId);
    if (caseCheck.isControlled) {
      return {
        success: false,
        error: language === "ar"
          ? "عذراً، هذا الشيك محجوز على ذمة قضية قانونية مفتوحة ولا يمكن استبداله حالياً."
          : "Sorry, this cheque is reserved under an active legal case and cannot be replaced.",
      };
    }

    if (origCheque.status === "REPLACED" || origCheque.status === "CANCELLED" || origCheque.status === "COLLECTED" || origCheque.status === "CLEARED") {
      return {
        success: false,
        error: language === "ar"
          ? `لا يمكن استبدال شيك مقفل أو مسوى بحالة (${origCheque.status}).`
          : `Cannot replace a terminal or settled cheque with status (${origCheque.status}).`,
      };
    }

    if (!params.reason || !params.reason.trim()) {
      return {
        success: false,
        error: language === "ar" ? "سبب استبدال الشيك إلزامي للتوثيق المالي." : "Cheque replacement reason is mandatory for audit trail.",
      };
    }

    if (!params.replacementCheques || params.replacementCheques.length === 0) {
      return {
        success: false,
        error: language === "ar" ? "يرجى إضافة شيك بديل واحد على الأقل." : "Please add at least one replacement cheque.",
      };
    }

    const totalReplacementAmount = params.replacementCheques.reduce((sum, chq) => sum + (Number(chq.amount) || 0), 0);
    const targetOutstanding = origCheque.outstanding > 0 ? origCheque.outstanding : origCheque.amount;

    if (totalReplacementAmount <= 0) {
      return { success: false, error: "مجموع مبالغ الشيكات البديلة يجب أن يكون أكبر من الصفر" };
    }

    if (Math.abs(totalReplacementAmount - targetOutstanding) > 0.01) {
      return {
        success: false,
        error: language === "ar"
          ? `مجموع الشيكات البديلة (${totalReplacementAmount.toLocaleString()} درهم) لا يطابق رصيد الشيك الأصلي (${targetOutstanding.toLocaleString()} درهم).`
          : `Total replacement cheques (AED ${totalReplacementAmount.toLocaleString()}) does not match original cheque outstanding balance (AED ${targetOutstanding.toLocaleString()}).`,
      };
    }

    const repGroupId = "rep-grp-" + Date.now();
    const repDate = params.date || new Date().toISOString().split("T")[0];

    // Locate linked lease
    let targetLease = leases.find((l) => origCheque.leaseId && (l.id === origCheque.leaseId || l.leaseNumber === origCheque.leaseId));
    if (!targetLease && origCheque.tenantId) {
      targetLease = leases.find(
        (l) => l.tenantId === origCheque.tenantId && (!origCheque.propertyId || l.propertyId === origCheque.propertyId)
      );
    }

    // Process all replacement cheques (new or existing)
    const finalReplacementCheques: Cheque[] = [];
    const newChequeIds: string[] = [];
    const existingChequeIdsToUpdate = new Set<string>();

    for (let idx = 0; idx < params.replacementCheques.length; idx++) {
      const item = params.replacementCheques[idx];

      if (item.existingChequeId) {
        // Validate existing cheque
        const existingChq = cheques.find((c) => c.id === item.existingChequeId);
        if (!existingChq) {
          return {
            success: false,
            error: language === "ar"
              ? `الشيك المسجل مسبقاً برقم ID (${item.existingChequeId}) غير موجود.`
              : `Existing cheque with ID (${item.existingChequeId}) not found.`,
          };
        }

        if (
          existingChq.status === "REPLACED" ||
          existingChq.status === "CANCELLED" ||
          existingChq.status === "COLLECTED" ||
          existingChq.status === "CLEARED" ||
          existingChq.status === "BOUNCED"
        ) {
          return {
            success: false,
            error: language === "ar"
              ? `الشيك المسجل #${existingChq.chequeNumber} غير مؤهل للاستبدال لأن حالته (${existingChq.status}).`
              : `Existing cheque #${existingChq.chequeNumber} is not eligible for replacement because its status is (${existingChq.status}).`,
          };
        }

        // Check if existing cheque is locked by a legal case
        const existingCaseCheck = checkCaseControlledCheque(existingChq.id);
        if (existingCaseCheck.isControlled) {
          return {
            success: false,
            error: language === "ar"
              ? `الشيك المسجل #${existingChq.chequeNumber} محجوز على ذمة قضية قانونية مفتوحة ولا يمكن استخدامه كبديل.`
              : `Existing cheque #${existingChq.chequeNumber} is locked by an active legal case and cannot be used as replacement.`,
          };
        }

        newChequeIds.push(existingChq.id);
        existingChequeIdsToUpdate.add(existingChq.id);

        const updatedExisting: Cheque = {
          ...existingChq,
          chequeNumber: item.chequeNumber ? String(item.chequeNumber).trim() : existingChq.chequeNumber,
          bankName: item.bankName ? String(item.bankName).trim() : existingChq.bankName,
          amount: Number(item.amount) || existingChq.amount,
          chequeDate: item.chequeDate || existingChq.chequeDate,
          dueDate: item.dueDate || existingChq.dueDate,
          ownerId: targetLease?.ownerId || origCheque.ownerId || existingChq.ownerId,
          ownerName: origCheque.ownerName || existingChq.ownerName,
          tenantId: targetLease?.tenantId || origCheque.tenantId || existingChq.tenantId,
          propertyId: targetLease?.propertyId || origCheque.propertyId || existingChq.propertyId,
          unitId: targetLease?.unitId || origCheque.unitId || existingChq.unitId,
          leaseId: targetLease?.id || origCheque.leaseId || existingChq.leaseId,
          originalChequeId: origCheque.id,
          isReplacement: true,
          replacementGroupId: repGroupId,
          replacementReason: params.reason.trim(),
          replacementDate: repDate,
          notes: `${existingChq.notes ? existingChq.notes + "\n" : ""}تم تعيينه كشيك بديل للشيك #${origCheque.chequeNumber}. ${item.notes || ""}`,
          auditTrail: [
            {
              id: "aud-" + Date.now() + "-" + (idx + 1),
              previousStatus: existingChq.status,
              newStatus: existingChq.status,
              timestamp: new Date().toISOString(),
              performedBy: currentUser?.nameAr || currentUser?.nameEn || "System User",
              performedByUserId: currentUser?.id || "system",
              notes: `تم تعيينه كشيك بديل للشيك رقم #${origCheque.chequeNumber}. السبب: ${params.reason.trim()}`,
            },
            ...(existingChq.auditTrail || []),
          ],
        };

        finalReplacementCheques.push(updatedExisting);
      } else {
        // Create new replacement cheque
        const newChqId = `chq-rep-${Date.now()}-${idx + 1}`;
        newChequeIds.push(newChqId);

        const isDue = new Date(item.dueDate) <= new Date();
        const initialStatus: ChequeStatus = isDue ? "PENDING" : "POST_DATED";

        const newChq: Cheque = {
          id: newChqId,
          chequeNumber: String(item.chequeNumber).trim(),
          bankName: String(item.bankName).trim(),
          amount: Number(item.amount),
          chequeDate: item.chequeDate,
          dueDate: item.dueDate,
          ownerId: targetLease?.ownerId || origCheque.ownerId,
          ownerName: origCheque.ownerName,
          tenantId: targetLease?.tenantId || origCheque.tenantId,
          propertyId: targetLease?.propertyId || origCheque.propertyId,
          unitId: targetLease?.unitId || origCheque.unitId,
          leaseId: targetLease?.id || origCheque.leaseId,
          status: initialStatus,
          originalStatus: "NORMAL",
          collectionStatus: "NOT_COLLECTED",
          totalApplied: 0,
          outstanding: Number(item.amount),
          whatsAppStatus: "NONE",
          reminderCount: 0,
          drawerName: item.drawerName || origCheque.drawerName,
          accountNumber: item.accountNumber || origCheque.accountNumber,
          notes: `شيك بديل عن الشيك رقم #${origCheque.chequeNumber}. ${item.notes || ""}`,
          createdAt: new Date().toISOString(),

          // Replacement tracking fields
          originalChequeId: origCheque.id,
          isReplacement: true,
          replacementGroupId: repGroupId,
          replacementReason: params.reason.trim(),
          replacementDate: repDate,
          auditTrail: [
            {
              id: "aud-" + Date.now() + "-" + (idx + 1),
              previousStatus: initialStatus,
              newStatus: initialStatus,
              timestamp: new Date().toISOString(),
              performedBy: currentUser?.nameAr || currentUser?.nameEn || "System User",
              performedByUserId: currentUser?.id || "system",
              notes: `شيك بديل تم إنشاؤه للشيك رقم #${origCheque.chequeNumber}. السبب: ${params.reason.trim()}`,
            },
          ],
        };

        finalReplacementCheques.push(newChq);
      }
    }

    const origAuditEntry: ChequeAuditEntry = {
      id: "aud-" + Date.now(),
      previousStatus: origCheque.status,
      newStatus: "REPLACED",
      timestamp: new Date().toISOString(),
      performedBy: currentUser?.nameAr || currentUser?.nameEn || "System User",
      performedByUserId: currentUser?.id || "system",
      notes: `تم الاستبدال بـ ${params.replacementCheques.length} شيك بديل (${params.replacementCheques.map(c => "#" + c.chequeNumber).join(", ")}). السبب: ${params.reason.trim()}`,
    };

    // Update original cheque: status -> REPLACED, outstanding -> 0 (locked, historical)
    const updatedOriginal: Cheque = {
      ...origCheque,
      status: "REPLACED",
      outstanding: 0,
      replacementChequeIds: newChequeIds,
      replacementGroupId: repGroupId,
      replacementReason: params.reason.trim(),
      replacementDate: repDate,
      notes: `${origCheque.notes ? origCheque.notes + "\n" : ""}تم استبداله بالشيك/الشيكات (${params.replacementCheques.map(c => "#" + c.chequeNumber).join(", ")}) بتاريخ ${repDate}. السبب: ${params.reason.trim()}`,
      auditTrail: [origAuditEntry, ...(origCheque.auditTrail || [])],
    };

    // Synchronize Lease Installment Schedule
    let updatedLease: Lease | null = null;
    if (targetLease && targetLease.installments && targetLease.installments.length > 0) {
      const origInstIdx = targetLease.installments.findIndex(
        (inst) =>
          (inst.chequeId && inst.chequeId === origCheque.id) ||
          isSameChequeNumber(inst.chequeNumber, origCheque.chequeNumber) ||
          (inst.dueDate === origCheque.dueDate && Math.abs((inst.amount || 0) - (origCheque.amount || 0)) < 1.0)
      );

      if (origInstIdx !== -1) {
        const currentInsts = [...targetLease.installments];
        const origInst = currentInsts[origInstIdx];

        if (finalReplacementCheques.length === 1) {
          const singleRep = finalReplacementCheques[0];
          currentInsts[origInstIdx] = {
            ...origInst,
            chequeId: singleRep.id,
            chequeNumber: singleRep.chequeNumber,
            amount: singleRep.amount,
            dueDate: singleRep.dueDate,
            status: "PENDING",
            notes: `استبدال من الشيك #${origCheque.chequeNumber}. ${params.reason.trim()}`,
          };
        } else {
          // Split replacement: replace 1 installment with multiple new installment records
          const splitInsts: LeaseInstallment[] = finalReplacementCheques.map((chq, cIdx) => ({
            installmentNumber: origInst.installmentNumber, // will be re-sequenced
            dueDate: chq.dueDate,
            amount: chq.amount,
            chequeId: chq.id,
            chequeNumber: chq.chequeNumber,
            status: "PENDING",
            notes: `تجزئة واستبدال (${cIdx + 1}/${finalReplacementCheques.length}) من الشيك #${origCheque.chequeNumber}. ${params.reason.trim()}`,
          }));

          currentInsts.splice(origInstIdx, 1, ...splitInsts);
        }

        // Re-sequence all installment numbers cleanly
        const resequencedInsts = currentInsts.map((inst, i) => ({
          ...inst,
          installmentNumber: i + 1,
        }));

        updatedLease = {
          ...targetLease,
          installments: resequencedInsts,
          installmentsCount: resequencedInsts.length,
          chequesCount: resequencedInsts.length,
        };
      }
    }

    // Persist replacement and updated records
    try {
      finalReplacementCheques.forEach((chq) => {
        safeSetDoc(doc(db, "cheques", chq.id), chq, { merge: existingChequeIdsToUpdate.has(chq.id) });
      });
      safeSetDoc(doc(db, "cheques", origCheque.id), updatedOriginal, { merge: true });
      if (updatedLease) {
        safeSetDoc(doc(db, "leases", updatedLease.id), updatedLease, { merge: true });
      }
    } catch (e) {
      console.error("Firestore persistence failed in replaceCheque:", e);
    }

    // Update in-memory state
    setCheques((prev) => {
      const newItems = finalReplacementCheques.filter((c) => !existingChequeIdsToUpdate.has(c.id));
      const existingMap = new Map(finalReplacementCheques.filter((c) => existingChequeIdsToUpdate.has(c.id)).map((c) => [c.id, c]));

      const updatedPrev = prev.map((c) => {
        if (c.id === origCheque.id) return updatedOriginal;
        if (existingMap.has(c.id)) return existingMap.get(c.id)!;
        return c;
      });

      return [...newItems, ...updatedPrev];
    });

    if (updatedLease) {
      setLeases((prev) => prev.map((l) => (l.id === updatedLease!.id ? updatedLease! : l)));
    }

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "CHEQUE",
      origCheque.id,
      `Cheque #${origCheque.chequeNumber}`,
      `Replaced cheque #${origCheque.chequeNumber} (AED ${origCheque.amount.toLocaleString()}) with ${finalReplacementCheques.length} replacement cheque(s): ${finalReplacementCheques.map(c => '#' + c.chequeNumber).join(', ')}`,
      origCheque.status,
      "REPLACED",
      params.reason.trim()
    );

    return { success: true, newCheques: finalReplacementCheques };
  };

  /**
   * Cancels a cheque while safeguarding the financial obligation, lease schedule, and audit trail.
   */
  const cancelCheque = (params: {
    chequeId: string;
    cancellationType: ChequeCancellationType;
    reason: string;
    settlementRef?: string;
    userId?: string;
  }): { success: boolean; error?: string } => {
    const target = cheques.find((c) => c.id === params.chequeId);
    if (!target) return { success: false, error: "الشيك غير موجود" };

    const caseCheck = checkCaseControlledCheque(params.chequeId);
    if (caseCheck.isControlled) {
      return {
        success: false,
        error: language === "ar"
          ? "عذراً، هذا الشيك محجوز على ذمة قضية قانونية مفتوحة ولا يمكن إلغاؤه."
          : "Sorry, this cheque is reserved under an active legal case and cannot be cancelled.",
      };
    }

    if (target.status === "CANCELLED") {
      return { success: false, error: "الشيك ملغى بالفعل ومقفل دفترياً." };
    }
    if (target.status === "REPLACED") {
      return { success: false, error: "لا يمكن إلغاء شيك تم استبداله بالفعل." };
    }
    if (target.status === "CLEARED" || target.status === "COLLECTED") {
      return { success: false, error: "لا يمكن إلغاء شيك تم صرفه أو تحصيله بالكامل." };
    }

    if (!params.reason || !params.reason.trim()) {
      return { success: false, error: "سبب الإلغاء إلزامي لتوثيق السجل المحاسبي." };
    }

    const check = checkFinancialEditPermission("CHEQUE", params.reason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("CHEQUE", target, "VERSION");

    const todayStr = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    const auditEntry: ChequeAuditEntry = {
      id: "aud-" + Date.now(),
      previousStatus: target.status,
      newStatus: "CANCELLED",
      timestamp: nowIso,
      performedBy: currentUser?.nameAr || currentUser?.nameEn || "System User",
      performedByUserId: params.userId || currentUser?.id || "system",
      notes: `إلغاء الشيك (${params.cancellationType}). السبب: ${params.reason.trim()}`,
      reason: params.reason.trim(),
      reference: params.settlementRef,
    };

    const updated: Cheque = {
      ...target,
      status: "CANCELLED",
      outstanding: 0, // Cheque instrument is locked from direct collection
      cancellationType: params.cancellationType,
      cancellationReason: params.reason.trim(),
      cancelledAt: todayStr,
      cancelledByUserId: params.userId || "system",
      cancellationSettlementRef: params.settlementRef,
      notes: `${target.notes ? target.notes + "\n" : ""}تم إلغاء الشيك بتاريخ ${todayStr}. نوع الإلغاء: ${params.cancellationType}. السبب: ${params.reason.trim()}${params.settlementRef ? ` | المرجع: ${params.settlementRef}` : ""}`,
      auditTrail: [auditEntry, ...(target.auditTrail || [])],
    };

    // Find linked lease and sync installment
    let targetLease = leases.find((l) => target.leaseId && (l.id === target.leaseId || l.leaseNumber === target.leaseId));
    if (!targetLease && target.tenantId) {
      targetLease = leases.find((l) => l.tenantId === target.tenantId && (!target.propertyId || l.propertyId === target.propertyId));
    }

    let updatedLease: Lease | null = null;
    if (targetLease && targetLease.installments && targetLease.installments.length > 0) {
      const instIdx = targetLease.installments.findIndex(
        (inst) =>
          (inst.chequeId && inst.chequeId === target.id) ||
          isSameChequeNumber(inst.chequeNumber, target.chequeNumber) ||
          (inst.dueDate === target.dueDate && Math.abs((inst.amount || 0) - (target.amount || 0)) < 1.0)
      );

      if (instIdx !== -1) {
        const updatedInstallments = [...targetLease.installments];
        let newInstStatus: "PENDING" | "WAIVED" | "COLLECTED" = "PENDING";
        let instNote = `تم إلغاء الشيك #${target.chequeNumber}. السبب: ${params.reason.trim()}`;

        if (params.cancellationType === "APPROVED_WAIVER") {
          newInstStatus = "WAIVED";
          instNote = `تم إلغاء الشيك وإعفاء الدفعة بموافقة المالك. السبب: ${params.reason.trim()}`;
        } else if (params.cancellationType === "SETTLED_OTHER_MEANS") {
          newInstStatus = "COLLECTED";
          instNote = `تم إلغاء الشيك وسداد القسط بوسيلة بديلة (مرجع: ${params.settlementRef || "تسوية نقدية/تحويل"}). السبب: ${params.reason.trim()}`;
        } else if (params.cancellationType === "CONTRACT_TERMINATED") {
          newInstStatus = "WAIVED";
          instNote = `تم إلغاء الشيك لفسخ/إنهاء العقد. السبب: ${params.reason.trim()}`;
        } else {
          // OTHER / ADMINISTRATIVE: Rent obligation survives as PENDING
          newInstStatus = "PENDING";
          instNote = `تم إلغاء الورقة المالية للشيك #${target.chequeNumber}. القسط ما زال مستحقاً بانتظار وسيلة سداد بديلة.`;
        }

        updatedInstallments[instIdx] = {
          ...updatedInstallments[instIdx],
          status: newInstStatus,
          chequeId: params.cancellationType === "APPROVED_WAIVER" || params.cancellationType === "SETTLED_OTHER_MEANS" ? target.id : undefined,
          notes: instNote,
        };

        updatedLease = {
          ...targetLease,
          installments: updatedInstallments,
        };
      }
    }

    // Persist to database
    try {
      safeSetDoc(doc(db, "cheques", target.id), updated, { merge: true });
      if (updatedLease) {
        safeSetDoc(doc(db, "leases", updatedLease.id), updatedLease, { merge: true });
      }
    } catch (e) {
      console.error("Firestore persistence failed in cancelCheque:", e);
    }

    setCheques((prev) => prev.map((c) => (c.id === target.id ? updated : c)));
    if (updatedLease) {
      setLeases((prev) => prev.map((l) => (l.id === updatedLease!.id ? updatedLease! : l)));
    }

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "CHEQUE",
      target.id,
      `Cheque #${target.chequeNumber}`,
      `Cancelled cheque #${target.chequeNumber} (AED ${target.amount.toLocaleString()}) - Type: ${params.cancellationType}`,
      target.status,
      "CANCELLED",
      params.reason.trim()
    );

    return { success: true };
  };

  /**
   * Dedicated action to mark a lease installment as BOUNCED.
   * Finds or auto-creates the linked cheque in the cheques register,
   * updates the lease installment status to BOUNCED, and ensures 100% synchronization.
   */
  const markInstallmentAsBounced = (
    leaseId: string,
    installmentNumber: number,
    reason?: string
  ): { success: boolean; cheque?: Cheque; error?: string } => {
    const targetLease = leases.find((l) => l.id === leaseId || l.leaseNumber === leaseId);
    if (!targetLease) {
      return { success: false, error: "عقد الإيجار غير موجود" };
    }

    const instList = targetLease.installments || [];
    const inst = instList.find((i) => i.installmentNumber === installmentNumber);
    if (!inst) {
      return { success: false, error: "القسط غير موجود في العقد" };
    }

    // 1. Find or create linked cheque
    let linkedCheque = findLinkedChequeForInstallment(cheques, inst, targetLease);
    const todayStr = new Date().toISOString().split("T")[0];
    const bounceReason = reason || "Marked as bounced from lease installment schedule";

    if (linkedCheque) {
      const oldStatus = linkedCheque.status;
      const updatedCheque: Cheque = {
        ...linkedCheque,
        status: "BOUNCED",
        originalStatus: "BOUNCED",
        returnedDate: linkedCheque.returnedDate || todayStr,
        returnReason: linkedCheque.returnReason || "INSUFFICIENT_FUNDS",
        whatsAppStatus: "PENDING_REMINDER",
        leaseId: targetLease.id,
        propertyId: targetLease.propertyId,
        unitId: targetLease.unitId,
        tenantId: targetLease.tenantId,
        outstanding: linkedCheque.outstanding > 0 ? linkedCheque.outstanding : linkedCheque.amount,
      };

      setCheques((prev) => prev.map((c) => (c.id === linkedCheque!.id ? updatedCheque : c)));
      safeSetDoc(doc(db, "cheques", linkedCheque.id), updatedCheque, { merge: true });

      logAudit(
        "FINANCIAL_RECORD_EDIT",
        "CHEQUE",
        linkedCheque.id,
        `Cheque #${linkedCheque.chequeNumber}`,
        `Changed cheque status from ${oldStatus} to BOUNCED via lease workspace`,
        oldStatus,
        "BOUNCED",
        bounceReason
      );
      linkedCheque = updatedCheque;
    } else {
      // Auto-create cheque record so it never gets lost and appears in Bounced Cheques view
      const prop = properties.find((p) => p.id === targetLease.propertyId);
      const chqNum = inst.chequeNumber
        ? String(inst.chequeNumber).trim()
        : `CHQ-${targetLease.leaseNumber || targetLease.id.substring(0, 4)}-${installmentNumber}`;

      const newCheque: Cheque = {
        id: "chq-" + Date.now(),
        chequeNumber: chqNum,
        bankName: "UAE Bank",
        amount: inst.amount,
        chequeDate: inst.dueDate,
        dueDate: inst.dueDate,
        ownerId: prop?.ownerId || owners[0]?.id || "ow-01",
        tenantId: targetLease.tenantId,
        propertyId: targetLease.propertyId,
        unitId: targetLease.unitId,
        leaseId: targetLease.id,
        status: "BOUNCED",
        originalStatus: "BOUNCED",
        returnReason: "INSUFFICIENT_FUNDS",
        returnedDate: todayStr,
        collectionStatus: "NOT_COLLECTED",
        totalApplied: 0,
        outstanding: inst.amount,
        whatsAppStatus: "PENDING_REMINDER",
        reminderCount: 0,
        createdAt: new Date().toISOString(),
        notes: `Auto-created and marked as bounced from lease #${targetLease.leaseNumber}. ${bounceReason}`,
      };

      setCheques((prev) => [newCheque, ...prev]);
      safeSetDoc(doc(db, "cheques", newCheque.id), newCheque);

      logAudit(
        "CREATE",
        "CHEQUE",
        newCheque.id,
        `Cheque #${newCheque.chequeNumber}`,
        `Created bounced cheque record #${newCheque.chequeNumber} for AED ${newCheque.amount.toLocaleString()} from lease installment #${installmentNumber}`
      );
      linkedCheque = newCheque;
    }

    // 2. Update installment status in lease
    const updatedInstallments = instList.map((i) => {
      if (i.installmentNumber === installmentNumber) {
        return {
          ...i,
          status: "BOUNCED" as const,
          chequeId: linkedCheque!.id,
          chequeNumber: i.chequeNumber || linkedCheque!.chequeNumber,
        };
      }
      return i;
    });

    const updatedLease = { ...targetLease, installments: updatedInstallments };
    setLeases((prev) => prev.map((l) => (l.id === targetLease.id ? updatedLease : l)));
    safeSetDoc(doc(db, "leases", targetLease.id), updatedLease, { merge: true });

    setTimeout(() => {
      recalculateTenantRisk(targetLease.tenantId);
    }, 200);

    return { success: true, cheque: linkedCheque };
  };

  /**
   * Updates an installment status directly in a lease contract.
   */
  const updateLeaseInstallmentStatus = (
    leaseId: string,
    installmentNumber: number,
    status: "PENDING" | "CLEARED" | "BOUNCED" | "COLLECTED" | "WAIVED",
    chequeId?: string
  ): { success: boolean; error?: string } => {
    const targetLease = leases.find((l) => l.id === leaseId || l.leaseNumber === leaseId);
    if (!targetLease) return { success: false, error: "Lease not found" };

    const instList = targetLease.installments || [];
    const updatedInstallments = instList.map((inst) => {
      if (inst.installmentNumber === installmentNumber) {
        return {
          ...inst,
          status,
          chequeId: chequeId || inst.chequeId,
        };
      }
      return inst;
    });

    const updatedLease = { ...targetLease, installments: updatedInstallments };
    setLeases((prev) => prev.map((l) => (l.id === targetLease.id ? updatedLease : l)));
    safeSetDoc(doc(db, "leases", targetLease.id), updatedLease, { merge: true });
    return { success: true };
  };

  
  const extractDocumentOCR = async (documentType: string, imageBase64: string, mimeType = "image/jpeg"): Promise<any> => {
    try {
      let cleanB64 = (imageBase64 || "").trim();
      if (cleanB64.includes(",")) {
        cleanB64 = cleanB64.substring(cleanB64.lastIndexOf(",") + 1);
      }
      cleanB64 = cleanB64.replace(/[\r\n\s]/g, "");
      const safeDataUrl = `data:${mimeType};base64,${cleanB64}`;

      if (documentType === "EMIRATES_ID") {
        try {
          const { OCRV2Engine } = await import("../services/ocr/v2/OCRV2Engine");
          const v2Res = await OCRV2Engine.extract(safeDataUrl, "EMIRATES_ID", "accurate");
          if (v2Res.success && v2Res.data && Object.keys(v2Res.data).length > 0) {
            return {
              success: true,
              data: v2Res.data,
              fields: v2Res.fields,
              metadata: v2Res.diagnostics,
            };
          }
        } catch (v2Err) {
          console.warn("[DataContext] OCR V2 fallback to V1 for Emirates ID:", v2Err);
        }

        const res = await OCRService.extractDocument(cleanB64, "EMIRATES_ID", "accurate", mimeType);
        return {
          success: res.success,
          data: res.data,
          fields: res.fields,
          metadata: res.metadata,
          error: res.errorAr || res.error,
          errorAr: res.errorAr,
        };
      }

      if (documentType === "CHEQUE") {
        try {
          const { OCRV2Engine } = await import("../services/ocr/v2/OCRV2Engine");
          const v2Res = await OCRV2Engine.extract(safeDataUrl, "CHEQUE", "forensic");
          if (v2Res.success && v2Res.data && Object.keys(v2Res.data).length > 0) {
            return {
              success: true,
              data: v2Res.data,
              fields: v2Res.fields,
              metadata: v2Res.diagnostics,
            };
          }
        } catch (v2Err) {
          console.warn("[DataContext] OCR V2 fallback to V1 for Cheque:", v2Err);
        }

        const res = await OCRService.extractCheque(cleanB64, mimeType);
        return {
          success: res.success,
          data: res.data,
          fields: res.fields,
          metadata: res.metadata,
          error: res.errorAr || res.error,
          errorAr: res.errorAr,
        };
      }

      const res = await OCRService.extractDocument(cleanB64, documentType, "accurate", mimeType);
      return {
        success: res.success,
        data: res.data,
        fields: res.fields,
        metadata: res.metadata,
        error: res.errorAr || res.error,
        errorAr: res.errorAr,
      };
    } catch (e: any) {
      console.error("OCR API error:", e);
      return { success: false, error: e.message || "Failed to process OCR" };
    }
  };

  const extractChequeOCR = async (imageBase64: string, mimeType = "image/jpeg"): Promise<any> => {
    try {
      let cleanB64 = (imageBase64 || "").trim();
      if (cleanB64.includes(",")) {
        cleanB64 = cleanB64.substring(cleanB64.lastIndexOf(",") + 1);
      }
      cleanB64 = cleanB64.replace(/[\r\n\s]/g, "");

      const res = await OCRService.extractCheque(cleanB64, mimeType);
      return {
        success: res.success,
        data: res.data,
        fields: res.fields,
        metadata: res.metadata,
        error: res.errorAr || res.error,
        errorAr: res.errorAr,
      };
    } catch (e: any) {
      console.error("OCR API error:", e);
      return {
        success: false,
        error: e.message || "Failed to process OCR",
      };
    }
  };

  const extractChequeBatchOCR = async (payload: { imageBase64?: string; images?: string[]; mimeType?: string }): Promise<any> => {
    try {
      let safeBase64 = payload.imageBase64;
      if (safeBase64 && safeBase64.includes(",")) {
        safeBase64 = safeBase64.substring(safeBase64.lastIndexOf(",") + 1).replace(/[\r\n\s]/g, "");
      }
      const safeImages = payload.images?.map((img) => {
        if (img && img.includes(",")) {
          return img.substring(img.lastIndexOf(",") + 1).replace(/[\r\n\s]/g, "");
        }
        return img ? img.replace(/[\r\n\s]/g, "") : img;
      });

      const res = await OCRService.extractChequeBatch({
        imageBase64: safeBase64,
        images: safeImages,
        mimeType: payload.mimeType,
      });
      return {
        success: res.success,
        data: res.data,
        error: res.errorAr || res.error,
        errorAr: res.errorAr,
      };
    } catch (e: any) {
      console.error("OCR Batch API error:", e);
      return {
        success: false,
        error: e.message || "Failed to process batch cheque OCR",
      };
    }
  };

  // -------------------------------------------------------------
  // Collections Workflow
  // -------------------------------------------------------------

  const recordCollection = async (params: { chequeId: string; amountEntered: number; bouncedFeeAmount?: number; paymentMethod: PaymentMethod; payerName: string; notes?: string; transactionReference?: string; approvalCode?: string; fromCase?: boolean; userId?: string; userName?: string; }): Promise<{ success: boolean; appliedAmount: number; isOverpayment: boolean; error?: string; receipt?: CollectionRecord }> => {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const chequeRef = doc(db, "cheques", params.chequeId);
        const chequeSnap = await transaction.get(chequeRef);
        if (!chequeSnap.exists()) throw new Error("Cheque not found");
        
        const cheque = chequeSnap.data() as Cheque;
        const caseCheck = checkCaseControlledCheque(params.chequeId);
        if (caseCheck.isControlled && !params.fromCase) {
          throw new Error(language === "ar" ? `هذا الشيك محجوز على ذمة قضية قانونية مفتوحة رقم ${caseCheck.caseNumber}، ولا يمكن تحصيله إلا من داخل القضية.` : `This cheque is reserved under open legal case #${caseCheck.caseNumber}.`);
        }

        if (cheque.status === "CLEARED" || cheque.status === "REPLACED" || cheque.status === "CANCELLED" || (cheque.outstanding <= 0 && cheque.status === "COLLECTED")) {
          throw new Error(language === "ar" ? `لا يمكن تحصيل شيك غير سارٍ أو مسدد بالكامل مسبقاً (الحالة: ${cheque.status}).` : `Cannot record payment for an inactive or already fully settled cheque (Status: ${cheque.status}).`);
        }

        if (isCardPayment(params.paymentMethod) && !params.approvalCode) {
          throw new Error(language === "ar" ? "يجب إدخال رقم الموافقة (Approval Code) عند الدفع بالبطاقة الائتمانية." : "Approval Code is mandatory for card payments.");
        }

        const outstanding = cheque.outstanding;
        const isOverpayment = params.amountEntered > outstanding;
        const appliedAmount = Math.min(params.amountEntered, outstanding);

        const newTotalApplied = cheque.totalApplied + appliedAmount;
        const newOutstanding = cheque.amount - newTotalApplied;
        const isFullyCollected = newOutstanding <= 0;

        const newCollectionStatus: CollectionStatus = isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION";
        const newChequeStatus: ChequeStatus = isFullyCollected ? "COLLECTED" : cheque.status;

        const bouncedFee = params.bouncedFeeAmount || 0;
        const isBouncedFeeAlreadyCollected = cheque.bouncedFeeCollected;
        const finalBouncedFee = isBouncedFeeAlreadyCollected ? 0 : bouncedFee;

        const receiptId = "col-" + Date.now();
        const receiptNumber = generateSequentialNumber(collections, "receiptNumber", "RCP-", 4, false);

        const colAuditEntry: ChequeAuditEntry = {
          id: "aud-" + Date.now(),
          previousStatus: cheque.status,
          newStatus: newChequeStatus,
          timestamp: new Date().toISOString(),
          performedBy: currentUser?.nameAr || currentUser?.nameEn || "System User",
          performedByUserId: currentUser?.id || "system",
          reference: params.transactionReference,
          notes: `تحصيل مالي: تم تطبيق ${appliedAmount.toLocaleString()} درهم بموجب السند #${receiptNumber}. المتبقي: ${Math.max(0, newOutstanding).toLocaleString()} درهم.`,
        };

        const updatedChqWithAudit: Cheque = {
          ...cheque,
          totalApplied: newTotalApplied,
          outstanding: Math.max(0, newOutstanding),
          collectionStatus: newCollectionStatus,
          status: newChequeStatus,
          bouncedFeeCollected: true,
          bouncedFeeCollectedAmount: (cheque.bouncedFeeCollectedAmount || 0) + finalBouncedFee,
          auditTrail: [colAuditEntry, ...(cheque.auditTrail || [])],
        };

        transaction.set(chequeRef, sanitizeForFirestore(updatedChqWithAudit), { merge: true });

        const receipt: CollectionRecord = {
          id: receiptId,
          receiptNumber: receiptNumber,
          chequeId: cheque.id,
          caseId: cheque.convertedToCaseId,
          tenantId: cheque.tenantId,
          ownerId: cheque.ownerId,
          paymentDate: new Date().toISOString().split("T")[0],
          amountEntered: params.amountEntered,
          amountApplied: appliedAmount,
          bouncedFeeAmount: finalBouncedFee > 0 ? finalBouncedFee : undefined,
          paymentMethod: params.paymentMethod,
          transactionReference: params.transactionReference,
          approvalCode: params.approvalCode,
          payerName: params.payerName,
          collectedBy: currentUser?.nameEn || "Finance Officer",
          collectedByUserId: currentUser?.id || "usr-03",
          notes: params.notes,
          createdAt: new Date().toISOString(),
        };

        transaction.set(doc(db, "collections", receiptId), sanitizeForFirestore(receipt));

        const allocId = "pal-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
        const alloc: PaymentAllocation = {
          id: allocId,
          collectionId: receiptId,
          targetType: "CHEQUE",
          targetId: cheque.id,
          allocatedAmount: appliedAmount,
          allocationDate: receipt.paymentDate,
          status: "ACTIVE",
          createdById: params.userId || currentUser?.id || "system",

          createdAt: new Date().toISOString(),
        };

        transaction.set(doc(db, "payment_allocations", allocId), sanitizeForFirestore(alloc));

        return { updatedChqWithAudit, receipt, alloc, isFullyCollected, appliedAmount, isOverpayment };
      });

      setCheques((prev) => prev.map((c) => (c.id === params.chequeId ? result.updatedChqWithAudit : c)));
      setCollections((prev) => [result.receipt, ...prev]);
      setPaymentAllocations((prev) => [...prev, result.alloc]);

      if (result.isFullyCollected) {
        syncChequeWithLease(result.updatedChqWithAudit, "COLLECTED");
      }
      if (result.updatedChqWithAudit.convertedToCaseId) {
        setCases((prevCases) =>
          prevCases.map((c) => {
            if (c.id === result.updatedChqWithAudit.convertedToCaseId) {
              const uCase = recalculateCaseFinancials(c, cheques.map((ch) => (ch.id === result.updatedChqWithAudit.id ? result.updatedChqWithAudit : ch)), propertyExpenses);
              safeSetDoc(doc(db, "cases", c.id), uCase, { merge: true });
              return uCase;
            }
            return c;
          })
        );
      }

      logAudit("FINANCIAL_PAYMENT", "COLLECTION", result.receipt.id, `Receipt #${result.receipt.receiptNumber}`, `Collected ${result.appliedAmount.toLocaleString()} AED against Cheque #${result.updatedChqWithAudit.chequeNumber}.`);

      setTimeout(() => { recalculateTenantRisk(result.updatedChqWithAudit.tenantId); }, 150);

      return { success: true, appliedAmount: result.appliedAmount, isOverpayment: result.isOverpayment, receipt: result.receipt };
    } catch (e: any) {
      console.error(e);
      return { success: false, appliedAmount: 0, isOverpayment: false, error: e.message };
    }
  };

  const deleteCollection = (id: string, options?: DeleteRecordOptions) => {
    const msg = language === "ar"
      ? "المقبوضات المالية المسجلة محمية تماماً ضد الحذف بموجب الحوكمة المالية الصارمة. يرجى استخدام عملية عكس المقبوضات بدلاً من ذلك."
      : "Posted collection receipts are fully protected against deletion under strict financial governance. Please perform a reversal instead.";
    alert(msg);
    return;
  };

  // -------------------------------------------------------------
  // ERP Phase 1: Commission Engine & Financial Allocations
  // -------------------------------------------------------------

  const addVatRate = (data: Omit<VatRateRecord, "id" | "createdAt" | "createdById" | "createdByName">) => {
    if (vatRates.some(v => v.category === data.category && v.effectiveFrom === data.effectiveFrom)) {
      return { success: false, error: "Duplicate effective date for this category." };
    }
    if (data.rate < 0) return { success: false, error: "Rate cannot be negative." };

    const newRate: VatRateRecord = {
      ...data,
      id: "vat-" + Date.now(),
      createdAt: new Date().toISOString(),
      createdById: currentUser?.id || "system",
      createdByName: currentUser?.nameEn || "System",
    };

    setVatRates(prev => [...prev, newRate]);
    safeSetDoc(doc(db, "vatRates", newRate.id), newRate);
    logAudit("CREATE", "CHART_OF_ACCOUNTS", newRate.id, `VAT Rate ${data.rate}%`, `Created new VAT rate effective ${data.effectiveFrom}`);
    return { success: true };
  };

  const updateVatRate = (id: string, patch: Partial<VatRateRecord>, reason?: string) => {
    const existing = vatRates.find(v => v.id === id);
    if (!existing) return { success: false, error: "Rate not found." };

    // Prevent changing rates that are already in the past and likely used
    const today = new Date().toISOString().split("T")[0];
    if (existing.effectiveFrom < today && patch.rate !== undefined && patch.rate !== existing.rate) {
      return { success: false, error: "Cannot modify historical VAT rates already in effect." };
    }

    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    setVatRates(prev => prev.map(v => v.id === id ? updated : v));
    safeSetDoc(doc(db, "vatRates", id), updated, { merge: true });
    logAudit("UPDATE", "CHART_OF_ACCOUNTS", id, `VAT Rate ${existing.rate}%`, reason || `Updated VAT rate details`, JSON.stringify(existing), JSON.stringify(updated));
    return { success: true };
  };

  const deleteVatRate = (id: string, reason?: string) => {
    const existing = vatRates.find(v => v.id === id);
    if (!existing) return { success: false, error: "Rate not found." };

    // Check if used by transactions (simplified check for this phase: if effective from is in past, assume used)
    const today = new Date().toISOString().split("T")[0];
    if (existing.effectiveFrom <= today) {
      return { success: false, error: "Cannot delete a VAT rate that is currently or was previously in effect." };
    }

    setVatRates(prev => prev.filter(v => v.id !== id));
    deleteDoc(doc(db, "vatRates", id));
    logAudit("DELETE", "CHART_OF_ACCOUNTS", id, `VAT Rate ${existing.rate}%`, reason || "Deleted VAT rate record");
    return { success: true };
  };

  const addCommissionObligation = (
    data: Omit<
      CommissionObligation,
      "id" | "businessKey" | "collectedAmount" | "outstandingBalance" | "status" | "createdAt" | "createdById" | "createdByName"
    > & { createdById?: string; createdByName?: string; businessKeySequence?: string }
  ): { success: boolean; commission?: CommissionObligation; error?: string } => {
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(data.dueDate || new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const seq = data.businessKeySequence || "PRIMARY";
    const businessKey = generateCommissionBusinessKey(data.leaseId, data.partyType, data.commissionType, seq);

    const contractYear = String(
      data.contractualCommissionYear ||
      (data.dueDate ? new Date(data.dueDate).getFullYear() : new Date().getFullYear())
    );

    // Business Rule Phase 53: Sequential Revenue Tracking
    // Format: leaseId:partyType:commissionType:contractYear:sequence
    const fullBusinessKey = `${businessKey}:${contractYear}`;

    const existingYearDuplicate = commissions.find(
      (c) =>
        c.status !== "CANCELLED" &&
        c.leaseId === data.leaseId &&
        c.partyType === data.partyType &&
        c.commissionType === data.commissionType &&
        String(c.contractualCommissionYear || (c.dueDate ? new Date(c.dueDate).getFullYear() : (c.createdAt ? new Date(c.createdAt).getFullYear() : new Date().getFullYear()))) === contractYear &&
        (c.businessKeySequence || "PRIMARY") === seq
    );

    if (isDuplicateCommission(commissions, fullBusinessKey) || (!data.isOverride && existingYearDuplicate)) {
      return {
        success: false,
        error: language === "ar"
          ? `تم تسجيل رسوم إدارية لهذا الطرف (${data.partyType === "OWNER" ? "المالك" : "المستأجر"}) عن السنة التعاقدية (${contractYear}) مسبقاً، ويُمنع تكرار الرسوم لنفس السنة.`
          : `Administrative fees already recorded for this party for contractual year ${contractYear}. Duplicate fees are prohibited.`,
      };
    }

    // Calculate total commission amount and tax components
    let totalAmount = 0;
    let vatAmount = 0;
    let vatRate = 0;
    let netRevenueAmount = 0;
    let taxTreatment: "VAT_DEDUCTION" | "NONE" = "NONE";

    if (data.calculationBasis === "PERCENTAGE_OF_RENT") {
      const calc = calculateCommissionAmount(
        data.baseAmount,
        data.partyType,
        data.ratePercentage,
        DEFAULT_COMMISSION_SETTINGS,
        data.commissionType
      );
      totalAmount = calc.amount;
      vatAmount = calc.vatAmount;
      vatRate = calc.vatRate;
      netRevenueAmount = calc.netRevenue;
      taxTreatment = calc.taxTreatment;
    } else {
      totalAmount = data.calculationBasis === "FIXED_AMOUNT" ? (data.fixedAmount || 0) : (data.totalCommissionAmount || 0);
      
      // Central VAT logic for Administrative Fee (VAT-Inclusive Basis)
      if (data.commissionType === "ADMIN_FEE") {
        vatRate = getApplicableVatRate(data.dueDate || new Date().toISOString(), vatRates, "ADMIN_FEE");
        vatAmount = Math.round((totalAmount * vatRate / (100 + vatRate)) * 100) / 100;
        netRevenueAmount = Math.round((totalAmount - vatAmount) * 100) / 100;
        taxTreatment = "VAT_DEDUCTION";
      } else {
        netRevenueAmount = totalAmount;
        taxTreatment = "NONE";
      }
    }

    const newCommission: CommissionObligation = {
      ...data,
      id: "com-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      businessKey,
      totalCommissionAmount: totalAmount,
      vatAmount,
      vatRate,
      netRevenueAmount,
      taxTreatment,
      collectedAmount: 0,
      outstandingBalance: totalAmount,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      createdById: currentUser?.id || "system",
      createdByName: currentUser?.nameEn || "System User",
    };

    setCommissions((prev) => [newCommission, ...prev]);
    safeSetDoc(doc(db, "commissions", newCommission.id), newCommission);

    logAudit(
      "COMMISSION_CREATED",
      "COMMISSION",
      newCommission.id,
      `${newCommission.partyType} Commission (${newCommission.commissionType})`,
      `Created ${newCommission.partyType} commission obligation of AED ${totalAmount.toLocaleString()} for Lease ${newCommission.leaseId} (Rate: ${newCommission.ratePercentage || 0}%, Key: ${businessKey})`
    );

    return { success: true, commission: newCommission };
  };

  const updateCommissionObligation = (id: string, patch: Partial<CommissionObligation>, modificationReason?: string): { success: boolean; error?: string } => {
    const existing = commissions.find((c) => c.id === id);
    if (!existing) return { success: false, error: "Commission record not found" };

    // Phase 53: Immutability Rule - Amount cannot be changed after save
    if (patch.totalCommissionAmount !== undefined && patch.totalCommissionAmount !== existing.totalCommissionAmount) {
      return {
        success: false,
        error: language === "ar"
          ? "لا يمكن تعديل مبلغ العمولة بعد الحفظ. يرجى استخدام إجراء العكس أو التسوية لإجراء التصحيحات."
          : "Commission amount is immutable after save. Use reversal or adjustment workflows for corrections.",
      };
    }

    const check = checkFinancialEditPermission("COMMISSION", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("COMMISSION", existing, "VERSION");

    let updatedPatch = { ...patch };
    // Trigger recalculation of tax fields if critical financial fields are modified
    if (patch.totalCommissionAmount !== undefined || patch.ratePercentage !== undefined || patch.commissionType !== undefined || patch.baseAmount !== undefined) {
      const baseAmount = patch.baseAmount !== undefined ? patch.baseAmount : (existing.baseAmount || 0);
      const rate = patch.ratePercentage !== undefined ? patch.ratePercentage : existing.ratePercentage;
      const type = patch.commissionType !== undefined ? patch.commissionType : existing.commissionType;
      const party = existing.partyType;

      const calc = calculateCommissionAmount(
        baseAmount, 
        party, 
        rate, 
        DEFAULT_COMMISSION_SETTINGS, 
        type,
        existing.dueDate,
        vatRates
      );

      updatedPatch = {
        ...updatedPatch,
        vatAmount: calc.vatAmount,
        vatRate: calc.vatRate,
        netRevenueAmount: calc.netRevenue,
        taxTreatment: calc.taxTreatment,
      };

      // If total amount was manually specified, ensure VAT/Net are derived from it
      if (patch.totalCommissionAmount !== undefined) {
        if (type === "ADMIN_FEE") {
          const vRate = getApplicableVatRate(existing.dueDate, vatRates, "ADMIN_FEE");
          const vAmt = Math.round((patch.totalCommissionAmount * vRate / (100 + vRate)) * 100) / 100;
          updatedPatch.vatAmount = vAmt;
          updatedPatch.vatRate = vRate;
          updatedPatch.netRevenueAmount = Math.round((patch.totalCommissionAmount - vAmt) * 100) / 100;
          updatedPatch.taxTreatment = "VAT_DEDUCTION";
        } else {
          updatedPatch.vatAmount = 0;
          updatedPatch.vatRate = 0;
          updatedPatch.netRevenueAmount = patch.totalCommissionAmount;
          updatedPatch.taxTreatment = "NONE";
        }
      }
    }

    const updated = { ...existing, ...updatedPatch, updatedAt: new Date().toISOString() };
    setCommissions((prev) => prev.map((c) => (c.id === id ? updated : c)));
    safeSetDoc(doc(db, "commissions", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "COMMISSION",
      id,
      `${updated.partyType} Commission`,
      `Updated commission details`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );
    return { success: true };
  };

  const collectAdministrativeFee = async (
    id: string,
    amount: number,
    paymentMethod: PaymentMethod,
    referenceNumber?: string,
    notes?: string,
    idempotencyKey?: string,
    options?: {
      sourceWorkflow?: "DAILY_DEPOSITS" | "DIRECT_SETTLEMENT" | "SETTLEMENT_GATE";
      proofDocumentId?: string;
      dailyDepositId?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    try {
      const existing = commissions.find((c) => c.id === id);
      if (!existing) {
        return { success: false, error: language === "ar" ? "سجل الرسوم غير موجود." : "Commission obligation record not found." };
      }

      // Duplicate collection protection
      if (existing.status === "FULLY_COLLECTED" || existing.status === "COLLECTED" || (existing.collectedAmount || 0) >= existing.totalCommissionAmount - 0.01) {
        return { success: false, error: language === "ar" ? "تم تحصيل هذه الرسوم بالكامل مسبقاً." : "This fee obligation has already been fully collected." };
      }

      if (existing.status === "CANCELLED" || existing.status === "REVERSED" || existing.status === "WAIVED") {
        return {
          success: false,
          error: language === "ar" ? "لا يمكن تحصيل رسوم ملغاة أو معفاة أو معكوسة." : "Cannot collect a cancelled, waived, or reversed fee obligation.",
        };
      }

      const availableBalance = existing.totalCommissionAmount - (existing.collectedAmount || 0);
      if (amount > availableBalance + 0.01) {
        return { success: false, error: language === "ar" ? "المبلغ يتجاوز الرصيد المستحق المتبقي." : "Amount exceeds remaining outstanding balance." };
      }

      // Financial Collection Gate: Cash must ONLY be collected/settled via Daily Deposits workflow
      const isDailyDepositsFlow = options?.sourceWorkflow === "DAILY_DEPOSITS" || options?.sourceWorkflow === "SETTLEMENT_GATE";
      if (paymentMethod === "CASH" && !isDailyDepositsFlow) {
        return {
          success: false,
          error: language === "ar"
            ? "تحصيل الرسوم الإدارية النقدية يجب أن يتم من خلال شاشة الإيداعات اليومية حصراً لضمان سلامة التوريد والمطابقة البنكية."
            : "Cash administrative fee collection must be processed exclusively via the Daily Deposits workflow to ensure verified bank deposit.",
        };
      }

      // For Bank Transfer or Credit Card direct settlement, require reference or proof
      if ((paymentMethod === "BANK_TRANSFER" || paymentMethod === "CREDIT_CARD") && !referenceNumber && !options?.proofDocumentId && !existing.proofDocumentId) {
        return {
          success: false,
          error: language === "ar"
            ? "يرجى إدخال رقم المرجع البنكي أو إرفاق إثبات السداد لإتمام التحصيل المباشر."
            : "Please provide a transaction reference number or attach payment proof for direct settlement.",
        };
      }

      const userId = currentUser?.id || "sys";
      const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

      // Deterministic IDs for idempotency
      const receiptId = idempotencyKey ? `col-adm-${idempotencyKey}` : `col-adm-${id}-${Date.now()}`;
      const allocationId = idempotencyKey ? `all-adm-${idempotencyKey}` : `all-adm-${id}-${Date.now()}`;

      let updatedCommission: CommissionObligation | null = null;
      let newReceipt: CollectionRecord | null = null;
      let newAllocation: PaymentAllocation | null = null;

      await runTransaction(db, async (transaction) => {
        const commRef = doc(db, "commissions", id);
        const commSnap = await transaction.get(commRef);

        if (!commSnap.exists()) {
          throw new Error("سجل الرسوم غير موجود.");
        }

        const commData = commSnap.data() as CommissionObligation;

        if (commData.status === "FULLY_COLLECTED" || (commData.collectedAmount || 0) >= commData.totalCommissionAmount - 0.01) {
          throw new Error("تم تحصيل هذه الرسوم بالكامل مسبقاً.");
        }

        const currentBal = commData.totalCommissionAmount - (commData.collectedAmount || 0);
        if (amount > currentBal + 0.01) {
          throw new Error("المبلغ يتجاوز الرصيد المتبقي.");
        }

        const receiptRef = doc(db, "collections", receiptId);
        const receiptSnap = await transaction.get(receiptRef);
        if (receiptSnap.exists()) {
          // Idempotency: Already processed!
          return;
        }

        // Determine payer name directly within transaction closure
        let refinedPayerName = userName;
        if (commData.partyType === "TENANT" && commData.tenantId) {
          const t = tenants.find((tt) => tt.id === commData.tenantId);
          if (t) refinedPayerName = language === "ar" ? t.nameAr : t.nameEn;
        } else if (commData.partyType === "OWNER" && commData.ownerId) {
          const o = owners.find((oo) => oo.id === commData.ownerId);
          if (o) refinedPayerName = language === "ar" ? o.nameAr : o.nameEn;
        }

        const newCollected = (commData.collectedAmount || 0) + amount;
        const isFullySettled = newCollected >= commData.totalCommissionAmount - 0.01;
        const newOutstanding = Math.max(0, commData.totalCommissionAmount - newCollected);

        updatedCommission = {
          ...commData,
          collectedAmount: newCollected,
          outstandingBalance: newOutstanding,
          status: isFullySettled ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED",
          paymentMethod,
          transactionReference: referenceNumber || commData.transactionReference,
          proofDocumentId: options?.proofDocumentId || commData.proofDocumentId,
          dailyDepositId: options?.dailyDepositId || commData.dailyDepositId,
          notes: notes ? (commData.notes ? `${commData.notes} | ${notes}` : notes) : commData.notes,
          updatedAt: new Date().toISOString(),
          updatedById: userId,
          updatedByName: userName,
        };

        newReceipt = {
          id: receiptId,
          receiptNumber: "RCP-ADM-" + new Date().getFullYear() + "-" + crypto.randomUUID().split("-")[0],
          tenantId: commData.tenantId || "",
          ownerId: commData.ownerId || "",
          paymentDate: new Date().toISOString().split("T")[0],
          amountEntered: amount,
          amountApplied: amount,
          adminFeeAmount: amount, // SYNCHRONIZATION FIELD for SaqrOfficeAccountView
          paymentMethod,
          transactionReference: referenceNumber || commData.transactionReference,
          payerName: refinedPayerName,
          collectedBy: userName,
          collectedByUserId: userId,
          notes: notes || `Administrative Fee Collection: ${commData.commissionType}`,
          createdAt: new Date().toISOString(),
          idempotencyKey,
        };

        newAllocation = {
          id: allocationId,
          collectionId: receiptId,
          targetType: "COMMISSION",
          targetId: id,
          targetDescription: `Administrative Fee: ${commData.commissionType}`,
          allocatedAmount: amount,
          allocationDate: newReceipt.paymentDate,
          status: "ACTIVE",

          createdAt: newReceipt.createdAt,
          createdById: userId,
          idempotencyKey,
        };

        transaction.set(commRef, sanitizeForFirestore(updatedCommission), { merge: true });
        transaction.set(receiptRef, sanitizeForFirestore(newReceipt));
        transaction.set(doc(db, "payment_allocations", allocationId), sanitizeForFirestore(newAllocation));
      });

      // If return was early due to idempotency, no state update needed
      if (!updatedCommission || !newReceipt || !newAllocation) {
        return { success: true };
      }

      const receiptObj = newReceipt as CollectionRecord;
      const commObj = updatedCommission as CommissionObligation;
      const allocObj = newAllocation as PaymentAllocation;

      setCommissions((prev) => prev.map((c) => (c.id === id ? commObj : c)));
      setCollections((prev) => [receiptObj, ...prev]);
      setPaymentAllocations((prev) => [allocObj, ...prev]);

      logAudit(
        "FINANCIAL_PAYMENT",
        "COLLECTION",
        receiptObj.id,
        `Receipt #${receiptObj.receiptNumber}`,
        `تحصيل رسوم إدارية بمبلغ ${amount.toLocaleString()} AED (${paymentMethod})`
      );

      try {
        const journalData = buildAdminFeeJournal(
          {
            commissionId: id,
            commissionNumber: commObj.businessKey || "COMM-" + id,
            grossAmount: amount,
            vatAmount: commObj.vatAmount,
            partyType: commObj.partyType,
            transactionDate: receiptObj.paymentDate,
            paymentMethod,
            isDeductedFromOwner: commObj.partyType === "OWNER",
            ownerId: commObj.ownerId,
            propertyId: commObj.propertyId,
            leaseId: commObj.leaseId,
            tenantId: commObj.tenantId,
            createdBy: userName,
            notes: notes || `تحصيل رسوم إدارية (${commObj.commissionType})`,
          },
          chartOfAccounts
        );
        postJournalEntry(journalData);
      } catch (jErr) {
        console.warn("Journal posting warning for admin fee collection:", jErr);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to collect admin fee" };
    }
  };

  const settleAdministrativeFee = async (params: {
    commissionId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
    paymentMethod?: PaymentMethod;
    dailyDepositId?: string;
    linkedDailyDeposit?: DailyDepositRecord;
  }): Promise<{ success: boolean; error?: string }> => {
    const {
      commissionId,
      proofBase64,
      proofFileName,
      proofFileType,
      proofFileSize,
      transactionReferenceNumber,
      notes,
      idempotencyKey,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      paymentMethod: providedPaymentMethod,
      dailyDepositId,
      linkedDailyDeposit,
    } = params;

    // RBAC Authorization check
    const check = checkFinancialEditPermission("COMMISSION", "Settlement");
    if (!check.allowed) return { success: false, error: check.error };

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const existing = commissions.find((c) => c.id === commissionId);
    if (!existing) return { success: false, error: language === "ar" ? "سجل الرسوم غير موجود." : "Commission obligation record not found." };

    // Idempotency check: If already settled and fully collected, return success
    if (existing.status === "FULLY_COLLECTED" || existing.status === "COLLECTED" || (typeof existing.outstandingBalance === "number" && existing.outstandingBalance <= 0)) {
      return { success: true };
    }

    if (existing.status === "CANCELLED" || existing.status === "REVERSED" || existing.status === "WAIVED") {
      return {
        success: false,
        error: language === "ar" ? "لا يمكن تسوية رسوم ملغاة أو معكوسة ماليًا." : "Cannot settle a cancelled or reversed commission obligation."
      };
    }

    // Determine the authoritative payment method
    const effectivePaymentMethod: PaymentMethod | undefined =
      providedPaymentMethod ||
      (existing.paymentMethod as PaymentMethod) ||
      (existing.partyType === "OWNER" ? "BANK_TRANSFER" : undefined);

    if (!effectivePaymentMethod) {
      return {
        success: false,
        error: language === "ar" ? "طريقة التحصيل / الدفع غير محددة لهذه الرسوم الإدارية." : "Payment method is required for administrative fee settlement.",
      };
    }

    // CASH Settlement Controls: Must link to a valid Daily Deposit
    if (effectivePaymentMethod === "CASH") {
      const targetDepositId = dailyDepositId || (existing as any).dailyDepositId || linkedDailyDeposit?.id;
      const matchedDeposit = linkedDailyDeposit || (targetDepositId ? dailyDeposits.find((d) => d.id === targetDepositId) : null);

      if (!targetDepositId && !matchedDeposit) {
        return {
          success: false,
          error:
            language === "ar"
              ? "لا يمكن تسوية الرسوم الإدارية النقدية مباشرة بدون ربطها بسجل أو حافظة إيداع يومي معتمدة (Daily Deposit)."
              : "CASH Administrative Fee cannot be settled directly without a linked and verified Daily Deposit.",
        };
      }

      if (matchedDeposit && matchedDeposit.status === "EXCEPTION") {
        return {
          success: false,
          error:
            language === "ar"
              ? "سجل الإيداع اليومي المرتبط به استثناء مالي ولم يتم اعتماده."
              : "The linked Daily Deposit record has an unresolved financial exception.",
        };
      }
    }

    // Resolve proof document from archive
    const resolvedArchiveDoc = existing.proofDocumentId
      ? archive.find((a) => a.id === existing.proofDocumentId && (a.entityId === commissionId || a.recordId === commissionId))
      : archive.find((a) => a.entityId === commissionId || a.recordId === commissionId);

    const hasValidProofDocument = Boolean(proofBase64 || resolvedArchiveDoc);

    // AI Verification & Manual Override Settlement Gate Evaluation
    if (verificationStatus) {
      const isMismatchCase =
        aiVerificationDetails?.aiStatus === "MISMATCH" ||
        verificationStatus === "OVERRIDDEN";

      const gateResult = evaluateSettlementGate({
        verificationStatus,
        hasProof: hasValidProofDocument,
        isProofResolved: existing.proofDocumentId ? Boolean(resolvedArchiveDoc) : undefined,
        proofRequired: true,
        overrideReason,
        overrideType,
        originalAiStatus: aiVerificationDetails?.aiStatus,
        userRole: currentUser?.role,
        isMismatch: isMismatchCase,
      });

      if (!gateResult.allowed) {
        return {
          success: false,
          error: language === "ar" ? gateResult.reasonAr : gateResult.reasonEn,
        };
      }
    } else if (!hasValidProofDocument) {
      return {
        success: false,
        error: language === "ar" ? "تم رفض التسوية: إرفاق إثبات الإيداع البنكي أو إيصال السداد إلزامي." : "Settlement denied: Bank deposit proof or receipt document is mandatory.",
      };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    try {
      let archiveDocId = existing.proofDocumentId;
      let newArchiveRecord: ElectronicArchiveItem | null = null;

      if (archiveDocId) {
        const isDuplicateUsed = commissions.some(
          (c) => c.id !== commissionId && c.proofDocumentId === archiveDocId
        );
        if (isDuplicateUsed) {
          return {
            success: false,
            error:
              language === "ar"
                ? "خطأ رقابي: مستند الإثبات مستخدم مسبقاً في معاملة أخرى. يرجى إرفاق إثبات مالي خاص بهذه المعاملة حصراً."
                : "Audit Guard Violation: Proof document is already linked to another commission record.",
          };
        }
      }

      if (proofBase64 && !archiveDocId) {
        const existingArchive = archive.find((a) => a.entityId === commissionId || a.recordId === commissionId);
        if (existingArchive) {
          archiveDocId = existingArchive.id;
        } else {
          archiveDocId = `arch-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
          newArchiveRecord = {
            id: archiveDocId,
            fileName: proofFileName || `proof-fee-${existing.id.slice(-6)}.pdf`,
            category: "PAYMENTS",
            recordId: existing.id,
            recordTitle: `إثبات إيداع رسوم إدارية ${existing.id}`,
            fileType: proofFileType || "application/pdf",
            fileSize: proofFileSize || 1024,
            fileHash: `hash-${Date.now()}`,
            isPrivate: false,
            storagePath: `archives/commissions/${existing.id}/${proofFileName || "proof.pdf"}`,
            uploadDate: new Date().toISOString(),
            uploadedByUserId: userId,
            uploadedByName: userName,
            previewUrl: proofBase64,
            downloadToken: `tok-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
            tags: ["payment_proof", "admin_fee", "daily_deposit", existing.id],
            entityType: "COMMISSION",
            entityId: existing.id,
            createdAt: new Date().toISOString(),
          } as ElectronicArchiveItem;
        }
      }

      const amountToCollect = existing.outstandingBalance || (existing.totalCommissionAmount - (existing.collectedAmount || 0));
      const sourceWorkflow = effectivePaymentMethod === "CASH" ? "DAILY_DEPOSITS" : "DIRECT_SETTLEMENT";

      const collectRes = await collectAdministrativeFee(
        commissionId,
        amountToCollect,
        effectivePaymentMethod,
        transactionReferenceNumber || existing.transactionReference,
        notes || (verificationStatus ? `Settled via ${verificationStatus}` : undefined),
        idempotencyKey,
        {
          sourceWorkflow,
          proofDocumentId: archiveDocId,
          dailyDepositId: effectivePaymentMethod === "CASH" ? (dailyDepositId || (existing as any).dailyDepositId || linkedDailyDeposit?.id) : undefined,
        }
      );

      if (!collectRes.success) {
        return collectRes;
      }

      // Update commission record with proof, daily deposit id, and verification metadata
      const updatedComm: Partial<CommissionObligation> = {
        proofDocumentId: archiveDocId,
        verificationStatus: verificationStatus || "MANUALLY_VERIFIED",
        verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
        verifiedAt: new Date().toISOString(),
        verifiedByUserId: userId,
        verifiedByName: userName,
        overrideReason: overrideReason || undefined,
        overrideType: overrideType || undefined,
        paymentMethod: effectivePaymentMethod,
        ...(effectivePaymentMethod === "CASH" && (dailyDepositId || linkedDailyDeposit?.id) ? { dailyDepositId: dailyDepositId || linkedDailyDeposit?.id } : {}),
      };

      setCommissions((prev) =>
        prev.map((c) => (c.id === commissionId ? { ...c, ...updatedComm } : c))
      );
      safeSetDoc(doc(db, "commissions", commissionId), updatedComm, { merge: true });

      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord!, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      // If the administrative fee was paid in CASH, post a bank deposit journal moving funds from Cash in Hand (1020) to Operating Bank (1010)
      if (effectivePaymentMethod === "CASH") {
        try {
          const depositJournal = buildBankDepositJournal(
            {
              sourceType: "ADMINISTRATIVE_FEE",
              sourceId: commissionId,
              totalAmount: amountToCollect,
              transactionDate: new Date().toISOString().split("T")[0],
              referenceNumber: transactionReferenceNumber || `DEP-FEE-${existing.id.slice(-6)}`,
              notes: notes || `إيداع بنكي للرسوم الإدارية النقدية #${existing.businessKey || existing.id}`,
              createdBy: userName,
            },
            chartOfAccounts
          );
          postJournalEntry(depositJournal);
        } catch (dErr) {
          console.warn("Bank deposit journal posting warning:", dErr);
        }
      }

      // Build and log structured audit record
      const auditPayload = buildVerificationAuditRecord({
        transactionId: existing.id,
        entityType: "COMMISSION",
        entityName: `Fee Obligation ${existing.id}`,
        proofDocumentId: archiveDocId,
        proofFileName: proofFileName || newArchiveRecord?.fileName,
        verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
        previousVerificationStatus: existing.verificationStatus || "UNVERIFIED",
        aiStatus: aiVerificationDetails?.aiStatus || (verificationStatus === "AI_VERIFIED" ? "MATCH" : "UNAVAILABLE"),
        aiExtractedValues: aiVerificationDetails?.extractedValues || {},
        expectedValues: aiVerificationDetails?.expectedValues || {
          amount: existing.totalCommissionAmount,
        },
        comparisonResults: aiVerificationDetails?.comparisonResults || {},
        overrideReason,
        overrideType,
        userId,
        userName,
        userRole: currentUser?.role || "FINANCE",
        finalStatus: verificationStatus || "MANUALLY_VERIFIED",
      });

      logAudit(
        "FINANCIAL_PAYMENT",
        "COMMISSION",
        existing.id,
        `Administrative Fee ${existing.id}`,
        `تسوية مالية وإيداع رسوم إدارية بمبلغ ${amountToCollect.toLocaleString()} AED (${verificationStatus || "VERIFIED"}) [${effectivePaymentMethod}]`,
        undefined,
        JSON.stringify(auditPayload),
        overrideReason
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to settle administrative fee" };
    }
  };

  const collectSecurityDeposit = async (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    isUndatedCheque?: boolean;
    payerName?: string;
    transactionReference?: string;
    notes?: string;
    proofBase64?: string;
    proofFileName?: string;
  }): Promise<{ success: boolean; receipt?: CollectionRecord; journalEntry?: JournalEntryRecord; error?: string }> => {
    const {
      leaseId,
      amount,
      paymentMethod,
      bankName,
      chequeNumber,
      chequeDate,
      isUndatedCheque,
      payerName,
      transactionReference,
      notes,
      proofBase64,
      proofFileName,
    } = params;

    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) {
      return { success: false, error: language === "ar" ? "عقد الإيجار غير موجود." : "Lease contract not found." };
    }

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    const tenant = tenants.find((t) => t.id === lease.tenantId);
    const resolvedPayerName = payerName || (tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "المستأجر");

    try {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split("T")[0];

      // Handle archive document if proof provided
      let archiveDocId: string | undefined = undefined;
      if (proofBase64) {
        archiveDocId = `arch-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
        const newArchiveRecord: ElectronicArchiveItem = {
          id: archiveDocId,
          fileName: proofFileName || `proof-deposit-${lease.leaseNumber}.pdf`,
          category: "PAYMENTS",
          recordId: lease.id,
          recordTitle: `إثبات إيداع تأمين صيانة عقد ${lease.leaseNumber}`,
          fileType: "application/pdf",
          fileSize: 1024,
          fileHash: `hash-${Date.now()}`,
          isPrivate: false,
          storagePath: `archives/leases/${lease.id}/${proofFileName || "deposit-proof.pdf"}`,
          uploadDate: nowIso,
          uploadedByUserId: userId,
          uploadedByName: userName,
          previewUrl: proofBase64,
          downloadToken: `tok-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          tags: ["security_deposit", "payment_proof", lease.id],
          entityType: "LEASE",
          entityId: lease.id,
          createdAt: nowIso,
        } as ElectronicArchiveItem;

        setArchive((prev) => [newArchiveRecord, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      // Generate Official Receipt Voucher (DEP-REC-)
      const receiptId = "col-dep-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
      const receiptNumber = generateSequentialNumber(collections, "receiptNumber", "DEP-REC-", 4, false);

      const newReceipt: CollectionRecord = {
        id: receiptId,
        receiptNumber,
        tenantId: lease.tenantId,
        ownerId: lease.ownerId,
        leaseId: lease.id,
        amountEntered: amount,
        amountApplied: amount,
        paymentDate: todayDate,
        paymentMethod: paymentMethod as PaymentMethod,
        payerName: resolvedPayerName,
        collectedBy: userName,
        collectedByUserId: userId,
        notes: notes || `تحصيل أمانات تأمين صيانة لعقد #${lease.leaseNumber} (حساب 2020)`,
        transactionReference: chequeNumber || transactionReference,
        isSecurityDepositReceipt: true,
        securityDepositChequeNumber: chequeNumber,
        securityDepositBankName: bankName,
        securityDepositIsUndatedCheque: isUndatedCheque,
        createdAt: nowIso,
      };

      // Allocation Record
      const allocationId = "alloc-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
      const newAllocation: PaymentAllocation = {
        id: allocationId,
        collectionId: receiptId,
        targetType: "SECURITY_DEPOSIT",
        targetId: lease.id,
        allocatedAmount: amount,
        allocationDate: todayDate,
        status: "ACTIVE",
        targetDescription: `تأمين صيانة مستأجر لعقد #${lease.leaseNumber}`,
        createdAt: nowIso,
        createdById: userId,
      };

      // Update Lease record
      const historyItem: SecurityDepositHistoryItem = {
        id: `sd-hist-${Date.now()}`,
        date: nowIso,
        action: "COLLECTION",
        amount,
        performedBy: userName,
        receiptNumber,
        notes: `تم تحصيل التأمين بواسطة ${paymentMethod}${chequeNumber ? ` (شيك #${chequeNumber})` : ""}`,
      };

      const updatedLease: Lease = {
        ...lease,
        securityDeposit: amount,
        securityDepositStatus: "HELD",
        securityDepositReceiptNumber: receiptNumber,
        securityDepositPaymentMethod: paymentMethod,
        securityDepositBankName: bankName || lease.securityDepositBankName,
        securityDepositChequeNumber: chequeNumber || lease.securityDepositChequeNumber,
        securityDepositChequeDate: chequeDate || lease.securityDepositChequeDate,
        securityDepositIsUndatedCheque: isUndatedCheque ?? lease.securityDepositIsUndatedCheque,
        securityDepositCollectedDate: todayDate,
        securityDepositProofDocId: archiveDocId || lease.securityDepositProofDocId,
        securityDepositVerificationStatus: paymentMethod === "CASH" ? "PENDING_VERIFICATION" : "VERIFIED",
        securityDepositHistory: [...(lease.securityDepositHistory || []), historyItem],
      };

      setCollections((prev) => [newReceipt, ...prev]);
      setPaymentAllocations((prev) => [newAllocation, ...prev]);
      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));

      safeSetDoc(doc(db, "collections", receiptId), sanitizeForFirestore(newReceipt));
      safeSetDoc(doc(db, "payment_allocations", allocationId), sanitizeForFirestore(newAllocation));
      safeSetDoc(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });

      // Post Double-Entry Journal Entry: Debit Asset, Credit 2020
      let postedJournal: JournalEntryRecord | undefined = undefined;
      try {
        const journalData = buildSecurityDepositCollectionJournal(
          chartOfAccounts,
          {
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            tenantId: lease.tenantId,
            ownerId: lease.ownerId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            amount,
            paymentMethod,
            receiptNumber,
            chequeNumber,
            bankName,
            transactionDate: todayDate,
            createdBy: userName,
            notes: notes || `تحصيل أمانات تأمين صيانة مستأجر لعقد إيجار #${lease.leaseNumber} (حساب 2020)`,
          }
        );
        const jRes = postJournalEntry(journalData);
        if (jRes.success && jRes.entry) {
          postedJournal = jRes.entry;
        }
      } catch (jErr) {
        console.warn("Journal posting warning for security deposit collection:", jErr);
      }

      logAudit(
        "FINANCIAL_PAYMENT",
        "LEASE",
        lease.id,
        `Lease #${lease.leaseNumber}`,
        `تحصيل أمانات تأمين صيانة مستأجر لعقد #${lease.leaseNumber} بمبلغ AED ${amount.toLocaleString()} (حساب 2020 - سند #${receiptNumber})`
      );

      return { success: true, receipt: newReceipt, journalEntry: postedJournal };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to collect security deposit" };
    }
  };

  const settleSecurityDeposit = async (params: {
    leaseId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
    paymentMethod?: PaymentMethod;
  }): Promise<{ success: boolean; error?: string }> => {
    const {
      leaseId,
      proofBase64,
      proofFileName,
      proofFileType,
      proofFileSize,
      transactionReferenceNumber,
      notes,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      paymentMethod = "BANK_TRANSFER",
    } = params;

    // RBAC Authorization check
    const check = checkFinancialEditPermission("COLLECTION", "Settlement");
    if (!check.allowed) return { success: false, error: check.error };

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const existingLease = leases.find((l) => l.id === leaseId);
    if (!existingLease) {
      return { success: false, error: language === "ar" ? "عقد الإيجار غير موجود." : "Lease record not found." };
    }

    if (existingLease.securityDepositStatus === "SETTLED" || existingLease.securityDepositStatus === "REFUNDED") {
      return { success: true };
    }

    // Resolve proof document from archive
    const resolvedArchiveDoc = existingLease.securityDepositProofDocId
      ? archive.find((a) => a.id === existingLease.securityDepositProofDocId)
      : archive.find((a) => a.entityId === leaseId || a.recordId === leaseId);

    const hasValidProofDocument = Boolean(proofBase64 || resolvedArchiveDoc);

    // AI Verification & Manual Override Settlement Gate Evaluation
    if (verificationStatus) {
      const isMismatchCase =
        aiVerificationDetails?.aiStatus === "MISMATCH" ||
        verificationStatus === "OVERRIDDEN";

      const gateResult = evaluateSettlementGate({
        verificationStatus,
        hasProof: hasValidProofDocument,
        hasValidProofDocument,
        isProofResolved: existingLease.securityDepositProofDocId ? Boolean(resolvedArchiveDoc) : undefined,
        proofRequired: true,
        overrideReason,
        overrideType,
        originalAiStatus: aiVerificationDetails?.aiStatus,
        userRole: currentUser?.role,
        isMismatch: isMismatchCase,
      });

      if (!gateResult.allowed) {
        return {
          success: false,
          error: language === "ar" ? gateResult.reasonAr : gateResult.reasonEn,
        };
      }
    } else if (!hasValidProofDocument) {
      return {
        success: false,
        error: language === "ar" ? "تم رفض التسوية: إرفاق إثبات الإيداع البنكي أو إيصال السداد إلزامي." : "Settlement denied: Bank deposit proof or receipt document is mandatory.",
      };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    try {
      let archiveDocId = existingLease.securityDepositProofDocId;
      let newArchiveRecord: ElectronicArchiveItem | null = null;

      if (proofBase64 && !archiveDocId) {
        archiveDocId = `arch-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
        newArchiveRecord = {
          id: archiveDocId,
          fileName: proofFileName || `proof-deposit-${existingLease.leaseNumber}.pdf`,
          category: "PAYMENTS",
          recordId: existingLease.id,
          recordTitle: `إثبات إيداع بنكي لتأمين عقد ${existingLease.leaseNumber}`,
          fileType: proofFileType || "application/pdf",
          fileSize: proofFileSize || 1024,
          fileHash: `hash-${Date.now()}`,
          isPrivate: false,
          storagePath: `archives/leases/${existingLease.id}/${proofFileName || "proof.pdf"}`,
          uploadDate: new Date().toISOString(),
          uploadedByUserId: userId,
          uploadedByName: userName,
          previewUrl: proofBase64,
          downloadToken: `tok-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          tags: ["payment_proof", "security_deposit", "daily_deposit", existingLease.id],
          entityType: "LEASE",
          entityId: existingLease.id,
          createdAt: new Date().toISOString(),
        } as ElectronicArchiveItem;
      }


      // Update lease verification metadata
      const updatedLeaseData: Partial<Lease> = {
        securityDepositStatus: "HELD",
        securityDepositProofDocId: archiveDocId || existingLease.securityDepositProofDocId,
        securityDepositVerificationStatus: verificationStatus || "VERIFIED",
      };

      setLeases((prev) =>
        prev.map((l) => (l.id === leaseId ? { ...l, ...updatedLeaseData } : l))
      );
      safeSetDoc(doc(db, "leases", leaseId), updatedLeaseData, { merge: true });

      if (newArchiveRecord) {
        setArchive((prev) => [newArchiveRecord!, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      if (existingLease.securityDepositPaymentMethod === "CASH" && updatedLeaseData.securityDepositVerificationStatus === "VERIFIED") {
        try {
          const journalData = buildBankDepositJournal(
            {
              sourceType: "SECURITY_DEPOSIT",
              sourceId: existingLease.id,
              totalAmount: existingLease.securityDeposit || 0,
              transactionDate: new Date().toISOString().split("T")[0],
              referenceNumber: transactionReferenceNumber || existingLease.securityDepositReceiptNumber,
              notes: notes || `إيداع بنكي لتأمين نقدي محصل لعقد #${existingLease.leaseNumber}`,
              createdBy: userName,
            },
            chartOfAccounts
          );
          postJournalEntry(journalData);
        } catch (jErr) {
          console.warn("Journal posting warning for security deposit bank deposit:", jErr);
        }
      }

      // Build and log structured audit record
      const auditPayload = buildVerificationAuditRecord({
        transactionId: existingLease.id,
        entityType: "FINANCIAL_TRANSACTION",
        entityName: `Security Deposit Lease #${existingLease.leaseNumber}`,
        proofDocumentId: archiveDocId,
        proofFileName: proofFileName || newArchiveRecord?.fileName,
        verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
        previousVerificationStatus: (existingLease.securityDepositVerificationStatus as any) || "UNVERIFIED",
        aiStatus: aiVerificationDetails?.aiStatus || (verificationStatus === "AI_VERIFIED" ? "MATCH" : "UNAVAILABLE"),
        aiExtractedValues: aiVerificationDetails?.extractedValues || {},
        expectedValues: aiVerificationDetails?.expectedValues || {
          amount: existingLease.securityDeposit,
        },
        comparisonResults: aiVerificationDetails?.comparisonResults || {},
        overrideReason,
        overrideType,
        userId,
        userName,
        userRole: currentUser?.role || "FINANCE",
        finalStatus: verificationStatus || "MANUALLY_VERIFIED",
      });

      logAudit(
        "FINANCIAL_PAYMENT",
        "LEASE",
        existingLease.id,
        `Security Deposit Lease #${existingLease.leaseNumber}`,
        `تسوية مالية وإيداع تأمين مستأجر بمبلغ ${(existingLease.securityDeposit || 0).toLocaleString()} AED (${verificationStatus || "VERIFIED"})`,
        undefined,
        JSON.stringify(auditPayload),
        overrideReason
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to settle security deposit" };
    }
  };

  const refundOrSettleSecurityDeposit = async (params: {
    leaseId: string;
    deductions: {
      rentDeduction?: number;
      maintenanceDeduction?: number;
      earlyTerminationDeduction?: number;
      otherDeductions?: number;
    };
    refundPaymentMethod?: PaymentMethod | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    refundReference?: string;
    proofBase64?: string;
    proofFileName?: string;
    notes?: string;
  }): Promise<{ success: boolean; settlement?: SecurityDepositSettlement; journalEntry?: JournalEntryRecord; error?: string }> => {
    const {
      leaseId,
      deductions,
      refundPaymentMethod = "BANK_TRANSFER",
      refundReference,
      proofBase64,
      proofFileName,
      notes,
    } = params;

    const lease = leases.find((l) => l.id === leaseId);
    if (!lease) {
      return { success: false, error: language === "ar" ? "عقد الإيجار غير موجود." : "Lease contract not found." };
    }

    if (lease.securityDepositStatus === "SETTLED" || lease.securityDepositStatus === "REFUNDED") {
      return { success: false, error: language === "ar" ? "تمت تسوية أو استرداد مبلغ التأمين لهذا العقد مسبقاً." : "Security deposit already settled or refunded." };
    }

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const totalHeld = lease.securityDeposit || 0;
    const rentDed = deductions.rentDeduction || 0;
    const maintDed = deductions.maintenanceDeduction || 0;
    const earlyTermDed = deductions.earlyTerminationDeduction || 0;
    const otherDed = deductions.otherDeductions || 0;

    let remainingHeld = totalHeld;
    const appliedRentDed = Math.min(remainingHeld, rentDed);
    remainingHeld -= appliedRentDed;
    const appliedMaintDed = Math.min(remainingHeld, maintDed);
    remainingHeld -= appliedMaintDed;
    const appliedEarlyTermDed = Math.min(remainingHeld, earlyTermDed);
    remainingHeld -= appliedEarlyTermDed;
    const appliedOtherDed = Math.min(remainingHeld, otherDed);
    remainingHeld -= appliedOtherDed;

    const cappedDeductions = {
      rentDeduction: appliedRentDed,
      maintenanceDeduction: appliedMaintDed,
      earlyTerminationDeduction: appliedEarlyTermDed,
      otherDeductions: appliedOtherDed,
    };

    const totalDeductions = Math.round((rentDed + maintDed + earlyTermDed + otherDed) * 100) / 100;
    const totalAppliedDeductions = Math.round((appliedRentDed + appliedMaintDed + appliedEarlyTermDed + appliedOtherDed) * 100) / 100;
    const netRefundAmount = Math.max(0, Math.round((totalHeld - totalAppliedDeductions) * 100) / 100);
    const remainingDueAmount = Math.max(0, Math.round((totalDeductions - totalHeld) * 100) / 100);

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split("T")[0];

    try {
      let archiveDocId: string | undefined = undefined;
      if (proofBase64) {
        archiveDocId = `arch-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
        const newArchiveRecord: ElectronicArchiveItem = {
          id: archiveDocId,
          fileName: proofFileName || `proof-clearance-sd-${lease.leaseNumber}.pdf`,
          category: "PAYMENTS",
          recordId: lease.id,
          recordTitle: `إثبات تسوية ورد تأمين عقد ${lease.leaseNumber}`,
          fileType: "application/pdf",
          fileSize: 1024,
          fileHash: `hash-${Date.now()}`,
          isPrivate: false,
          storagePath: `archives/leases/${lease.id}/${proofFileName || "clearance-proof.pdf"}`,
          uploadDate: nowIso,
          uploadedByUserId: userId,
          uploadedByName: userName,
          previewUrl: proofBase64,
          downloadToken: `tok-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          tags: ["security_deposit_settlement", "clearance", lease.id],
          entityType: "LEASE",
          entityId: lease.id,
          createdAt: nowIso,
        } as ElectronicArchiveItem;

        setArchive((prev) => [newArchiveRecord, ...prev]);
        safeSetDoc(doc(db, "archive", newArchiveRecord.id), sanitizeForFirestore(newArchiveRecord));
      }

      const settlementRecord: SecurityDepositSettlement = {
        settlementId: `sd-set-${Date.now()}`,
        settledAt: nowIso,
        settlementDate: todayDate,
        totalHeldAmount: totalHeld,
        maintenanceDeductions: cappedDeductions.maintenanceDeduction,
        maintenanceDeduction: cappedDeductions.maintenanceDeduction,
        rentDeductions: cappedDeductions.rentDeduction,
        rentDeduction: cappedDeductions.rentDeduction,
        earlyTerminationDeductions: cappedDeductions.earlyTerminationDeduction,
        earlyTerminationDeduction: cappedDeductions.earlyTerminationDeduction,
        otherDeductions: cappedDeductions.otherDeductions,
        totalDeductions: totalAppliedDeductions,
        netRefundAmount,
        remainingDueAmount,
        refundPaymentMethod,
        refundReference,
        settledByUserId: userId,
        settledByUserName: userName,
        notes: notes || (language === "ar" ? "تسوية وبراءة ذمة تأمين مستأجر نهائية" : "Final security deposit settlement & clearance"),
        proofDocumentId: archiveDocId,
      };

      const finalStatus: SecurityDepositStatus = netRefundAmount > 0 ? "REFUNDED" : "SETTLED";

      const historyItem: SecurityDepositHistoryItem = {
        id: `sd-hist-${Date.now()}`,
        date: nowIso,
        action: netRefundAmount > 0 ? "REFUND" : "SETTLEMENT",
        amount: netRefundAmount > 0 ? netRefundAmount : totalHeld,
        performedBy: userName,
        notes: `تسوية أمانات التأمين: إجمالي المحتجز AED ${totalHeld} - الخصومات AED ${totalDeductions} = صافي المردود AED ${netRefundAmount}`,
      };

      const updatedLease: Lease = {
        ...lease,
        securityDepositStatus: finalStatus,
        securityDepositSettlement: settlementRecord,
        securityDepositHistory: [...(lease.securityDepositHistory || []), historyItem],
      };

      setLeases((prev) => prev.map((l) => (l.id === leaseId ? updatedLease : l)));
      safeSetDoc(doc(db, "leases", leaseId), sanitizeForFirestore(updatedLease), { merge: true });

      // Post Double-Entry Journal Entry
      let postedJournal: JournalEntryRecord | undefined = undefined;
      try {
        const journalData = buildSecurityDepositSettlementJournal(
          chartOfAccounts,
          {
            leaseId: lease.id,
            leaseNumber: lease.leaseNumber,
            tenantId: lease.tenantId,
            ownerId: lease.ownerId,
            propertyId: lease.propertyId,
            unitId: lease.unitId,
            totalHeldAmount: totalHeld,
            deductions: cappedDeductions,
            netRefundAmount,
            refundPaymentMethod,
            reference: refundReference,
            transactionDate: todayDate,
            createdBy: userName,
            notes: notes || `تسوية وبراءة ذمة تأمين مستأجر لعقد #${lease.leaseNumber}`,
          }
        );
        const jRes = postJournalEntry(journalData);
        if (jRes.success && jRes.entry) {
          postedJournal = jRes.entry;
        }
      } catch (jErr) {
        console.warn("Journal posting warning for security deposit settlement:", jErr);
      }

      logAudit(
        "FINANCIAL_PAYMENT",
        "LEASE",
        lease.id,
        `Lease #${lease.leaseNumber}`,
        `تسوية أمانات تأمين صيانة مستأجر لعقد #${lease.leaseNumber} (محتجز: ${totalHeld} AED, خصومات: ${totalDeductions} AED, مردود: ${netRefundAmount} AED)`
      );

      return { success: true, settlement: settlementRecord, journalEntry: postedJournal };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to settle security deposit" };
    }
  };

  const reverseCommissionObligation = (id: string, reason: string): { success: boolean; error?: string } => {
    const existing = commissions.find((c) => c.id === id);
    if (!existing) return { success: false, error: "سجل الرسوم غير موجود." };
    if (existing.status === "REVERSED") return { success: false, error: "هذه الرسوم ملغاة مسبقاً." };

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    const updated: CommissionObligation = {
      ...existing,
      status: "REVERSED",
      notes: existing.notes ? `${existing.notes} | REVERSED: ${reason}` : `REVERSED: ${reason}`,
      updatedAt: new Date().toISOString(),
      updatedById: userId,
      updatedByName: userName,
    };

    setCommissions((prev) => prev.map((c) => (c.id === id ? updated : c)));
    safeSetDoc(doc(db, "commissions", id), updated, { merge: true });

    // Record the reversal in the reversals table
    const reversalRecord: FinancialReversalRecord = {
      id: "rev-" + Date.now(),
      reversalNumber: generateSequentialNumber(financialReversals, "reversalNumber", "REV-"),
      targetType: "COMMISSION",
      targetId: id,
      originalAmount: existing.totalCommissionAmount,
      reversedAmount: existing.totalCommissionAmount,
      reason,
      reversalDate: new Date().toISOString().split("T")[0],
      reversalTimestamp: new Date().toISOString(),
      performedByUserId: userId,
      performedByUserName: userName,
      createdAt: new Date().toISOString(),
    };
    
    // Check if we need to update FinancialReversalRecord targetType in types.ts
    // For now, using what's available or expanding if needed.

    setFinancialReversals(prev => [reversalRecord, ...prev]);
    safeSetDoc(doc(db, "financial_reversals", reversalRecord.id), reversalRecord);

    logAudit(
      "UPDATE",
      "COMMISSION",
      id,
      `إلغاء رسوم إدارية - ${existing.partyType}`,
      `تم إلغاء الرسوم الإدارية بقيمة ${existing.totalCommissionAmount.toLocaleString()} AED. السبب: ${reason}`
    );

    return { success: true };
  };

  const deleteCommissionObligation = (id: string, options?: DeleteRecordOptions) => {
    const existing = commissions.find((c) => c.id === id);
    if (!existing) return;

    if (!options?.force && existing.collectedAmount > 0) {
      logAudit(
        "DELETE",
        "COMMISSION",
        id,
        `${existing.partyType} Commission`,
        `Blocked deletion of commission ${id} with active collections (${existing.collectedAmount} AED)`
      );
      return;
    }

    archiveEntityToHistory("COMMISSION", existing, options);
    setCommissions((prev) => prev.filter((c) => c.id !== id));
    deleteDoc(doc(db, "commissions", id)).catch(() => {});
    logAudit("DELETE", "COMMISSION", id, `${existing.partyType} Commission`, `Deleted commission obligation ${id}`);
  };

  const allocatePaymentToTargets = async (params: {
    collectionId: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; allocatedCount: number; error?: string }> => {
    const collection = collections.find((c) => c.id === params.collectionId);
    if (!collection) {
      return { success: false, allocatedCount: 0, error: `Collection receipt ${params.collectionId} not found.` };
    }

    // Check idempotency if key provided
    if (params.idempotencyKey) {
      const existing = paymentAllocations.find(
        (a) => a.idempotencyKey === params.idempotencyKey && a.status === "ACTIVE"
      );
      if (existing) {
        return { success: true, allocatedCount: 1 };
      }
    }

    // Validate allocations against targets
    const validationTargets = params.allocations.map((a) => {
      let targetCurrentOutstanding = 0;
      if (a.targetType === "CHEQUE") {
        const chq = cheques.find((c) => c.id === a.targetId);
        targetCurrentOutstanding = chq ? chq.outstanding : 0;
      } else if (a.targetType === "COMMISSION") {
        const com = commissions.find((c) => c.id === a.targetId);
        targetCurrentOutstanding = com ? com.outstandingBalance : 0;
      } else if (a.targetType === "UNALLOCATED_PREPAYMENT") {
        targetCurrentOutstanding = collection.amountEntered;
      }

      return {
        targetType: a.targetType,
        targetId: a.targetId,
        allocatedAmount: a.amount,
        targetCurrentOutstanding,
      };
    });

    const validation = validatePaymentAllocations(collection.amountEntered, validationTargets);
    if (!validation.isValid) {
      return { success: false, allocatedCount: 0, error: validation.error };
    }

    const createdAllocations: PaymentAllocation[] = [];

    for (const item of params.allocations) {
      const alloc: PaymentAllocation = {
        id: "pal-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
        collectionId: collection.id,
        targetType: item.targetType,
        targetId: item.targetId,
        targetDescription: item.targetDescription,
        allocatedAmount: item.amount,
        allocationDate: collection.paymentDate || new Date().toISOString().split("T")[0],
        status: "ACTIVE",
        idempotencyKey: params.idempotencyKey,
        createdAt: new Date().toISOString(),
        createdById: currentUser?.id || "system",
      };
      createdAllocations.push(alloc);
      safeSetDoc(doc(db, "payment_allocations", alloc.id), alloc);

      // Mutate target state in memory & Firestore
      if (item.targetType === "COMMISSION") {
        setCommissions((prev) =>
          prev.map((c) => {
            if (c.id === item.targetId) {
              const newCollected = c.collectedAmount + item.amount;
              const newRemaining = Math.max(0, c.totalCommissionAmount - newCollected);
              const status: CommissionObligation["status"] =
                newRemaining <= 0.0001 ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED";
              const updatedCom = {
                ...c,
                collectedAmount: newCollected,
                outstandingBalance: newRemaining,
                status,
                updatedAt: new Date().toISOString(),
              };
              safeSetDoc(doc(db, "commissions", c.id), updatedCom, { merge: true });
              return updatedCom;
            }
            return c;
          })
        );
      } else if (item.targetType === "CHEQUE") {
        setCheques((prev) =>
          prev.map((c) => {
            if (c.id === item.targetId) {
              const newTotalApplied = c.totalApplied + item.amount;
              const newOutstanding = Math.max(0, c.amount - newTotalApplied);
              const isFullyCollected = newOutstanding <= 0.0001;
              const updatedChq = {
                ...c,
                totalApplied: newTotalApplied,
                outstanding: newOutstanding,
                collectionStatus: isFullyCollected
                  ? ("FULLY_COLLECTED_AFTER_BOUNCE" as const)
                  : ("PARTIAL_COLLECTION" as const),
                status: isFullyCollected ? ("COLLECTED" as const) : c.status,
              };
              safeSetDoc(doc(db, "cheques", c.id), updatedChq, { merge: true });
              return updatedChq;
            }
            return c;
          })
        );
      }
    }

    setPaymentAllocations((prev) => [...createdAllocations, ...prev]);

    logAudit(
      "PAYMENT_ALLOCATED",
      "PAYMENT_ALLOCATION",
      collection.id,
      `Receipt #${collection.receiptNumber}`,
      `Allocated payment receipt #${collection.receiptNumber} (${collection.amountEntered.toLocaleString()} AED) across ${params.allocations.length} target(s)`
    );

    return { success: true, allocatedCount: createdAllocations.length };
  };

  const reversePaymentReceipt = (
    collectionId: string,
    reason: string
  ): { success: boolean; reversal?: FinancialReversalRecord; error?: string } => {
    const targetCollection = collections.find((c) => c.id === collectionId);
    if (!targetCollection) {
      return { success: false, error: "Payment collection record not found." };
    }

    // Idempotency check: Already reversed?
    const alreadyReversed = financialReversals.some(
      (r) => r.targetId === collectionId && r.targetType === "COLLECTION"
    );
    if (alreadyReversed) {
      return {
        success: false,
        error: `Payment receipt #${targetCollection.receiptNumber} has already been reversed. Duplicate reversal rejected.`,
      };
    }

    // Financial Period Validation for the REVERSAL date (now)
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { 
        success: false, 
        error: language === "ar" 
          ? `لا يمكن إجراء العكس المالي: ${periodCheck.errorAr}` 
          : `Financial reversal cannot be performed: ${periodCheck.errorEn}` 
      };
    }

    // Identify and reverse all active allocations
    const relatedAllocations = paymentAllocations.filter(
      (a) => a.collectionId === collectionId && a.status === "ACTIVE"
    );

    for (const alloc of relatedAllocations) {
      // Revert target state
      if (alloc.targetType === "COMMISSION") {
        setCommissions((prev) =>
          prev.map((c) => {
            if (c.id === alloc.targetId) {
              const newCollected = Math.max(0, c.collectedAmount - alloc.allocatedAmount);
              const newRemaining = Math.max(0, c.totalCommissionAmount - newCollected);
              const status: CommissionObligation["status"] =
                newCollected <= 0 ? "PENDING" : newRemaining <= 0 ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED";
              const updated = {
                ...c,
                collectedAmount: newCollected,
                outstandingBalance: newRemaining,
                status,
                updatedAt: new Date().toISOString(),
              };
              safeSetDoc(doc(db, "commissions", c.id), updated, { merge: true });
              return updated;
            }
            return c;
          })
        );
      } else if (alloc.targetType === "CHEQUE") {
        setCheques((prev) =>
          prev.map((c) => {
            if (c.id === alloc.targetId) {
              const newTotalApplied = Math.max(0, c.totalApplied - alloc.allocatedAmount);
              const newOutstanding = Math.max(0, c.amount - newTotalApplied);
              const isFullyCollected = newOutstanding <= 0.0001;
              const chqCollectionStatus: CollectionStatus = isFullyCollected
                ? "FULLY_COLLECTED_AFTER_BOUNCE"
                : newTotalApplied > 0
                ? "PARTIAL_COLLECTION"
                : "NOT_COLLECTED";
              const chqStatus: ChequeStatus = isFullyCollected ? "COLLECTED" : (c.originalStatus === "BOUNCED" ? "BOUNCED" : "PENDING");
              const updated: Cheque = {
                ...c,
                totalApplied: newTotalApplied,
                outstanding: newOutstanding,
                collectionStatus: chqCollectionStatus,
                status: chqStatus,
              };
              safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
              return updated;
            }
            return c;
          })
        );
      } else if (alloc.targetType === "LEASE_INSTALLMENT") {
        const [lId, instNumStr] = alloc.targetId.split(":");
        const instNum = parseInt(instNumStr);
        setLeases((prevLeases) =>
          prevLeases.map((l) => {
            if (l.id === lId) {
              if (l.installments && l.installments.length > 0) {
                const updatedInsts = l.installments.map((inst) => {
                  if (inst.installmentNumber === instNum) {
                    const otherAllocated = paymentAllocations
                      .filter((p) => p.targetType === "LEASE_INSTALLMENT" && p.targetId === alloc.targetId && p.status === "ACTIVE" && p.id !== alloc.id)
                      .reduce((sum, p) => sum + p.allocatedAmount, 0);

                    return {
                      ...inst,
                      status: otherAllocated >= inst.amount - 0.01 ? ("COLLECTED" as const) : ("PENDING" as const),
                    };
                  }
                  return inst;
                });
                const updatedLease = { ...l, installments: updatedInsts };
                safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });
                return updatedLease;
              }
            }
            return l;
          })
        );
      }
    }

    // Mark allocations as REVERSED
    const nowIso = new Date().toISOString();
    setPaymentAllocations((prev) =>
      prev.map((a) => {
        if (a.collectionId === collectionId && a.status === "ACTIVE") {
          const updated = {
            ...a,
            status: "REVERSED" as const,
            reversalReason: reason,
            reversalTimestamp: nowIso,
            reversedById: currentUser?.id || "system",
          };
          safeSetDoc(doc(db, "payment_allocations", a.id), updated, { merge: true });
          return updated;
        }
        return a;
      })
    );

    // Create Reversal Record
    const reversalRecord: FinancialReversalRecord = {
      id: "rev-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      reversalNumber: generateSequentialNumber(financialReversals, "reversalNumber", "REV-"),
      targetType: "COLLECTION",
      targetId: collectionId,
      originalAmount: targetCollection.amountEntered,
      reversedAmount: targetCollection.amountEntered,
      reason,
      reversalDate: nowIso.split("T")[0],
      reversalTimestamp: nowIso,
      performedByUserId: currentUser?.id || "system",
      performedByUserName: currentUser?.nameEn || "System Admin",
      createdAt: nowIso,
    };

    setFinancialReversals((prev) => [reversalRecord, ...prev]);
    safeSetDoc(doc(db, "financial_reversals", reversalRecord.id), reversalRecord);

    logAudit(
      "PAYMENT_REVERSED",
      "REVERSAL",
      reversalRecord.id,
      `Reversal #${reversalRecord.reversalNumber}`,
      `Reversed payment receipt #${targetCollection.receiptNumber} (${targetCollection.amountEntered.toLocaleString()} AED). Reason: ${reason}`
    );

    return { success: true, reversal: reversalRecord };
  };

  const recordLeasePayment = async (params: {
    leaseId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    payerName: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    chequeDetails?: {
      chequeNumber: string;
      chequeDate: string;
      bankName: string;
      accountHolder?: string;
      depositDate?: string;
      depositReference?: string;
    };
    attachment?: {
      fileName: string;
      driveFileId?: string;
      driveWebViewLink?: string;
    };
    approvalCode?: string;
  }): Promise<{ success: boolean; receipt?: CollectionRecord; error?: string }> => {
    return processUnifiedPayment(params);
  };

  const liquidateUnallocatedAdvance = async (params: {
    leaseId: string;
    allocations: Array<{
      targetType: PaymentAllocationTargetType;
      targetId: string;
      amount: number;
      targetDescription?: string;
    }>;
    notes?: string;
  }): Promise<{ success: boolean; allocatedCount: number; error?: string }> => {
    const leaseObj = leases.find((l) => l.id === params.leaseId);
    if (!leaseObj) {
      return { success: false, allocatedCount: 0, error: "Lease contract not found." };
    }

    const totalToAllocate = params.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalToAllocate <= 0) {
      return { success: false, allocatedCount: 0, error: "Total allocation amount must be greater than zero." };
    }

    // Find all collections for this tenant/lease that have unallocated amounts
    const tenantCollections = collections.filter(
      (c) => c.tenantId === leaseObj.tenantId && c.ownerId === leaseObj.ownerId
    );

    // Calculate unallocated balance per collection
    const unallocatedCollections = tenantCollections
      .map((col) => {
        const activeAllocations = paymentAllocations
          .filter((pa) => pa.collectionId === col.id && pa.status === "ACTIVE")
          .reduce((sum, pa) => sum + pa.allocatedAmount, 0);
        const unallocated = col.amountEntered - activeAllocations;
        return {
          col,
          unallocated: Math.max(0, unallocated),
        };
      })
      .filter((item) => item.unallocated > 0.001);

    const totalAvailableAdvance = unallocatedCollections.reduce((sum, item) => sum + item.unallocated, 0);

    if (totalToAllocate > totalAvailableAdvance + 0.01) {
      return {
        success: false,
        allocatedCount: 0,
        error:
          language === "ar"
            ? `رصيد الدفعة المقدمة غير كافٍ. المتاح: ${totalAvailableAdvance.toLocaleString()} درهم، المطلوب توزيعه: ${totalToAllocate.toLocaleString()} درهم.`
            : `Insufficient unallocated advance balance. Available: ${totalAvailableAdvance.toLocaleString()} AED, Requested: ${totalToAllocate.toLocaleString()} AED.`,
      };
    }

    let remainingToDistribute = totalToAllocate;
    const newAllocations: PaymentAllocation[] = [];
    const nowIso = new Date().toISOString();

    for (const allocReq of params.allocations) {
      if (allocReq.amount <= 0) continue;
      let targetNeeded = allocReq.amount;

      for (const item of unallocatedCollections) {
        if (item.unallocated <= 0 || targetNeeded <= 0) continue;
        const take = Math.min(item.unallocated, targetNeeded);
        item.unallocated -= take;
        targetNeeded -= take;
        remainingToDistribute -= take;

        const newAlloc: PaymentAllocation = {
          id: "pal-adv-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
          collectionId: item.col.id,
          targetType: allocReq.targetType,
          targetId: allocReq.targetId,
          targetDescription: allocReq.targetDescription || "Advance Liquidation",
          allocatedAmount: take,
          allocationDate: nowIso.split("T")[0],
          status: "ACTIVE",

          createdAt: nowIso,
          createdById: currentUser?.id || "system",
        };

        newAllocations.push(newAlloc);
        safeSetDoc(doc(db, "payment_allocations", newAlloc.id), newAlloc);

        // Update collection amountApplied
        const newApplied = (item.col.amountApplied || 0) + take;
        setCollections((prev) =>
          prev.map((c) => (c.id === item.col.id ? { ...c, amountApplied: newApplied } : c))
        );
        safeSetDoc(doc(db, "collections", item.col.id), { amountApplied: newApplied }, { merge: true });

        // Update target state
        if (allocReq.targetType === "COMMISSION") {
          setCommissions((prev) =>
            prev.map((c) => {
              if (c.id === allocReq.targetId) {
                const newCollected = c.collectedAmount + take;
                const newRemaining = Math.max(0, c.totalCommissionAmount - newCollected);
                const status: CommissionStatus = newRemaining <= 0.0001 ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED";
                const updated: CommissionObligation = { ...c, collectedAmount: newCollected, outstandingBalance: newRemaining, status };
                safeSetDoc(doc(db, "commissions", c.id), updated, { merge: true });
                return updated;
              }
              return c;
            })
          );
        } else if (allocReq.targetType === "CHEQUE") {
          setCheques((prev) =>
            prev.map((c) => {
              if (c.id === allocReq.targetId) {
                const newAppliedChq = c.totalApplied + take;
                const newOutstanding = Math.max(0, c.amount - newAppliedChq);
                const isFullyCollected = newOutstanding <= 0.0001;
                const collectionStatus: CollectionStatus = isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION";
                const status: ChequeStatus = isFullyCollected ? "COLLECTED" : c.status;
                const updated: Cheque = {
                  ...c,
                  totalApplied: newAppliedChq,
                  outstanding: newOutstanding,
                  collectionStatus,
                  status,
                };
                safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
                return updated;
              }
              return c;
            })
          );
        } else if (allocReq.targetType === "LEASE_INSTALLMENT") {
          const [lId, instNumStr] = allocReq.targetId.split(":");
          const instNum = parseInt(instNumStr);
          
          let linkedChequeId: string | null = null;
          
          setLeases((prevLeases) =>
            prevLeases.map((l) => {
              if (l.id === lId && l.installments) {
                const updatedInstList = l.installments.map((inst) => {
                  if (inst.installmentNumber === instNum) {
                    if ((inst as any).chequeId) linkedChequeId = (inst as any).chequeId;
                    
                    const alreadyAllocated = paymentAllocations
                      .filter((p) => p.targetType === "LEASE_INSTALLMENT" && p.targetId === allocReq.targetId && p.status === "ACTIVE")
                      .reduce((sum, p) => sum + p.allocatedAmount, 0) + take;
                    const status = alreadyAllocated >= inst.amount - 0.01 ? "COLLECTED" : inst.status;
                    return { ...inst, status };
                  }
                  return inst;
                });
                const updatedLease = { ...l, installments: updatedInstList };
                safeSetDoc(doc(db, "leases", l.id), updatedLease, { merge: true });
                return updatedLease;
              }
              return l;
            })
          );
          
          // Fix: Ensure that if the installment has a linked cheque, the cheque is also updated to reflect the cash collection.
          if (linkedChequeId) {
            setCheques((prev) =>
              prev.map((c) => {
                if (c.id === linkedChequeId) {
                  const newTotalApplied = c.totalApplied + take;
                  const newOutstanding = Math.max(0, c.amount - newTotalApplied);
                  const isFullyCollected = newOutstanding <= 0.0001;
                  const collectionStatus: CollectionStatus = isFullyCollected ? "FULLY_COLLECTED_AFTER_BOUNCE" : "PARTIAL_COLLECTION";
                  const status: ChequeStatus = isFullyCollected ? "COLLECTED" : c.status;
                  const updated: Cheque = {
                    ...c,
                    totalApplied: newTotalApplied,
                    outstanding: newOutstanding,
                    collectionStatus,
                    status,
                  };
                  safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
                  return updated;
                }
                return c;
              })
            );
          }
        }
      }
    }

    setPaymentAllocations((prev) => [...newAllocations, ...prev]);

    logAudit(
      "ADVANCE_LIQUIDATION",
      "LEASE",
      leaseObj.id,
      `عقد ${leaseObj.leaseNumber}`,
      `تم تسوية دفعة مقدمة غير موزعة بمبلغ ${totalToAllocate.toLocaleString()} AED لعقد الإيجار #${leaseObj.leaseNumber} وتوزيعها على الالتزامات.`
    );

    return { success: true, allocatedCount: newAllocations.length };
  };

  const reverseSinglePaymentAllocation = (
    allocationId: string,
    reason: string
  ): { success: boolean; error?: string } => {
    const targetAlloc = paymentAllocations.find((a) => a.id === allocationId);
    if (!targetAlloc) {
      return { success: false, error: "Payment allocation not found." };
    }
    if (targetAlloc.status === "REVERSED") {
      return { success: false, error: "Payment allocation is already reversed." };
    }

    const nowIso = new Date().toISOString();

    // Revert target state
    if (targetAlloc.targetType === "COMMISSION") {
      setCommissions((prev) =>
        prev.map((c) => {
          if (c.id === targetAlloc.targetId) {
            const newCollected = Math.max(0, c.collectedAmount - targetAlloc.allocatedAmount);
            const newRemaining = Math.max(0, c.totalCommissionAmount - newCollected);
            const status: CommissionObligation["status"] =
              newCollected <= 0 ? "PENDING" : newRemaining <= 0 ? "FULLY_COLLECTED" : "PARTIALLY_COLLECTED";
            const updated = {
              ...c,
              collectedAmount: newCollected,
              outstandingBalance: newRemaining,
              status,
              updatedAt: nowIso,
            };
            safeSetDoc(doc(db, "commissions", c.id), updated, { merge: true });
            return updated;
          }
          return c;
        })
      );
    } else if (targetAlloc.targetType === "CHEQUE") {
      setCheques((prev) =>
        prev.map((c) => {
          if (c.id === targetAlloc.targetId) {
            const newTotalApplied = Math.max(0, c.totalApplied - targetAlloc.allocatedAmount);
            const newOutstanding = Math.max(0, c.amount - newTotalApplied);
            const isFullyCollected = newOutstanding <= 0.0001;
            const status: ChequeStatus = isFullyCollected ? "COLLECTED" : (c.originalStatus === "BOUNCED" ? "BOUNCED" : "PENDING");
            const updated: Cheque = {
              ...c,
              totalApplied: newTotalApplied,
              outstanding: newOutstanding,
              collectionStatus: isFullyCollected
                ? ("FULLY_COLLECTED_AFTER_BOUNCE" as const)
                : newTotalApplied > 0
                ? ("PARTIAL_COLLECTION" as const)
                : ("NOT_COLLECTED" as const),
              status,
            };
            safeSetDoc(doc(db, "cheques", c.id), updated, { merge: true });
            return updated;
          }
          return c;
        })
      );
    }

    const updatedAlloc: PaymentAllocation = {
      ...targetAlloc,
      status: "REVERSED",
      reversalReason: reason,
      reversalTimestamp: nowIso,
      reversedById: currentUser?.id || "system",
    };

    setPaymentAllocations((prev) => prev.map((a) => (a.id === allocationId ? updatedAlloc : a)));
    safeSetDoc(doc(db, "payment_allocations", allocationId), updatedAlloc, { merge: true });

    logAudit(
      "ALLOCATION_REVERSED",
      "PAYMENT_ALLOCATION",
      allocationId,
      `Allocation ${allocationId}`,
      `Reversed allocation of AED ${targetAlloc.allocatedAmount.toLocaleString()} to target ${targetAlloc.targetId}. Reason: ${reason}`
    );

    return { success: true };
  };

  const recordFinancialAdjustment = (
    params: Omit<FinancialAdjustmentRecord, "id" | "adjustmentNumber" | "createdAt">
  ): { success: boolean; adjustment?: FinancialAdjustmentRecord; error?: string } => {
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(params.effectiveDate, financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const newAdj: FinancialAdjustmentRecord = {
      ...params,
      id: "adj-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      adjustmentNumber: generateSequentialNumber(financialAdjustments, "adjustmentNumber", "ADJ-"),
      createdAt: new Date().toISOString(),
    };

    setFinancialAdjustments((prev) => [newAdj, ...prev]);
    safeSetDoc(doc(db, "financial_adjustments", newAdj.id), newAdj);

    logAudit(
      "FINANCIAL_ADJUSTMENT",
      "ADJUSTMENT",
      newAdj.id,
      `Adjustment #${newAdj.adjustmentNumber}`,
      `Recorded financial ${newAdj.adjustmentType} adjustment of AED ${newAdj.amount.toLocaleString()} for ${newAdj.targetEntityType} (${newAdj.targetEntityId}). Reason: ${newAdj.reason}`
    );

    return { success: true, adjustment: newAdj };
  };

  const reconcileSystemFinancialBalances = (shouldLogAudit = false): ReconciledFinancialBalances => {
    const result = recalculateAllFinancialBalances({
      leases,
      cheques,
      collections,
      commissions,
      paymentAllocations,
      reversals: financialReversals,
      adjustments: financialAdjustments,
      owners,
      ownerTransfers,
    });

    if (shouldLogAudit) {
      logAudit(
        "RECONCILIATION_PERFORMED",
        "FINANCIAL_TRANSACTION",
        "system-reconciliation",
        "Financial Reconciler",
        `Recalculated derived balances: ${Object.keys(result.tenantBalances).length} tenants, ${Object.keys(result.ownerBalances).length} owners, ${Object.keys(result.chequeBalances).length} cheques, ${Object.keys(result.commissionBalances).length} commissions.`
      );
    }

    return result;
  };

  // -------------------------------------------------------------
  // ERP PHASE 2: Chart of Accounts, Owner Transfers & Property Expenses
  // -------------------------------------------------------------

  const getOwnerPayable = (ownerId: string): OwnerPayableDetails => {
    return computeOwnerPayableDetails(ownerId, {
      collections,
      commissions,
      expenses: propertyExpenses,
      transfers: ownerTransfers,
      adjustments: financialAdjustments,
      reversals: financialReversals,
    });
  };

  const getOwnerStatement = (
    ownerId: string,
    filters?: { propertyId?: string; dateFrom?: string; dateTo?: string }
  ): OwnerStatementReport => {
    const targetOwner = owners.find((o) => o.id === ownerId);
    const ownerName = targetOwner?.nameAr || targetOwner?.nameEn || "المالك";
    return generateOwnerStatement(ownerId, ownerName, filters || {}, {
      collections,
      commissions,
      expenses: propertyExpenses,
      transfers: ownerTransfers,
      adjustments: financialAdjustments,
      reversals: financialReversals,
      leases,
      tenants,
    });
  };

  const getTenantStatement = (
    tenantId: string,
    filters?: { leaseId?: string; dateFrom?: string; dateTo?: string }
  ): TenantStatementReport => {
    const targetTenant = tenants.find((t) => t.id === tenantId);
    const tenantName = targetTenant?.nameAr || targetTenant?.nameEn || "المستأجر";
    return generateTenantStatement(tenantId, tenantName, filters || {}, {
      leases,
      collections,
      commissions,
      expenses: propertyExpenses,
      cheques,
      adjustments: financialAdjustments,
      reversals: financialReversals,
    });
  };

  // -------------------------------------------------------------
  // ERP PHASE 19: Advanced Accounts Receivable & Debt Recovery
  // -------------------------------------------------------------

  const getTenantReceivablePosition = (tenantId: string): TenantReceivablePosition => {
    const statement = getTenantStatement(tenantId);
    const tenant = tenants.find(t => t.id === tenantId);
    const activeLease = leases.find(l => l.tenantId === tenantId && (l.contractStatus === "ACTIVE" || l.contractStatus === "RENEWED"));
    
    // 1. Core Balances
    const outstanding = statement.closingBalance;
    const totalDue = statement.totalDebits;
    const totalPaid = statement.totalCredits;
    
    // 2. Specific Debt Components
    const tenantBouncedCheques = cheques.filter(c => c.tenantId === tenantId && c.status === "BOUNCED");
    const bouncedChequeAmount = tenantBouncedCheques.reduce((sum, c) => sum + c.outstanding, 0);
    
    const tenantCommissions = commissions.filter(c => c.tenantId === tenantId && (c.status === "PENDING" || c.status === "DUE" || c.status === "PARTIALLY_COLLECTED"));
    const administrativeFeesDue = tenantCommissions.reduce((sum, c) => sum + c.outstandingBalance, 0);
    
    const tenantExpenses = propertyExpenses.filter(e => e.tenantId === tenantId && e.costBearer === "TENANT" && e.status !== "REVERSED" && e.status !== "PAID");
    const maintenanceChargesDue = tenantExpenses.filter(e => e.category === "MAINTENANCE").reduce((sum, e) => sum + e.totalAmount, 0);
    const legalChargesDue = tenantExpenses.filter(e => e.category === "LEGAL_FEES").reduce((sum, e) => sum + e.totalAmount, 0);

    // 3. Aging Engine
    // Logic: Map debits from statement that aren't yet "covered" by credits
    // For simplicity in this implementation, we take the outstanding balance and attribute it to the oldest due dates
    // In a real system we'd match every debit to every credit (FIFO)
    const aging = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91_120: 0, days121Plus: 0 };
    
    const now = new Date();
    const debits = statement.transactions.filter(t => t.debit > 0).sort((a, b) => a.date.localeCompare(b.date));
    let remainingToAttribute = outstanding;
    
    // Reverse attribution (LIFO for current outstanding) - but user wants Aging buckets based on due date
    // Standard aging: Unpaid balance distributed by how long it's been due
    // We'll use a simplified version: If you owe 1000, and your oldest unpaid charge was 40 days ago, that 1000 sits in the 31-60 bucket
    
    for (const d of debits) {
      if (remainingToAttribute <= 0) break;
      const chargeAmount = d.debit;
      const dueDate = new Date(d.date);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const amountToBucket = Math.min(chargeAmount, remainingToAttribute);
      
      if (diffDays <= 0) aging.current += amountToBucket;
      else if (diffDays <= 30) aging.days1_30 += amountToBucket;
      else if (diffDays <= 60) aging.days31_60 += amountToBucket;
      else if (diffDays <= 90) aging.days61_90 += amountToBucket;
      else if (diffDays <= 120) aging.days91_120 += amountToBucket;
      else aging.days121Plus += amountToBucket;
      
      remainingToAttribute -= amountToBucket;
    }

    // 4. Priority & Status
    const reasons: string[] = [];
    let priority: CollectionPriority = "LOW";
    
    if (outstanding > 1000) {
      priority = "MEDIUM";
      reasons.push("Overdue balance > 1,000 AED");
    }
    if (aging.days61_90 > 0 || aging.days91_120 > 0) {
      priority = "HIGH";
      reasons.push("Balance overdue > 60 days");
    }
    if (bouncedChequeAmount > 0) {
      priority = "CRITICAL";
      reasons.push(`${tenantBouncedCheques.length} Bounced Cheque(s) detected`);
    }
    if (aging.days121Plus > 0) {
      priority = "CRITICAL";
      reasons.push("Severe aging > 120 days");
    }

    let status: TenantReceivablePosition["status"] = "CURRENT";
    if (outstanding > 0) {
      if (priority === "CRITICAL") status = "SEVERELY_OVERDUE";
      else if (priority === "HIGH") status = "OVERDUE";
      else status = "DUE_SOON";
    }
    if (tenantBouncedCheques.some(c => cases.some(cs => cs.linkedChequeIds.includes(c.id)))) {
       status = "LEGAL_ESCALATION";
    }
    if (outstanding <= 0 && totalDue > 0) status = "COLLECTION_COMPLETED";

    return {
      tenantId,
      totalDue,
      totalPaid,
      outstanding,
      aging,
      bouncedChequeAmount,
      administrativeFeesDue,
      maintenanceChargesDue,
      legalChargesDue,
      priority,
      priorityReasons: reasons,
      status
    };
  };

  const addCollectionAction = (data: Omit<CollectionAction, "id" | "actionNumber" | "createdAt" | "createdById">): { success: boolean; action?: CollectionAction; error?: string } => {
    const actionNumber = `COL-ACT-${Date.now().toString().slice(-6)}`;
    const id = `colact-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const createdAt = new Date().toISOString();
    const createdById = currentUser?.id || "sys";
    
    const newAction: CollectionAction = {
      ...data,
      id,
      actionNumber,
      createdAt,
      createdById,
    };
    
    setCollectionActions(prev => [newAction, ...prev]);
    safeSetDoc(doc(db, "collection_actions", id), newAction);
    
    logAudit("CREATE", "COLLECTION_ACTION", id, `Follow-up #${actionNumber}`, `Recorded ${data.actionType} follow-up for tenant ${data.tenantId}. Result: ${data.result || "N/A"}`);
    
    return { success: true, action: newAction };
  };

  const updateCollectionAction = (id: string, patch: Partial<CollectionAction>, modificationReason?: string): { success: boolean; error?: string } => {
    const existing = collectionActions.find(a => a.id === id);
    if (!existing) return { success: false, error: "Action not found" };
    
    const check = checkFinancialEditPermission("COLLECTION_ACTION", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("COLLECTION_ACTION", existing, "VERSION");

    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    setCollectionActions(prev => prev.map(a => a.id === id ? updated : a));
    safeSetDoc(doc(db, "collection_actions", id), updated, { merge: true });
    
    logAudit(
      "FINANCIAL_RECORD_EDIT", 
      "COLLECTION_ACTION", 
      id, 
      `Follow-up #${existing.actionNumber}`, 
      `Modified collection action fields: ${Object.keys(patch).join(", ")}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );
    
    return { success: true };
  };

  const addPaymentPromise = (data: Omit<PaymentPromise, "id" | "promiseNumber" | "createdAt" | "createdById" | "amountFulfilled">): { success: boolean; promise?: PaymentPromise; error?: string } => {
    const promiseNumber = `PROM-${Date.now().toString().slice(-6)}`;
    const id = `prom-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const createdAt = new Date().toISOString();
    const createdById = currentUser?.id || "sys";
    
    const newPromise: PaymentPromise = {
      ...data,
      id,
      promiseNumber,
      amountFulfilled: 0,
      createdAt,
      createdById,
    };
    
    setPaymentPromises(prev => [newPromise, ...prev]);
    safeSetDoc(doc(db, "payment_promises", id), newPromise);
    
    logAudit("CREATE", "PAYMENT_PROMISE", id, `Promise #${promiseNumber}`, `Tenant promised to pay AED ${data.amountPromised.toLocaleString()} on ${data.expectedPaymentDate}`);
    
    return { success: true, promise: newPromise };
  };

  const updatePaymentPromise = (id: string, patch: Partial<PaymentPromise>, modificationReason?: string): { success: boolean; error?: string } => {
    const existing = paymentPromises.find(p => p.id === id);
    if (!existing) return { success: false, error: "Promise not found" };
    
    const check = checkFinancialEditPermission("PAYMENT_PROMISE", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("PAYMENT_PROMISE", existing, "VERSION");

    const updated = { ...existing, ...patch };
    setPaymentPromises(prev => prev.map(p => p.id === id ? updated : p));
    safeSetDoc(doc(db, "payment_promises", id), updated, { merge: true });
    
    logAudit(
      "FINANCIAL_RECORD_EDIT", 
      "PAYMENT_PROMISE", 
      id, 
      `Promise #${existing.promiseNumber}`, 
      `Modified promise fields: ${Object.keys(patch).join(", ")}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );
    
    return { success: true };
  };

  const fulfillPaymentPromise = (promiseId: string, amount: number): { success: boolean; error?: string } => {
    const existing = paymentPromises.find(p => p.id === promiseId);
    if (!existing) return { success: false, error: "Promise not found" };
    
    const newFulfilled = existing.amountFulfilled + amount;
    const isFull = newFulfilled >= existing.amountPromised - 0.01;
    
    const updated: PaymentPromise = {
      ...existing,
      amountFulfilled: newFulfilled,
      status: isFull ? "FULFILLED" : "PARTIALLY_FULFILLED",
      fulfillmentDate: isFull ? new Date().toISOString() : undefined
    };
    
    setPaymentPromises(prev => prev.map(p => p.id === promiseId ? updated : p));
    safeSetDoc(doc(db, "payment_promises", promiseId), updated, { merge: true });
    
    logAudit("UPDATE", "PAYMENT_PROMISE", promiseId, `Promise #${existing.promiseNumber}`, `Fulfilled promise with AED ${amount.toLocaleString()}. Status: ${updated.status}`);
    
    return { success: true };
  };

  const addDailyDeposit = async (deposit: Omit<DailyDepositRecord, "id" | "createdAt" | "createdBy">) => {
    try {
      if (!currentUser) throw new Error("Unauthorized");
      const newDeposit: DailyDepositRecord = {
        ...deposit,
        id: `DEP-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
        createdBy: currentUser.nameEn,
        createdAt: new Date().toISOString(),
      };
      setDailyDeposits((prev) => [...prev, newDeposit]);
      return { success: true, id: newDeposit.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateDailyDeposit = async (id: string, updates: Partial<DailyDepositRecord>) => {
    try {
      if (!currentUser) throw new Error("Unauthorized");
      setDailyDeposits((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const addOwnerTransfer = async (
    data: Omit<OwnerTransferRecord, "id" | "transferNumber" | "createdAt" | "createdById" | "createdByName"> & {
      createdById?: string;
      createdByName?: string;
    }
  ): Promise<{ success: boolean; transfer?: OwnerTransferRecord; error?: string }> => {
    // 0. Idempotency check
    if (data.idempotencyKey) {
      const existing = ownerTransfers.find((t) => t.idempotencyKey === data.idempotencyKey);
      if (existing) {
        return { success: true, transfer: existing };
      }
    }

    // 1. Authoritative validation against live net remaining balance
    const payableDetails = getOwnerPayable(data.ownerId);

    // 1.1 Financial Period Validation
    const periodCheck = validateTransactionPeriod(data.transferDate, financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const validation = validateOwnerTransfer(data.ownerId, data.amount, payableDetails.netRemainingBalance);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    
    const expectedLocalTotalHeld = owners.find(o => o.id === data.ownerId)?.totalHeld || 0;

    const transferNumber = generateSequentialNumber(ownerTransfers, "transferNumber", "TRF-", 4, false);
    const id = `trf-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const createdAt = new Date().toISOString();
    const createdById = data.createdById || currentUser?.id || "sys";
    const createdByName = data.createdByName || currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    const idempotencyKey = data.idempotencyKey || `idem-trf-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;

    const ownerObj = owners.find(o => o.id === data.ownerId);
    const beneficiaryBankName = data.beneficiaryBankName || ownerObj?.bankName || undefined;
    const beneficiaryIban = data.beneficiaryIban || ownerObj?.iban || undefined;

    const newTransfer: OwnerTransferRecord = {
      ...data,
      beneficiaryBankName,
      beneficiaryIban,
      id,
      transferNumber,
      status: data.status || "APPROVED",
      createdAt,
      createdById,
      createdByName,
      idempotencyKey,
    };

    try {
      await runTransaction(db, async (transaction) => {
        const ownerRef = doc(db, "owners", data.ownerId);
        const ownerSnap = await transaction.get(ownerRef);
        if (!ownerSnap.exists()) {
          throw new Error("Owner not found in database.");
        }
        
        const currentHeld = ownerSnap.data().totalHeld || 0;
        
        // Optimistic Concurrency Control Check:
        if (currentHeld !== expectedLocalTotalHeld) {
           throw new Error(language === "ar" ? "تم اكتشاف عملية مالية متزامنة على حساب هذا المالك. يرجى تحديث الصفحة والمحاولة مرة أخرى." : "Concurrent financial operation detected on this owner's account. Please refresh and try again.");
        }

        transaction.update(ownerRef, { totalHeld: currentHeld + data.amount });
        
        const newTransferRef = doc(db, "owner_transfers", id);
        transaction.set(newTransferRef, sanitizeForFirestore(newTransfer));
      });
      
      setOwners((prev) => prev.map((o) => o.id === data.ownerId ? { ...o, totalHeld: (o.totalHeld || 0) + data.amount } : o));
      setOwnerTransfers((prev) => [newTransfer, ...prev]);

      logAudit(
        "CREATE",
        "OWNER_TRANSFER",
        id,
        `تحويل مالك #${transferNumber}`,
        `تم إصدار تحويل للمالك بمبلغ ${data.amount.toLocaleString()} AED (${data.paymentMethod}) - حالة: ${newTransfer.status}`
      );

      return { success: true, transfer: newTransfer };
    } catch (error: any) {
      console.error("Transaction failed: ", error);
      return { success: false, error: error.message || "Failed to create transfer due to a database error." };
    }
  };

  const updateOwnerTransfer = async (
    id: string,
    patch: Partial<OwnerTransferRecord>,
    modificationReason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = ownerTransfers.find((t) => t.id === id);
    if (!existing) return { success: false, error: "سجل التحويل غير موجود." };

    // Financial Lock: Immutability check for settled or closed records
    if (["PAID", "COMPLETED", "RECONCILED", "REVERSED", "CANCELLED"].includes(existing.status)) {
      if (
        (patch.amount !== undefined && patch.amount !== existing.amount) ||
        (patch.ownerId !== undefined && patch.ownerId !== existing.ownerId) ||
        (patch.transferDate !== undefined && patch.transferDate !== existing.transferDate) ||
        (patch.paymentMethod !== undefined && patch.paymentMethod !== existing.paymentMethod)
      ) {
        return {
          success: false,
          error: language === "ar"
            ? "هذه الحوالة مرحلة ومغلقة مالياً ولا يمكن تعديل مبالغها أو أطرافها. استخدم الإلغاء قبل الصرف أو العكس المالي للحوالات المسددة."
            : "This transfer is financially posted and locked. Financial fields cannot be modified."
        };
      }
    }

    const check = checkFinancialEditPermission("OWNER_TRANSFER", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    // Determine if we need a transaction for financial field changes
    const isFinancialChange = (patch.amount !== undefined && patch.amount !== existing.amount) ||
                             (patch.ownerId !== undefined && patch.ownerId !== existing.ownerId);

    const isContributingToHeld = ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(existing.status);

    if (isFinancialChange && isContributingToHeld) {
      try {
        await runTransaction(db, async (transaction) => {
          const transferDocRef = doc(db, "owner_transfers", id);
          const oldOwnerDocRef = doc(db, "owners", existing.ownerId);
          
          const oldOwnerDoc = await transaction.get(oldOwnerDocRef);
          if (!oldOwnerDoc.exists()) throw new Error("مالك العقار غير موجود.");
          
          const oldOwnerData = oldOwnerDoc.data() as Owner;
          const oldAmount = existing.amount;
          const newAmount = patch.amount !== undefined ? patch.amount : oldAmount;
          const newOwnerId = patch.ownerId !== undefined ? patch.ownerId : existing.ownerId;
          
          const isOwnerChanged = newOwnerId !== existing.ownerId;

          if (isOwnerChanged) {
            const newOwnerDocRef = doc(db, "owners", newOwnerId);
            const newOwnerDoc = await transaction.get(newOwnerDocRef);
            if (!newOwnerDoc.exists()) throw new Error("المالك الجديد غير موجود.");
            
            const newOwnerData = newOwnerDoc.data() as Owner;
            
            // Validate new owner capacity
            const newOwnerPayable = getOwnerPayable(newOwnerId);
            const validation = validateOwnerTransfer(newOwnerId, newAmount, newOwnerPayable.netRemainingBalance);
            if (!validation.isValid) throw new Error(validation.error);

            // 1. Remove from old owner
            transaction.update(oldOwnerDocRef, {
              totalHeld: Math.max(0, (oldOwnerData.totalHeld || 0) - oldAmount)
            });
            
            // 2. Add to new owner
            transaction.update(newOwnerDocRef, {
              totalHeld: (newOwnerData.totalHeld || 0) + newAmount
            });
          } else {
            // Amount change for same owner
            const amountDelta = newAmount - oldAmount;
            
            if (amountDelta > 0) {
              // Validate capacity for additional amount
              const payableDetails = getOwnerPayable(existing.ownerId);
              const validation = validateOwnerTransfer(existing.ownerId, amountDelta, payableDetails.netRemainingBalance);
              if (!validation.isValid) throw new Error(validation.error);
            }
            
            const newTotalHeld = (oldOwnerData.totalHeld || 0) + amountDelta;
            if (newTotalHeld < 0) throw new Error("خطأ في رصيد المبالغ المحجوزة.");
            
            transaction.update(oldOwnerDocRef, { totalHeld: newTotalHeld });
          }

          transaction.update(transferDocRef, sanitizeForFirestore({
            ...patch,
            updatedAt: new Date().toISOString()
          }));
        });

        const updated: OwnerTransferRecord = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        setOwnerTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
        
        logAudit("FINANCIAL_RECORD_EDIT", "OWNER_TRANSFER", id, `تحويل #${existing.transferNumber}`, `تم تحديث بيانات تحويل المالك مالياً (تغيير المبلغ أو المالك).`, JSON.stringify(existing), JSON.stringify(updated), modificationReason);
        return { success: true };
      } catch (error: any) {
        console.error("Update Owner Transfer Transaction failed: ", error);
        return { success: false, error: error.message || "فشلت عملية التحديث في قاعدة البيانات." };
      }
    }

    saveEntitySnapshot("OWNER_TRANSFER", existing, "VERSION");

    const updated: OwnerTransferRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setOwnerTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    safeSetDoc(doc(db, "owner_transfers", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "OWNER_TRANSFER",
      id,
      `تحويل #${existing.transferNumber}`,
      `تم تحديث بيانات تحويل المالك.`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );

    return { success: true };
  };

  const settleOwnerTransfer = async (params: {
    transferId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
  }): Promise<{ success: boolean; error?: string }> => {
    const {
      transferId,
      proofBase64,
      proofFileName,
      proofFileType,
      proofFileSize,
      transactionReferenceNumber,
      notes,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
    } = params;
    
    // RBAC Authorization check
    const check = checkFinancialEditPermission("OWNER_TRANSFER", "Settlement");
    if (!check.allowed) return { success: false, error: check.error };
    
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const existing = ownerTransfers.find((t) => t.id === transferId);
    if (!existing) return { success: false, error: "سجل التحويل غير موجود." };

    // Idempotency check: If already settled and posted, return success
    if (existing.status === "PAID" || existing.status === "COMPLETED" || existing.status === "RECONCILED") {
      return { success: true };
    }

    if (existing.status === "CANCELLED" || existing.status === "REVERSED" || existing.isReversed) {
      return {
        success: false,
        error: language === "ar"
          ? "لا يمكن تسوية تحويل ملغى أو معكوس ماليًا."
          : "Cannot settle a cancelled or reversed owner transfer."
      };
    }

    // Resolve proof document from archive
    const resolvedArchiveDoc = existing.proofDocumentId
      ? archive.find((a) => a.id === existing.proofDocumentId && (a.entityId === transferId || a.recordId === transferId))
      : archive.find((a) => a.entityId === transferId || a.recordId === transferId);

    const hasValidProofDocument = Boolean(proofBase64 || resolvedArchiveDoc);

    // AI Verification & Manual Override Settlement Gate Evaluation
    if (verificationStatus) {
      const isMismatchCase =
        aiVerificationDetails?.aiStatus === "MISMATCH" ||
        verificationStatus === "OVERRIDDEN";

      const gateResult = evaluateSettlementGate({
        verificationStatus,
        hasProof: hasValidProofDocument,
        hasValidProofDocument,
        isProofResolved: existing.proofDocumentId ? Boolean(resolvedArchiveDoc) : undefined,
        proofRequired: true,
        overrideReason,
        overrideType,
        originalAiStatus: aiVerificationDetails?.aiStatus,
        userRole: currentUser?.role,
        isMismatch: isMismatchCase,
      });

      if (!gateResult.allowed) {
        return {
          success: false,
          error: language === "ar" ? gateResult.reasonAr : gateResult.reasonEn,
        };
      }
    } else if (!hasValidProofDocument) {
      return {
        success: false,
        error: language === "ar" ? "تم رفض التسوية: إرفاق إثبات الإيداع البنكي أو إيصال السداد إلزامي." : "Settlement denied: Bank deposit proof or receipt document is mandatory.",
      };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    
    try {
      let archiveDocId = existing.proofDocumentId;
      let newArchiveRecord: ElectronicArchiveItem | null = null;
      
      if (archiveDocId) {
        const isDuplicateUsed = ownerTransfers.some(
          (t) => t.id !== transferId && t.proofDocumentId === archiveDocId
        );
        if (isDuplicateUsed) {
          return {
            success: false,
            error:
              language === "ar"
                ? "خطأ رقابي: مستند الإثبات مستخدم مسبقاً في معاملة تحويل أخرى. يرجى إرفاق إثبات مالي خاص بهذه المعاملة حصراً."
                : "Audit Guard Violation: Proof document is already linked to another transfer record.",
          };
        }
      }
      if (proofBase64 && !archiveDocId) {
        const existingArchive = archive.find((a) => a.entityId === transferId || a.recordId === transferId);
        if (existingArchive) {
          archiveDocId = existingArchive.id;
        } else {
          archiveDocId = `arch-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
          newArchiveRecord = {
            id: archiveDocId,
            fileName: proofFileName || `proof-${existing.transferNumber}.pdf`,
            category: "PAYMENTS",
            recordId: existing.id,
            recordTitle: `إثبات إيداع تحويل ${existing.transferNumber}`,
            fileType: proofFileType || "application/pdf",
            fileSize: proofFileSize || 1024,
            fileHash: `hash-${Date.now()}`,
            isPrivate: false,
            storagePath: `archives/owners/${existing.ownerId}/${proofFileName || "proof.pdf"}`,
            uploadedAt: new Date().toISOString(),
            uploadedByUserId: userId,
            uploadedByName: userName,
            previewUrl: proofBase64,
            downloadToken: `tok-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
            tags: ["payment_proof", "daily_deposit", existing.transferNumber],
            entityType: "OWNER_TRANSFER",
            entityId: existing.id,
            createdAt: new Date().toISOString(),
          } as ElectronicArchiveItem;
        }
      }

      await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "owner_transfers", transferId);
        const ownerRef = doc(db, "owners", existing.ownerId);

        const transferSnap = await transaction.get(transferRef);
        const ownerSnap = await transaction.get(ownerRef);

        if (!transferSnap.exists()) throw new Error("Transfer not found.");
        const transferData = transferSnap.data() as OwnerTransferRecord;
        
        if (["PAID", "COMPLETED", "RECONCILED", "CANCELLED", "REVERSED"].includes(transferData.status) || transferData.isReversed) {
          throw new Error("Transfer is already settled or locked.");
        }

        const currentHeld = ownerSnap.data()?.totalHeld || 0;
        const currentPaid = ownerSnap.data()?.totalPaid || 0;

        // Atomic update of counters
        const updateOwnerFields: any = {
           totalPaid: currentPaid + transferData.amount
        };

        // If it was held (status APPROVED), release the hold
        if (transferData.status === "APPROVED") {
            updateOwnerFields.totalHeld = Math.max(0, currentHeld - transferData.amount);
        }

        transaction.update(ownerRef, updateOwnerFields);

        if (newArchiveRecord) {
           const archiveRef = doc(db, "archive", newArchiveRecord.id);
           transaction.set(archiveRef, sanitizeForFirestore(newArchiveRecord));
        }
        
        const finalVerificationStatus = verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED");
        const finalVerificationMethod = verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE");

        transaction.update(transferRef, sanitizeForFirestore({
           status: "PAID",
           paidByUserId: userId,
           paidByUserName: userName,
           approvedByUserId: transferData.approvedByUserId || userId,
           approvedByUserName: transferData.approvedByUserName || userName,
           proofDocumentId: archiveDocId,
           transactionReferenceNumber: transactionReferenceNumber || transferData.transactionReferenceNumber,
           notes: notes ? (transferData.notes ? `${transferData.notes} | ${notes}` : notes) : transferData.notes,
           updatedAt: new Date().toISOString(),
           settledAt: new Date().toISOString(),
           settledByUserId: userId,
           settledByName: userName,
           verificationStatus: finalVerificationStatus,
           verificationMethod: finalVerificationMethod,
           overrideReason: overrideReason || null,
           overrideType: overrideType || null,
           verifiedByUserId: userId,
           verifiedByName: userName,
           verifiedAt: new Date().toISOString(),
           aiVerificationDetails: aiVerificationDetails || null,
        }));
      });

      // Update local state
      const updatedTransfer: OwnerTransferRecord = {
          ...existing,
          status: "PAID" as OwnerTransferStatus,
          paidByUserId: userId,
          paidByUserName: userName,
          approvedByUserId: existing.approvedByUserId || userId,
          approvedByUserName: existing.approvedByUserName || userName,
          proofDocumentId: archiveDocId,
          transactionReferenceNumber: transactionReferenceNumber || existing.transactionReferenceNumber,
          notes: notes ? (existing.notes ? `${existing.notes} | ${notes}` : notes) : existing.notes,
          updatedAt: new Date().toISOString(),
          settledAt: new Date().toISOString(),
          settledByUserId: userId,
          settledByName: userName,
          verificationStatus: verificationStatus || (archiveDocId ? "MANUALLY_VERIFIED" : "UNVERIFIED"),
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          overrideReason: overrideReason,
          overrideType: overrideType,
          verifiedByUserId: userId,
          verifiedByName: userName,
          verifiedAt: new Date().toISOString(),
          aiVerificationDetails: aiVerificationDetails,
      };

      setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updatedTransfer : t)));
      if (newArchiveRecord) {
         setArchive(prev => [newArchiveRecord!, ...prev]);
      }
      setOwners(prev => prev.map(o => o.id === existing.ownerId ? {
          ...o,
          totalHeld: Math.max(0, (o.totalHeld || 0) - existing.amount),
          totalPaid: (o.totalPaid || 0) + existing.amount
      } : o));

      // AI Verification & Manual Override Audit Log
      if (verificationStatus) {
        const auditRec = buildVerificationAuditRecord({
          transactionId: existing.id,
          entityType: "OWNER_TRANSFER",
          entityName: `تحويل مالك #${existing.transferNumber} بمبلغ ${existing.amount.toLocaleString()} AED`,
          proofDocumentId: archiveDocId,
          proofFileName: proofFileName,
          verificationMethod: verificationMethod || (verificationStatus === "AI_VERIFIED" ? "AI_AUTOMATED" : "MANUAL_OVERRIDE"),
          previousVerificationStatus: existing.verificationStatus || "UNVERIFIED",
          aiStatus: aiVerificationDetails?.aiStatus || (verificationStatus === "AI_VERIFIED" ? "MATCH" : "FAILED"),
          aiExtractedValues: aiVerificationDetails?.extractedValues || {},
          expectedValues: aiVerificationDetails?.expectedValues || { amount: existing.amount },
          comparisonResults: aiVerificationDetails?.comparisonResults || {},
          overrideReason: overrideReason,
          overrideType: overrideType,
          userId,
          userName,
          userRole: currentUser?.role || "SUPER_ADMIN",
          finalStatus: verificationStatus,
        });

        logAudit(
          auditRec.action,
          auditRec.entityType,
          auditRec.entityId,
          auditRec.entityName,
          auditRec.details,
          auditRec.oldValue,
          auditRec.newValue,
          auditRec.reason
        );
      }

      logAudit(
        "FINANCIAL_POSTING",
        "OWNER_TRANSFER",
        transferId,
        `تحويل #${existing.transferNumber}`,
        `تم إثبات الإيداع والتسوية المالية بنجاح بمبلغ ${existing.amount.toLocaleString()} AED - مرجع: ${updatedTransfer.transactionReferenceNumber || "لا يوجد"}`
      );

      try {
        const journalData = buildOwnerTransferJournal(
          {
            transferId: existing.id,
            transferNumber: existing.transferNumber,
            amount: existing.amount,
            transactionDate: existing.transferDate || new Date().toISOString().split("T")[0],
            ownerId: existing.ownerId,
            bankAccountReference: updatedTransfer.transactionReferenceNumber,
            createdBy: userName,
            notes: notes || existing.notes,
          },
          chartOfAccounts
        );
        postJournalEntry(journalData);
      } catch (jErr) {
        console.warn("Journal posting warning for owner transfer settlement:", jErr);
      }

      return { success: true };
    } catch (err: any) {
      console.error("Settlement transaction failed:", err);
      return { success: false, error: err.message || "فشلت عملية التسوية الموثوقة." };
    }
  };

  const cancelOwnerTransfer = async (
    transferId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const checkPerm = checkFinancialEditPermission("OWNER_TRANSFER", reason || "Cancellation");
    if (!checkPerm.allowed) return { success: false, error: checkPerm.error };

    const existing = ownerTransfers.find((t) => t.id === transferId);
    if (!existing) return { success: false, error: "سجل التحويل غير موجود." };

    if (existing.status === "PAID" || existing.status === "COMPLETED" || existing.status === "RECONCILED") {
      return {
        success: false,
        error: language === "ar"
          ? "لا يمكن إلغاء تحويل تم صرفه وتسويته بنجاح. يرجى استخدام العكس المالي الحسابي."
          : "Cannot cancel a paid/settled transfer. Use financial reversal."
      };
    }

    if (existing.status === "CANCELLED") {
      return { success: true };
    }

    try {
      await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "owner_transfers", transferId);
        const ownerRef = doc(db, "owners", existing.ownerId);

        const transferSnap = await transaction.get(transferRef);
        const ownerSnap = await transaction.get(ownerRef);

        if (!transferSnap.exists()) throw new Error("Transfer not found.");
        const transferData = transferSnap.data() as OwnerTransferRecord;

        if (["PAID", "COMPLETED", "RECONCILED", "CANCELLED", "REVERSED"].includes(transferData.status)) {
           throw new Error("Transfer is locked.");
        }

        const currentHeld = ownerSnap.data()?.totalHeld || 0;
        transaction.update(ownerRef, {
           totalHeld: Math.max(0, currentHeld - transferData.amount)
        });

        transaction.update(transferRef, {
           status: "CANCELLED",
           reversalReason: reason || "إلغاء الحوالة قبل الصرف والتسوية",
           updatedAt: new Date().toISOString(),
        });
      });

      const updated: OwnerTransferRecord = {
        ...existing,
        status: "CANCELLED",
        reversalReason: reason || "إلغاء الحوالة قبل الصرف والتسوية",
        updatedAt: new Date().toISOString(),
      };

      setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updated : t)));
      setOwners(prev => prev.map(o => o.id === existing.ownerId ? {
          ...o,
          totalHeld: Math.max(0, (o.totalHeld || 0) - existing.amount)
      } : o));

      logAudit(
        "CANCEL",
        "OWNER_TRANSFER",
        transferId,
        `تحويل #${existing.transferNumber}`,
        `تم إلغاء أمر تحويل المالك وإطلاق المبلغ المحجوز. السبب: ${reason || "بدون سبب مدخل"}`
      );

      return { success: true };
    } catch (err: any) {
       console.error("Cancel transaction failed:", err);
       return { success: false, error: err.message || "فشل الإلغاء." };
    }
  };

  const updateOwnerTransferStatus = async (
    transferId: string,
    newStatus: OwnerTransferStatus,
    notes?: string,
    modificationReason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (newStatus === "PAID" || newStatus === "COMPLETED") {
      return await settleOwnerTransfer({ transferId, notes, transactionReferenceNumber: notes });
    }
    if (newStatus === "CANCELLED") {
      return await cancelOwnerTransfer(transferId, notes);
    }
    if (newStatus === "REVERSED") {
      return reverseOwnerTransfer(transferId, notes || "عكس تحويل مالي");
    }

    const existing = ownerTransfers.find((t) => t.id === transferId);
    if (!existing) return { success: false, error: "سجل التحويل غير موجود." };

    const check = checkFinancialEditPermission("OWNER_TRANSFER", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("OWNER_TRANSFER", existing, "VERSION");

    const approvedUserId = currentUser?.id || "sys";
    const approvedUserName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    const updated: OwnerTransferRecord = {
      ...existing,
      status: newStatus,
      approvedByUserId: newStatus === "APPROVED" ? approvedUserId : existing.approvedByUserId,
      approvedByUserName: newStatus === "APPROVED" ? approvedUserName : existing.approvedByUserName,
      notes: notes ? (existing.notes ? `${existing.notes} | ${notes}` : notes) : existing.notes,
      updatedAt: new Date().toISOString(),
    };

    setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updated : t)));
    safeSetDoc(doc(db, "owner_transfers", transferId), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "OWNER_TRANSFER",
      transferId,
      `تحويل #${existing.transferNumber}`,
      `تحديث حالة تحويل المالك إلى ${newStatus}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );

    return { success: true };
  };

  const reverseOwnerTransfer = async (
    transferId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = ownerTransfers.find((t) => t.id === transferId);
    if (!existing) return { success: false, error: "سجل التحويل غير موجود." };

    if (existing.isReversed || existing.status === "REVERSED") {
      return { success: false, error: "تم عكس هذا التحويل مسبقاً." };
    }

    const checkPerm = checkFinancialEditPermission("OWNER_TRANSFER", reason);
    if (!checkPerm.allowed) return { success: false, error: checkPerm.error };

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    const reversalRecord: FinancialReversalRecord = {
      id: `rev-trf-${Date.now()}`,
      reversalNumber: `REV-TRF-${Date.now().toString().slice(-6)}`,
      targetType: "PAYMENT_ALLOCATION",
      targetId: transferId,
      originalAmount: existing.amount,
      reversedAmount: existing.amount,
      reason,
      reversalDate: new Date().toISOString().slice(0, 10),
      reversalTimestamp: new Date().toISOString(),
      performedByUserId: userId,
      performedByUserName: userName,
      createdAt: new Date().toISOString(),
    };

    try {
      await runTransaction(db, async (transaction) => {
        const transferRef = doc(db, "owner_transfers", transferId);
        const ownerRef = doc(db, "owners", existing.ownerId);

        const transferSnap = await transaction.get(transferRef);
        const ownerSnap = await transaction.get(ownerRef);

        if (!transferSnap.exists()) throw new Error("Transfer not found.");
        const transferData = transferSnap.data() as OwnerTransferRecord;

        if (transferData.isReversed || transferData.status === "REVERSED") {
           throw new Error("Transfer is already reversed.");
        }

        const currentPaid = ownerSnap.data()?.totalPaid || 0;
        transaction.update(ownerRef, {
           totalPaid: Math.max(0, currentPaid - transferData.amount)
        });

        const revRef = doc(db, "financial_reversals", reversalRecord.id);
        transaction.set(revRef, sanitizeForFirestore(reversalRecord));

        transaction.update(transferRef, sanitizeForFirestore({
           isReversed: true,
           reversalRecordId: reversalRecord.id,
           reversalReason: reason,
           reversalTimestamp: reversalRecord.reversalTimestamp,
           updatedAt: new Date().toISOString(),
        }));
      });

      const updatedTransfer: OwnerTransferRecord = {
        ...existing,
        isReversed: true,
        reversalRecordId: reversalRecord.id,
        reversalReason: reason,
        reversalTimestamp: reversalRecord.reversalTimestamp,
        updatedAt: new Date().toISOString(),
      };

      setFinancialReversals((prev) => [reversalRecord, ...prev]);
      setOwnerTransfers((prev) => prev.map((t) => (t.id === transferId ? updatedTransfer : t)));
      setOwners(prev => prev.map(o => o.id === existing.ownerId ? {
          ...o,
          totalPaid: Math.max(0, (o.totalPaid || 0) - existing.amount)
      } : o));

      logAudit(
        "FINANCIAL_REVERSAL",
        "OWNER_TRANSFER",
        transferId,
        `تحويل #${existing.transferNumber}`,
        `تم عكس تحويل المالك بمبلغ ${existing.amount.toLocaleString()} AED وإنشاء قيد عكس مالي. السبب: ${reason}`
      );

      try {
        const journalData = buildOwnerTransferReversalJournal(
          {
            transferId: existing.id,
            transferNumber: existing.transferNumber,
            amount: existing.amount,
            transactionDate: new Date().toISOString().split("T")[0],
            ownerId: existing.ownerId,
            createdBy: currentUser?.nameAr || "مدير النظام",
            notes: reason,
          },
          chartOfAccounts
        );
        postJournalEntry(journalData);
      } catch (jErr) {
        console.warn("Journal posting warning for transfer reversal:", jErr);
      }

      return { success: true };
    } catch (err: any) {
       console.error("Reversal transaction failed:", err);
       return { success: false, error: err.message || "فشل عكس المعاملة ماليًا." };
    }
  };

  const addPropertyExpense = (
    data: Omit<PropertyExpenseRecord, "id" | "expenseNumber" | "totalAmount" | "createdAt" | "createdById" | "createdByName"> & {
      createdById?: string;
      createdByName?: string;
    }
  ): { success: boolean; expense?: PropertyExpenseRecord; error?: string } => {
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(data.expenseDate, financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const expenseNumber = generateSequentialNumber(propertyExpenses, "expenseNumber", "EXP-", 4, false);
    const id = `exp-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const createdAt = new Date().toISOString();
    const createdById = data.createdById || currentUser?.id || "sys";
    const createdByName = data.createdByName || currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    const vat = data.vatAmount || 0;
    const totalAmount = data.amount + vat;

    const newExpense: PropertyExpenseRecord = {
      ...data,
      id,
      expenseNumber,
      vatAmount: vat,
      totalAmount,
      status: data.status || "PAID",
      createdAt,
      createdById,
      createdByName,
    };

    setPropertyExpenses((prev) => [newExpense, ...prev]);
    safeSetDoc(doc(db, "property_expenses", id), newExpense);

    // If linked to a legal case, automatically attach to the case and recalculate
    if (data.legalCaseId) {
      const targetCase = cases.find(c => c.id === data.legalCaseId);
      if (targetCase) {
        const newLinkedIds = Array.from(new Set([...(targetCase.linkedExpenseIds || []), id]));
        const updatedCase = recalculateCaseFinancials(
          { ...targetCase, linkedExpenseIds: newLinkedIds },
          cheques,
          [newExpense, ...propertyExpenses]
        );
        setCases(prev => prev.map(c => c.id === data.legalCaseId ? updatedCase : c));
        safeSetDoc(doc(db, "cases", data.legalCaseId), updatedCase, { merge: true });
        logAudit("LINK_EXPENSE", "CASE", targetCase.id, targetCase.caseNumber, `تم ربط المصروف القضائي #${expenseNumber} تلقائياً بالقضية بمبلغ ${totalAmount.toLocaleString()} AED.`);
      }
    }

    logAudit(
      "CREATE",
      "PROPERTY_EXPENSE",
      id,
      `مصروف #${expenseNumber}`,
      `تم تسجيل مصروف جديد بمبلغ ${totalAmount.toLocaleString()} AED (${data.category}) - يتحمله: ${data.costBearer}`
    );

    try {
      const journalData = buildPropertyExpenseJournal(
        {
          expenseId: id,
          expenseNumber,
          totalAmount,
          costBearer: data.costBearer,
          category: data.category,
          transactionDate: data.expenseDate || createdAt,
          paymentMethod: data.paymentMethod,
          ownerId: data.ownerId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          notes: data.notes || data.description,
          createdBy: createdByName,
        },
        chartOfAccounts
      );
      postJournalEntry(journalData);
    } catch (jErr) {
      console.warn("Journal posting warning for expense:", jErr);
    }

    return { success: true, expense: newExpense };
  };

  const settlePropertyExpense = async (params: {
    expenseId: string;
    proofBase64?: string;
    proofFileName?: string;
    proofFileType?: string;
    proofFileSize?: number;
    transactionReferenceNumber?: string;
    notes?: string;
    idempotencyKey?: string;
    verificationStatus?: FinancialVerificationStatus;
    verificationMethod?: VerificationMethod;
    overrideReason?: string;
    overrideType?: VerificationOverrideType;
    aiVerificationDetails?: any;
    paymentMethod?: PaymentMethod;
  }): Promise<{ success: boolean; error?: string }> => {
    const {
      expenseId,
      proofBase64,
      proofFileName,
      proofFileType,
      proofFileSize,
      transactionReferenceNumber,
      notes,
      idempotencyKey,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      paymentMethod = "BANK_TRANSFER",
    } = params;

    const check = checkFinancialEditPermission("PROPERTY_EXPENSE", "Settlement");
    if (!check.allowed) return { success: false, error: check.error };

    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const existing = propertyExpenses.find((e) => e.id === expenseId);
    if (!existing) return { success: false, error: language === "ar" ? "سجل المصروف غير موجود." : "Property expense record not found." };

    if (existing.status === "PAID") {
      return { success: true };
    }

    let archiveDocId: string | undefined = existing.proofDocumentId;
    if (proofBase64) {
      try {
        const docRes = await DocumentStorageService.uploadAndArchive(proofBase64, {
          category: "PAYMENTS",
          entityType: "PROPERTY_EXPENSE",
          entityId: existing.id,
          fileName: proofFileName || "deposit_proof.pdf",
          mimeType: proofFileType || "application/pdf",
          description: `تسوية مصروف: ${existing.expenseNumber}`,
          tags: ["EXPENSE_PROOF", existing.category, verificationStatus || ""],
          uploadedByUserId: currentUser?.id || "admin",
          uploadedByName: currentUser?.nameEn || "Admin",
        });
        if (docRes && docRes.id) {
          archiveDocId = docRes.id;
        }
      } catch (err: any) {
        console.error("Failed to archive expense proof:", err);
        return { success: false, error: language === "ar" ? "فشل أرشفة إثبات الدفع. لم يتم إكمال التسوية." : "Failed to archive payment proof. Settlement aborted." };
      }
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    
    saveEntitySnapshot("PROPERTY_EXPENSE", existing, "VERSION");

    const updated: PropertyExpenseRecord = {
      ...existing,
      status: "PAID",
      paymentMethod,
      transactionReference: transactionReferenceNumber || existing.transactionReference,
      proofDocumentId: archiveDocId || existing.proofDocumentId,
      verificationStatus,
      verificationMethod,
      overrideReason,
      overrideType,
      aiVerificationDetails,
      verifiedByName: userName,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPropertyExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
    safeSetDoc(doc(db, "property_expenses", expenseId), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "PROPERTY_EXPENSE",
      expenseId,
      `مصروف #${existing.expenseNumber}`,
      `تم تسوية المصروف واعتماده.${notes ? ` ملاحظات: ${notes}` : ""}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      "Settlement & Verification"
    );

    return { success: true };
  };
  const updatePropertyExpense = (
    id: string,
    patch: Partial<PropertyExpenseRecord>,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const existing = propertyExpenses.find((e) => e.id === id);
    if (!existing) return { success: false, error: "سجل المصروف غير موجود." };
    if (existing.status === "REVERSED") return { success: false, error: "لا يمكن تعديل مصروف معكوس ماليًا." };
    
    // Check if critical financial values are being changed
    const hasFinancialChanges = 
      (patch.amount !== undefined && patch.amount !== existing.amount) ||
      (patch.vatAmount !== undefined && patch.vatAmount !== existing.vatAmount) ||
      (patch.totalAmount !== undefined && patch.totalAmount !== existing.totalAmount) ||
      (patch.expenseDate !== undefined && patch.expenseDate !== existing.expenseDate) ||
      (patch.category !== undefined && patch.category !== existing.category) ||
      (patch.propertyId !== undefined && patch.propertyId !== existing.propertyId) ||
      (patch.unitId !== undefined && patch.unitId !== existing.unitId);

    if (hasFinancialChanges) {
      return {
        success: false,
        error: language === "ar"
          ? "القيم المالية الأساسية للمصروفات غير قابلة للتعديل مباشرة. يرجى عكس المصروف وإنشاء حركة جديدة."
          : "Core financial properties of registered expenses are immutable. Please reverse this record and submit a new one."
      };
    }

    if (existing.sourceType === "MAINTENANCE_REQUEST" || existing.sourceType === "LEGAL_CASE" || existing.sourceType === "LEASE_RENEWAL") {
      return {
        success: false,
        error: language === "ar"
          ? "هذا المصروف مرتبط بنظام خارجي (صيانة/قضايا/عقود) ولا يمكن تعديله من هنا. يرجى إدارته من المصدر لضمان سلامة البيانات."
          : "This expense is linked to an external system (Maintenance/Legal/Leases) and cannot be edited here. Please manage it from the original screen."
      };
    }

    const check = checkFinancialEditPermission("PROPERTY_EXPENSE", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("PROPERTY_EXPENSE", existing, "VERSION");

    const vat = patch.vatAmount !== undefined ? patch.vatAmount : (existing.vatAmount || 0);
    const amount = patch.amount !== undefined ? patch.amount : existing.amount;
    const totalAmount = amount + vat;

    const updated: PropertyExpenseRecord = {
      ...existing,
      ...patch,
      vatAmount: vat,
      amount,
      totalAmount,
      updatedAt: new Date().toISOString(),
    };

    setPropertyExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    safeSetDoc(doc(db, "property_expenses", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "PROPERTY_EXPENSE",
      id,
      `مصروف #${existing.expenseNumber}`,
      `تم تحديث بيانات المصروف. المبلغ الجديد: ${totalAmount.toLocaleString()} AED`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );

    return { success: true };
  };

  const reversePropertyExpense = (
    expenseId: string,
    reason: string
  ): { success: boolean; error?: string } => {
    const existing = propertyExpenses.find((e) => e.id === expenseId);
    if (!existing) return { success: false, error: "سجل المصروف غير موجود." };
    if (existing.status === "REVERSED") return { success: false, error: "تم عكس هذا المصروف مسبقاً." };

    if (existing.sourceType === "MAINTENANCE_REQUEST" || existing.sourceType === "LEGAL_CASE" || existing.sourceType === "LEASE_RENEWAL") {
      return {
        success: false,
        error: language === "ar"
          ? "هذا المصروف مرتبط بنظام خارجي (صيانة أو قضايا أو عقود) ولا يمكن عكسه من هنا. يرجى إدارته من الشاشة الأصلية لضمان سلامة البيانات."
          : "This expense is linked to an external system (Maintenance, Legal, or Leases) and cannot be reversed here. Please manage it from the original screen to ensure data integrity."
      };
    }

    const checkPerm = checkFinancialEditPermission("PROPERTY_EXPENSE", reason);
    if (!checkPerm.allowed) return { success: false, error: checkPerm.error };

    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(new Date().toISOString(), financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    const userId = currentUser?.id || "sys";
    const userName = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    const reversalRecord: FinancialReversalRecord = {
      id: `rev-exp-${Date.now()}`,
      reversalNumber: `REV-EXP-${Date.now().toString().slice(-6)}`,
      targetType: "PAYMENT_ALLOCATION",
      targetId: expenseId,
      originalAmount: existing.totalAmount,
      reversedAmount: existing.totalAmount,
      reason,
      reversalDate: new Date().toISOString().slice(0, 10),
      reversalTimestamp: new Date().toISOString(),
      performedByUserId: userId,
      performedByUserName: userName,
      createdAt: new Date().toISOString(),
    };

    setFinancialReversals((prev) => [reversalRecord, ...prev]);
    safeSetDoc(doc(db, "financial_reversals", reversalRecord.id), reversalRecord);

    const updatedExpense: PropertyExpenseRecord = {
      ...existing,
      status: "REVERSED",
    };

    setPropertyExpenses((prev) => prev.map((e) => (e.id === expenseId ? updatedExpense : e)));
    safeSetDoc(doc(db, "property_expenses", expenseId), updatedExpense, { merge: true });

    // Cascade reverse any other expenses generated from the same maintenance invoice
    if ((existing.sourceType as any) === "MAINTENANCE_REQUEST" && existing.maintenanceInvoiceId) {
      const relatedExpenses = propertyExpenses.filter(
        (e) =>
          e.id !== expenseId &&
          (e.sourceType as any) === "MAINTENANCE_REQUEST" &&
          e.maintenanceInvoiceId === existing.maintenanceInvoiceId &&
          e.status !== "REVERSED"
      );

      relatedExpenses.forEach((rel) => {
        const relReversal: FinancialReversalRecord = {
          id: `rev-exp-${Date.now()}-${crypto.randomUUID().split("-")[0]}`,
          reversalNumber: `REV-EXP-${Date.now().toString().slice(-6)}`,
          targetType: "PAYMENT_ALLOCATION",
          targetId: rel.id,
          originalAmount: rel.totalAmount,
          reversedAmount: rel.totalAmount,
          reason: `تراجع تابع بسبب إلغاء المصروف الرئيسي: ${reason}`,
          reversalDate: new Date().toISOString().slice(0, 10),
          reversalTimestamp: new Date().toISOString(),
          performedByUserId: userId,
          performedByUserName: userName,
          createdAt: new Date().toISOString(),
        };
        setFinancialReversals((prev) => [relReversal, ...prev]);
        safeSetDoc(doc(db, "financial_reversals", relReversal.id), relReversal);

        const updatedRel: PropertyExpenseRecord = {
          ...rel,
          status: "REVERSED",
        };
        setPropertyExpenses((prev) => prev.map((e) => (e.id === rel.id ? updatedRel : e)));
        safeSetDoc(doc(db, "property_expenses", rel.id), updatedRel, { merge: true });
      });
    }

    logAudit(
      "FINANCIAL_REVERSAL",
      "PROPERTY_EXPENSE",
      expenseId,
      `مصروف #${existing.expenseNumber}`,
      `تم عكس وإلغاء المصروف بمبلغ ${existing.totalAmount.toLocaleString()} AED. السبب: ${reason}`
    );

    return { success: true };
  };

  /**
   * Permanently deletes a property expense record from Firestore and local state.
   * This is used for cascading deletions from source modules (Legal, Maintenance, etc.)
   */
  const deletePropertyExpense = async (expenseId: string): Promise<{ success: boolean; error?: string }> => {
    return {
      success: false,
      error: language === "ar"
        ? "المصروفات المالية المسجلة محمية تماماً ضد الحذف بموجب الحوكمة المالية الصارمة. يرجى عكس المصروف بدلاً من ذلك."
        : "Registered property expenses are fully protected against deletion under strict financial governance. Please perform a reversal instead."
    };
  };

  const addAccountDefinition = (
    data: Omit<AccountDefinition, "id" | "createdAt">
  ): { success: boolean; account?: AccountDefinition; error?: string } => {
    if (chartOfAccounts.some((a) => a.accountCode === data.accountCode.trim())) {
      return { success: false, error: `رمز الحساب (${data.accountCode}) مسجل بالفعل.` };
    }

    const id = `acc-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const newAccount: AccountDefinition = {
      ...data,
      id,
      accountCode: data.accountCode.trim(),
      createdAt: new Date().toISOString(),
    };

    setChartOfAccounts((prev) => [...prev, newAccount]);
    safeSetDoc(doc(db, "chart_of_accounts", id), newAccount);

    logAudit(
      "CREATE",
      "RISK_CONFIG",
      id,
      `دليل الحسابات - ${newAccount.accountCode}`,
      `تمت إضافة حساب جديد (${newAccount.accountCode} - ${newAccount.accountNameAr}) إلى دليل الحسابات`
    );

    return { success: true, account: newAccount };
  };

  const updateAccountDefinition = (id: string, patch: Partial<AccountDefinition>, modificationReason?: string): { success: boolean; error?: string } => {
    const existing = chartOfAccounts.find((a) => a.id === id);
    if (!existing) return { success: false, error: "Account not found" };

    const check = checkFinancialEditPermission("CHART_OF_ACCOUNTS", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("CHART_OF_ACCOUNTS", existing, "VERSION");

    const updated = { ...existing, ...patch };
    setChartOfAccounts((prev) => prev.map((acc) => (acc.id === id ? updated : acc)));
    safeSetDoc(doc(db, "chart_of_accounts", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "CHART_OF_ACCOUNTS",
      id,
      `حساب #${existing.accountCode}`,
      `تم تحديث بيانات الحساب في دليل الحسابات`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      modificationReason
    );
    return { success: true };
  };

  const addFinancialPeriod = (data: Omit<FinancialPeriod, "id" | "openedAt" | "openedBy" | "status">): { success: boolean; period?: FinancialPeriod; error?: string } => {
    const checkOverlap = canCreateFinancialPeriod(data, financialPeriods);
    if (!checkOverlap.allowed) {
      return { success: false, error: language === "ar" ? checkOverlap.error : checkOverlap.error };
    }

    const id = `fp-${Date.now()}`;
    const period: FinancialPeriod = {
      ...data,
      id,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      openedBy: currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || "System",
    };

    setFinancialPeriods((prev) => [...prev, period]);
    safeSetDoc(doc(db, "financial_periods", id), period);

    logAudit(
      "FINANCIAL_PERIOD_CREATED",
      "FINANCIAL_PERIOD",
      id,
      period.name,
      `تم إنشاء فترة مالية جديدة: ${period.name} (${period.startDate} إلى ${period.endDate})`
    );

    return { success: true, period };
  };

  const closeFinancialPeriod = (id: string, reason?: string): { success: boolean; error?: string } => {
    const existing = financialPeriods.find((p) => p.id === id);
    if (!existing) return { success: false, error: "Financial period not found" };

    if (existing.status === "CLOSED") {
      return { success: false, error: language === "ar" ? "الفترة مغلقة بالفعل" : "Period is already closed" };
    }

    const check = validateFinancialPeriodClosing(existing, {
      journalEntries,
      collections,
      ownerTransfers,
    });

    if (!check.canClose) {
      logAudit(
        "PERIOD_CLOSE_REJECTED",
        "FINANCIAL_PERIOD",
        id,
        existing.name,
        `فشل إغلاق الفترة المالية: ${check.errors.join(", ")}`,
        undefined,
        undefined,
        reason
      );
      return {
        success: false,
        error: language === "ar" 
          ? `لا يمكن إغلاق الفترة المالية لوجود استثناءات: ${check.errors.join(". ")}`
          : `Cannot close financial period due to exceptions: ${check.errors.join(". ")}`
      };
    }

    const updated: FinancialPeriod = {
      ...existing,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || "System",
      auditMetadata: {
        ...existing.auditMetadata,
        reason,
      }
    };

    setFinancialPeriods((prev) => prev.map((p) => (p.id === id ? updated : p)));
    safeSetDoc(doc(db, "financial_periods", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_PERIOD_CLOSED",
      "FINANCIAL_PERIOD",
      id,
      existing.name,
      `تم إغلاق الفترة المالية بنجاح: ${existing.name}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      reason
    );

    return { success: true };
  };

  const reopenFinancialPeriod = (id: string, reason: string): { success: boolean; error?: string } => {
    const existing = financialPeriods.find((p) => p.id === id);
    if (!existing) return { success: false, error: "Financial period not found" };

    if (existing.status === "OPEN") {
      return { success: false, error: language === "ar" ? "الفترة مفتوحة بالفعل" : "Period is already open" };
    }

    // Require explicit reason for reopening
    if (!reason || reason.trim().length < 10) {
      return { 
        success: false, 
        error: language === "ar" 
          ? "يجب تقديم سبب مبرر لإعادة فتح الفترة المالية (10 أحرف على الأقل)" 
          : "A valid reason is required to reopen a financial period (min 10 chars)" 
      };
    }

    const updated: FinancialPeriod = {
      ...existing,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      openedBy: currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || "System",
      auditMetadata: {
        ...existing.auditMetadata,
        reason,
      }
    };

    setFinancialPeriods((prev) => prev.map((p) => (p.id === id ? updated : p)));
    safeSetDoc(doc(db, "financial_periods", id), updated, { merge: true });

    logAudit(
      "FINANCIAL_PERIOD_REOPENED",
      "FINANCIAL_PERIOD",
      id,
      existing.name,
      `تم إعادة فتح الفترة المالية: ${existing.name}`,
      JSON.stringify(existing),
      JSON.stringify(updated),
      reason
    );

    return { success: true };
  };

  const deleteFinancialPeriod = (id: string): { success: boolean; error?: string } => {
    const existing = financialPeriods.find((p) => p.id === id);
    if (!existing) return { success: false, error: "Financial period not found" };

    if (existing.status === "CLOSED") {
      return { success: false, error: language === "ar" ? "لا يمكن حذف فترة مالية مغلقة" : "Cannot delete a closed financial period" };
    }

    setFinancialPeriods((prev) => prev.filter((p) => p.id !== id));
    safeDeleteDoc(doc(db, "financial_periods", id));

    logAudit(
      "DELETE",
      "FINANCIAL_PERIOD",
      id,
      existing.name,
      `تم حذف الفترة المالية: ${existing.name}`
    );

    return { success: true };
  };

  const runPeriodReconciliation = (
    periodId: string
  ): { success: boolean; report?: PeriodReconciliationReport; error?: string } => {
    const period = financialPeriods.find((p) => p.id === periodId);
    if (!period) return { success: false, error: "Financial period not found" };

    const activeUser = {
      id: currentUser?.id || "sys-user",
      name: currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || "System Auditor",
    };

    logAudit(
      "FINANCIAL_RECONCILIATION_STARTED",
      "FINANCIAL_PERIOD",
      period.id,
      period.name,
      `بدء عملية المطابقة والتحقق المالي للفترة: ${period.name} (${period.startDate} إلى ${period.endDate})`
    );

    try {
      const report = reconcileFinancialPeriod({
        period,
        journalEntries,
        collections,
        expenses: propertyExpenses,

        dailyDeposits,
        ownerTransfers,
        paymentAllocations,
        cheques,
        commissions,
        rentalCases: cases,
        reversals: financialReversals,
        adjustments: financialAdjustments,
        owners,
        leases,
        user: activeUser,
      });

      if (report.overallStatus === "NOT_RECONCILED") {
        logAudit(
          "FINANCIAL_RECONCILIATION_FAILED",
          "FINANCIAL_PERIOD",
          period.id,
          period.name,
          `فشل المطابقة المالية للفترة ${period.name}: يوجد ${report.totalExceptions} استثناء مالي حرج.`
        );
      } else {
        logAudit(
          "FINANCIAL_RECONCILIATION_COMPLETED",
          "FINANCIAL_PERIOD",
          period.id,
          period.name,
          `اكتملت المطابقة المالية للفترة ${period.name}: الحالة (${report.overallStatus}) مع ${report.totalWarnings} تنبيه.`
        );
      }

      return { success: true, report };
    } catch (err: any) {
      logAudit(
        "FINANCIAL_RECONCILIATION_EXCEPTION",
        "FINANCIAL_PERIOD",
        period.id,
        period.name,
        `خطأ غير متوقع أثناء مطابقة الفترة: ${err.message || String(err)}`
      );
      return { success: false, error: err.message || "Failed to reconcile financial period" };
    }
  };

  const generatePeriodCertification = async (
    periodId: string,
    notes?: string
  ): Promise<{ success: boolean; certification?: ForensicClosingCertification; error?: string }> => {
    const period = financialPeriods.find((p) => p.id === periodId);
    if (!period) return { success: false, error: "Financial period not found" };

    const activeUser = {
      id: currentUser?.id || "sys-user",
      name: currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || "Financial Controller",
    };

    const reportResult = runPeriodReconciliation(periodId);
    if (!reportResult.success || !reportResult.report) {
      return { success: false, error: reportResult.error || "Reconciliation failed" };
    }

    const report = reportResult.report;
    if (report.overallStatus === "NOT_RECONCILED" || !report.canCertify) {
      return {
        success: false,
        error: language === "ar"
          ? `لا يمكن إصدار شهادة إغلاق مالي: توجد استثناءات مالية حرجة لم تُعالج (${report.totalExceptions} استثناء).`
          : `Cannot issue closing certificate: Critical reconciliation exceptions remain unresolved (${report.totalExceptions} exceptions).`
      };
    }

    try {
      const certification = createForensicClosingCertification(report, notes);

      setPeriodCertifications((prev) => [certification, ...prev]);
      safeSetDoc(doc(db, "period_certifications", certification.id), certification);

      logAudit(
        "FINANCIAL_CLOSING_CERTIFIED",
        "PERIOD_CERTIFICATION",
        certification.id,
        certification.certificateNumber,
        `تم إصدار شهادة الإغلاق المالي والتدقيق الجنائي رقم ${certification.certificateNumber} للفترة ${period.name} بنجاح. البصمة: ${certification.snapshotHash}`,
        undefined,
        JSON.stringify(certification),
        notes
      );

      return { success: true, certification };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to generate forensic closing certification" };
    }
  };

  const postJournalEntry = (
    entryData: Omit<JournalEntryRecord, "id" | "entryNumber" | "createdAt" | "status">
  ): { success: boolean; entry?: JournalEntryRecord; error?: string } => {
    // Financial Period Validation
    const periodCheck = validateTransactionPeriod(entryData.transactionDate, financialPeriods);
    if (!periodCheck.allowed) {
      return { success: false, error: language === "ar" ? periodCheck.errorAr : periodCheck.errorEn };
    }

    if (entryData.sourceType && entryData.sourceId) {
      const existing = journalEntries.find(
        (je) => je.sourceType === entryData.sourceType && je.sourceId === entryData.sourceId && je.status === "POSTED"
      );
      if (existing) {
        return { success: true, entry: existing };
      }
    }

    const val = validateJournalEntry(entryData);
    if (!val.isValid) {
      return { success: false, error: val.error || "خطأ في توازن القيد المحاسبي" };
    }

    const count = journalEntries.length + 1;
    const year = new Date().getFullYear();
    const entryNumber = `JE-${year}-${String(count).padStart(5, "0")}`;
    const id = `je-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;

    const newEntry: JournalEntryRecord = {
      ...entryData,
      id,
      entryNumber,
      status: "POSTED",
      totalDebit: val.totalDebit,
      totalCredit: val.totalCredit,
      createdAt: new Date().toISOString(),
    };

    setJournalEntries((prev) => [...prev, newEntry]);
    safeSetDoc(doc(db, "journal_entries", id), newEntry);

    logAudit(
      "CREATE",
      "ADJUSTMENT",
      id,
      `قيد محاسبي #${entryNumber}`,
      `تم ترحيل قيد محاسبي جديد رقم (${entryNumber}) بقيمة (${val.totalDebit.toFixed(2)} د.إ) - ${entryData.description}`
    );

    return { success: true, entry: newEntry };
  };

  const reverseJournalEntry = (
    id: string,
    reason: string
  ): { success: boolean; reversalEntry?: JournalEntryRecord; error?: string } => {
    const original = journalEntries.find((je) => je.id === id);
    if (!original) {
      return { success: false, error: "القيد المحاسبي غير موجود." };
    }

    if (original.status === "REVERSED") {
      return { success: false, error: "القيد المحاسبي معكوس بالفعل مسبقاً." };
    }

    const userName = currentUser?.nameAr || currentUser?.nameEn || "المحاسب المسؤول";
    const reversalData = buildReversalJournalEntry(original, reason, userName);
    const result = postJournalEntry(reversalData);

    if (!result.success || !result.entry) {
      return { success: false, error: result.error || "فشل في ترحيل قيد العكس." };
    }

    const updatedOriginal: JournalEntryRecord = {
      ...original,
      status: "REVERSED",
      reversalEntryId: result.entry.id,
    };

    setJournalEntries((prev) => prev.map((je) => (je.id === id ? updatedOriginal : je)));
    safeSetDoc(doc(db, "journal_entries", id), updatedOriginal, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "ADJUSTMENT",
      id,
      `عكس قيد #${original.entryNumber}`,
      `تم عكس القيد المحاسبي رقم (${original.entryNumber}) بقيد العكس رقم (${result.entry.entryNumber}) - السبب: ${reason}`
    );

    return { success: true, reversalEntry: result.entry };
  };

  const updateJournalEntry = (
    _id: string,
    _patch: Partial<JournalEntryRecord>
  ): { success: boolean; error?: string } => {
    return {
      success: false,
      error: "القيود المحاسبية المرحلة محمية بموجب قواعد الحوكمة المالية ولا يمكن تعديلها مباشرة. يرجى استخدام قيد العكس أو التسوية.",
    };
  };

  const deleteJournalEntry = (_id: string): { success: boolean; error?: string } => {
    return {
      success: false,
      error: "القيود المحاسبية المرحلة محمية من الحذف النهائي لضمان نزاهة السجل المالي. يرجى استخدام قيد العكس المحاسبي.",
    };
  };

  // -------------------------------------------------------------
  // Cases & Hearings
  // -------------------------------------------------------------

  const addCase = (caseData: Omit<RentalCase, "id" | "createdAt" | "updatedAt">) => {
    const newCase: RentalCase = {
      ...caseData,
      id: "cas-" + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCases((prev) => [newCase, ...prev]);
    safeSetDoc(doc(db, "cases", newCase.id), newCase);
    logAudit("CREATE", "CASE", newCase.id, newCase.caseNumber, `Manual case creation`);
    
    // Notify
    const tnt = tenants.find(t => t.id === newCase.tenantId);
    if (tnt) {
      const notifItem: NotificationRecord = {
        id: "notif-" + Date.now(),
        channel: "WHATSAPP",
        recipient: tnt.phone,
        recipientName: tnt.nameEn,
        tenantId: tnt.id,
        type: "LEGAL_NOTICE",
        status: "SENT",
        sentAt: new Date().toISOString(),
        content: `Legal action has been initiated. Case Reference: ${newCase.caseNumber}`,
        attemptCount: 1,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notifItem, ...prev]);
      safeSetDoc(doc(db, "notifications", notifItem.id), notifItem);
    }
  };

  const convertChequesToCase = (params: {
    chequeIds: string[];
    courtName: string;
    responsibleUserId: string;
    responsibleUserName: string;
    courtReferenceNumber?: string;
    legalFeesClaimed?: number;
    notes?: string;
  }): RentalCase => {
    const selectedCheques = cheques.filter((c) => params.chequeIds.includes(c.id));
    if (selectedCheques.length === 0) {
      throw new Error("No cheques selected");
    }

    const first = selectedCheques[0];
    const totalClaim = selectedCheques.reduce((sum, c) => sum + c.outstanding, 0);

    const newCase: RentalCase = {
      id: "cas-" + Date.now(),
      caseNumber: generateSequentialNumber(cases, "caseNumber", "RDSC/"),
      courtReferenceNumber: params.courtReferenceNumber,
      tenantId: first.tenantId,
      ownerId: first.ownerId,
      propertyId: first.propertyId,
      unitId: first.unitId,
      leaseId: first.leaseId,
      linkedChequeIds: params.chequeIds,
      linkedExpenseIds: [],
      claimAmount: totalClaim + 0 + (params.chequeIds.length * legalSettings.defaultBouncedChequeFee),
      legalFeesClaimed: 0,
      bouncedChequeFeePerUnit: legalSettings.defaultBouncedChequeFee,
      totalPaid: 0,
      outstanding: totalClaim + (params.chequeIds.length * legalSettings.defaultBouncedChequeFee),
      outstandingAmount: totalClaim + (params.chequeIds.length * legalSettings.defaultBouncedChequeFee),
      status: "NEW",
      priority: totalClaim > 100000 ? "HIGH" : "NORMAL",
      responsibleUserId: params.responsibleUserId,
      responsibleUserName: params.responsibleUserName,
      courtName: params.courtName,
      filingDate: new Date().toISOString().split("T")[0],
      notes: params.notes,
      documents: [],
      sessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCases((prev) => [newCase, ...prev]);
    safeSetDoc(doc(db, "cases", newCase.id), newCase);

    // Update cheques to mark status UNDER_LEGAL and link caseId
    setCheques((prev) =>
      prev.map((c) => {
        if (params.chequeIds.includes(c.id)) {
          const updatedChq = { ...c, status: "UNDER_LEGAL" as const, convertedToCaseId: newCase.id };
          safeSetDoc(doc(db, "cheques", c.id), updatedChq, { merge: true });
          return updatedChq;
        }
        return c;
      })
    );

    logAudit(
      "CONVERT_TO_CASE",
      "CASE",
      newCase.id,
      `Case ${newCase.caseNumber}`,
      `Converted ${params.chequeIds.length} returned cheques into rental case ${newCase.caseNumber} with claim AED ${newCase.claimAmount.toLocaleString()}`
    );

    setTimeout(() => {
      recalculateTenantRisk(first.tenantId);
    }, 150);

    return newCase;
  };

  const linkChequesToCase = (
    caseId: string,
    chequeIds: string[],
    reason?: string
  ): { success: boolean; linkedCount: number; error?: string } => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return { success: false, linkedCount: 0, error: "Case not found" };

    // Check if any cheque is linked to ANOTHER active case
    const activeCases = cases.filter((c) => c.id !== caseId && c.status !== "CLOSED" && c.status !== "ARCHIVED");
    const conflictingCheques: Cheque[] = [];

    chequeIds.forEach((chqId) => {
      const alreadyLinkedCase = activeCases.find((c) => c.linkedChequeIds?.includes(chqId));
      if (alreadyLinkedCase) {
        const chq = cheques.find((c) => c.id === chqId);
        if (chq) conflictingCheques.push(chq);
      }
    });

    if (conflictingCheques.length > 0) {
      return {
        success: false,
        linkedCount: 0,
        error: `CONFLICT_LINKED:${conflictingCheques.map((c) => c.chequeNumber).join(", ")}`,
      };
    }

    // Perform linking
    const newLinkedIds = Array.from(new Set([...(targetCase.linkedChequeIds || []), ...chequeIds]));
    
    // Automatically attach cheque document copies to case
    const updatedCaseDocs = [...(targetCase.caseDocuments || [])];
    
    chequeIds.forEach((chqId) => {
      const chq = cheques.find((c) => c.id === chqId);
      if (chq) {
        if (chq.imageUrl) {
          const docId = "cdoc-chq-" + chq.id + "-" + Date.now();
          if (!updatedCaseDocs.some((d) => d.fileUrl === chq.imageUrl || d.title.includes(chq.chequeNumber))) {
            updatedCaseDocs.push({
              id: docId,
              caseId: targetCase.id,
              title: `Cheque #${chq.chequeNumber} Copy (${chq.bankName})`,
              documentType: "CHEQUE_COPY",
              fileName: `Cheque_${chq.chequeNumber}_${chq.bankName.replace(/\s+/g, "_")}.jpg`,
              fileUrl: chq.imageUrl,
              uploadedAt: new Date().toISOString(),
              uploadedByName: currentUser?.nameEn || "System Legal Action",
              driveFileId: chq.driveFileId,
              driveWebViewLink: chq.driveWebViewLink,
              driveSyncedAt: chq.driveSyncedAt,
              notes: `Original Bounced Cheque #${chq.chequeNumber} - AED ${chq.amount.toLocaleString()} - Reason: ${chq.returnReason || "BOUNCED"}`,
            });
          }
        }
      }
    });

    // Calculate new claim amount based on all linked cheques' outstanding balances
    const updatedCaseWithCheques = { ...targetCase, linkedChequeIds: newLinkedIds, caseDocuments: updatedCaseDocs };
    const updatedCase = recalculateCaseFinancials(updatedCaseWithCheques, cheques, propertyExpenses);

    setCases((prev) => prev.map((c) => (c.id === caseId ? updatedCase : c)));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    // Update cheques: set status to UNDER_LEGAL and set convertedToCaseId = caseId, preserving originalStatus BOUNCED
    setCheques((prev) =>
      prev.map((c) => {
        if (chequeIds.includes(c.id)) {
          const updatedChq: Cheque = {
            ...c,
            status: "UNDER_LEGAL",
            convertedToCaseId: caseId,
            originalStatus: c.originalStatus || "BOUNCED",
          };
          safeSetDoc(doc(db, "cheques", c.id), updatedChq, { merge: true });
          return updatedChq;
        }
        return c;
      })
    );

    // Audit Log
    logAudit(
      "CONVERT_TO_CASE",
      "CASE",
      caseId,
      `Case ${targetCase.caseNumber}`,
      `Linked ${chequeIds.length} returned cheque(s) to case ${targetCase.caseNumber}. Reason/Action: ${reason || "Legal Action escalation"}`,
      `Previous linked cheques: ${targetCase.linkedChequeIds.length}`,
      `New linked cheques count: ${newLinkedIds.length}`
    );

    setTimeout(() => {
      recalculateTenantRisk(targetCase.tenantId);
    }, 150);

    return { success: true, linkedCount: chequeIds.length };
  };

  const unlinkChequeFromCase = (
    caseId: string,
    chequeId: string,
    reason?: string
  ): { success: boolean; error?: string } => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const targetCheque = cheques.find((c) => c.id === chequeId);
    if (!targetCheque) return { success: false, error: "Cheque not found" };

    // Remove cheque ID from linkedChequeIds
    const newLinkedIds = (targetCase.linkedChequeIds || []).filter((id) => id !== chequeId);

    // Remove cheque document copies associated with this cheque
    const updatedCaseDocs = (targetCase.caseDocuments || []).filter(
      (d) => !d.id.includes(`cdoc-chq-${chequeId}`)
    );

    // Calculate updated claim amount based on remaining linked cheques
    const updatedCaseWithCheques = { ...targetCase, linkedChequeIds: newLinkedIds, caseDocuments: updatedCaseDocs };
    const updatedCase = recalculateCaseFinancials(updatedCaseWithCheques, cheques, propertyExpenses);

    setCases((prev) => prev.map((c) => (c.id === caseId ? updatedCase : c)));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    // Revert cheque back to original status (BOUNCED) and clear convertedToCaseId
    // Note: The cheque is NOT deleted from the system, it stays in cheques list as BOUNCED!
    const revertedStatus = targetCheque.originalStatus || "BOUNCED";
    const updatedCheque: Cheque = {
      ...targetCheque,
      status: revertedStatus as any,
      convertedToCaseId: deleteField() as any,
    };

    setCheques((prev) => prev.map((c) => (c.id === chequeId ? updatedCheque : c)));
    safeSetDoc(doc(db, "cheques", chequeId), updatedCheque, { merge: true });

    logAudit(
      "UPDATE",
      "CASE",
      caseId,
      `Case ${targetCase.caseNumber}`,
      `Removed cheque #${targetCheque.chequeNumber} from case ${targetCase.caseNumber}. Reverted cheque status to ${revertedStatus}. Reason: ${reason || "Removed by Admin"}`,
      `Previous linked count: ${targetCase.linkedChequeIds.length}`,
      `New linked count: ${newLinkedIds.length}`
    );

    setTimeout(() => {
      recalculateTenantRisk(targetCase.tenantId);
    }, 150);

    return { success: true };
  };

  const createCaseFromCheque = (params: {
    chequeId: string;
    caseNumber?: string;
    courtName?: string;
    courtReferenceNumber?: string;
    emirate?: string;
    city?: string;
    responsibleUserId?: string;
    responsibleUserName?: string;
    legalFeesClaimed?: number;
    notes?: string;
  }): RentalCase => {
    const chq = cheques.find((c) => c.id === params.chequeId);
    if (!chq) throw new Error("Cheque not found");

    const emirate = params.emirate || "Sharjah";
    const city = params.city || "Khor Fakkan";
    const defaultCourtName = params.courtName || `Sharjah Rental Dispute Tribunal - ${city}`;
    const generatedCaseNo = params.caseNumber || generateSequentialNumber(cases, "caseNumber", `RDT/${emirate.substring(0, 3).toUpperCase()}/${city.substring(0, 2).toUpperCase()}/`);

    const initialDocs: CaseDocumentItem[] = [];
    if (chq.imageUrl) {
      initialDocs.push({
        id: "cdoc-chq-" + chq.id + "-" + Date.now(),
        caseId: "",
        title: `Cheque #${chq.chequeNumber} Copy (${chq.bankName})`,
        documentType: "CHEQUE_COPY",
        fileName: `Cheque_${chq.chequeNumber}_${chq.bankName.replace(/\s+/g, "_")}.jpg`,
        fileUrl: chq.imageUrl,
        uploadedAt: new Date().toISOString(),
        uploadedByName: currentUser?.nameEn || "Legal Counsel",
        driveFileId: chq.driveFileId,
        driveWebViewLink: chq.driveWebViewLink,
        driveSyncedAt: chq.driveSyncedAt,
        notes: `Returned Cheque #${chq.chequeNumber} - Amount AED ${chq.amount.toLocaleString()} - Reason: ${chq.returnReason || "BOUNCED"}`,
      });
    }

    const newCaseId = "cas-" + Date.now();
    initialDocs.forEach((d) => (d.caseId = newCaseId));

    const newCase: RentalCase = {
      id: newCaseId,
      caseNumber: generatedCaseNo,
      courtReferenceNumber: params.courtReferenceNumber,
      tenantId: chq.tenantId,
      ownerId: chq.ownerId,
      propertyId: chq.propertyId,
      unitId: chq.unitId,
      leaseId: chq.leaseId,
      linkedChequeIds: [chq.id],
      linkedExpenseIds: [],
      claimAmount: chq.outstanding + legalSettings.defaultBouncedChequeFee,
      legalFeesClaimed: 0,
      bouncedChequeFeePerUnit: legalSettings.defaultBouncedChequeFee,
      totalPaid: 0,
      outstanding: chq.outstanding + legalSettings.defaultBouncedChequeFee,
      outstandingAmount: chq.outstanding + legalSettings.defaultBouncedChequeFee,
      status: "NEW",
      priority: chq.amount > 100000 ? "HIGH" : "NORMAL",
      responsibleUserId: params.responsibleUserId || currentUser?.id || "usr-04",
      responsibleUserName: params.responsibleUserName || currentUser?.nameEn || "Legal Counsel",
      courtName: defaultCourtName,
      filingDate: new Date().toISOString().split("T")[0],
      notes: params.notes || `Case created automatically from returned cheque #${chq.chequeNumber} (${chq.bankName})`,
      documents: initialDocs.map((d) => d.fileName),
      caseDocuments: initialDocs,
      sessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCases((prev) => [newCase, ...prev]);
    safeSetDoc(doc(db, "cases", newCase.id), newCase);

    // Update cheque status to UNDER_LEGAL and convertedToCaseId = newCaseId
    setCheques((prev) =>
      prev.map((c) => {
        if (c.id === chq.id) {
          const updatedChq: Cheque = {
            ...c,
            status: "UNDER_LEGAL",
            convertedToCaseId: newCase.id,
            originalStatus: "BOUNCED",
          };
          safeSetDoc(doc(db, "cheques", c.id), updatedChq, { merge: true });
          return updatedChq;
        }
        return c;
      })
    );

    logAudit(
      "CONVERT_TO_CASE",
      "CASE",
      newCase.id,
      `Case ${newCase.caseNumber}`,
      `Created new rental dispute case ${newCase.caseNumber} in ${defaultCourtName} (${emirate} / ${city}) from returned cheque #${chq.chequeNumber} (Claim AED ${newCase.claimAmount.toLocaleString()})`
    );

    setTimeout(() => {
      recalculateTenantRisk(chq.tenantId);
    }, 150);

    return newCase;
  };

  const updateCaseStatus = (caseId: string, status: CaseStatus): { success: boolean; error?: string } => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return { success: false, error: "Case not found" };

    if (!currentUser) {
      return {
        success: false,
        error: language === "ar"
          ? "يجب تسجيل الدخول أولاً لتعديل حالة القضية."
          : "User must be logged in to modify case status."
      };
    }

    // Check central permission: requires MANAGE_CASES permission or SYSTEM_OWNER/SUPER_ADMIN/MANAGER/LEGAL role
    const hasStatusPermission =
      hasPermission("MANAGE_CASES") ||
      currentUser.role === "SYSTEM_OWNER" ||
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.role === "MANAGER" ||
      currentUser.role === "LEGAL";

    if (!hasStatusPermission) {
      logAudit(
        "STATUS_CHANGE",
        "CASE",
        caseId,
        target.caseNumber,
        `Blocked unauthorized status change attempt to ${status}`
      );
      return {
        success: false,
        error: language === "ar"
          ? "غير مصرح لك بتعديل حالة القضية. تتطلب هذه العملية صلاحيات القسم القانوني أو الإدارة."
          : "Unauthorized to change case status. This operation requires Legal department or Admin/Manager permissions."
      };
    }

    // Strict State Transition Guard
    const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
      NEW: ["UNDER_REVIEW", "LEGAL_NOTICE", "FILED", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      UNDER_REVIEW: ["LEGAL_NOTICE", "FILED", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      LEGAL_NOTICE: ["FILED", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      FILED: ["IN_PROGRESS", "HEARING_SCHEDULED", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      IN_PROGRESS: ["HEARING_SCHEDULED", "JUDGMENT_ISSUED", "ENFORCEMENT", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      HEARING_SCHEDULED: ["IN_PROGRESS", "JUDGMENT_ISSUED", "ENFORCEMENT", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      JUDGMENT_ISSUED: ["IN_PROGRESS", "HEARING_SCHEDULED", "ENFORCEMENT", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      ENFORCEMENT: ["IN_PROGRESS", "HEARING_SCHEDULED", "JUDGMENT_ISSUED", "SETTLEMENT_IN_PROGRESS", "CLOSED"],
      SETTLEMENT_IN_PROGRESS: ["SETTLED", "IN_PROGRESS", "HEARING_SCHEDULED", "ENFORCEMENT", "CLOSED"],
      SETTLED: ["CLOSED", "ARCHIVED", "SETTLEMENT_IN_PROGRESS"],
      CLOSED: ["ARCHIVED"],
      ARCHIVED: []
    };

    // 1. If currently CLOSED or ARCHIVED, strictly lock from moving back
    if (target.status === "CLOSED" || target.status === "ARCHIVED") {
      if (target.status === "CLOSED" && status === "ARCHIVED") {
        // Allowed transition to archive a closed case
      } else {
        logAudit(
          "STATUS_CHANGE",
          "CASE",
          caseId,
          target.caseNumber,
          `Blocked transition attempt from ${target.status} to ${status}. Case status is locked.`
        );
        return {
          success: false,
          error: language === "ar"
            ? "لا يمكن تعديل حالة القضية بعد إغلاقها أو أرشفتها (الحالة مقفلة بالكامل)."
            : "Cannot modify case status once it has been CLOSED or ARCHIVED (Status is locked)."
        };
      }
    }

    // 2. Transition Guard Check
    const allowed = ALLOWED_TRANSITIONS[target.status] || [];
    if (status !== target.status && !allowed.includes(status)) {
      logAudit(
        "STATUS_CHANGE",
        "CASE",
        caseId,
        target.caseNumber,
        `Blocked invalid status transition from ${target.status} to ${status}.`
      );
      return {
        success: false,
        error: language === "ar"
          ? `مسار غير مسموح به في دورة حياة القضية: لا يمكن الانتقال مباشرة من [${target.status}] إلى [${status}].`
          : `Invalid transition path: Cannot transition directly from [${target.status}] to [${status}].`
      };
    }

    // 3. Financial Clearance check for closed/archived/settled states
    if (status === "CLOSED" || status === "ARCHIVED" || status === "SETTLED") {
      const freshCase = recalculateCaseFinancials(target, cheques, propertyExpenses);
      const caseOutstanding = freshCase.outstanding ?? freshCase.outstandingAmount ?? 0;
      const linkedIds = target.linkedChequeIds || [];
      const linkedChqs = cheques.filter(c => linkedIds.includes(c.id));
      const unpaidChequeAmount = linkedChqs.reduce((sum, c) => sum + (c.outstanding ?? 0), 0);

      if (caseOutstanding > 0 || unpaidChequeAmount > 0) {
        logAudit(
          "STATUS_CHANGE",
          "CASE",
          caseId,
          target.caseNumber,
          `Blocked transition to ${status} due to outstanding obligations. Case: ${caseOutstanding}, Cheques: ${unpaidChequeAmount}`
        );
        const errorMsgAr = `لا يمكن إغلاق أو تسوية أو أرشفة القضية لوجود مستحقات مالية غير مسددة بالكامل. المتبقي المستحق: ${caseOutstanding.toLocaleString()} درهم، ومتبقي الشيكات الراجعة: ${unpaidChequeAmount.toLocaleString()} درهم.`;
        const errorMsgEn = `Cannot close, settle, or archive this case because there are outstanding financial obligations. Case outstanding: AED ${caseOutstanding.toLocaleString()}, Cheques outstanding: AED ${unpaidChequeAmount.toLocaleString()}.`;
        return {
          success: false,
          error: language === "ar" ? errorMsgAr : errorMsgEn
        };
      }

      // Check for pending settlement installments
      const pendingInstallments = (target.settlement?.schedule || []).filter(ins => ins.status === "PENDING");
      if (pendingInstallments.length > 0) {
        return {
          success: false,
          error: language === "ar"
            ? `لا يمكن إغلاق القضية لوجود أقساط تسوية معلقة (${pendingInstallments.length} قسط).`
            : `Cannot close the case as there are ${pendingInstallments.length} pending settlement installments.`
        };
      }
    }

    saveEntitySnapshot("CASE", target, "VERSION");
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const old = c.status;
          logAudit("STATUS_CHANGE", "CASE", caseId, c.caseNumber, `Changed case status from ${old} to ${status}`, old, status);
          const updated = { ...c, status, updatedAt: new Date().toISOString() };
          safeSetDoc(doc(db, "cases", caseId), { status, updatedAt: updated.updatedAt }, { merge: true });
          return updated;
        }
        return c;
      })
    );
    return { success: true };
  };

  const deleteCase = (id: string, options?: DeleteRecordOptions) => {
    const c = cases.find((cas) => cas.id === id);
    if (!c) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("CASE", id);
      if (!check.canDelete) {
        logAudit("DELETE", "CASE", id, c.caseNumber, `Blocked deletion of case due to active constraints (${check.totalBlockersCount} blockers)`);
        console.warn(`[Integrity Guard] Cannot delete Case ${id} - blocked by active dependencies:`, check.blockers);
        return;
      }
    }

    archiveEntityToHistory("CASE", c, options);
    setCases((prev) => prev.filter((cas) => cas.id !== id));
    deleteDoc(doc(db, "cases", id)).catch(() => {});
  };

  const recalculateCaseFinancials = (caseItem: RentalCase, allCheques: Cheque[], allExpenses: PropertyExpenseRecord[]): RentalCase => {
    const linkedIds = caseItem.linkedChequeIds || [];
    const linkedCheques = allCheques.filter(c => linkedIds.includes(c.id));
    const linkedExpenses = allExpenses.filter(e => (caseItem.linkedExpenseIds || []).includes(e.id));
    
    const totalChequeOutstanding = linkedCheques.reduce((sum, c) => sum + c.outstanding, 0);
    const totalLegalFees = linkedExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    
    const includeBounced = caseItem.includeBouncedFees ?? false;
    // All cheques linked to the legal dispute are eligible for the returned cheques penalty
    const eligibleBouncedCheques = linkedCheques.filter(c => c.status === "BOUNCED" || c.status === "UNDER_LEGAL" || c.originalStatus === "BOUNCED" || true);
    const feePerUnit = caseItem.bouncedChequeFeePerUnit !== undefined && caseItem.bouncedChequeFeePerUnit !== null ? caseItem.bouncedChequeFeePerUnit : (legalSettings?.defaultBouncedChequeFee ?? 500);
    const totalBouncedFees = includeBounced ? (eligibleBouncedCheques.length * feePerUnit) : 0;
    
    const includeOtherFees = caseItem.includeOtherFees ?? false;
    const totalOtherFees = includeOtherFees ? (caseItem.otherFeesAmount || 0) : 0;
    
    const newClaimAmount = totalChequeOutstanding + totalLegalFees + totalBouncedFees + totalOtherFees;
    const newOutstanding = Math.max(0, newClaimAmount - (caseItem.paidAmount ?? caseItem.totalPaid ?? 0));
    
    return {
      ...caseItem,
      claimAmount: newClaimAmount,
      legalFeesClaimed: totalLegalFees,
      outstanding: newOutstanding,
      outstandingAmount: newOutstanding,
      updatedAt: new Date().toISOString()
    };
  };

  const linkExpenseToCase = (caseId: string, expenseId: string, reason?: string): { success: boolean; error?: string } => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const expense = propertyExpenses.find(e => e.id === expenseId);
    if (!expense) return { success: false, error: "Expense not found" };

    if (expense.legalCaseId && expense.legalCaseId !== caseId) {
      return { success: false, error: "EXPENSE_ALREADY_LINKED_TO_OTHER_CASE" };
    }

    const newLinkedIds = Array.from(new Set([...(targetCase.linkedExpenseIds || []), expenseId]));
    
    // Update expense record first
    const updatedExpense: PropertyExpenseRecord = {
      ...expense,
      legalCaseId: caseId
    };
    setPropertyExpenses(prev => prev.map(e => e.id === expenseId ? updatedExpense : e));
    safeSetDoc(doc(db, "property_expenses", expenseId), updatedExpense, { merge: true });

    // Recalculate case
    const updatedCase = recalculateCaseFinancials({ ...targetCase, linkedExpenseIds: newLinkedIds }, cheques, [...propertyExpenses.filter(e => e.id !== expenseId), updatedExpense]);
    
    setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    logAudit("LINK_EXPENSE", "CASE", caseId, targetCase.caseNumber, `Linked legal expense #${expense.expenseNumber} (AED ${expense.totalAmount.toLocaleString()}) to case. Reason: ${reason || "Cost Recovery"}`);
    
    return { success: true };
  };

  const linkMultipleExpensesToCase = (caseId: string, expenseIds: string[], reason?: string): { success: boolean; error?: string } => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const validExpenses = propertyExpenses.filter(e => expenseIds.includes(e.id));
    if (validExpenses.length === 0) return { success: false, error: "No valid expenses found" };

    // Update expense records
    const updatedExpenses = propertyExpenses.map(e => {
      if (expenseIds.includes(e.id)) {
        const updated = { ...e, legalCaseId: caseId };
        safeSetDoc(doc(db, "property_expenses", e.id), updated, { merge: true });
        return updated;
      }
      return e;
    });

    setPropertyExpenses(updatedExpenses);

    // Recalculate case with all new linked IDs
    const newLinkedIds = Array.from(new Set([...(targetCase.linkedExpenseIds || []), ...expenseIds]));
    const updatedCase = recalculateCaseFinancials(
      { ...targetCase, linkedExpenseIds: newLinkedIds }, 
      cheques, 
      updatedExpenses
    );
    
    setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    logAudit("LINK_EXPENSE", "CASE", caseId, targetCase.caseNumber, `Linked ${expenseIds.length} legal expenses to case. Reason: ${reason || "Bulk Cost Recovery"}`);
    
    return { success: true };
  };

  const unlinkExpenseFromCase = (caseId: string, expenseId: string, reason?: string): { success: boolean; error?: string } => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const expense = propertyExpenses.find(e => e.id === expenseId);
    if (!expense) return { success: false, error: "Expense not found" };

    const isAuthorized =
      !currentUser ||
      currentUser?.role === "SYSTEM_OWNER" ||
      currentUser?.role === "SUPER_ADMIN" ||
      currentUser?.role === "MANAGER" ||
      hasPermission("DELETE_RECORDS");
    if (!isAuthorized) {
      logAudit(
        "UNLINK_EXPENSE",
        "CASE",
        caseId,
        targetCase.caseNumber,
        `Blocked unauthorized attempt to unlink expense #${expense.expenseNumber} from case.`
      );
      return {
        success: false,
        error: language === "ar"
          ? "غير مصرح لك بإلغاء ارتباط مصروف مرتبط بقضية. هذه العملية تتطلب صلاحية مدير أو مسؤول النظام."
          : "Unauthorized to unlink an expense from a case. This operation requires Admin/Manager role."
      };
    }

    const newLinkedIds = (targetCase.linkedExpenseIds || []).filter(id => id !== expenseId);
    
    // Update expense record
    const updatedExpense: PropertyExpenseRecord = {
      ...expense,
      legalCaseId: undefined
    };
    setPropertyExpenses(prev => prev.map(e => e.id === expenseId ? updatedExpense : e));
    safeSetDoc(doc(db, "property_expenses", expenseId), { legalCaseId: deleteField() }, { merge: true });

    // Recalculate case
    const updatedCase = recalculateCaseFinancials({ ...targetCase, linkedExpenseIds: newLinkedIds }, cheques, [...propertyExpenses.filter(e => e.id !== expenseId), updatedExpense]);
    
    setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    logAudit("UNLINK_EXPENSE", "CASE", caseId, targetCase.caseNumber, `Unlinked legal expense #${expense.expenseNumber} from case. Reason: ${reason || "Correction"}`);

    return { success: true };
  };

  const updateCaseBouncedFee = (caseId: string, feePerUnit: number, reason?: string): { success: boolean; error?: string } => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const updatedCase = recalculateCaseFinancials({ ...targetCase, bouncedChequeFeePerUnit: feePerUnit }, cheques, propertyExpenses);
    
    setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    logAudit("UPDATE_BOUNCED_FEE", "CASE", caseId, targetCase.caseNumber, `Updated bounced cheque fee per unit to AED ${feePerUnit.toLocaleString()}. Reason: ${reason || "Modification"}`);

    return { success: true };
  };

  const updateCaseFeesConfig = (caseId: string, updates: { includeBouncedFees?: boolean; includeOtherFees?: boolean; otherFeesAmount?: number; otherFeesDescription?: string; }): { success: boolean; error?: string } => {
    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const updatedCase = recalculateCaseFinancials({ ...targetCase, ...updates }, cheques, propertyExpenses);
    
    setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
    safeSetDoc(doc(db, "cases", caseId), updatedCase, { merge: true });

    logAudit("UPDATE_CASE_FEES_CONFIG", "CASE", caseId, targetCase.caseNumber, `Updated case fees configuration`);
    
    return { success: true };
  };

  const addHearingSession = (caseId: string, sessionData: Omit<HearingSession, "id" | "createdAt">) => {
    const newSession: HearingSession = {
      ...sessionData,
      id: "ses-" + Date.now(),
      createdAt: new Date().toISOString(),
    };

    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const updated = {
            ...c,
            status: "HEARING_SCHEDULED" as CaseStatus,
            sessions: [...c.sessions, newSession],
            updatedAt: new Date().toISOString(),
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );

    logAudit(
      "HEARING_ADDED",
      "HEARING",
      newSession.id,
      `Session #${newSession.sessionNumber}`,
      `Scheduled hearing session #${newSession.sessionNumber} on ${newSession.date} at ${newSession.time}`
    );
  };

  const updateHearingSession = (caseId: string, sessionId: string, patch: Partial<HearingSession>) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (targetCase) {
      saveEntitySnapshot("CASE", targetCase, "VERSION");
    }
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const updated = {
            ...c,
            sessions: c.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
            updatedAt: new Date().toISOString(),
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );
    logAudit("UPDATE", "HEARING", sessionId, "Hearing Session", "Updated court hearing record and decision notes");
  };

  const paySettlementInstallment = (
    caseId: string,
    installmentId: string,
    paymentData: {
      amount?: number;
      method: PaymentMethod | "CHEQUE";
      date: string;
      reference?: string;
      chequeDetails?: { chequeNumber: string; chequeDate: string; bankName: string };
    }
  ) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId && c.settlement) {
          let paymentAmount = 0;
          const updatedSchedule: any[] = [];
          
          let scheduleToProcess = c.settlement?.schedule || (c.settlement as any).installmentSchedule || [];
          if (scheduleToProcess.length === 0 && (c.settlement?.installmentsCount || 0) > 0) {
              scheduleToProcess = Array.from({ length: (c.settlement?.installmentsCount || 0) }).map((_, i) => {
                const d = new Date(c.settlement?.signedDate || new Date());
                d.setMonth(d.getMonth() + i + 1);
                return {
                  id: `inst-fallback-${i}` as string,
                  installmentNumber: i + 1,
                  dueDate: d.toISOString().split("T")[0],
                  amount: Math.round((c.settlement?.totalAgreedAmount || (c.settlement as any).agreedAmount || 0) / (c.settlement?.installmentsCount || 0)),
                  status: "PENDING",
                };
              });
          }

          scheduleToProcess.forEach((inst: any) => {
            if (inst.id === installmentId) {
              const status = paymentData.method === "CHEQUE" ? "PROCESSING" : "PAID";
              const payAmount = paymentData.amount ?? inst.amount;

              if (status === "PAID") {
                paymentAmount = payAmount;
              }

              const updatedInst: any = {
                ...inst,
                amount: payAmount,
                status,
                paidDate: paymentData.date,
                paymentMethod: paymentData.method,
              };

              if (paymentData.reference) {
                updatedInst.transactionReference = paymentData.reference;
              }

              if (paymentData.method === "CHEQUE" && paymentData.chequeDetails) {
                updatedInst.chequeDetails = {
                  ...paymentData.chequeDetails,
                  isCleared: false
                };
              }

              updatedSchedule.push(updatedInst);

              if (payAmount < inst.amount) {
                const newInst: any = {
                  ...inst,
                  id: `${inst.id}-part-${Date.now()}`,
                  amount: inst.amount - payAmount,
                  status: "PENDING",
                };
                delete newInst.paidDate;
                delete newInst.paymentMethod;
                delete newInst.transactionReference;
                delete newInst.chequeDetails;
                updatedSchedule.push(newInst);
              }
            } else {
              updatedSchedule.push(inst);
            }
          });

          const newPaidAmount = (c.paidAmount ?? c.totalPaid ?? 0) + paymentAmount;
          const newOutstanding = Math.max(0, (c.claimAmount || 0) - newPaidAmount);

          const updated = {
            ...c,
            paidAmount: newPaidAmount,
            totalPaid: newPaidAmount,
            outstandingAmount: newOutstanding,
            outstanding: newOutstanding,
            settlement: { ...c.settlement, schedule: updatedSchedule },
            updatedAt: new Date().toISOString()
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );
    logAudit("FINANCIAL_PAYMENT", "CASE", caseId, "Settlement Installment", `Payment recorded via ${paymentData.method}`);
  };

  const clearSettlementCheque = (caseId: string, installmentId: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId && c.settlement) {
          let paymentAmount = 0;
          const updatedSchedule = c.settlement?.schedule.map((inst) => {
            if (inst.id === installmentId && inst.chequeDetails) {
              paymentAmount = inst.amount;
              return {
                ...inst,
                status: "PAID" as const,
                chequeDetails: {
                  ...inst.chequeDetails,
                  isCleared: true,
                  clearedDate: new Date().toISOString().split("T")[0]
                }
              };
            }
            return inst;
          });

          const newPaidAmount = (c.paidAmount ?? c.totalPaid ?? 0) + paymentAmount;
          const newOutstanding = Math.max(0, (c.claimAmount || 0) - newPaidAmount);

          const updated = {
            ...c,
            paidAmount: newPaidAmount,
            totalPaid: newPaidAmount,
            outstandingAmount: newOutstanding,
            outstanding: newOutstanding,
            settlement: { ...c.settlement, schedule: updatedSchedule },
            updatedAt: new Date().toISOString()
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );
    logAudit("FINANCIAL_PAYMENT", "CASE", caseId, "Settlement Cheque", "Cheque cleared and installment marked as paid");
  };

  const updateSettlementCheque = (caseId: string, installmentId: string, chequeData: { chequeNumber: string; chequeDate: string; bankName: string }) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId && c.settlement) {
          const updatedSchedule = c.settlement?.schedule.map((inst) => {
            if (inst.id === installmentId && inst.chequeDetails) {
              return {
                ...inst,
                chequeDetails: {
                  ...inst.chequeDetails,
                  ...chequeData
                }
              };
            }
            return inst;
          });

          const updated = {
            ...c,
            settlement: { ...c.settlement, schedule: updatedSchedule },
            updatedAt: new Date().toISOString()
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );
    logAudit("UPDATE", "CASE", caseId, "Settlement Cheque", "Cheque details updated by admin");
  };

  const saveSettlement = (caseId: string, settlementData: Omit<SettlementAgreement, "id">) => {
    const agreement: SettlementAgreement = {
      ...settlementData,
      id: "stl-" + Date.now(),
      schedule: settlementData.schedule.map((inst, idx) => ({
        ...inst,
        id: inst.id || `inst-${Date.now()}-${idx}`,
        status: inst.status || "PENDING"
      }))
    };

    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const updated = {
            ...c,
            settlement: agreement,
            status: "SETTLEMENT_IN_PROGRESS" as const,
            updatedAt: new Date().toISOString(),
          };
          safeSetDoc(doc(db, "cases", caseId), updated, { merge: true });
          return updated;
        }
        return c;
      })
    );

    logAudit(
      "UPDATE",
      "CASE",
      caseId,
      "Case Settlement",
      `Recorded settlement agreement for AED ${agreement.totalAgreedAmount.toLocaleString()} across ${agreement.installmentsCount} installments`
    );
  };

  // -------------------------------------------------------------
  // Private Archive & Security
  // -------------------------------------------------------------

  const addArchiveItem = (
    item: Omit<ElectronicArchiveItem, "id" | "createdAt" | "downloadToken" | "fileHash"> & { fileHash?: string }
  ): ElectronicArchiveItem => {
    const docId = "doc-" + Date.now();
    const token = "tok_sec_" + crypto.randomUUID().split("-")[0];
    const hash = item.fileHash || "sha256_" + crypto.randomUUID().split("-")[0];

    const newDoc: ElectronicArchiveItem = {
      uploadedByUserId: currentUser?.id || "sys-01",
      uploadedByName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      previewUrl: "",
      ...item,
      id: docId,
      fileHash: hash,
      downloadToken: token,
      isPrivate: true,
      createdAt: new Date().toISOString(),
    };

    // Defensively filter any binary/oversized fields
    const forbiddenKeys = ['base64', 'dataUrl', 'dataURL', 'blob', 'fileContent', 'binary', 'imageData', 'attachmentBase64', 'rawFile'];
    forbiddenKeys.forEach(k => {
      delete (newDoc as any)[k];
    });

    setArchive((prev) => [newDoc, ...prev]);
    safeSetDoc(doc(db, "archive", newDoc.id), newDoc);

    logAudit(
      "DOCUMENT_UPLOAD",
      "DOCUMENT",
      docId,
      newDoc.fileName,
      `Uploaded private confidential document ${newDoc.fileName} (${newDoc.category}) with SHA-256 hash ${hash.substring(0, 16)}...`
    );

    return newDoc;
  };

  const uploadAndArchiveDocument = async (
    source: string | File,
    options: DocumentUploadOptions
  ): Promise<ElectronicArchiveItem> => {
    const archiveItem = await DocumentStorageService.uploadAndArchive(source, {
      ...options,
      uploadedByUserId: currentUser?.id,
      uploadedByName: currentUser?.nameAr || currentUser?.nameEn
    });
    
    setArchive((prev) => [archiveItem, ...prev]);

    logAudit(
      "DOCUMENT_UPLOAD",
      "DOCUMENT",
      archiveItem.id,
      archiveItem.fileName,
      `Uploaded and synced to Drive: ${archiveItem.fileName} (${archiveItem.category})`
    );

    return archiveItem;
  };

  const deleteArchiveItem = (id: string) => {
    const item = archive.find((a) => a.id === id);
    if (!item) return;

    setArchive((prev) => prev.filter((a) => a.id !== id));
    deleteDoc(doc(db, "archive", id)).catch(() => {});
    logAudit(
      "UPDATE",
      "DOCUMENT",
      id,
      item.fileName,
      `Deleted document ${item.fileName} from private archive`
    );
  };

  const generateSecureDownloadToken = (id: string): string => {
    const item = archive.find((a) => a.id === id);
    if (!item) return "";

    const newToken = "tok_sec_" + Date.now();
    logAudit(
      "DOCUMENT_ACCESS",
      "DOCUMENT",
      id,
      item.fileName,
      `Authenticated user ${currentUser?.nameEn} generated secure access link for ${item.fileName}`
    );
    return newToken;
  };

  // Google Drive Sync for Archive Item
  const syncArchiveItemToDrive = async (
    id: string
  ): Promise<{ success: boolean; driveLink?: string; error?: string }> => {
    const item = archive.find((a) => a.id === id);
    if (!item) return { success: false, error: "Archive item not found" };

    try {
      const updatedItem = await DocumentStorageService.syncExistingArchiveItem(item);
      
      if (updatedItem.syncStatus === "SYNCED" && updatedItem.driveWebViewLink) {
        setArchive((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...updatedItem } : a))
        );

        logAudit(
          "DOCUMENT_ACCESS",
          "DOCUMENT",
          id,
          item.fileName,
          `Synced document ${item.fileName} to Google Drive (${updatedItem.driveWebViewLink})`
        );
        return { success: true, driveLink: updatedItem.driveWebViewLink };
      }
      return { success: false, error: "Sync deferred or failed." };
    } catch (e: any) {
      return { success: false, error: e.message || "Failed to sync to Google Drive" };
    }
  };

  // Cheque Image Upload & Drive Sync
  const uploadChequeImage = async (
    chequeId: string,
    imageBase64: string,
    syncToDrive = false
  ): Promise<{ success: boolean; driveLink?: string; error?: string }> => {
    const cheque = cheques.find((c) => c.id === chequeId);
    if (!cheque) return { success: false, error: "Cheque not found" };

    let driveFileId: string | undefined;
    let driveWebViewLink: string | undefined;
    let driveSyncedAt: string | undefined;

    try {
      const result = await DocumentStorageService.uploadAndArchive(imageBase64, {
        category: "CHEQUES",
        entityType: "CHEQUE",
        entityId: cheque.id,
        fileName: `Cheque_${cheque.chequeNumber}_${cheque.bankName.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`,
        mimeType: "image/jpeg",
        description: `Cheque #${cheque.chequeNumber} - AED ${cheque.amount} - Bank: ${cheque.bankName}`,
        uploadedByUserId: currentUser?.id,
        uploadedByName: currentUser?.nameEn
      });
      
      driveFileId = result.driveFileId;
      driveWebViewLink = result.driveWebViewLink;
      driveSyncedAt = result.driveSyncedAt;
      
      setArchive((prev) => {
        const exists = prev.find(a => a.id === result.id);
        if (exists) return prev.map(a => a.id === result.id ? { ...a, ...result } : a);
        return [...prev, result];
      });
    } catch (e) {
      console.warn("Cheque upload via DocumentStorageService failed:", e);
    }

    const updatedCheque: Cheque = {
      ...cheque,
      imageUrl: imageBase64,
      driveFileId: driveFileId || cheque.driveFileId,
      driveWebViewLink: driveWebViewLink || cheque.driveWebViewLink,
      driveSyncedAt: driveSyncedAt || cheque.driveSyncedAt,
    };

    setCheques((prev) => prev.map((c) => (c.id === chequeId ? updatedCheque : c)));
    return { success: true, driveLink: driveWebViewLink };
  };

  const syncChequeToDrive = async (
    chequeId: string
  ): Promise<{ success: boolean; driveLink?: string; error?: string }> => {
    const cheque = cheques.find((c) => c.id === chequeId);
    if (!cheque || !cheque.imageUrl) {
      return { success: false, error: "Cheque image not found" };
    }
    return uploadChequeImage(chequeId, cheque.imageUrl, true);
  };

  const deleteChequeImage = (chequeId: string) => {
    setCheques((prev) =>
      prev.map((c) =>
        c.id === chequeId
          ? { ...c, imageUrl: deleteField() as any, driveWebViewLink: deleteField() as any, driveFileId: deleteField() as any, driveSyncedAt: deleteField() as any }
          : c
      )
    );
    logAudit("DELETE", "CHEQUE", chequeId, `Cheque #${cheques.find((c) => c.id === chequeId)?.chequeNumber}`, `Deleted cheque image attachment`);
  };

  // Case Documents Management & Drive Sync
  const addCaseDocument = async (
    caseId: string,
    doc: Omit<CaseDocumentItem, "id" | "uploadedAt">,
    syncToDrive = false
  ): Promise<{ success: boolean; document?: CaseDocumentItem; driveLink?: string; error?: string }> => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const docId = "cdoc-" + Date.now();
    const uploadedAt = new Date().toISOString();

    let driveFileId: string | undefined;
    let driveWebViewLink: string | undefined;
    let driveSyncedAt: string | undefined;

    if (syncToDrive) {
      try {
        const archiveItem = await DocumentStorageService.uploadAndArchive(doc.fileUrl, {
          category: "CASES",
          entityType: "CASE",
          entityId: caseId,
          fileName: doc.fileName,
          mimeType: doc.mimeType || "application/pdf",
          description: `Case Document: ${doc.title} (${doc.documentType}) for Case #${targetCase.caseNumber}`,
          uploadedByUserId: currentUser?.id,
          uploadedByName: currentUser?.nameEn,
          tags: ["case", "court", "document"]
        });
        
        driveFileId = archiveItem.driveFileId;
        driveWebViewLink = archiveItem.driveWebViewLink;
        driveSyncedAt = archiveItem.driveSyncedAt;
      } catch (err) {
        console.error("Case document sync failed", err);
        return { success: false, error: "Failed to upload document to Drive" };
      }
    }

    const newDocItem: CaseDocumentItem = {
      ...doc,
      id: docId,
      uploadedAt,
      uploadedByName: currentUser?.nameEn || "Legal Counsel",
      driveFileId,
      driveWebViewLink,
      driveSyncedAt,
    };

    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          const currentDocs = c.caseDocuments || [];
          return {
            ...c,
            caseDocuments: [newDocItem, ...currentDocs],
            documents: [...c.documents, doc.fileName],
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    // Also register in main electronic archive
    addArchiveItem({
      fileName: doc.fileName,
      category: "CASES",
      recordId: caseId,
      recordTitle: `Case ${targetCase.caseNumber} - ${doc.title}`,
      fileType: doc.mimeType || "application/pdf",
      fileSize: doc.fileSize || 500000,
      isPrivate: true,
      storagePath: `/secure/cases/${caseId}/${doc.fileName}`,
      uploadedByUserId: currentUser?.id || "sys",
      uploadedByName: currentUser?.nameEn || "Legal Counsel",
      previewUrl: doc.fileUrl,
      tags: [doc.documentType, targetCase.courtName, `Case #${targetCase.caseNumber}`],
      driveFileId,
      driveWebViewLink,
      driveSyncedAt,
    });

    logAudit(
      "DOCUMENT_UPLOAD",
      "CASE",
      caseId,
      `Case #${targetCase.caseNumber}`,
      `Uploaded case document: ${doc.title} (${doc.documentType})${driveWebViewLink ? " and synced to Google Drive" : ""}`
    );

    return { success: true, document: newDocItem, driveLink: driveWebViewLink };
  };

  const deleteCaseDocument = (caseId: string, docId: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            caseDocuments: (c.caseDocuments || []).filter((d) => d.id !== docId),
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    logAudit("UPDATE", "CASE", caseId, "Case Document", `Removed document from case #${caseId}`);
  };

  const syncCaseDocumentToDrive = async (
    caseId: string,
    docId: string
  ): Promise<{ success: boolean; driveLink?: string; error?: string }> => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return { success: false, error: "Case not found" };

    const doc = (targetCase.caseDocuments || []).find((d) => d.id === docId);
    if (!doc) return { success: false, error: "Document not found" };

    try {
      const archiveItem = await DocumentStorageService.uploadAndArchive(doc.fileUrl, {
        category: "CASES",
        entityType: "CASE",
        entityId: caseId,
        fileName: doc.fileName,
        mimeType: doc.mimeType || "application/pdf",
        description: `Case Document: ${doc.title} (${doc.documentType}) for Case #${targetCase.caseNumber}`,
        uploadedByUserId: currentUser?.id,
        uploadedByName: currentUser?.nameEn,
        tags: ["case", "court", "document"]
      });

      const syncedAt = new Date().toISOString();
      setCases((prev) =>
        prev.map((c) => {
          if (c.id === caseId) {
            return {
              ...c,
              caseDocuments: (c.caseDocuments || []).map((d) =>
                d.id === docId
                  ? {
                      ...d,
                      driveFileId: archiveItem.driveFileId,
                      driveWebViewLink: archiveItem.driveWebViewLink,
                      driveSyncedAt: archiveItem.driveSyncedAt,
                    }
                  : d
              ),
              updatedAt: syncedAt,
            };
          }
          return c;
        })
      );

      return { success: true, driveLink: archiveItem.driveWebViewLink };
    } catch (err) {
      console.error("Case document sync failed", err);
      return { success: false, error: "Failed to upload document to Drive" };
    }
  };

  // -------------------------------------------------------------
  // Notifications & Reminders
  // -------------------------------------------------------------

  const dispatchNewLeaseNotification = async (leaseId: string): Promise<{ success: boolean; message: string }> => {
    const lse = leases.find((l) => l.id === leaseId);
    if (!lse) return { success: false, message: "Lease not found" };

    const tenant = tenants.find((t) => t.id === lse.tenantId);
    const tenantName = tenant?.nameAr || tenant?.nameEn || "Tenant";
    const tenantPhone = tenant?.phone ? tenant.phone.replace(/[^0-9+]/g, "") : "";

    let textMessage = `عزيزي ${tenantName}، نرحب بك. تم تسجيل عقد الإيجار الجديد رقم ${lse.leaseNumber}. مرفق الإيصال.`;
    
    const tpl = messageTemplates.find(t => t.id === "NEW_LEASE");
    if (tpl) {
      textMessage = (language === "ar" ? tpl.bodyAr : tpl.bodyEn)
        .replace(/{tenantName}/g, tenantName)
        .replace(/{leaseNumber}/g, lse.leaseNumber);
    }

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: "WHATSAPP",
      recipient: tenantPhone || "N/A",
      recipientName: tenantName,
      tenantId: lse.tenantId,
      type: "OTHER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: textMessage,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
    return { success: true, message: language === "ar" ? "تم إرسال إشعار العقد الجديد" : "New lease notification sent" };
  };

  const dispatchChequeCollectedNotification = async (chequeId: string): Promise<{ success: boolean; message: string }> => {
    const cheque = cheques.find((c) => c.id === chequeId);
    if (!cheque) return { success: false, message: "Cheque not found" };

    const tenant = tenants.find((t) => t.id === cheque.tenantId);
    const tenantName = tenant?.nameAr || tenant?.nameEn || "عزيزي المستأجر";
    const tenantPhone = tenant?.phone ? tenant.phone.replace(/[^0-9+]/g, "") : "";

    let textMessage = `عزيزي ${tenantName}، تم بنجاح تحصيل الشيك رقم ${cheque.chequeNumber} بمبلغ ${cheque.amount.toLocaleString()} درهم. شكراً لك.`;
    
    const tpl = messageTemplates.find(t => t.id === "CHEQUE_COLLECTED");
    if (tpl) {
      textMessage = (language === "ar" ? tpl.bodyAr : tpl.bodyEn)
        .replace(/{tenantName}/g, tenantName)
        .replace(/{chequeNumber}/g, cheque.chequeNumber)
        .replace(/{chequeAmount}/g, cheque.amount.toLocaleString())
        .replace(/{dueDate}/g, cheque.dueDate);
    }

    const notif: NotificationRecord = {
      id: "notif-" + Date.now(),
      channel: "WHATSAPP",
      recipient: tenantPhone || "N/A",
      recipientName: tenantName,
      tenantId: cheque.tenantId,
      chequeId: cheque.id,
      type: "OTHER",
      status: "SENT",
      sentAt: new Date().toISOString(),
      content: textMessage,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
    return { success: true, message: language === "ar" ? "تم إرسال إشعار تحصيل الشيك" : "Cheque collected notification sent" };
  };

  const dispatchWhatsAppReminder = async (chequeId: string): Promise<{ success: boolean; message: string }> => {
    const cheque = cheques.find((c) => c.id === chequeId);
    if (!cheque) return { success: false, message: "Cheque not found" };

    const tenant = tenants.find((t) => t.id === cheque.tenantId);
    
    try {
      const tenantName = tenant?.nameAr || tenant?.nameEn || "عزيزي المستأجر";
      const tenantPhone = tenant?.phone ? tenant.phone.replace(/[^0-9+]/g, "") : "";
      
      let textMessage = `تحية طيبة،\n${tenantName}\n\nنود إعلامكم بأنه تم إرجاع الشيك الخاص بكم رقم (${cheque.chequeNumber}) بقيمة (${cheque.amount.toLocaleString()} درهم إماراتي) والمستحق بتاريخ (${cheque.dueDate}).\n\nيرجى المبادرة بتسوية المبلغ المذكور في أقرب وقت ممكن لتجنب اتخاذ الإجراءات القانونية اللازمة.\n\nشكراً لتعاونكم.`;
      
      const tpl = messageTemplates.find(t => t.id === "CHEQUE_BOUNCED");
      if (tpl) {
        textMessage = (language === "ar" ? tpl.bodyAr : tpl.bodyEn)
          .replace(/{tenantName}/g, tenantName)
          .replace(/{chequeNumber}/g, cheque.chequeNumber)
          .replace(/{chequeAmount}/g, cheque.amount.toLocaleString())
          .replace(/{dueDate}/g, cheque.dueDate);
      }
      
      const whatsappUrl = `https://wa.me/${tenantPhone}?text=${encodeURIComponent(textMessage)}`;
      
      // Open WhatsApp in a new tab
      window.open(whatsappUrl, "_blank");

      const notif: NotificationRecord = {
        id: "notif-" + Date.now(),
        channel: "WHATSAPP",
        recipient: tenantPhone || "N/A",
        recipientName: tenantName,
        tenantId: cheque.tenantId,
        chequeId: cheque.id,
        type: cheque.reminderCount === 0 ? "BOUNCED_CHEQUE_ALERT" : "THREE_DAY_REMINDER",
        status: "SENT",
        sentAt: new Date().toISOString(),
        content: textMessage,
        responsePayload: "Opened via WhatsApp Web",
        attemptCount: cheque.reminderCount + 1,
        createdAt: new Date().toISOString(),
      };

      setNotifications((prev) => [notif, ...prev]);

      // Update cheque reminder tracker
      setCheques((prev) =>
        prev.map((c) =>
          c.id === chequeId
            ? {
                ...c,
                whatsAppStatus: "SENT",
                reminderCount: c.reminderCount + 1,
                lastReminderDate: new Date().toISOString().split("T")[0],
              }
            : c
        )
      );

      return {
        success: true,
        message: "WhatsApp opened successfully",
      };
    } catch (e: any) {
      return { success: false, message: e.message || "Failed to open WhatsApp" };
    }
  };

  const dispatchEmailReminder = async (chequeId: string): Promise<{ success: boolean; message: string }> => {
    const cheque = cheques.find((c) => c.id === chequeId);
    if (!cheque) return { success: false, message: "Cheque not found" };

    const tenant = tenants.find((t) => t.id === cheque.tenantId);

    try {
      const res = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          recipient: tenant?.email || "tenant@example.com",
          tenantName: tenant?.nameAr || tenant?.nameEn,
          chequeNumber: cheque.chequeNumber,
          amountAED: cheque.amount,
          dueDate: cheque.dueDate,
        }),
      });
      const data = await res.json();

      const notif: NotificationRecord = {
        id: "notif-" + Date.now(),
        channel: "EMAIL",
        recipient: tenant?.email || "N/A",
        recipientName: tenant?.nameEn || "Tenant",
        tenantId: cheque.tenantId,
        chequeId: cheque.id,
        type: cheque.reminderCount === 0 ? "BOUNCED_CHEQUE_ALERT" : "THREE_DAY_REMINDER",
        status: data.success ? "SENT" : "FAILED",
        sentAt: new Date().toISOString(),
        content: data.previewMessage || "Email Notification",
        responsePayload: data.status,
        attemptCount: cheque.reminderCount + 1,
        createdAt: new Date().toISOString(),
      };

      setNotifications((prev) => [notif, ...prev]);

      return {
        success: data.success,
        message: data.success ? "Email reminder delivered successfully" : (data.error || "Failed to deliver Email message"),
      };
    } catch (e: any) {
      return { success: false, message: e.message || "Network error" };
    }
  };

  const addOperationalCommunication = async (
    data: Omit<OperationalCommunicationRecord, "id" | "createdAt"> & { id?: string; createdAt?: string }
  ): Promise<{ success: boolean; id?: string }> => {
    const id = data.id || `comm-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
    const newRecord: OperationalCommunicationRecord = {
      ...data,
      id,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    setOperationalCommunications((prev) => [newRecord, ...prev]);
    safeSetDoc(doc(db, "operational_communications", id), newRecord);
    return { success: true, id };
  };

  // -------------------------------------------------------------
  // Risk Config
  // -------------------------------------------------------------

  const updateRiskConfig = (newWeights: Partial<RiskConfigWeights>) => {
    const updated = { ...riskConfig, ...newWeights };
    setRiskConfig(updated);

    logAudit(
      "UPDATE",
      "RISK_CONFIG",
      "cfg-01",
      "Tenant Risk Engine",
      `Super Admin modified risk scoring weights and thresholds`
    );

    // Recalculate all tenants with new weights
    setTimeout(() => {
      setTenants((prev) =>
        prev.map((t) => {
          const r = calculateTenantRisk(t.id, updated);
          return { ...t, riskScore: r.score, riskLevel: r.level, riskFactors: r.factors };
        })
      );
    }, 100);
  };

  // -------------------------------------------------------------
  // Excel Batch Import
  // -------------------------------------------------------------

  const importBatchData = (
    type: "OWNERS" | "TENANTS" | "PROPERTIES" | "CHEQUES" | "LEASES",
    records: any[]
  ) => {
    let successCount = 0;
    const errors: string[] = [];

    if (type === "CHEQUES") {
      const added: Cheque[] = [];
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r.chequeNumber || !r.amount) {
          errors.push(`Row ${i + 1}: Missing cheque number or amount`);
          continue;
        }

        const isBounced = r.status === "BOUNCED" || r.originalStatus === "BOUNCED";
        const newChq: Cheque = {
          id: "chq-" + Date.now() + "-" + i,
          chequeNumber: String(r.chequeNumber),
          bankName: r.bankName || "UAE Bank",
          amount: parseFloat(r.amount) || 0,
          chequeDate: r.chequeDate || new Date().toISOString().split("T")[0],
          dueDate: r.dueDate || new Date().toISOString().split("T")[0],
          ownerId: r.ownerId || owners[0]?.id || "ow-01",
          tenantId: r.tenantId || tenants[0]?.id || "tnt-01",
          propertyId: r.propertyId || properties[0]?.id || "prop-01",
          unitId: r.unitId || units[0]?.id || "unt-01",
          leaseId: r.leaseId || leases[0]?.id || "lse-01",
          status: isBounced ? "BOUNCED" : (r.status || "PENDING"),
          originalStatus: isBounced ? "BOUNCED" : "NORMAL",
          returnReason: r.returnReason,
          returnedDate: r.returnedDate,
          collectionStatus: isBounced ? "NOT_COLLECTED" : "NOT_COLLECTED",
          totalApplied: 0,
          outstanding: parseFloat(r.amount) || 0,
          whatsAppStatus: isBounced ? "PENDING_REMINDER" : "NONE",
          reminderCount: 0,
          notes: r.notes,
          createdAt: new Date().toISOString(),
        };

        added.push(newChq);
        successCount++;
      }

      setCheques((prev) => [...added, ...prev]);
      added.forEach((c) => safeSetDoc(doc(db, "cheques", c.id), c));
      logAudit("DATA_IMPORT", "CHEQUE", "batch", "Excel Cheques Import", `Imported ${successCount} cheques from Excel`);
    } else if (type === "TENANTS") {
      const added: Tenant[] = [];
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r.nameEn && !r.nameAr) {
          errors.push(`Row ${i + 1}: Missing tenant name`);
          continue;
        }

        const newT: Tenant = {
          id: "tnt-" + Date.now() + "-" + i,
          code: r.code || `TNT-${crypto.randomUUID().split("-")[0]}`,
          nameEn: r.nameEn || r.nameAr,
          nameAr: r.nameAr || r.nameEn,
          type: r.type === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
          email: r.email || "info@tenant.ae",
          phone: r.phone || "+971500000000",
          emiratesId: r.emiratesId,
          nationality: r.nationality || "United Arab Emirates",
          riskScore: 10,
          riskLevel: "LOW",
          riskFactors: ["Imported from historical spreadsheet"],
          status: "ACTIVE",

          createdAt: new Date().toISOString(),
        };
        added.push(newT);
        successCount++;
      }
      setTenants((prev) => [...added, ...prev]);
      added.forEach((t) => safeSetDoc(doc(db, "tenants", t.id), t));
      logAudit("DATA_IMPORT", "TENANT", "batch", "Excel Tenants Import", `Imported ${successCount} tenants from Excel`);
    }

    return { total: records.length, successCount, errors };
  };

  const importOwnersBatch = async (
    records: Array<{
      code?: string;
      nameEn: string;
      nameAr: string;
      emiratesId?: string;
      trn?: string;
      email?: string;
      phone?: string;
      bankName?: string;
      iban?: string;
      accountNumber?: string;
      status?: "ACTIVE" | "INACTIVE";
      notes?: string;
    }>
  ): Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let importedCount = 0;
    let updatedCount = 0;

    const currentOwnersMap = new Map<string, Owner>();
    owners.forEach((o) => currentOwnersMap.set(o.id, { ...o }));

    const docsToSave: Owner[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.nameEn && !r.nameAr) {
        errors.push(`Row ${i + 1}: Missing owner name`);
        continue;
      }

      const normEmiratesId = normalizeIdNumber(r.emiratesId);
      const normCode = normalizeText(r.code);
      const normPhone = normalizePhone(r.phone);
      const normNameAr = normalizeText(r.nameAr);
      const normNameEn = normalizeText(r.nameEn);

      let existingOwner: Owner | undefined;
      for (const o of currentOwnersMap.values()) {
        const matchId = normEmiratesId && normEmiratesId.length >= 8 && normalizeIdNumber(o.emiratesId) === normEmiratesId;
        const matchCode = normCode && normCode.length >= 3 && normalizeText(o.code) === normCode;
        const matchPhone = normPhone && normPhone.length >= 8 && normalizePhone(o.phone) === normPhone;
        const matchNameAr = normNameAr && normNameAr.length >= 3 && normalizeText(o.nameAr) === normNameAr;
        const matchNameEn = normNameEn && normNameEn.length >= 3 && normalizeText(o.nameEn) === normNameEn;

        if (matchId || matchCode || matchPhone || matchNameAr || matchNameEn) {
          existingOwner = o;
          break;
        }
      }

      if (existingOwner) {
        const updated: Owner = {
          ...existingOwner,
          code: r.code || existingOwner.code,
          nameAr: r.nameAr || existingOwner.nameAr,
          nameEn: r.nameEn || existingOwner.nameEn,
          emiratesId: r.emiratesId || existingOwner.emiratesId,
          trn: r.trn !== undefined ? r.trn : existingOwner.trn,
          email: r.email || existingOwner.email,
          phone: r.phone || existingOwner.phone,
          bankName: r.bankName || existingOwner.bankName,
          iban: r.iban || existingOwner.iban,
          accountNumber: r.accountNumber || existingOwner.accountNumber,
          status: (r.status as any) || existingOwner.status,
          notes: r.notes ? (existingOwner.notes ? `${existingOwner.notes} | ${r.notes}` : r.notes) : existingOwner.notes,
        };
        currentOwnersMap.set(updated.id, updated);
        docsToSave.push(updated);
        updatedCount++;
      } else {
        const newOwner: Owner = {
          id: "ow-" + Date.now() + "-" + i + "-" + crypto.randomUUID().split("-")[0],
          code: r.code || generateSequentialNumber(owners, "code", "EFR-OWN-"),
          nameEn: r.nameEn || r.nameAr,
          nameAr: r.nameAr || r.nameEn,
          emiratesId: r.emiratesId || "",
          trn: r.trn || undefined,
          email: r.email || "",
          phone: r.phone || "",
          bankName: r.bankName || "",
          iban: r.iban || "",
          accountNumber: r.accountNumber || "",
          status: (r.status as any) || "ACTIVE",
          notes: r.notes || "",
          createdAt: new Date().toISOString(),
        };
        currentOwnersMap.set(newOwner.id, newOwner);
        docsToSave.push(newOwner);
        importedCount++;
      }
    }

    const finalOwnersList = Array.from(currentOwnersMap.values());
    setOwners(finalOwnersList);

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < docsToSave.length; i += CHUNK_SIZE) {
        const chunk = docsToSave.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(doc(db, "owners", item.id), sanitizeForFirestore(item), { merge: true });
        }
        await batch.commit();
      }
    } catch (err) {
      console.error("Firestore batch commit error:", err);
    }

    logAudit(
      "DATA_IMPORT",
      "OWNER",
      "batch",
      "Excel Owners Import",
      `Imported ${importedCount} new owners, updated ${updatedCount} existing owners without duplicates.`
    );

    return { total: records.length, importedCount, updatedCount, errors };
  };

  const importTenantsBatch = async (
    records: Array<{
      code?: string;
      nameEn: string;
      nameAr: string;
      type?: "INDIVIDUAL" | "CORPORATE";
      email?: string;
      phone?: string;
      emiratesId?: string;
      passportNumber?: string;
      tradeLicenseNo?: string;
      nationality?: string;
      status?: "ACTIVE" | "INACTIVE" | "BLACKLISTED";
    }>
  ): Promise<{ total: number; importedCount: number; updatedCount: number; errors: string[] }> => {
    const errors: string[] = [];
    let importedCount = 0;
    let updatedCount = 0;

    const currentTenantsMap = new Map<string, Tenant>();
    tenants.forEach((t) => currentTenantsMap.set(t.id, { ...t }));

    const docsToSave: Tenant[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.nameEn && !r.nameAr) {
        errors.push(`Row ${i + 1}: Missing tenant name`);
        continue;
      }

      const normEmiratesId = normalizeIdNumber(r.emiratesId);
      const normTradeLicense = normalizeIdNumber(r.tradeLicenseNo);
      const normPassport = normalizeIdNumber(r.passportNumber);
      const normCode = normalizeText(r.code);
      const normPhone = normalizePhone(r.phone);
      const normNameAr = normalizeText(r.nameAr);
      const normNameEn = normalizeText(r.nameEn);

      let existingTenant: Tenant | undefined;
      for (const t of currentTenantsMap.values()) {
        const matchId = normEmiratesId && normEmiratesId.length >= 8 && normalizeIdNumber(t.emiratesId) === normEmiratesId;
        const matchTrade = normTradeLicense && normTradeLicense.length >= 4 && normalizeIdNumber(t.tradeLicenseNo) === normTradeLicense;
        const matchPass = normPassport && normPassport.length >= 6 && normalizeIdNumber(t.passportNumber || t.passportNo) === normPassport;
        const matchCode = normCode && normCode.length >= 3 && normalizeText(t.code) === normCode;
        const matchPhone = normPhone && normPhone.length >= 8 && normalizePhone(t.phone) === normPhone;
        const matchNameAr = normNameAr && normNameAr.length >= 3 && normalizeText(t.nameAr) === normNameAr;
        const matchNameEn = normNameEn && normNameEn.length >= 3 && normalizeText(t.nameEn) === normNameEn;

        if (matchId || matchTrade || matchPass || matchCode || matchPhone || matchNameAr || matchNameEn) {
          existingTenant = t;
          break;
        }
      }

      if (existingTenant) {
        const updated: Tenant = {
          ...existingTenant,
          code: r.code || existingTenant.code,
          nameAr: r.nameAr || existingTenant.nameAr,
          nameEn: r.nameEn || existingTenant.nameEn,
          type: r.type || existingTenant.type,
          email: r.email || existingTenant.email,
          phone: r.phone || existingTenant.phone,
          emiratesId: r.emiratesId || existingTenant.emiratesId,
          passportNumber: r.passportNumber || existingTenant.passportNumber || existingTenant.passportNo,
          passportNo: r.passportNumber || existingTenant.passportNumber || existingTenant.passportNo,
          tradeLicenseNo: r.tradeLicenseNo || existingTenant.tradeLicenseNo,
          nationality: r.nationality || existingTenant.nationality,
          status: (r.status as any) || existingTenant.status,
        };
        currentTenantsMap.set(updated.id, updated);
        docsToSave.push(updated);
        updatedCount++;
      } else {
        const newTenant: Tenant = {
          id: "tnt-" + Date.now() + "-" + i + "-" + crypto.randomUUID().split("-")[0],
          code: r.code || generateSequentialNumber(Array.from(currentTenantsMap.values()), "code", "EFR-TNT-"),
          nameEn: r.nameEn || r.nameAr,
          nameAr: r.nameAr || r.nameEn,
          type: r.type || "INDIVIDUAL",
          email: r.email || "",
          phone: r.phone || "",
          emiratesId: r.emiratesId || "",
          passportNumber: r.passportNumber || "",
          passportNo: r.passportNumber || "",
          tradeLicenseNo: r.tradeLicenseNo || "",
          nationality: r.nationality || "United Arab Emirates",
          riskScore: 10,
          riskLevel: "LOW",
          riskFactors: ["New tenant profile"],
          bouncedChequesCount: 0,
          totalBouncedAmount: 0,
          activeCasesCount: 0,
          status: (r.status as any) || "ACTIVE",
          createdAt: new Date().toISOString(),
        };
        currentTenantsMap.set(newTenant.id, newTenant);
        docsToSave.push(newTenant);
        importedCount++;
      }
    }

    const finalTenantsList = Array.from(currentTenantsMap.values());
    setTenants(finalTenantsList);

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < docsToSave.length; i += CHUNK_SIZE) {
        const chunk = docsToSave.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(doc(db, "tenants", item.id), sanitizeForFirestore(item), { merge: true });
        }
        await batch.commit();
      }
    } catch (err) {
      console.error("Firestore batch commit error:", err);
    }

    logAudit(
      "DATA_IMPORT",
      "TENANT",
      "batch",
      "Excel Tenants Import",
      `Imported ${importedCount} new tenants, updated ${updatedCount} existing tenants without duplicates.`
    );

    return { total: records.length, importedCount, updatedCount, errors };
  };

  const clearTable = (tableName: string) => {
    switch (tableName) {
      case "owners": setOwners([]); break;
      case "properties": setProperties([]); break;
      case "units": setUnits([]); break;
      case "tenants": setTenants([]); break;
      case "leases": setLeases([]); break;
      case "cheques": setCheques([]); break;
      case "collections": setCollections([]); break;
      case "cases": setCases([]); break;
      case "archive": setArchive([]); break;
      case "notifications": setNotifications([]); break;
      case "auditLogs": setAuditLogs([]); break;
      case "historicalRecords": setHistoricalRecords([]); break;
    }
    logAudit("DELETE", "RISK_CONFIG", "table-clear", tableName, `Cleared all records in table ${tableName}`);
  };

  const resetDatabase = async () => {
    setOwners([]);
    setProperties([]);
    setUnits([]);
    setTenants([]);
    setLeases([]);
    setCheques([]);
    setCollections([]);
    setCases([]);
    setArchive([]);
    setNotifications([]);
    setAuditLogs([]);
    setHistoricalRecords([]);
    setMaintenanceRequests([]);
    setTechnicians([]);
    setCommissions([]);
    setPaymentAllocations([]);
    setFinancialReversals([]);
    setFinancialAdjustments([]);
    setOwnerTransfers([]);
    setPropertyExpenses([]);
    setCollectionActions([]);
    setPaymentPromises([]);
    setLeaseRenewals([]);
    setDeferredPayments([]);
    setJournalEntries([]);
    setOfficePettyCashMonths([]);
    setOfficePettyCashExpenses([]);
    setFinancialPeriods([]);
    setPeriodCertifications([]);

    const operationalStorageKeys = [
      "ef_owners_v12",
      "ef_properties_v12",
      "ef_units_v12",
      "ef_tenants_v12",
      "ef_leases_v12",
      "ef_cheques_v12",
      "ef_collections_v12",
      "ef_cases_v12",
      "ef_archive_v12",
      "ef_notifications_v12",
      "ef_audit_logs_v12",
      "ef_historical_records_v12",
      "ef_maintenance_requests_v12",
      "ef_technicians_v12",
      "ef_commissions_v12",
      "ef_payment_allocations_v12",
      "ef_financial_reversals_v12",
      "ef_financial_adjustments_v12",
      "ef_owner_transfers_v12",
      "ef_property_expenses_v12",
      "ef_collection_actions_v12",
      "ef_payment_promises_v12",
      "ef_lease_renewals_v12",
      "ef_deferred_payments_v12",
      "ef_journal_entries_v12",
      "ef_office_petty_cash_months_v12",
      "ef_office_petty_cash_expenses_v12",
      "ef_financial_periods_v1",
      "ef_period_certifications_v1",
      "emirates_falcon_pending_sync"
    ];
    operationalStorageKeys.forEach((key) => localStorage.removeItem(key));

    const collectionsToPurge = [
      "owners", "properties", "units", "tenants", "leases", "cheques",
      "collections", "cases", "archive", "notifications", "auditLogs",
      "historicalRecords", "maintenance_requests", "technicians", "commissions",
      "payment_allocations", "financial_reversals", "financial_adjustments",
      "owner_transfers", "property_expenses", "collection_actions",
      "payment_promises", "lease_renewals", "deferred_payments",
      "journal_entries", "office_petty_cash_months", "office_petty_cash_expenses",
      "financial_periods", "period_certifications"
    ];

    try {
      for (const colName of collectionsToPurge) {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const docs = snap.docs;
          const batchSize = 400;
          for (let i = 0; i < docs.length; i += batchSize) {
            const chunk = docs.slice(i, i + batchSize);
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
      }
    } catch (e) {
      console.error("Error purging Firestore collections during resetDatabase:", e);
    }
  };

  // -------------------------------------------------------------
  // Maintenance Management Methods
  // -------------------------------------------------------------
  const generateMaintenanceRequestNumber = (): string => {
    return generateSequentialNumber(maintenanceRequests, "requestNumber", "MR-", 4, false);
  };

  const addMaintenanceRequest = (
    data: Omit<MaintenanceRequest, "id" | "requestNumber" | "createdAt" | "updatedAt" | "timeline" | "invoices" | "attachments" | "notes"> & {
      notes?: string[] | string;
      invoices?: MaintenanceInvoice[];
      attachments?: MaintenanceAttachment[];
    }
  ): MaintenanceRequest => {
    const id = "mr-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const requestNumber = generateMaintenanceRequestNumber();
    const createdAt = new Date().toISOString();
    const initialTimeline: MaintenanceTimelineEvent[] = [
      {
        id: "tl-" + Date.now() + "-1",
        eventType: "CREATED",
        titleAr: "إنشاء طلب الصيانة",
        titleEn: "Maintenance Request Created",
        details: data.issueDescription || "تم إنشاء طلب الصيانة بنجاح",
        timestamp: createdAt,
        userId: currentUser?.id || "sys",
        userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      },
    ];

    if (data.assignedTechnicianId) {
      initialTimeline.push({
        id: "tl-" + Date.now() + "-2",
        eventType: "TECHNICIAN_ASSIGNED",
        titleAr: "تعيين فني",
        titleEn: "Technician Assigned",
        details: `تم تعيين الفني: ${data.assignedTechnicianName || "فني معتمد"}`,
        timestamp: createdAt,
        userId: currentUser?.id || "sys",
        userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      });
    }

    const notesList: string[] = Array.isArray(data.notes)
      ? data.notes
      : (typeof data.notes === "string" && data.notes.trim())
      ? [data.notes.trim()]
      : [];

    const laborCost = data.laborCost || 0;
    const partsCost = data.partsCost || 0;
    const otherCost = data.otherCost || 0;
    const totalCost = data.totalCost || (laborCost + partsCost + otherCost);
    const paidAmount = data.paidAmount || 0;
    const remainingAmount = data.remainingAmount !== undefined ? data.remainingAmount : (totalCost - paidAmount);

    const newRequest: MaintenanceRequest = {
      ...data,
      id,
      requestNumber,
      createdAt,
      updatedAt: createdAt,
      timeline: initialTimeline,
      invoices: data.invoices || [],
      attachments: data.attachments || [],
      notes: notesList,
      costBearer: data.costBearer || "OWNER",
      status: data.status || (data.assignedTechnicianId ? "IN_PROGRESS" : "OPEN"),
      priority: data.priority || "NORMAL",
      category: data.category || "عام",
      laborCost,
      partsCost,
      otherCost,
      totalCost,
      paidAmount,
      remainingAmount,
    };

    setMaintenanceRequests((prev) => [newRequest, ...prev]);
    safeSetDoc(doc(db, "maintenance_requests", newRequest.id), newRequest);

    // Instant real-time notification & event dispatch for critical/urgent maintenance
    if (newRequest.priority === "URGENT" || (newRequest as any).isEmergency) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("urgent-maintenance-received", { detail: newRequest }));
      }
      const notif: NotificationRecord = {
        id: "notif-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
        channel: "SMS",
        recipient: "OPERATIONS_DESK",
        recipientName: "فريق العمليات والشاغر",
        tenantId: newRequest.tenantId || "SYSTEM",
        type: "MAINTENANCE_EMERGENCY_ALERT",
        status: "SENT",
        sentAt: createdAt,
        content: `⚠️ بلاغ صيانة حرج وطارئ: ${newRequest.requestNumber} - ${newRequest.propertyNameAr || newRequest.propertyNameEn || "عقار"} (وحدة ${newRequest.unitNumber || "عامة"}) - ${newRequest.issueDescription}`,
        attemptCount: 1,
        createdAt,
      };
      setNotifications((prev) => [notif, ...prev]);
      safeSetDoc(doc(db, "notifications", notif.id), notif);
    }

    logAudit(
      "CREATE",
      "MAINTENANCE_REQUEST",
      newRequest.id,
      `طلب صيانة ${newRequest.requestNumber}`,
      `تم إنشاء طلب صيانة جديد (${newRequest.requestNumber}) للوحدة ${newRequest.unitNumber || ""} بالعقار ${newRequest.propertyNameAr || newRequest.propertyNameEn || ""}`
    );

    return newRequest;
  };

  const updateMaintenanceRequest = (id: string, patch: Partial<MaintenanceRequest>) => {
    const existing = maintenanceRequests.find((m) => m.id === id);
    if (existing) {
      saveEntitySnapshot("MAINTENANCE", existing, "VERSION");
    }

    const updatedAt = new Date().toISOString();
    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = { ...m, ...patch, updatedAt };
          safeSetDoc(doc(db, "maintenance_requests", id), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    logAudit(
      "UPDATE",
      "MAINTENANCE_REQUEST",
      id,
      existing ? `طلب صيانة ${existing.requestNumber}` : id,
      `تم تحديث بيانات طلب الصيانة`
    );
  };

  const deleteMaintenanceRequest = (id: string, options?: DeleteRecordOptions) => {
    const request = maintenanceRequests.find((m) => m.id === id);
    if (!request) return;

    if (!options?.force) {
      const check = checkDeleteIntegrity("MAINTENANCE", id);
      if (!check.canDelete) {
        logAudit(
          "DELETE",
          "MAINTENANCE_REQUEST",
          id,
          request.requestNumber,
          `تم حظر حذف طلب الصيانة بسبب وجود متطلبات نشطة (${check.totalBlockersCount} معوقات)`
        );
        console.warn(`[Integrity Guard] Cannot delete Maintenance Request ${id}:`, check.blockers);
        return;
      }
    }

    // Save snapshot to historical records
    archiveEntityToHistory("MAINTENANCE", request, options);

    // Remove from state and Firestore
    setMaintenanceRequests((prev) => prev.filter((m) => m.id !== id));
    deleteDoc(doc(db, "maintenance_requests", id)).catch(() => {});

    // Delete any linked property expenses to restore/refund the paid amount to the corresponding payer's account dynamically
    const linkedExpenses = propertyExpenses.filter(
      (exp) => exp.sourceType === "MAINTENANCE_REQUEST" && exp.sourceId === id
    );

    if (linkedExpenses.length > 0) {
      linkedExpenses.forEach((exp) => {
        deleteDoc(doc(db, "property_expenses", exp.id)).catch((error) => {
          console.error(`Error deleting linked expense ${exp.id} on maintenance request deletion:`, error);
        });
      });

      setPropertyExpenses((prev) =>
        prev.filter((exp) => !(exp.sourceType === "MAINTENANCE_REQUEST" && exp.sourceId === id))
      );

      logAudit(
        "DELETE",
        "PROPERTY_EXPENSE",
        id,
        request.requestNumber,
        `تم تصفية وحذف عدد ${linkedExpenses.length} مصروفات عقارية مرتبطة بطلب الصيانة المفتوح/المكتمل لعمل استرداد للمبلغ`
      );
    }

    logAudit(
      "DELETE",
      "MAINTENANCE_REQUEST",
      id,
      request.requestNumber,
      `تم حذف طلب الصيانة #${request.requestNumber} ونقله إلى السجلات التاريخية`
    );
  };

  const updateMaintenanceStatus = (
    id: string,
    newStatus: MaintenanceStatus,
    notes?: string,
    completionDate?: string
  ) => {
    const existing = maintenanceRequests.find((m) => m.id === id);
    if (!existing) return;

    const timestamp = new Date().toISOString();
    const eventType = newStatus === "RETURNED" ? "RETURNED_TO_TENANT" : "STATUS_CHANGED";
    
    // Status translation helper for titles/notifications
    const getStatusLabelAr = (s: string) => {
      if (s === "OPEN") return "مفتوح";
      if (s === "IN_PROGRESS") return "قيد التنفيذ";
      if (s === "COMPLETED") return "مكتمل";
      if (s === "REJECTED") return "مرفوض";
      if (s === "CANCELLED") return "ملغي";
      if (s === "RETURNED") return "مرتجع للمستأجر";
      return s;
    };

    const getStatusLabelEn = (s: string) => {
      if (s === "OPEN") return "Open";
      if (s === "IN_PROGRESS") return "In Progress";
      if (s === "COMPLETED") return "Completed";
      if (s === "REJECTED") return "Rejected";
      if (s === "CANCELLED") return "Cancelled";
      if (s === "RETURNED") return "Returned to Tenant";
      return s;
    };

    const event: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      eventType: eventType,
      titleAr: `تغيير الحالة: ${getStatusLabelAr(newStatus)}`,
      titleEn: `Status Changed: ${getStatusLabelEn(newStatus)}`,
      details: notes || `تغيرت حالة الطلب إلى ${getStatusLabelAr(newStatus)}`,
      timestamp,
      userId: currentUser?.id || "sys",
      userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
    };

    const isCompleted = newStatus === "COMPLETED";
    const actualCompletion = isCompleted ? (completionDate || timestamp.split("T")[0]) : existing.completionDate;

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated: MaintenanceRequest = {
            ...m,
            status: newStatus,
            completionDate: actualCompletion,
            timeline: [...(m.timeline || []), event],
            updatedAt: timestamp,
          };
          safeSetDoc(doc(db, "maintenance_requests", id), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    // Send notification to tenant
    if (existing.tenantId) {
      const tenant = tenants.find(t => t.id === existing.tenantId);
      if (tenant) {
        addNotification({
          channel: "WHATSAPP",
          recipient: tenant.phone,
          recipientName: tenant.nameAr || tenant.nameEn,
          tenantId: tenant.id,
          status: "SENT",
          content: language === "ar" 
            ? `تحديث لطلب الصيانة #${existing.requestNumber}: تغيرت الحالة إلى ${getStatusLabelAr(newStatus)}. الملاحظات: ${notes || "لا توجد ملاحظات إضافية"}.` 
            : `Update for maintenance request #${existing.requestNumber}: Status changed to ${getStatusLabelEn(newStatus)}. Notes: ${notes || "No additional notes"}.`,
          attemptCount: 1,
          sentAt: timestamp,
        });
      }
    }

    // Automatically post financial expense if approved/completed
    if (["IN_PROGRESS", "COMPLETED"].includes(newStatus)) {
      setTimeout(() => {
        postMaintenanceExpense(id);
      }, 50);
    }

    logAudit(
      "MAINTENANCE_STATUS_CHANGE",
      "MAINTENANCE_REQUEST",
      id,
      `طلب صيانة ${existing.requestNumber}`,
      `تم تغيير حالة طلب الصيانة من ${existing.status} إلى ${newStatus}${notes ? ` - ملاحظات: ${notes}` : ""}`
    );
  };

  const postMaintenanceExpense = (
    requestId: string,
    options?: { overrideUser?: { id: string; name: string }; forceRepost?: boolean }
  ): {
    success: boolean;
    status: MaintenanceFinancialStatus;
    postedExpenses?: PropertyExpenseRecord[];
    error?: string;
    alreadyPosted?: boolean;
  } => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) {
      return { success: false, status: "NOT_POSTED", error: "طلب الصيانة غير موجود" };
    }

    // 1. Approval validation
    const validStatuses: MaintenanceStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED"];
    if (!validStatuses.includes(targetRequest.status)) {
      return {
        success: false,
        status: "NOT_POSTED",
        error: "طلب الصيانة غير معتمد بعد. يجب اعتماد الطلب أولاً لترحيل القيد المالي.",
      };
    }

    // 2. Calculate approved financial amount
    const invoiceTotal = (targetRequest.invoices || []).reduce(
      (sum, inv) => sum + (inv.totalAmount || inv.amount || 0),
      0
    );
    const invoiceVat = (targetRequest.invoices || []).reduce(
      (sum, inv) => sum + (inv.vatAmount || 0),
      0
    );
    const fallbackCost = targetRequest.totalCost > 0
      ? targetRequest.totalCost
      : (targetRequest.laborCost || 0) + (targetRequest.partsCost || 0) + (targetRequest.otherCost || 0);

    const totalFinancialCost = invoiceTotal > 0 ? invoiceTotal : fallbackCost;
    const totalVat = invoiceVat;

    if (totalFinancialCost <= 0) {
      setMaintenanceRequests((prev) =>
        prev.map((m) => (m.id === requestId ? { ...m, financialStatus: "REQUIRES_INVOICE" } : m))
      );
      safeSetDoc(doc(db, "maintenance_requests", requestId), { financialStatus: "REQUIRES_INVOICE" }, { merge: true });
      return {
        success: false,
        status: "REQUIRES_INVOICE",
        error: "يتطلب تحديد تكلفة الصيانة أو إضافة فاتورة صيانة معتمدة لترحيل القيد المالي.",
      };
    }

    // 3. Idempotency Check (Duplicate Protection)
    const existingPosted = propertyExpenses.filter(
      (e) =>
        e.sourceType === "MAINTENANCE_REQUEST" &&
        e.sourceId === requestId &&
        e.status !== "CANCELLED" &&
        e.status !== "REVERSED"
    );

    const existingTotal = existingPosted.reduce((sum, e) => sum + (e.totalAmount || 0), 0);

    if (existingPosted.length > 0 && Math.abs(existingTotal - totalFinancialCost) < 0.01 && !options?.forceRepost) {
      if (targetRequest.financialStatus !== "POSTED" && targetRequest.financialStatus !== "PARTIALLY_POSTED") {
        const currentFinStatus = targetRequest.costBearer === "SPLIT/CUSTOM" || (targetRequest.costBearer as any) === "SHARED" ? "PARTIALLY_POSTED" : "POSTED";
        setMaintenanceRequests((prev) =>
          prev.map((m) => (m.id === requestId ? { ...m, financialStatus: currentFinStatus, postedExpenseIds: existingPosted.map(e => e.id) } : m))
        );
        safeSetDoc(doc(db, "maintenance_requests", requestId), { financialStatus: currentFinStatus, postedExpenseIds: existingPosted.map(e => e.id) }, { merge: true });
      }
      return {
        success: true,
        status: targetRequest.financialStatus || "POSTED",
        alreadyPosted: true,
        postedExpenses: existingPosted,
        error: "تم ترحيل مصروف الصيانة مسبقاً ولا يمكن ترحيله مرة أخرى.",
      };
    }

    // 4. Reverse existing postings if cost/allocation changed
    if (existingPosted.length > 0) {
      const now = new Date().toISOString();
      const userId = options?.overrideUser?.id || currentUser?.id || "sys";
      const userName = options?.overrideUser?.name || currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

      existingPosted.forEach((oldExp) => {
        const revId = `rev-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
        const revRecord: FinancialReversalRecord = {
          id: revId,
          reversalNumber: `REV-MNT-${Date.now().toString().slice(-6)}`,
          targetType: "EXPENSE",
          targetId: oldExp.id,
          originalAmount: oldExp.totalAmount,
          reversedAmount: oldExp.totalAmount,
          reason: `تعديل/إعادة ترحيل قيد مصروفات صيانة لطلب #${targetRequest.requestNumber}`,
          reversalDate: now.slice(0, 10),
          reversalTimestamp: now,
          performedByUserId: userId,
          performedByUserName: userName,
          createdAt: now,
        };
        setFinancialReversals((prev) => [revRecord, ...prev]);
        safeSetDoc(doc(db, "financial_reversals", revId), revRecord);

        const updatedOld = { ...oldExp, status: "REVERSED" as const, updatedAt: now };
        setPropertyExpenses((prev) => prev.map((p) => (p.id === oldExp.id ? updatedOld : p)));
        safeSetDoc(doc(db, "property_expenses", oldExp.id), updatedOld);
      });
    }

    // 5. Generate Authoritative Property Expense Records
    const prop = properties.find((p) => p.id === targetRequest.propertyId);
    const ownerId = targetRequest.ownerId || prop?.ownerId || "";
    const bearer = targetRequest.costBearer || "OWNER";
    const userId = options?.overrideUser?.id || currentUser?.id || "sys";
    const userName = options?.overrideUser?.name || currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";
    const now = new Date().toISOString();

    const generatedExpenses: PropertyExpenseRecord[] = [];

    if (bearer === "SPLIT/CUSTOM" || (bearer as any) === "SPLIT" || (bearer as any) === "CUSTOM") {
      const method = targetRequest.splitMethod || "PERCENTAGE";
      const ownerVal = targetRequest.splitOwnerVal ?? 0;
      const tenantVal = targetRequest.splitTenantVal ?? 0;
      const officeVal = targetRequest.splitOfficeVal ?? 0;

      let ownerAmt = 0;
      let tenantAmt = 0;
      let officeAmt = 0;

      if (method === "PERCENTAGE") {
        ownerAmt = Math.round((totalFinancialCost * (ownerVal / 100)) * 100) / 100;
        tenantAmt = Math.round((totalFinancialCost * (tenantVal / 100)) * 100) / 100;
        officeAmt = Math.round((totalFinancialCost - ownerAmt - tenantAmt) * 100) / 100;
      } else {
        ownerAmt = ownerVal;
        tenantAmt = tenantVal;
        officeAmt = officeVal;
      }

      const ownerVat = totalFinancialCost > 0 ? Math.round(((totalVat) * (ownerAmt / totalFinancialCost)) * 100) / 100 : 0;
      const tenantVat = totalFinancialCost > 0 ? Math.round(((totalVat) * (tenantAmt / totalFinancialCost)) * 100) / 100 : 0;
      const officeVat = totalVat - ownerVat - tenantVat;

      if (ownerAmt > 0) {
        generatedExpenses.push(createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: `${targetRequest.requestNumber}-OWN`,
          ownerId,
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          amount: ownerAmt - ownerVat,
          vatAmount: ownerVat,
          costBearer: "OWNER",
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - حصة المالك لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        }));
      }

      if (tenantAmt > 0) {
        generatedExpenses.push(createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: `${targetRequest.requestNumber}-TNT`,
          ownerId: "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          tenantId: targetRequest.tenantId,
          amount: tenantAmt - tenantVat,
          vatAmount: tenantVat,
          costBearer: "TENANT",
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - حصة المستأجر لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        }));
      }

      if (officeAmt > 0) {
        generatedExpenses.push(createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: `${targetRequest.requestNumber}-OFF`,
          ownerId: "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          amount: officeAmt - officeVat,
          vatAmount: officeVat,
          costBearer: "OFFICE",
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - حصة المكتب لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        }));
      }
    } else if ((bearer as any) === "SHARED") {
      const ownerAmt = Math.round((totalFinancialCost / 2) * 100) / 100;
      const tenantAmt = totalFinancialCost - ownerAmt;
      const ownerVat = Math.round((totalVat / 2) * 100) / 100;
      const tenantVat = totalVat - ownerVat;

      generatedExpenses.push(
        createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: `${targetRequest.requestNumber}-OWN`,
          ownerId,
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          amount: ownerAmt - ownerVat,
          vatAmount: ownerVat,
          costBearer: "OWNER",
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة (50%) - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - طلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        }),
        createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: `${targetRequest.requestNumber}-TNT`,
          ownerId: "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          tenantId: targetRequest.tenantId,
          amount: tenantAmt - tenantVat,
          vatAmount: tenantVat,
          costBearer: "TENANT",
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة (50%) - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - طلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        })
      );
    } else {
      // Single cost bearer (OWNER, TENANT, OFFICE)
      const baseAmount = totalFinancialCost - totalVat;
      generatedExpenses.push(
        createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: targetRequest.invoices?.[0]?.id || `inv-${requestId}`,
          invoiceNumber: targetRequest.invoices?.[0]?.invoiceNumber || targetRequest.requestNumber,
          ownerId: bearer === "OWNER" ? ownerId : "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          tenantId: bearer === "TENANT" ? targetRequest.tenantId : undefined,
          amount: baseAmount,
          vatAmount: totalVat,
          costBearer: bearer as any,
          vendorName: targetRequest.assignedTechnicianName || "شركة الصيانة",
          description: `مصروف صيانة - إصلاحات الوحدة ${targetRequest.unitNumber || ''} - طلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: targetRequest.paymentMethod || "BANK_TRANSFER",
          userId,
          userName,
        })
      );
    }

    // Save to state and Firestore
    generatedExpenses.forEach((exp) => {
      setPropertyExpenses((prev) => [exp, ...prev]);
      safeSetDoc(doc(db, "property_expenses", exp.id), exp);
    });

    const postedIds = generatedExpenses.map((e) => e.id);
    const newFinStatus: MaintenanceFinancialStatus =
      bearer === "SPLIT/CUSTOM" || (bearer as any) === "SPLIT" || (bearer as any) === "CUSTOM" || (bearer as any) === "SHARED"
        ? "PARTIALLY_POSTED"
        : "POSTED";

    const timelineEvent: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-post",
      eventType: "STATUS_CHANGED",
      titleAr: "ترحيل القيد المالي للصيانة",
      titleEn: "Maintenance Financial Posting",
      details: `تم ترحيل مصروف الصيانة بقيمة AED ${totalFinancialCost.toLocaleString()} لحساب ${bearer} (${postedIds.join(", ")})`,
      timestamp: now,
      userId,
      userName,
    };

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated: MaintenanceRequest = {
            ...m,
            financialStatus: newFinStatus,
            postedExpenseIds: postedIds,
            postedAt: now,
            postedByUserId: userId,
            postedByUserName: userName,
            timeline: [...(m.timeline || []), timelineEvent],
            updatedAt: now,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    logAudit(
      "MAINTENANCE_EXPENSE_POSTED",
      "MAINTENANCE_REQUEST",
      requestId,
      `طلب صيانة ${targetRequest.requestNumber}`,
      `تم ترحيل قيد مصروفات الصيانة بمبلغ AED ${totalFinancialCost.toLocaleString()} لصالح (${bearer}) - سجلات المصروفات: ${postedIds.join(", ")}`
    );

    return {
      success: true,
      status: newFinStatus,
      postedExpenses: generatedExpenses,
    };
  };

  const assignTechnicianToRequest = (requestId: string, technicianId: string, notes?: string) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    const tech = technicians.find((t) => t.id === technicianId);
    if (!targetRequest) return;

    const timestamp = new Date().toISOString();
    const techName = tech?.name || "فني معتمد";
    const techPhone = tech?.phone || "";

    const event: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      eventType: "TECHNICIAN_ASSIGNED",
      titleAr: "تعيين فني",
      titleEn: "Technician Assigned",
      details: notes || `تم تعيين الفني: ${techName} (${techPhone})`,
      timestamp,
      userId: currentUser?.id || "sys",
      userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
    };

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated: MaintenanceRequest = {
            ...m,
            assignedTechnicianId: technicianId,
            assignedTechnicianName: techName,
            assignedTechnicianPhone: techPhone,
            assignedTechnicianCompany: tech?.company,
            assignedAt: timestamp,
            status: m.status === "OPEN" ? "IN_PROGRESS" : m.status,
            timeline: [...(m.timeline || []), event],
            updatedAt: timestamp,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    // Send notification to tenant
    if (targetRequest.tenantId) {
      const tenant = tenants.find(t => t.id === targetRequest.tenantId);
      if (tenant) {
        addNotification({
          channel: "WHATSAPP",
          recipient: tenant.phone,
          recipientName: tenant.nameAr || tenant.nameEn,
          tenantId: tenant.id,
          status: "SENT",
          content: language === "ar"
            ? `تحديث لطلب الصيانة #${targetRequest.requestNumber}: تم تعيين الفني ${techName} (${techPhone}) للمتابعة.`
            : `Update for maintenance request #${targetRequest.requestNumber}: Technician ${techName} (${techPhone}) has been assigned to your request.`,
          attemptCount: 1,
          sentAt: timestamp,
        });
      }
    }

    logAudit(
      "TECHNICIAN_ASSIGNED",
      "MAINTENANCE_REQUEST",
      requestId,
      `طلب صيانة ${targetRequest.requestNumber}`,
      `تم تعيين الفني ${techName} لمتابعة الطلب`
    );
  };

  const addMaintenanceInvoice = (
    requestId: string,
    invoiceData: Omit<MaintenanceInvoice, "id" | "createdAt" | "maintenanceRequestId">
  ) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return;

    const invoiceId = "inv-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const createdAt = new Date().toISOString();
    const newInvoice: MaintenanceInvoice = {
      ...invoiceData,
      id: invoiceId,
      maintenanceRequestId: requestId,
      createdAt,
    };

    // Duplicate Posting Protection
    const isDuplicate = propertyExpenses.some(
      (exp) =>
        exp.sourceType === "MAINTENANCE_REQUEST" &&
        exp.sourceId === requestId &&
        exp.status !== "CANCELLED" &&
        exp.status !== "REVERSED" &&
        (exp.vendorInvoiceNumber === newInvoice.invoiceNumber || exp.maintenanceInvoiceId === invoiceId)
    );

    if (isDuplicate) {
      logAudit(
        "PROPERTY_EXPENSE_CREATED",
        "MAINTENANCE_REQUEST",
        requestId,
        `طلب صيانة ${targetRequest.requestNumber}`,
        `تم رفض الترحيل: محاولة تكرار ترحيل مالي لنفس الفاتورة ${newInvoice.invoiceNumber}`
      );
      return;
    }

    const updatedInvoices = [...(targetRequest.invoices || []), newInvoice];
    const totalActualCost = updatedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

    const event: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-inv",
      eventType: "INVOICE_ADDED",
      titleAr: "إضافة فاتورة صيانة",
      titleEn: "Maintenance Invoice Added",
      details: `تم إضافة فاتورة صيانة رقم ${newInvoice.invoiceNumber} بقيمة AED ${(newInvoice.totalAmount || newInvoice.amount).toLocaleString()}`,
      timestamp: createdAt,
      userId: currentUser?.id || "sys",
      userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
    };

    // Auto post Property Expenses depending on Cost Bearer
    const prop = properties.find((p) => p.id === targetRequest.propertyId);
    const ownerId = targetRequest.ownerId || prop?.ownerId || "";
    const bearer = targetRequest.costBearer || "OWNER";

    const generatedExpenses: PropertyExpenseRecord[] = [];

    if (bearer === "SPLIT/CUSTOM") {
      const method = targetRequest.splitMethod || "PERCENTAGE";
      const ownerVal = targetRequest.splitOwnerVal ?? 0;
      const tenantVal = targetRequest.splitTenantVal ?? 0;
      const officeVal = targetRequest.splitOfficeVal ?? 0;

      // Validate Allocations
      if (ownerVal < 0 || tenantVal < 0 || officeVal < 0) {
        logAudit(
          "PROPERTY_EXPENSE_CREATED",
          "MAINTENANCE_REQUEST",
          requestId,
          `طلب صيانة ${targetRequest.requestNumber}`,
          `فشل الترحيل: قيم التقسيم سلبية مرفوضة`
        );
        return;
      }

      let ownerAmt = 0;
      let tenantAmt = 0;
      let officeAmt = 0;

      if (method === "PERCENTAGE") {
        const totalPct = ownerVal + tenantVal + officeVal;
        if (totalPct !== 100) {
          logAudit(
            "PROPERTY_EXPENSE_CREATED",
            "MAINTENANCE_REQUEST",
            requestId,
            `طلب صيانة ${targetRequest.requestNumber}`,
            `فشل الترحيل: مجموع النسب المئوية للتقسيم (${totalPct}%) لا يساوي 100%`
          );
          return;
        }

        ownerAmt = Math.round((newInvoice.amount * (ownerVal / 100)) * 100) / 100;
        tenantAmt = Math.round((newInvoice.amount * (tenantVal / 100)) * 100) / 100;
        officeAmt = Math.round((newInvoice.amount - ownerAmt - tenantAmt) * 100) / 100;
      } else {
        // FIXED amounts
        const totalFixed = ownerVal + tenantVal + officeVal;
        if (Math.abs(totalFixed - newInvoice.amount) > 0.02) {
          logAudit(
            "PROPERTY_EXPENSE_CREATED",
            "MAINTENANCE_REQUEST",
            requestId,
            `طلب صيانة ${targetRequest.requestNumber}`,
            `فشل الترحيل: مجموع مبالغ التقسيم (${totalFixed} AED) لا يتطابق مع قيمة الفاتورة (${newInvoice.amount} AED)`
          );
          return;
        }
        ownerAmt = ownerVal;
        tenantAmt = tenantVal;
        officeAmt = officeVal;
      }

      // Proportional VAT calculation
      const ownerVat = Math.round(((newInvoice.vatAmount || 0) * (ownerAmt / (newInvoice.amount || 1))) * 100) / 100;
      const tenantVat = Math.round(((newInvoice.vatAmount || 0) * (tenantAmt / (newInvoice.amount || 1))) * 100) / 100;
      const officeVat = Math.round(((newInvoice.vatAmount || 0) - ownerVat - tenantVat) * 100) / 100;

      // Post only non-zero values
      if (ownerAmt > 0) {
        const ownerExpense = createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: invoiceId,
          invoiceNumber: `${newInvoice.invoiceNumber}-OWN`,
          ownerId,
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          amount: ownerAmt,
          vatAmount: ownerVat,
          costBearer: "OWNER",
          vendorName: newInvoice.vendorName,
          description: `فاتورة صيانة #${newInvoice.invoiceNumber} - حصة المالك لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: newInvoice.paymentMethod || "CASH",
          userId: currentUser?.id || "sys",
          userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
        });
        generatedExpenses.push(ownerExpense);
      }

      if (tenantAmt > 0) {
        const tenantExpense = createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: invoiceId,
          invoiceNumber: `${newInvoice.invoiceNumber}-TNT`,
          ownerId: "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          tenantId: targetRequest.tenantId,
          amount: tenantAmt,
          vatAmount: tenantVat,
          costBearer: "TENANT",
          vendorName: newInvoice.vendorName,
          description: `فاتورة صيانة #${newInvoice.invoiceNumber} - حصة المستأجر لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: newInvoice.paymentMethod || "CASH",
          userId: currentUser?.id || "sys",
          userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
        });
        generatedExpenses.push(tenantExpense);
      }

      if (officeAmt > 0) {
        const officeExpense = createExpenseFromMaintenance({
          maintenanceRequestId: requestId,
          requestNumber: targetRequest.requestNumber,
          invoiceId: invoiceId,
          invoiceNumber: `${newInvoice.invoiceNumber}-OFF`,
          ownerId: "",
          propertyId: targetRequest.propertyId,
          unitId: targetRequest.unitId,
          amount: officeAmt,
          vatAmount: officeVat,
          costBearer: "OFFICE",
          vendorName: newInvoice.vendorName,
          description: `فاتورة صيانة #${newInvoice.invoiceNumber} - حصة المكتب لطلب صيانة #${targetRequest.requestNumber}`,
          paymentMethod: newInvoice.paymentMethod || "CASH",
          userId: currentUser?.id || "sys",
          userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
        });
        generatedExpenses.push(officeExpense);
      }
    } else if ((bearer as any) === "SHARED") {
      // Split 50/50 between Owner and Tenant
      const ownerAmt = Math.round((newInvoice.amount / 2) * 100) / 100;
      const ownerVat = Math.round(((newInvoice.vatAmount || 0) / 2) * 100) / 100;
      const tenantAmt = Math.round((newInvoice.amount - ownerAmt) * 100) / 100;
      const tenantVat = Math.round(((newInvoice.vatAmount || 0) - ownerVat) * 100) / 100;

      const ownerExpense = createExpenseFromMaintenance({
        maintenanceRequestId: requestId,
        requestNumber: targetRequest.requestNumber,
        invoiceId: invoiceId,
        invoiceNumber: `${newInvoice.invoiceNumber}-OWN`,
        ownerId,
        propertyId: targetRequest.propertyId,
        unitId: targetRequest.unitId,
        amount: ownerAmt,
        vatAmount: ownerVat,
        costBearer: "OWNER",
        vendorName: newInvoice.vendorName,
        description: `فاتورة صيانة #${newInvoice.invoiceNumber} - حصة المالك (50%) لطلب صيانة #${targetRequest.requestNumber}`,
        paymentMethod: newInvoice.paymentMethod || "CASH",
        userId: currentUser?.id || "sys",
        userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      });

      const tenantExpense = createExpenseFromMaintenance({
        maintenanceRequestId: requestId,
        requestNumber: targetRequest.requestNumber,
        invoiceId: invoiceId,
        invoiceNumber: `${newInvoice.invoiceNumber}-TNT`,
        ownerId: "",
        propertyId: targetRequest.propertyId,
        unitId: targetRequest.unitId,
        tenantId: targetRequest.tenantId,
        amount: tenantAmt,
        vatAmount: tenantVat,
        costBearer: "TENANT",
        vendorName: newInvoice.vendorName,
        description: `فاتورة صيانة #${newInvoice.invoiceNumber} - حصة المستأجر (50%) لطلب صيانة #${targetRequest.requestNumber}`,
        paymentMethod: newInvoice.paymentMethod || "CASH",
        userId: currentUser?.id || "sys",
        userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      });

      generatedExpenses.push(ownerExpense, tenantExpense);
    } else {
      // Single cost bearer
      const singleExpense = createExpenseFromMaintenance({
        maintenanceRequestId: requestId,
        requestNumber: targetRequest.requestNumber,
        invoiceId: invoiceId,
        invoiceNumber: newInvoice.invoiceNumber,
        ownerId: bearer === "OWNER" ? ownerId : "",
        propertyId: targetRequest.propertyId,
        unitId: targetRequest.unitId,
        tenantId: bearer === "TENANT" ? targetRequest.tenantId : undefined,
        amount: newInvoice.amount,
        vatAmount: newInvoice.vatAmount || 0,
        costBearer: bearer as any,
        vendorName: newInvoice.vendorName,
        description: `فاتورة صيانة #${newInvoice.invoiceNumber} لطلب صيانة #${targetRequest.requestNumber}`,
        paymentMethod: newInvoice.paymentMethod || "CASH",
        userId: currentUser?.id || "sys",
        userName: currentUser?.nameAr || currentUser?.nameEn || "مدير النظام",
      });

      generatedExpenses.push(singleExpense);
    }

    // Write all generated expenses to local state and Firestore
    generatedExpenses.forEach((exp) => {
      setPropertyExpenses((prev) => [exp, ...prev]);
      safeSetDoc(doc(db, "property_expenses", exp.id), exp);
    });

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated: MaintenanceRequest = {
            ...m,
            invoices: updatedInvoices,
            totalCost: totalActualCost,
            remainingAmount: Math.max(0, totalActualCost - m.paidAmount),
            timeline: [...(m.timeline || []), event],
            updatedAt: createdAt,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    logAudit(
      "INVOICE_CREATED",
      "MAINTENANCE_INVOICE",
      newInvoice.id,
      `فاتورة صيانة ${newInvoice.invoiceNumber}`,
      `تم إصدار فاتورة صيانة بمبلغ AED ${newInvoice.totalAmount || newInvoice.amount} لطلب الصيانة #${targetRequest.requestNumber} وتم ترحيل المصاريف تلقائياً (${bearer})`
    );
  };

  const addMaintenancePayment = (
    requestId: string,
    paymentData: Omit<MaintenancePayment, "id" | "createdAt" | "receivedByUserId" | "receivedByUserName">
  ) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return;

    const paymentId = "pmt-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const createdAt = new Date().toISOString();
    
    const newPayment: MaintenancePayment = {
      ...paymentData,
      id: paymentId,
      receivedByUserId: currentUser?.id || "sys",
      receivedByUserName: currentUser?.nameAr || currentUser?.nameEn || "النظام",
      createdAt,
    };

    const currentPayments = targetRequest.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    
    // Calculate new totals
    const totalCost = targetRequest.totalCost > 0 
      ? targetRequest.totalCost 
      : (targetRequest.laborCost || 0) + (targetRequest.partsCost || 0) + (targetRequest.otherCost || 0);
      
    const oldPaid = targetRequest.paidAmount || 0;
    const newPaidAmount = oldPaid + newPayment.amount;
    const newRemainingAmount = Math.max(0, totalCost - newPaidAmount);
    
    let collectionStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
    if (newPaidAmount >= totalCost && totalCost > 0) {
      collectionStatus = "PAID";
    } else if (newPaidAmount > 0) {
      collectionStatus = "PARTIALLY_PAID";
    }

    const updatedRequest = {
      ...targetRequest,
      payments: updatedPayments,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      collectionStatus: collectionStatus
    };

    setMaintenanceRequests((prev) =>
      prev.map((m) => (m.id === requestId ? updatedRequest : m))
    );
    safeSetDoc(doc(db, "maintenance_requests", requestId), updatedRequest, { merge: true });

    logAudit(
      "UPDATE",
      "MAINTENANCE_REQUEST",
      requestId,
      targetRequest.requestNumber,
      `تم تسجيل دفعة مالية بمبلغ ${newPayment.amount} للصيانة. المبلغ المتبقي: ${newRemainingAmount}`
    );
  };

  const updateMaintenanceInvoice = (
    requestId: string,
    invoiceId: string,
    patch: Partial<MaintenanceInvoice>,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return { success: false, error: "طلب الصيانة غير موجود" };

    const targetInvoice = targetRequest.invoices?.find((i) => i.id === invoiceId);
    if (!targetInvoice) return { success: false, error: "الفاتورة غير موجودة" };

    const check = checkFinancialEditPermission("MAINTENANCE_INVOICE", modificationReason);
    if (!check.allowed) return { success: false, error: check.error };

    saveEntitySnapshot("MAINTENANCE_INVOICE", targetInvoice, "VERSION");

    const updatedInvoices = (targetRequest.invoices || []).map((inv) =>
      inv.id === invoiceId ? { ...inv, ...patch } : inv
    );
    const totalActualCost = updatedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
    const updatedAt = new Date().toISOString();

    const updatedRequest = {
      ...targetRequest,
      invoices: updatedInvoices,
      totalCost: totalActualCost,
      remainingAmount: Math.max(0, totalActualCost - targetRequest.paidAmount),
      updatedAt,
    };

    setMaintenanceRequests((prev) => prev.map((m) => (m.id === requestId ? updatedRequest : m)));
    safeSetDoc(doc(db, "maintenance_requests", requestId), updatedRequest, { merge: true });

    logAudit(
      "FINANCIAL_RECORD_EDIT",
      "MAINTENANCE_INVOICE",
      invoiceId,
      `فاتورة ${invoiceId}`,
      `تم تعديل بيانات فاتورة الصيانة لطلب #${targetRequest.requestNumber}`,
      JSON.stringify(targetInvoice),
      JSON.stringify(updatedInvoices.find((i) => i.id === invoiceId)),
      modificationReason
    );

    return { success: true };
  };

  const deleteMaintenanceInvoice = (requestId: string, invoiceId: string) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return;

    const updatedInvoices = (targetRequest.invoices || []).filter((inv) => inv.id !== invoiceId);
    const totalActualCost = updatedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
    const updatedAt = new Date().toISOString();

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated = {
            ...m,
            invoices: updatedInvoices,
            totalCost: totalActualCost,
            remainingAmount: Math.max(0, totalActualCost - m.paidAmount),
            updatedAt,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    // Delete linked property expenses since the invoice was deleted
    const linkedExpenses = propertyExpenses.filter(
      (exp) => exp.sourceType === "MAINTENANCE_REQUEST" && exp.sourceId === requestId
    );
    if (linkedExpenses.length > 0) {
      linkedExpenses.forEach((exp) => {
        deleteDoc(doc(db, "property_expenses", exp.id)).catch(() => {});
      });
      setPropertyExpenses((prev) =>
        prev.filter((exp) => !(exp.sourceType === "MAINTENANCE_REQUEST" && exp.sourceId === requestId))
      );
    }

    // If there are other invoices remaining, re-post the financial expense so it gets calculated with the new total
    if (updatedInvoices.length > 0 && totalActualCost > 0) {
      setTimeout(() => {
        postMaintenanceExpense(requestId);
      }, 100);
    } else {
      // If no invoices remain, make sure we update the financial status to REQUIRES_INVOICE
      setMaintenanceRequests((prev) =>
        prev.map((m) => (m.id === requestId ? { ...m, financialStatus: "REQUIRES_INVOICE" as const } : m))
      );
      safeSetDoc(doc(db, "maintenance_requests", requestId), { financialStatus: "REQUIRES_INVOICE" }, { merge: true });
    }

    logAudit(
      "DELETE",
      "MAINTENANCE_INVOICE",
      invoiceId,
      `طلب #${targetRequest.requestNumber}`,
      `تم حذف فاتورة صيانة من طلب #${targetRequest.requestNumber} وتصفية المصاريف المرتبطة`
    );
  };

  const addMaintenanceAttachment = async (
    requestId: string,
    attachmentData: Omit<MaintenanceAttachment, "id" | "uploadedAt" | "uploadedBy" | "maintenanceRequestId">
  ): Promise<{ success: boolean; attachment?: MaintenanceAttachment; driveLink?: string; error?: string }> => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return { success: false, error: "Maintenance request not found" };

    const attachmentId = "att-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const uploadedAt = new Date().toISOString();
    const uploadedBy = currentUser?.nameAr || currentUser?.nameEn || "مدير النظام";

    let archiveItem: ElectronicArchiveItem | undefined;

    if (attachmentData.fileUrl) {
      archiveItem = await uploadAndArchiveDocument(attachmentData.fileUrl, {
        category: "MAINTENANCE",
        entityType: "MAINTENANCE",
        entityId: requestId,
        fileName: attachmentData.fileName || `attachment_${Date.now()}`,
        mimeType: attachmentData.fileType || "application/octet-stream",
        description: attachmentData.notes,
        tags: [attachmentData.category || "ISSUE_PHOTO"],
        uploadedByUserId: currentUser?.id,
        uploadedByName: uploadedBy
      });
    }

    const newAttachment: MaintenanceAttachment = {
      ...attachmentData,
      id: attachmentId,
      maintenanceRequestId: requestId,
      uploadedAt,
      uploadedBy,
      category: attachmentData.category || "ISSUE_PHOTO",
      driveFileId: archiveItem?.driveFileId,
      driveWebViewLink: archiveItem?.driveWebViewLink,
      fileUrl: archiveItem ? "" : attachmentData.fileUrl, // Binary stripped
    };

    const updatedAttachments = [...(targetRequest.attachments || []), newAttachment];

    const timelineEvent: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-att",
      eventType: "ATTACHMENT_ADDED",
      titleAr: "إرفاق مستند/صورة",
      titleEn: "Attachment Added",
      details: `تم إرفاق: ${newAttachment.fileName} (${newAttachment.category})`,
      timestamp: uploadedAt,
      userId: currentUser?.id || "sys",
      userName: uploadedBy,
    };

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated = {
            ...m,
            attachments: updatedAttachments,
            timeline: [...(m.timeline || []), timelineEvent],
            updatedAt: uploadedAt,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    // Register in electronic archive as MAINTENANCE category
    addArchiveItem({
      fileName: newAttachment.fileName,
      category: "MAINTENANCE",
      recordId: requestId,
      recordTitle: `صيانة #${targetRequest.requestNumber} - ${newAttachment.fileName}`,
      fileType: newAttachment.fileType || "image/jpeg",
      fileSize: newAttachment.fileSize || 500000,
      isPrivate: false,
      storagePath: `/secure/maintenance/${requestId}/${newAttachment.fileName}`,
      uploadedByUserId: currentUser?.id || "sys",
      uploadedByName: uploadedBy,
      previewUrl: newAttachment.fileUrl,
      tags: ["صيانة", targetRequest.requestNumber, targetRequest.category, newAttachment.category],
      driveFileId: archiveItem?.driveFileId,
      driveWebViewLink: archiveItem?.driveWebViewLink,
      driveSyncedAt: archiveItem?.driveFileId ? new Date().toISOString() : undefined,
    });

    logAudit(
      "DOCUMENT_UPLOAD",
      "DOCUMENT",
      requestId,
      `مرفق ${newAttachment.fileName}`,
      `تم إرفاق مستند/صورة صيانة لطلب #${targetRequest.requestNumber}`
    );

    return { success: true, attachment: newAttachment, driveLink: archiveItem?.driveWebViewLink };
  };

  const deleteMaintenanceAttachment = (requestId: string, attachmentId: string) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest) return;

    const updatedAttachments = (targetRequest.attachments || []).filter((a) => a.id !== attachmentId);
    const updatedAt = new Date().toISOString();

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated = {
            ...m,
            attachments: updatedAttachments,
            updatedAt,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    logAudit(
      "UPDATE",
      "MAINTENANCE_REQUEST",
      requestId,
      `طلب #${targetRequest.requestNumber}`,
      `تم إزالة مرفق من طلب الصيانة`
    );
  };

  const addMaintenanceNote = (requestId: string, noteText: string) => {
    const targetRequest = maintenanceRequests.find((m) => m.id === requestId);
    if (!targetRequest || !noteText.trim()) return;

    const timestamp = new Date().toISOString();
    const authorName = currentUser?.nameAr || currentUser?.nameEn || "النظام";
    const formattedNote = `[${timestamp.substring(0, 16).replace("T", " ")} - ${authorName}]: ${noteText.trim()}`;
    const updatedNotes = [...(targetRequest.notes || []), formattedNote];

    const event: MaintenanceTimelineEvent = {
      id: "tl-" + Date.now() + "-note",
      eventType: "NOTE_ADDED",
      titleAr: "إضافة ملاحظة",
      titleEn: "Note Added",
      details: noteText.trim(),
      timestamp,
      userId: currentUser?.id || "sys",
      userName: authorName,
    };

    setMaintenanceRequests((prev) =>
      prev.map((m) => {
        if (m.id === requestId) {
          const updated = {
            ...m,
            notes: updatedNotes,
            timeline: [...(m.timeline || []), event],
            updatedAt: timestamp,
          };
          safeSetDoc(doc(db, "maintenance_requests", requestId), updated, { merge: true });
          return updated;
        }
        return m;
      })
    );

    logAudit(
      "UPDATE",
      "MAINTENANCE_REQUEST",
      requestId,
      `طلب #${targetRequest.requestNumber}`,
      `إضافة ملاحظة على طلب الصيانة: ${noteText.trim()}`
    );

    // Send notification to tenant
    if (targetRequest.tenantId) {
      const tenant = tenants.find(t => t.id === targetRequest.tenantId);
      if (tenant) {
        addNotification({
          channel: "WHATSAPP",
          recipient: tenant.phone,
          recipientName: tenant.nameAr || tenant.nameEn,
          tenantId: tenant.id,
          status: "SENT",
          content: language === "ar"
            ? `ملاحظة جديدة على طلب الصيانة #${targetRequest.requestNumber}: ${noteText.trim()}`
            : `New note on maintenance request #${targetRequest.requestNumber}: ${noteText.trim()}`,
          attemptCount: 1,
          sentAt: timestamp,
        });
      }
    }
  };

  const addNotification = (data: Omit<NotificationRecord, "id" | "createdAt">): NotificationRecord => {
    const newNotification: NotificationRecord = {
      ...data,
      id: "notif-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
    safeSetDoc(doc(db, "notifications", newNotification.id), newNotification);
    return newNotification;
  };

  const addTechnician = (data: Omit<Technician, "id" | "createdAt">): Technician => {
    const id = "tech-" + Date.now() + "-" + crypto.randomUUID().split("-")[0];
    const createdAt = new Date().toISOString();
    const newTech: Technician = {
      ...data,
      id,
      createdAt,
      serviceType: data.serviceType || "عام",
      status: data.status || "ACTIVE",
    };

    setTechnicians((prev) => [newTech, ...prev]);
    safeSetDoc(doc(db, "technicians", newTech.id), newTech);

    logAudit(
      "CREATE",
      "TECHNICIAN",
      newTech.id,
      newTech.name,
      `تم تسجيل فني صيانة جديد: ${newTech.name} (${newTech.serviceType})`
    );

    return newTech;
  };

  const updateTechnician = (id: string, patch: Partial<Technician>) => {
    setTechnicians((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...patch };
          safeSetDoc(doc(db, "technicians", id), updated, { merge: true });
          return updated;
        }
        return t;
      })
    );

    logAudit("UPDATE", "TECHNICIAN", id, "Technician", `تم تعديل بيانات الفني`);
  };

  const deleteTechnician = (id: string) => {
    const tech = technicians.find((t) => t.id === id);
    if (!tech) return;

    setTechnicians((prev) => prev.filter((t) => t.id !== id));
    deleteDoc(doc(db, "technicians", id)).catch(() => {});

    logAudit("DELETE", "TECHNICIAN", id, tech.name, `تم حذف سجل الفني: ${tech.name}`);
  };

  const updateMaintenanceSettings = (settings: Partial<MaintenanceSettings>) => {
    setMaintenanceSettings((prev) => {
      const updated = { ...prev, ...settings };
      safeSaveToStorage("ef_maintenance_settings_v12", updated);
      return updated;
    });
    logAudit("UPDATE", "RISK_CONFIG", "maint-settings", "Maintenance Settings", `تم تحديث إعدادات نظام الصيانة`);
  };

  const updateLegalSettings = (settings: Partial<LegalSettings>) => {
    setLegalSettings((prev) => {
      const updated = { ...prev, ...settings };
      safeSaveToStorage("ef_legal_settings_v12", updated);
      return updated;
    });
    logAudit("UPDATE", "RISK_CONFIG", "legal-settings", "Legal Settings", `تم تحديث إعدادات نظام الدعاوى والرسوم`);
  };

  const exportDatabaseJSON = (): string => {
    const data = {
      owners,
      properties,
      units,
      tenants,
      leases,
      cheques,
      collections,
      cases,
      maintenanceRequests,
      technicians,
      maintenanceSettings,
      archive,
      notifications,
      riskConfig,
      auditLogs,
      historicalRecords,
      companyProfile,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  };

  const importDatabaseJSON = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.owners) setOwners(parsed.owners);
      if (parsed.properties) setProperties(parsed.properties);
      if (parsed.units) setUnits(parsed.units);
      if (parsed.tenants) setTenants(parsed.tenants);
      if (parsed.leases) setLeases(parsed.leases);
      if (parsed.cheques) setCheques(parsed.cheques);
      if (parsed.collections) setCollections(parsed.collections);
      if (parsed.cases) setCases(parsed.cases);
      if (parsed.maintenanceRequests) setMaintenanceRequests(parsed.maintenanceRequests);
      if (parsed.technicians) setTechnicians(parsed.technicians);
      if (parsed.maintenanceSettings) setMaintenanceSettings(parsed.maintenanceSettings);
      if (parsed.archive) setArchive(parsed.archive);
      if (parsed.notifications) setNotifications(parsed.notifications);
      if (parsed.riskConfig) setRiskConfig(parsed.riskConfig);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      if (parsed.historicalRecords) setHistoricalRecords(parsed.historicalRecords);
      if (parsed.companyProfile) setCompanyProfile(parsed.companyProfile);
      logAudit("DATA_IMPORT", "RISK_CONFIG", "db-import", "Database Transfer", "Successfully imported database state from JSON backup");
      return true;
    } catch (e) {
      console.error("Database import error:", e);
      return false;
    }
  };

  // -------------------------------------------------------------
  // OFFICE PETTY CASH OPERATIONS
  // -------------------------------------------------------------

  const addOfficePettyCashMonth = (
    data: Omit<OfficePettyCashMonth, "id" | "totalExpenses" | "closingBalance" | "status" | "createdAt" | "createdBy">
  ): { success: boolean; month?: OfficePettyCashMonth; error?: string } => {
    if (data.openingAmount < 0) {
      return { success: false, error: language === "ar" ? "يجب أن يكون المبلغ الافتتاحي صفراً أو أكثر" : "Opening amount must be zero or greater" };
    }

    const monthExists = officePettyCashMonths.some((m) => m.month === data.month && m.year === data.year);
    if (monthExists) {
      return {
        success: false,
        error: language === "ar" ? "تم إنشاء صندوق لهذا الشهر بالفعل" : "A petty cash fund already exists for this month",
      };
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";

    const newMonth: OfficePettyCashMonth = {
      ...data,
      id: "pcm-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      totalExpenses: 0,
      closingBalance: data.openingAmount,
      status: "OPEN",
      createdBy: userId,
      createdAt: nowIso,
    };

    setOfficePettyCashMonths((prev) => [newMonth, ...prev]);
    safeSetDoc(doc(db, "office_petty_cash_months", newMonth.id), newMonth);

    logAudit(
      "CREATE",
      "OFFICE_PETTY_CASH_MONTH" as any,
      newMonth.id,
      `${data.month}/${data.year}`,
      `تم إنشاء صندوق نثريات مكتب لشهر ${data.month}/${data.year} بمبلغ افتتاحي ${data.openingAmount} درهم.`
    );

    return { success: true, month: newMonth };
  };

  const updateOfficePettyCashMonth = (
    id: string,
    patch: Partial<OfficePettyCashMonth>,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const target = officePettyCashMonths.find((m) => m.id === id);
    if (!target) return { success: false, error: "Month record not found" };

    if (target.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")) {
      return {
        success: false,
        error: language === "ar" ? "عذراً، هذا الشهر مغلق ولا يمكن تعديله إلا من خلال المسؤول المصرح له" : "This month is closed and can only be modified by an authorized administrator",
      };
    }

    let opening = patch.openingAmount !== undefined ? patch.openingAmount : target.openingAmount;
    if (opening < 0) {
      return { success: false, error: language === "ar" ? "يجب أن يكون المبلغ الافتتاحي صفراً أو أكثر" : "Opening amount must be zero or greater" };
    }

    const expensesForMonth = officePettyCashExpenses.filter((e) => e.monthId === id);
    const totalExpenses = expensesForMonth.reduce((sum, e) => sum + e.amount, 0);
    const closingBalance = opening - totalExpenses;

    const updated: OfficePettyCashMonth = {
      ...target,
      ...patch,
      openingAmount: opening,
      totalExpenses,
      closingBalance,
      updatedBy: currentUser?.id,
      updatedAt: new Date().toISOString(),
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === id ? updated : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", id), updated);

    logAudit(
      "UPDATE",
      "OFFICE_PETTY_CASH_MONTH" as any,
      id,
      `${target.month}/${target.year}`,
      `تم تعديل بيانات صندوق شهر ${target.month}/${target.year}. السبب: ${modificationReason || "تعديل عام"}`,
      JSON.stringify(target),
      JSON.stringify(updated)
    );

    return { success: true };
  };

  const closeOfficePettyCashMonth = (
    id: string,
    carryForwardOption: PettyCashCarryForwardOption,
    notes?: string,
    actualCashCounted?: number,
    reconciliationDifference?: number,
    reconciliationStatus?: string
  ): { success: boolean; error?: string } => {
    const target = officePettyCashMonths.find((m) => m.id === id);
    if (!target) return { success: false, error: "Month record not found" };

    if (!hasPermission("CLOSE_OFFICE_PETTY_CASH_MONTH")) {
      return {
        success: false,
        error: language === "ar" ? "ليس لديك صلاحية لإغلاق شهر النثريات" : "You do not have permission to close petty cash months",
      };
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";

    const updated: OfficePettyCashMonth = {
      ...target,
      status: "CLOSED",
      carryForwardOption,
      notes: notes || target.notes,
      closedBy: userId,
      closedAt: nowIso,
      actualCashCounted: actualCashCounted !== undefined ? actualCashCounted : target.closingBalance,
      reconciliationDifference: reconciliationDifference !== undefined ? reconciliationDifference : 0,
      reconciliationStatus: reconciliationStatus || "RECONCILED",
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === id ? updated : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", id), updated);

    logAudit(
      "STATUS_CHANGE",
      "OFFICE_PETTY_CASH_MONTH" as any,
      id,
      `${target.month}/${target.year}`,
      `تم إغلاق صندوق شهر ${target.month}/${target.year} بنجاح. الخيار: ${carryForwardOption}. جرد فعلي: ${updated.actualCashCounted} AED، الفارق: ${updated.reconciliationDifference} AED.`
    );

    return { success: true };
  };

  const reopenOfficePettyCashMonth = (
    id: string,
    reason?: string
  ): { success: boolean; error?: string } => {
    const target = officePettyCashMonths.find((m) => m.id === id);
    if (!target) return { success: false, error: "Month record not found" };

    if (!hasPermission("REOPEN_OFFICE_PETTY_CASH_MONTH")) {
      return {
        success: false,
        error: language === "ar" ? "ليس لديك صلاحية لإعادة فتح شهر النثريات" : "You do not have permission to reopen petty cash months",
      };
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";

    const updated: OfficePettyCashMonth = {
      ...target,
      status: "OPEN",
      reopenedBy: userId,
      reopenedAt: nowIso,
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === id ? updated : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", id), updated);

    logAudit(
      "STATUS_CHANGE",
      "OFFICE_PETTY_CASH_MONTH" as any,
      id,
      `${target.month}/${target.year}`,
      `تم إعادة فتح صندوق شهر ${target.month}/${target.year}. السبب: ${reason || "تعديل القيود"}`
    );

    return { success: true };
  };

  const addOfficePettyCashExpense = (
    data: Omit<OfficePettyCashExpense, "id" | "expenseNumber" | "createdAt" | "createdBy">
  ): { success: boolean; expense?: OfficePettyCashExpense; error?: string } => {
    const monthRecord = officePettyCashMonths.find((m) => m.id === data.monthId);
    if (!monthRecord) {
      return { success: false, error: "Month record not found" };
    }

    if (monthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")) {
      return {
        success: false,
        error: language === "ar" ? "عذراً، هذا الشهر مغلق ولا يمكن إضافة مصروفات جديدة له" : "This month is closed and cannot receive new expenses",
      };
    }

    if (data.amount <= 0) {
      return { success: false, error: language === "ar" ? "يجب أن تكون قيمة المصروف أكبر من الصفر" : "Expense amount must be greater than zero" };
    }

    const expDate = new Date(data.date);
    const expMonth = expDate.getMonth() + 1;
    const expYear = expDate.getFullYear();
    if (expMonth !== monthRecord.month || expYear !== monthRecord.year) {
      return {
        success: false,
        error: language === "ar" 
          ? `تاريخ المصروف يجب أن ينتمي إلى نفس شهر و سنة الصندوق المفتوح (${monthRecord.month}/${monthRecord.year})` 
          : `Expense date must belong to the active fund's month and year (${monthRecord.month}/${monthRecord.year})`,
      };
    }

    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || "sys-01";

    const monthExpenses = officePettyCashExpenses.filter((e) => e.monthId === data.monthId);
    const sequence = monthExpenses.length + 1;
    const padMonth = String(monthRecord.month).padStart(2, "0");
    const padSeq = String(sequence).padStart(3, "0");
    const expenseNumber = `EXP-${monthRecord.year}-${padMonth}-${padSeq}`;

    const cat = officePettyCashCategories.find((c) => c.id === data.categoryId);

    const newExpense: OfficePettyCashExpense = {
      ...data,
      id: "exp-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      expenseNumber,
      categoryNameArabic: cat?.nameArabic || "غير محدد",
      categoryNameEnglish: cat?.nameEnglish || "Uncategorized",
      createdBy: userId,
      createdAt: nowIso,
    };

    setOfficePettyCashExpenses((prev) => [newExpense, ...prev]);
    safeSetDoc(doc(db, "office_petty_cash_expenses", newExpense.id), newExpense);

    const newTotalExpenses = monthRecord.totalExpenses + data.amount;
    const newClosingBalance = monthRecord.openingAmount - newTotalExpenses;

    const updatedMonth: OfficePettyCashMonth = {
      ...monthRecord,
      totalExpenses: newTotalExpenses,
      closingBalance: newClosingBalance,
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === data.monthId ? updatedMonth : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", monthRecord.id), updatedMonth);

    logAudit(
      "CREATE",
      "OFFICE_PETTY_CASH_EXPENSE" as any,
      newExpense.id,
      expenseNumber,
      `تم تسجيل مصروف جديد بقيمة ${data.amount} درهم رقم ${expenseNumber} فئة ${cat?.nameArabic || data.categoryId}.`
    );

    return { success: true, expense: newExpense };
  };

  const updateOfficePettyCashExpense = (
    id: string,
    patch: Partial<OfficePettyCashExpense>,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const target = officePettyCashExpenses.find((e) => e.id === id);
    if (!target) return { success: false, error: "Expense record not found" };

    const monthRecord = officePettyCashMonths.find((m) => m.id === target.monthId);
    if (!monthRecord) return { success: false, error: "Month record not found" };

    if (monthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")) {
      return {
        success: false,
        error: language === "ar" ? "عذراً، هذا الشهر مغلق ولا يمكن تعديل المصروفات المدرجة فيه" : "This month is closed and its expenses cannot be modified",
      };
    }

    if (patch.amount !== undefined && patch.amount <= 0) {
      return { success: false, error: language === "ar" ? "يجب أن تكون قيمة المصروف أكبر من الصفر" : "Expense amount must be greater than zero" };
    }

    if (patch.date !== undefined) {
      const expDate = new Date(patch.date);
      const expMonth = expDate.getMonth() + 1;
      const expYear = expDate.getFullYear();
      if (expMonth !== monthRecord.month || expYear !== monthRecord.year) {
        return {
          success: false,
          error: language === "ar" 
            ? `تاريخ المصروف يجب أن ينتمي إلى نفس شهر و سنة الصندوق (${monthRecord.month}/${monthRecord.year})` 
            : `Expense date must belong to the active fund's month and year (${monthRecord.month}/${monthRecord.year})`,
        };
      }
    }

    const catId = patch.categoryId !== undefined ? patch.categoryId : target.categoryId;
    const cat = officePettyCashCategories.find((c) => c.id === catId);

    const updated: OfficePettyCashExpense = {
      ...target,
      ...patch,
      categoryNameArabic: cat?.nameArabic || target.categoryNameArabic,
      categoryNameEnglish: cat?.nameEnglish || target.categoryNameEnglish,
      updatedBy: currentUser?.id,
      updatedAt: new Date().toISOString(),
    };

    setOfficePettyCashExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    safeSetDoc(doc(db, "office_petty_cash_expenses", id), updated);

    const otherExpenses = officePettyCashExpenses.filter((e) => e.monthId === target.monthId && e.id !== id);
    const newAmount = patch.amount !== undefined ? patch.amount : target.amount;
    const newTotalExpenses = otherExpenses.reduce((sum, e) => sum + e.amount, 0) + newAmount;
    const newClosingBalance = monthRecord.openingAmount - newTotalExpenses;

    const updatedMonth: OfficePettyCashMonth = {
      ...monthRecord,
      totalExpenses: newTotalExpenses,
      closingBalance: newClosingBalance,
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === target.monthId ? updatedMonth : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", monthRecord.id), updatedMonth);

    logAudit(
      "UPDATE",
      "OFFICE_PETTY_CASH_EXPENSE" as any,
      id,
      target.expenseNumber,
      `تم تعديل المصروف رقم ${target.expenseNumber}. السبب: ${modificationReason || "تعديل عام"}`,
      JSON.stringify(target),
      JSON.stringify(updated)
    );

    return { success: true };
  };

  const deleteOfficePettyCashExpense = (
    id: string,
    modificationReason?: string
  ): { success: boolean; error?: string } => {
    const target = officePettyCashExpenses.find((e) => e.id === id);
    if (!target) return { success: false, error: "Expense record not found" };

    const monthRecord = officePettyCashMonths.find((m) => m.id === target.monthId);
    if (!monthRecord) return { success: false, error: "Month record not found" };

    if (monthRecord.status === "CLOSED" && !hasPermission("MODIFY_CLOSED_OFFICE_PETTY_CASH")) {
      return {
        success: false,
        error: language === "ar" ? "عذراً، هذا الشهر مغلق ولا يمكن حذف مصروفات مدرجة فيه" : "This month is closed and its expenses cannot be deleted",
      };
    }

    if (!hasPermission("DELETE_OFFICE_EXPENSE")) {
      return {
        success: false,
        error: language === "ar" ? "ليس لديك صلاحية لحذف مصروفات المكتب" : "You do not have permission to delete office expenses",
      };
    }

    setOfficePettyCashExpenses((prev) => prev.filter((e) => e.id !== id));
    deleteDoc(doc(db, "office_petty_cash_expenses", id)).catch(() => {});

    const otherExpenses = officePettyCashExpenses.filter((e) => e.monthId === target.monthId && e.id !== id);
    const newTotalExpenses = otherExpenses.reduce((sum, e) => sum + e.amount, 0);
    const newClosingBalance = monthRecord.openingAmount - newTotalExpenses;

    const updatedMonth: OfficePettyCashMonth = {
      ...monthRecord,
      totalExpenses: newTotalExpenses,
      closingBalance: newClosingBalance,
    };

    setOfficePettyCashMonths((prev) => prev.map((m) => (m.id === target.monthId ? updatedMonth : m)));
    safeSetDoc(doc(db, "office_petty_cash_months", monthRecord.id), updatedMonth);

    logAudit(
      "DELETE",
      "OFFICE_PETTY_CASH_EXPENSE" as any,
      id,
      target.expenseNumber,
      `تم حذف المصروف رقم ${target.expenseNumber} بقيمة ${target.amount} درهم. السبب: ${modificationReason || "حذف سجل"}`
    );

    return { success: true };
  };

  const addOfficePettyCashCategory = (
    data: Omit<OfficePettyCashCategory, "id" | "active" | "createdAt">
  ): { success: boolean; category?: OfficePettyCashCategory; error?: string } => {
    if (!hasPermission("MANAGE_OFFICE_EXPENSE_CATEGORIES")) {
      return {
        success: false,
        error: language === "ar" ? "ليس لديك صلاحية لإدارة فئات مصروفات المكتب" : "You do not have permission to manage expense categories",
      };
    }

    const nowIso = new Date().toISOString();
    const newCat: OfficePettyCashCategory = {
      ...data,
      id: "cat-" + Date.now() + "-" + crypto.randomUUID().split("-")[0],
      active: true,
      createdAt: nowIso,
    };

    setOfficePettyCashCategories((prev) => [...prev, newCat]);
    safeSetDoc(doc(db, "office_petty_cash_categories", newCat.id), newCat);

    logAudit(
      "CREATE",
      "OFFICE_PETTY_CASH_CATEGORY" as any,
      newCat.id,
      newCat.nameEnglish,
      `تم إضافة فئة مصروفات مكتبية جديدة: ${newCat.nameArabic} / ${newCat.nameEnglish}`
    );

    return { success: true, category: newCat };
  };

  const updateOfficePettyCashCategory = (
    id: string,
    patch: Partial<OfficePettyCashCategory>
  ): { success: boolean; error?: string } => {
    if (!hasPermission("MANAGE_OFFICE_EXPENSE_CATEGORIES")) {
      return {
        success: false,
        error: language === "ar" ? "ليس لديك صلاحية لإدارة فئات مصروفات المكتب" : "You do not have permission to manage expense categories",
      };
    }

    const target = officePettyCashCategories.find((c) => c.id === id);
    if (!target) return { success: false, error: "Category not found" };

    const updated: OfficePettyCashCategory = {
      ...target,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setOfficePettyCashCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    safeSetDoc(doc(db, "office_petty_cash_categories", id), updated);

    logAudit(
      "UPDATE",
      "OFFICE_PETTY_CASH_CATEGORY" as any,
      id,
      target.nameEnglish,
      `تم تعديل فئة المصروفات المكتبية: ${target.nameEnglish}`,
      JSON.stringify(target),
      JSON.stringify(updated)
    );

    return { success: true };
  };

  const updateSaqrOfficeConfig = (patch: Partial<SaqrOfficeConfig>) => {
    setSaqrOfficeConfig((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
    logAudit("UPDATE", "COMPANY_PROFILE" as any, "saqr-office", "Saqr Office Config", "تم تحديث بيانات حساب مكتب صقر الإمارات للعقارات");
  };

  const addOfficeSaqrTransaction = (tx: SaqrOfficeManualTransaction) => {
    setSaqrOfficeManualTransactions((prev) => [tx, ...prev]);
    logAudit("CREATE", "COLLECTION" as any, tx.id, tx.category, `تم إضافة معاملة مالية يدوية لحساب المكتب بقيمة ${tx.amount} درهم`);
  };

  const deleteOfficeSaqrTransaction = (id: string) => {
    setSaqrOfficeManualTransactions((prev) => prev.filter((t) => t.id !== id));
    logAudit("DELETE", "COLLECTION" as any, id, "Manual Tx", "تم حذف معاملة مالية يدوية من حساب المكتب");
  };

  // AUTHORITATIVE OCCUPANCY GOVERNANCE METHODS
  const validateUnitAvailability = (
    unitId: string,
    options?: { targetLeaseId?: string; renewalOriginalLeaseId?: string; isRenewal?: boolean }
  ): UnitAvailabilityValidationResult => {
    return validateUnitAvailabilityForLease({
      unitId,
      targetLeaseId: options?.targetLeaseId,
      renewalOriginalLeaseId: options?.renewalOriginalLeaseId,
      isRenewal: options?.isRenewal,
      units,
      leases,
      language: (language as any) || "ar",
    });
  };

  const getUnitOccupancyStatus = (unitId: string): UnitOccupancySummary => {
    const unit = units.find((u) => u.id === unitId);
    return getUnitEffectiveOccupancy(unitId, unit, leases);
  };

  const reconcileUnitOccupancy = (): { reconciledCount: number; mismatches: UnitReconciliationMismatch[] } => {
    const { reconciledUnits, mismatches } = reconcileAllUnitsOccupancy(units, leases);
    if (mismatches.length > 0) {
      setUnits(reconciledUnits);
      mismatches.forEach((m) => {
        const targetUnit = reconciledUnits.find((u) => u.id === m.unitId);
        if (targetUnit) {
          safeSetDoc(doc(db, "units", m.unitId), targetUnit, { merge: true });
        }
        logAudit(
          "UPDATE",
          "UNIT",
          m.unitId,
          `Unit ${m.unitNumber}`,
          `[Occupancy Governance Auto-Reconciliation] ${m.reasonAr}`
        );
      });
    }
    return { reconciledCount: mismatches.length, mismatches };
  };

  return (
    <DataContext.Provider
      value={{
        dailyDeposits,
        depositBatches,
        createDepositBatch,
        updateDepositBatch,
        addDailyDeposit,
        updateDailyDeposit,
        isQuotaExceeded,
        isDataLoaded,
        checkFinancialEditPermission,
        owners,
        properties,
        units,
        tenants,
        leases,
        validateUnitAvailability,
        getUnitOccupancyStatus,
        reconcileUnitOccupancy,
        cheques,
        collections,
        cases,
        maintenanceRequests,
        technicians,
        maintenanceSettings,
        archive,
        notifications,
        riskConfig,
        auditLogs,
        historicalRecords,
        financialPeriods,
        periodCertifications,
        companyProfile,
        updateCompanyProfile,
        activeLetterheadTemplate,
        addCompanyLetterheadTemplate,
        setActiveCompanyLetterhead,
        deleteCompanyLetterheadTemplate,
        deleteHistoricalRecord,
        restoreHistoricalRecord,
        checkDeleteIntegrity,
        clearTable,
        resetDatabase,
        exportDatabaseJSON,
        importDatabaseJSON,

        // Office Petty Cash Module
        officePettyCashMonths,
        officePettyCashExpenses,
        officePettyCashCategories,

        // Saqr Office Account Module
        saqrOfficeConfig,
        saqrOfficeManualTransactions,
        updateSaqrOfficeConfig,
        addOfficeSaqrTransaction,
        deleteOfficeSaqrTransaction,

        addOfficePettyCashMonth,
        updateOfficePettyCashMonth,
        closeOfficePettyCashMonth,
        reopenOfficePettyCashMonth,
        addOfficePettyCashExpense,
        updateOfficePettyCashExpense,
        deleteOfficePettyCashExpense,
        addOfficePettyCashCategory,
        updateOfficePettyCashCategory,

        addOwner,
        updateOwner,
        deleteOwner,
        addProperty,
        updateProperty,
        deleteProperty,
        addUnit,
        updateUnit,
        deleteUnit,
        addTenant,
        updateTenant,
        deleteTenant,
        addLease,
        updateLease,
        deleteLease,
        renewLease,
        leaseRenewals,
        deferredPayments,
        createLeaseRenewal,
        updateLeaseRenewal,
        approveLeaseRenewal,
        rejectLeaseRenewal,
        recordDeferredPayment,
        collectDeferredPayment,
        cancelDeferredPayment,
        updateChequeWithSafetyConfirmation,
        dispatchRenewalNotification,
        dispatchPaymentReceiptNotification,
        dispatchChequeReminderNotification,
        runAutomatedChequeReminders,
        dispatchDeferredReminderNotification,
        dispatchNewLeaseNotification,
        dispatchChequeCollectedNotification,
        addCheque,
        updateCheque,
        deleteCheque,
        updateChequeStatus,
        depositCheque,
        clearCheque,
        checkDuplicateCheque,
        bulkUpdateCheques,
        replaceCheque,
        cancelCheque,
        extractChequeOCR,
        extractChequeBatchOCR,
        extractDocumentOCR,
        markInstallmentAsBounced,
        updateLeaseInstallmentStatus,
        recordCollection,
        deleteCollection,
        addCase,
        convertChequesToCase,
        linkChequesToCase,
        unlinkChequeFromCase,
        linkExpenseToCase,
        linkMultipleExpensesToCase,
        unlinkExpenseFromCase,
        updateCaseBouncedFee,
        updateCaseFeesConfig,
        createCaseFromCheque,
        updateCaseStatus,
        deleteCase,
        addHearingSession,
        updateHearingSession,
        saveSettlement,
        addMaintenanceRequest,
        updateMaintenanceRequest,
        deleteMaintenanceRequest,
        updateMaintenanceStatus,
        postMaintenanceExpense,
        assignTechnicianToRequest,
        addMaintenanceInvoice,
        addMaintenancePayment,
        updateMaintenanceInvoice,
        deleteMaintenanceInvoice,
        addMaintenanceAttachment,
        deleteMaintenanceAttachment,
        addMaintenanceNote,
        addTechnician,
        updateTechnician,
        deleteTechnician,
        updateMaintenanceSettings,
        legalSettings,
        updateLegalSettings,
        commissions,
        commissionObligations: commissions,
        paymentAllocations,
        financialReversals,
        financialAdjustments,
        vatRates,
        addVatRate,
        updateVatRate,
        deleteVatRate,
        chartOfAccounts,
        journalEntries,
        postJournalEntry,
        reverseJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        messageTemplates,
        updateMessageTemplate,
        operationalCommunications,
        addOperationalCommunication,

        ownerTransfers,
        propertyExpenses,
        collectionActions,
        paymentPromises,
        addCollectionAction,
        updateCollectionAction,
        addPaymentPromise,
        updatePaymentPromise,
        fulfillPaymentPromise,
        getTenantReceivablePosition,
        addOwnerTransfer,
        updateOwnerTransfer,
        updateOwnerTransferStatus,
        settleOwnerTransfer,
        cancelOwnerTransfer,
        reverseOwnerTransfer,
        addPropertyExpense,
        settlePropertyExpense,
    updatePropertyExpense,
        reversePropertyExpense,
        deletePropertyExpense,
        addAccountDefinition,
        updateAccountDefinition,
        addFinancialPeriod,
        closeFinancialPeriod,
        reopenFinancialPeriod,
        deleteFinancialPeriod,
        runPeriodReconciliation,
        generatePeriodCertification,
        getOwnerPayable,
        getOwnerStatement,
        getTenantStatement,
        addCommissionObligation,
        updateCommissionObligation,
        collectAdministrativeFee,
        settleAdministrativeFee,
        collectSecurityDeposit,
        settleSecurityDeposit,
        refundOrSettleSecurityDeposit,
        reverseCommissionObligation,
        deleteCommissionObligation,
        allocatePaymentToTargets,
        reversePaymentReceipt,
        recordLeasePayment,
        processUnifiedPayment,
        liquidateUnallocatedAdvance,
        reverseSinglePaymentAllocation,
        recordFinancialAdjustment,
        reconcileSystemFinancialBalances,
        addArchiveItem,
        uploadAndArchiveDocument,
        deleteArchiveItem,
        generateSecureDownloadToken,
        syncArchiveItemToDrive,
        uploadChequeImage,
        syncChequeToDrive,
        deleteChequeImage,
        addCaseDocument,
        deleteCaseDocument,
        syncCaseDocumentToDrive,
        dispatchWhatsAppReminder,
        dispatchEmailReminder,
        updateRiskConfig,
        riskWeights: riskConfig,
        updateRiskWeights: updateRiskConfig,
        addHearingToCase: (caseId: string, h: any) => addHearingSession(caseId, {
          sessionNumber: 1,
          date: h.hearingDate || h.date || new Date().toISOString().split("T")[0],
          time: h.hearingTime || h.time || "10:00 AM",
          courtName: h.courtName || "Dubai Rental Dispute Center (RDSC)",
          courtRoom: h.courtRoom,
          sessionType: h.sessionType || "PLEADINGS",
          attendees: h.attendees || "",
          ownerRepresentative: h.ownerRepresentative || "Legal Counsel",
          tenantRepresentative: h.tenantRepresentative || "",
          attendanceStatus: "BOTH_ATTENDED",
          summary: h.summary || h.notes || "",
          decision: h.decision || h.judgeDecisions || "",
          nextAction: h.nextAction || "",
          notes: h.notes || "",
        }),
        saveSettlementAgreement: (caseId: string, s: any) => {
          if (!s) {
            setCases((prev) => prev.map((c) => {
              if (c.id === caseId) {
                const updated = { ...c };
                delete updated.settlement;
                safeSetDoc(doc(db, "cases", caseId), { settlement: null }, { merge: true });
                return updated;
              }
              return c;
            }));
            return;
          }
          saveSettlement(caseId, {
            caseId,
            totalAgreedAmount: s.agreedAmount || s.totalAgreedAmount || 0,
            installmentsCount: s.installmentsCount || 1,
            signedDate: s.agreementDate || s.signedDate || s.settlementDate || new Date().toISOString().split("T")[0],
            status: s.status || "ACTIVE",
            terms: s.notes || s.terms || "",
            schedule: (s.installments || s.schedule || s.installmentSchedule || []).map((inst: any) => ({
              ...inst,
              id: inst.id || `inst-${crypto.randomUUID().split("-")[0]}`,
              status: inst.status || (inst.paid ? "PAID" : "PENDING")
            })),
          });
        },
        paySettlementInstallment,
        clearSettlementCheque,
        updateSettlementCheque,
        recalculateTenantRisk,
        importBatchData,
        importOwnersBatch,
        importTenantsBatch,
        addNotification,
        logAudit,

        // Sequence Generators
        getNextOwnerCode: () => generateSequentialNumber(owners, "code", "EFR-OWN-", 4, false),
        getNextTenantCode: () => generateSequentialNumber(tenants, "code", "EFR-TNT-", 4, false),
        getNextPropertyCode: () => generateSequentialNumber(properties, "code", "EFR-PRP-", 4, false),
        getNextLeaseNumber: () => generateSequentialNumber(leases, "leaseNumber", "EFR-CON-", 4, false),
        getNextReceiptNumber: () => generateSequentialNumber(collections, "receiptNumber", "RCP-", 4, false),
        getNextCaseNumber: () => generateSequentialNumber(cases, "caseNumber", "CAS-", 4, false),
        getNextExpenseNumber: () => generateSequentialNumber(propertyExpenses, "expenseNumber", "EXP-", 4, false),
        getNextTransferNumber: () => generateSequentialNumber(ownerTransfers, "transferNumber", "TRF-", 4, false),
        getNextDepositBatchNumber: () => generateSequentialNumber(dailyDeposits, "id", "DEP-", 4, false),
        getNextMaintenanceRequestNumber: () => generateSequentialNumber(maintenanceRequests, "requestNumber", "MR-", 4, false),
        getNextMaintenanceInvoiceNumber: () => {
          const allInvoices = maintenanceRequests.flatMap(r => r.invoices || []);
          return generateSequentialNumber(allInvoices, "invoiceNumber", "INV-", 4, false);
        },
        getNextReversalNumber: () => generateSequentialNumber(financialReversals, "reversalNumber", "REV-", 4, false),
        getNextRenewalNumber: () => generateSequentialNumber(leaseRenewals, "renewalNumber", "RNW-", 4, false),
        getNextDeferredNumber: () => generateSequentialNumber(deferredPayments, "deferredNumber", "DEF-", 4, false),
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
