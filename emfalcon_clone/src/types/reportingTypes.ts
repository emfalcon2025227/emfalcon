export type ReportGroupByOption =
  | "NONE"
  | "OWNER"
  | "TENANT"
  | "PROPERTY"
  | "CATEGORY"
  | "MONTH"
  | "PAYMENT_METHOD";

export interface UniversalReportFilters {
  fromDate?: string;
  toDate?: string;
  ownerId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  transactionType?: string;
  status?: string;
  paymentMethod?: string;
  expenseCategory?: string;
  operatorId?: string;
  groupBy?: ReportGroupByOption;
  searchQuery?: string;
}

export interface ReportItemBase {
  id: string;
  date: string;
  reference?: string;
  description: string;
  entityDetails?: string;
  ownerId?: string;
  ownerName?: string;
  tenantId?: string;
  tenantName?: string;
  propertyId?: string;
  propertyName?: string;
  unitId?: string;
  unitNumber?: string;
  leaseId?: string;
  leaseNumber?: string;
  category?: string;
  paymentMethod?: string;
  status?: string;
  debit: number;
  credit: number;
  taxableBase?: number;
  vatAmount?: number;
  vatRate?: number;
  taxDirection?: "INPUT_VAT" | "OUTPUT_VAT";
  balance: number;
  costBearer?: string;
  metadata?: Record<string, any>;
}

export interface ReportGroup<T = ReportItemBase> {
  groupKey: string;
  groupTitle: string;
  groupSubLabel?: string;
  items: T[];
  itemCount: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface GroupedReportResult<T = ReportItemBase> {
  groups: ReportGroup<T>[];
  totalCount: number;
  grandTotalDebit: number;
  grandTotalCredit: number;
  grandTotalNet: number;
}
