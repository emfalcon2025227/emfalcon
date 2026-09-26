/**
 * Phase 12 Notification Templates
 */

export interface NotificationTemplate {
  id: string;
  eventType: string;
  channel: "WHATSAPP" | "EMAIL" | "IN_APP";
  name: string;
  subjectAr: string;
  subjectEn: string;
  bodyAr: string;
  bodyEn: string;
  isActive: boolean;
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "tpl_payment_received",
    eventType: "PAYMENT_RECORDED",
    channel: "WHATSAPP",
    name: "Payment Received Confirmation",
    subjectAr: "تأكيد استلام دفعة إيجارية",
    subjectEn: "Rent Payment Received Confirmation",
    bodyAr: "مرحباً {{tenantName}}، تم استلام دفعتكم بقيمة AED {{paymentAmount}} بتاريخ {{paymentDate}} بنجاح للعقد {{leaseReference}}.",
    bodyEn: "Dear {{tenantName}}, your rent payment of AED {{paymentAmount}} on {{paymentDate}} has been successfully received for lease {{leaseReference}}.",
    isActive: true,
  },
  {
    id: "tpl_maint_completed",
    eventType: "MAINTENANCE_COMPLETED",
    channel: "WHATSAPP",
    name: "Maintenance Completed",
    subjectAr: "اكتمال طلب الصيانة",
    subjectEn: "Maintenance Request Completed",
    bodyAr: "مرحباً {{tenantName}}، نود إعلامكم بأنه تم إنجاز طلب الصيانة رقم {{maintenanceRequestNumber}} بنجاح.",
    bodyEn: "Dear {{tenantName}}, we are pleased to inform you that maintenance request {{maintenanceRequestNumber}} has been successfully completed.",
    isActive: true,
  },
  {
    id: "tpl_cheque_bounced",
    eventType: "CHEQUE_BOUNCED",
    channel: "WHATSAPP",
    name: "Cheque Bounced Alert",
    subjectAr: "تنبيه: رجوع شيك بدون إفراز",
    subjectEn: "Alert: Cheque Returned / Bounced",
    bodyAr: "عناية {{tenantName}}، نود إفادتكم برجوع الشيك رقم {{chequeNumber}} بقيمة AED {{chequeAmount}} لسبب: {{returnReason}}. يرجى سرعة التسوية.",
    bodyEn: "Dear {{tenantName}}, please note that cheque #{{chequeNumber}} for AED {{chequeAmount}} was returned due to: {{returnReason}}. Immediate settlement is requested.",
    isActive: true,
  },
  {
    id: "tpl_statement_gen",
    eventType: "OWNER_STATEMENT_GENERATED",
    channel: "EMAIL",
    name: "Owner Statement Available",
    subjectAr: "توفر كشف حساب المالك الجديد",
    subjectEn: "Owner Financial Statement Available",
    bodyAr: "عزيزي المالك {{ownerName}}، تم إصدار كشف حسابكم للفترة {{statementPeriod}}. الرصيد الختامي: AED {{outstandingAmount}}.",
    bodyEn: "Dear Owner {{ownerName}}, your financial statement for period {{statementPeriod}} has been generated. Closing Balance: AED {{outstandingAmount}}.",
    isActive: true,
  },
];
