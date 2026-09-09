import {
  Owner,
  Property,
  Unit,
  Tenant,
  Lease,
  Cheque,
  CollectionRecord,
  RentalCase,
  ElectronicArchiveItem,
  NotificationRecord,
  RiskConfigWeights,
  AuditLogEntry,
  MaintenanceRequest,
  Technician,
  MaintenanceSettings,
  LegalSettings,
} from "../types";

export const INITIAL_OWNERS: Owner[] = [
  {
    id: "own-mahmoud",
    code: "OWN-001",
    nameEn: "Mahmoud Mohamed Mahmoud Hamed",
    nameAr: "محمود محمد محمود حامد",
    emiratesId: "784-1985-1234567-1",
    email: "m_hamed@msn.com",
    phone: "+971501234567",
    bankName: "ADCB",
    iban: "AE000000000000000000001",
    accountNumber: "10001234567",
    status: "ACTIVE",
    createdAt: "2024-01-01T08:00:00Z"
  }
];

export const INITIAL_PROPERTIES: Property[] = [
  {
    id: "prop-mahmoud",
    code: "PRP-Horizon",
    nameEn: "Horizon Tower",
    nameAr: "برج الأفق",
    ownerId: "own-mahmoud",
    emirate: "Abu Dhabi",
    community: "Corniche",
    totalUnits: 1,
    type: "RESIDENTIAL_BUILDING",
    status: "ACTIVE",
    createdAt: "2024-01-01T08:00:00Z"
  }
];

export const INITIAL_UNITS: Unit[] = [
  {
    id: "unit-mahmoud",
    propertyId: "prop-mahmoud",
    unitNumber: "Apt 1402",
    floor: "14",
    type: "2BR",
    annualRent: 85000,
    status: "OCCUPIED",
    createdAt: "2024-01-01T08:00:00Z"
  }
];

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: "tnt-mahmoud",
    code: "TNT-007",
    nameEn: "Mahmoud Mohamed",
    nameAr: "محمود محمد",
    type: "INDIVIDUAL",
    nationality: "Egypt",
    email: "mahmoud.m@sdi.ae",
    phone: "+971507777777",
    riskScore: 15,
    riskLevel: "LOW",
    riskFactors: [],
    status: "ACTIVE",
    createdAt: "2024-01-01T08:00:00Z"
  }
];

export const INITIAL_LEASES: Lease[] = [
  {
    id: "lse-mahmoud",
    leaseNumber: "LSE-908",
    ownerId: "own-mahmoud",
    propertyId: "prop-mahmoud",
    unitId: "unit-mahmoud",
    tenantId: "tnt-mahmoud",
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    annualRent: 85000,
    installmentsCount: 2,
    securityDeposit: 5000,
    contractStatus: "ACTIVE",
    installments: [],
    createdAt: "2025-01-01T08:00:00Z"
  }
];

export const INITIAL_CHEQUES: Cheque[] = [
  {
    id: "chq-mahmoud-1",
    chequeNumber: "990123",
    bankName: "ADCB",
    amount: 42500,
    chequeDate: "2024-01-01",
    dueDate: "2024-01-01",
    ownerId: "own-mahmoud",
    tenantId: "tnt-mahmoud",
    propertyId: "prop-mahmoud",
    unitId: "unit-mahmoud",
    leaseId: "lse-mahmoud",
    status: "CLEARED",
    originalStatus: "NORMAL",
    collectionStatus: "FULLY_COLLECTED_AFTER_BOUNCE",
    totalApplied: 42500,
    outstanding: 0,
    whatsAppStatus: "NONE",
    reminderCount: 0,
    createdAt: "2024-01-01T08:00:00Z"
  },
  {
    id: "chq-mahmoud-2",
    chequeNumber: "990124",
    bankName: "ADCB",
    amount: 42500,
    chequeDate: "2024-07-01",
    dueDate: "2024-07-01",
    ownerId: "own-mahmoud",
    tenantId: "tnt-mahmoud",
    propertyId: "prop-mahmoud",
    unitId: "unit-mahmoud",
    leaseId: "lse-mahmoud",
    status: "CLEARED",
    originalStatus: "NORMAL",
    collectionStatus: "FULLY_COLLECTED_AFTER_BOUNCE",
    totalApplied: 42500,
    outstanding: 0,
    whatsAppStatus: "NONE",
    reminderCount: 0,
    createdAt: "2024-01-01T08:00:00Z"
  }
];

export const INITIAL_COLLECTIONS: CollectionRecord[] = [];

export const INITIAL_CASES: RentalCase[] = [];

export const INITIAL_ARCHIVE: ElectronicArchiveItem[] = [];

export const INITIAL_TECHNICIANS: Technician[] = [
  {
    id: "tech-1",
    name: "م. محمد فوزي",
    phone: "+971501234567",
    company: "الخليج لصيانة أنظمة التكييف والتهوية",
    serviceType: "HVAC",
    email: "mohamed.fawzy@gulfhvac.ae",
    status: "ACTIVE",
    rating: 4.8,
    notes: "خبير معتمد في صيانة المكيفات المركزية ووحدات سبليت",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "tech-2",
    name: "طارق العلي",
    phone: "+971559876543",
    company: "مؤسسة الأفق للأعمال الصحية والسباكة",
    serviceType: "PLUMBING",
    email: "tariq.ali@horizonsanitary.ae",
    status: "ACTIVE",
    rating: 4.9,
    notes: "متخصص في كشف تسربات المياه والصرف والشبكات الداخلية",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: "tech-3",
    name: "أحمد عبدالحميد",
    phone: "+971523344556",
    company: "شركة الشعلة للخدمات الكهربائية الذكية",
    serviceType: "ELECTRICAL",
    email: "ahmed.elec@flameelectric.ae",
    status: "ACTIVE",
    rating: 4.7,
    notes: "فني كهربائي معتمد من هيئة كهرباء ومياه الشارقة/دبي",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: "tech-4",
    name: "شركة أوتيس للمصاعد (مركز الخدمة)",
    phone: "+97148006847",
    company: "Otis Elevator Company UAE",
    serviceType: "ELEVATOR",
    email: "service.uae@otis.com",
    status: "ACTIVE",
    rating: 5.0,
    notes: "عقد صيانة دورية شامل لجميع مصاعد الأبراج",
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

export const INITIAL_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  delayedDaysThreshold: 3,
  defaultCostBearer: "OWNER",
  autoNotifyTenantOnStatusChange: true,
  slaHoursByPriority: {
    LOW: 72,
    NORMAL: 48,
    HIGH: 24,
    URGENT: 6,
  },
  categories: [
    { id: "PLUMBING", nameAr: "أعمال السباكة والصرف الصحي", nameEn: "Plumbing & Sanitary", icon: "Wrench" },
    { id: "ELECTRICAL", nameAr: "أعمال الكهرباء والإنارة", nameEn: "Electrical & Lighting", icon: "Zap" },
    { id: "HVAC", nameAr: "التكييف والتهوية (HVAC)", nameEn: "HVAC & AC Systems", icon: "Wind" },
    { id: "ELEVATOR", nameAr: "صيانة المصاعد", nameEn: "Elevator Maintenance", icon: "ArrowUpDown" },
    { id: "CARPENTRY", nameAr: "أعمال النجارة والأبواب", nameEn: "Carpentry & Doors", icon: "Hammer" },
    { id: "PAINTING", nameAr: "الدهانات والديكورات", nameEn: "Painting & Decor", icon: "Paintbrush" },
    { id: "APPLIANCES", nameAr: "الأجهزة الكهربائية والمنزلية", nameEn: "Appliances", icon: "Tv" },
    { id: "PEST_CONTROL", nameAr: "مكافحة الحشرات والقوارض", nameEn: "Pest Control", icon: "Bug" },
    { id: "MASONRY", nameAr: "أعمال البناء والتشطيبات", nameEn: "Civil & Masonry", icon: "Layers" },
    { id: "ALUMINUM", nameAr: "أعمال الألمنيوم والزجاج", nameEn: "Aluminum & Glass", icon: "Square" },
    { id: "OTHER", nameAr: "أعمال صيانة عامة أخرى", nameEn: "Other Maintenance", icon: "Tool" },
  ],
};

export const INITIAL_LEGAL_SETTINGS: LegalSettings = {
  defaultBouncedChequeFee: 500,
  defaultLegalFeesClaimed: 0,
};

export const INITIAL_MAINTENANCE_REQUESTS: MaintenanceRequest[] = [];

export const INITIAL_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: "notif-mock-1",
    channel: "WHATSAPP",
    type: "WHATSAPP",
    recipient: "+971502025227",
    recipientName: "System Administrator",
    tenantId: "system",
    content: "تم استلام رسالة واردة من المالك بخصوص تحديث الشيكات المرتجعة. يرجى المراجعة واتخاذ الإجراء اللازم في نظام الدعاوى.",
    status: "DELIVERED",
    sentAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    chequeId: "CHQ-1004",
    attemptCount: 1
  },
  {
    id: "notif-mock-2",
    channel: "EMAIL",
    type: "EMAIL",
    recipient: "emfalcon2025227@gmail.com",
    recipientName: "System Administrator",
    tenantId: "system",
    content: "إشعار تلقائي من نظام البنك: تم استلام كشف حساب يوضح حالة تحصيل مجموعة من الشيكات. تم تحديث البيانات التلقائية للنظام.",
    status: "DELIVERED",
    sentAt: new Date(Date.now() - 7200000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    attemptCount: 1
  }
];

export const INITIAL_RISK_CONFIG: RiskConfigWeights = {
  bouncedChequesCountWeight: 25,
  bouncedRatioWeight: 20,
  outstandingAmountWeight: 25,
  delayDaysWeight: 10,
  casesFiledWeight: 20,
  lowThreshold: 30,
  mediumThreshold: 70,
  highThreshold: 100,
  blockRenewalOnHighRisk: false,
};

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud-1",
    action: "CREATE",
    entityType: "PROPERTY",
    entityId: "prop-1",
    entityName: "برج الأفق (Horizon Tower)",
    userId: "u-1",
    userName: "عبدالله المنهالي",
    userRole: "SUPER_ADMIN",
    timestamp: "2026-08-15 10:30:00",
    details: "تم إضافة عقار جديد برج الأفق في النظام الرئيسي",
    newValue: "{ name: 'Horizon Tower', code: 'PRP-101' }"
  },
  {
    id: "aud-2",
    action: "CREATE",
    entityType: "TENANT",
    entityId: "tnt-1",
    entityName: "شركة الشروق للتجارة",
    userId: "u-2",
    userName: "سارة أحمد",
    userRole: "PROPERTY_MANAGER",
    timestamp: "2026-08-15 11:15:22",
    details: "تسجيل مستأجر جديد (شركة) وإرفاق وثائق الرخصة التجارية",
    newValue: "{ name: 'Al Shurooq Trading', type: 'CORPORATE' }"
  },
  {
    id: "aud-3",
    action: "CREATE",
    entityType: "LEASE",
    entityId: "lse-1",
    entityName: "LSE-402 (برج الأفق)",
    userId: "u-1",
    userName: "عبدالله المنهالي",
    userRole: "SUPER_ADMIN",
    timestamp: "2026-08-15 14:00:00",
    details: "إصدار عقد إيجار جديد رقم LSE-402 بقيمة 120,000 درهم وإرفاق الشيكات البنكية",
    newValue: "{ rentAmount: 120000, chequesCount: 4 }"
  },
  {
    id: "aud-4",
    action: "FINANCIAL_PAYMENT",
    entityType: "CHEQUE",
    entityId: "chq-1",
    entityName: "شيك رقم 100234 (30,000 د.إ)",
    userId: "u-3",
    userName: "خالد المحاسب",
    userRole: "FINANCE",
    timestamp: "2026-08-16 09:20:10",
    details: "تحصيل وتحت الإيداع دفعة شيك بنكي لمستحق عقود الإيجار",
    oldValue: "PENDING",
    newValue: "DEPOSITED"
  }
];
export const INITIAL_HISTORICAL_RECORDS: any[] = [];

