/**
 * Automated Communication & Notification Service
 * Fully automated server-side dispatching for Emails and one-click WhatsApp dispatching.
 * Completely eliminates mailto / Outlook popups.
 */

import { getOwnerPortalLoginUrl, getTenantPortalLoginUrl } from "./portalProvisioningService";

export interface PortalAccessDispatchParams {
  recipient: string;
  role: "OWNER" | "TENANT" | "PROPERTY_OWNER";
  name: string;
  username: string;
  password?: string;
  loginUrl?: string;
}

export interface ReceiptDispatchParams {
  recipient?: string;
  ownerEmail?: string;
  tenantNameAr?: string;
  tenantNameEn?: string;
  ownerName?: string;
  receiptNumber: string;
  amount: number;
  paymentMethod?: string;
  payerName?: string;
  chequeNumber?: string;
  chequeAmount?: number;
  date?: string;
  propertyName?: string;
  unitNumber?: string;
  remainingBalance?: number;
}

export interface LeaseDispatchParams {
  recipientTenantEmail?: string;
  recipientOwnerEmail?: string;
  leaseNumber: string;
  isRenewal?: boolean;
  tenantName: string;
  ownerName: string;
  propertyName: string;
  unitNumber: string;
  annualRent: number;
  startDate: string;
  endDate: string;
  paymentTerms?: string;
}

export interface TenantWelcomeDispatchParams {
  recipient: string;
  tenantName: string;
  tenantCode: string;
  phone?: string;
  tenantType?: string;
  portalUrl?: string;
}

// 1. Dispatch Portal Access Credentials Email
export async function dispatchPortalAccessNotification(params: PortalAccessDispatchParams): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}> {
  try {
    const isOwner = params.role === "OWNER" || params.role === "PROPERTY_OWNER";
    const resolvedUrl = params.loginUrl || (isOwner ? getOwnerPortalLoginUrl() : getTenantPortalLoginUrl());

    const res = await fetch("/api/notifications/dispatch-portal-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        loginUrl: resolvedUrl,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP error ${res.status}` };
    }
    return { success: true, ...data };
  } catch (err: any) {
    console.error("dispatchPortalAccessNotification error:", err);
    return { success: false, error: err?.message || "Failed to dispatch portal credentials" };
  }
}

// 2. Dispatch Collection Receipt Notification (to Tenant & Owner)
export async function dispatchReceiptNotification(params: ReceiptDispatchParams): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}> {
  try {
    if (!params.recipient && !params.ownerEmail) {
      return { success: false, error: "No recipient email provided" };
    }

    const res = await fetch("/api/notifications/dispatch-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP error ${res.status}` };
    }
    return { success: true, ...data };
  } catch (err: any) {
    console.error("dispatchReceiptNotification error:", err);
    return { success: false, error: err?.message || "Failed to dispatch receipt notification" };
  }
}

// 3. Dispatch Lease Notification (New registration or renewal)
export async function dispatchLeaseNotification(params: LeaseDispatchParams): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}> {
  try {
    if (!params.recipientTenantEmail && !params.recipientOwnerEmail) {
      return { success: false, error: "No recipient email provided" };
    }

    const res = await fetch("/api/notifications/dispatch-lease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP error ${res.status}` };
    }
    return { success: true, ...data };
  } catch (err: any) {
    console.error("dispatchLeaseNotification error:", err);
    return { success: false, error: err?.message || "Failed to dispatch lease notification" };
  }
}

// 4. Dispatch Tenant Welcome Notification
export async function dispatchTenantWelcomeNotification(params: TenantWelcomeDispatchParams): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}> {
  try {
    if (!params.recipient) {
      return { success: false, error: "Recipient email is required" };
    }

    const res = await fetch("/api/notifications/dispatch-tenant-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP error ${res.status}` };
    }
    return { success: true, ...data };
  } catch (err: any) {
    console.error("dispatchTenantWelcomeNotification error:", err);
    return { success: false, error: err?.message || "Failed to dispatch tenant welcome email" };
  }
}

// 5. Clean phone number and open WhatsApp directly with pre-composed text
export function openWhatsAppDirect(phone: string, text: string): void {
  if (!phone) {
    alert("رقم الهاتف غير متوفر للإرسال عبر واتساب");
    return;
  }

  // Remove spaces, dashes, brackets
  let clean = phone.replace(/[^\d+]/g, "");

  // If UAE number starts with 05, replace with 9715
  if (clean.startsWith("05")) {
    clean = "971" + clean.substring(1);
  } else if (clean.startsWith("+")) {
    clean = clean.substring(1);
  }

  const encodedText = encodeURIComponent(text.trim());
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${clean}&text=${encodedText}`;

  // Safe window open without interfering with iframe restrictions
  const link = document.createElement("a");
  link.href = whatsappUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 6. Pre-formatted WhatsApp text generators
export function formatWhatsAppPortalAccess(name: string, role: string, username: string, password?: string): string {
  const portalName = role === "OWNER" || role === "PROPERTY_OWNER" ? "بوابة المالك الاستثمارية" : "بوابة المستأجر";
  const url = role === "OWNER" || role === "PROPERTY_OWNER" ? getOwnerPortalLoginUrl() : getTenantPortalLoginUrl();

  return `
مرحباً بك ${name}،
تم تفعيل حسابك في ${portalName} لدى صقر الإمارات للعقارات.

بيانات الدخول:
• اسم المستخدم: ${username}
${password ? `• كلمة المرور المؤقتة: ${password}` : ""}
• رابط تسجيل الدخول المباشر:
${url}

يسعدنا خدمتك دائماً.
`.trim();
}

export function formatWhatsAppReceipt(receiptNumber: string, tenantName: string, amount: number, propertyName?: string, unitNumber?: string): string {
  return `
سند قبض رسمي معتمد — صقر الإمارات للعقارات
=====================================
عزيزي ${tenantName}،
تم بنجاح تسجيل استلام سند القبض رقم #${receiptNumber}.
• المبلغ: ${Number(amount).toLocaleString()} درهم إماراتي
• العقار: ${propertyName || "عقار صقر الإمارات"}
• الوحدة: ${unitNumber || "-"}

شكراً لتعاملكم معنا.
`.trim();
}

export function formatWhatsAppLease(leaseNumber: string, tenantName: string, isRenewal: boolean, propertyName: string, unitNumber: string, annualRent: number, endDate: string): string {
  const action = isRenewal ? "تجديد عقد الإيجار" : "تسجيل وتوثيق عقد الإيجار الجديد";
  return `
إشعار رسمي: ${action} — صقر الإمارات للعقارات
=====================================
عزيزي ${tenantName}،
تم بنجاح ${action} برقم العقد #${leaseNumber}.
• العقار: ${propertyName}
• رقم الوحدة: ${unitNumber}
• القيمة الإيجارية: ${Number(annualRent).toLocaleString()} درهم إماراتي
• تاريخ انتهاء العقد: ${endDate}

يمكنكم متابعة تفاصيل العقد والشيكات عبر بوابتكم الإلكترونية.
`.trim();
}
