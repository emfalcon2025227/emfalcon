import { Lease } from "../types";

export interface LeaseRenewalEligibility {
  isEligible: boolean;
  daysRemaining: number;
  isExpired: boolean;
  isWithin30Days: boolean;
  earliestAllowedRenewalDate: string;
  leaseEndDate: string;
  ruleTitle: string;
  message: string;
  statusBadgeText: string;
  statusBadgeVariant: "success" | "warning" | "danger" | "neutral";
}

/**
 * Calculates whether a lease is eligible for renewal according to company policy:
 * Rule: A lease can ONLY be renewed when it is expired OR within 30 days (1 month) before its expiration date.
 * If more than 30 days remain, renewal is strictly blocked.
 */
export function getLeaseRenewalEligibility(
  lease: Lease | null | undefined,
  language: "ar" | "en" = "ar"
): LeaseRenewalEligibility {
  const isAr = language === "ar";

  if (!lease || !lease.endDate) {
    return {
      isEligible: false,
      daysRemaining: 0,
      isExpired: false,
      isWithin30Days: false,
      earliestAllowedRenewalDate: "",
      leaseEndDate: "",
      ruleTitle: isAr ? "تحديد عقد الإيجار" : "Select Lease",
      message: isAr
        ? "يرجى اختيار عقد إيجار صالح للتحقق من أهلية التجديد."
        : "Please select a valid lease to verify renewal eligibility.",
      statusBadgeText: isAr ? "غير محدد" : "Unspecified",
      statusBadgeVariant: "neutral",
    };
  }

  // Parse today's date at midnight local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse contract end date at midnight
  const endDateObj = new Date(lease.endDate);
  endDateObj.setHours(0, 0, 0, 0);

  // Calculate days remaining
  const diffTime = endDateObj.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Calculate the earliest allowed renewal date (30 days before end date)
  const earliestDateObj = new Date(endDateObj);
  earliestDateObj.setDate(earliestDateObj.getDate() - 30);
  const earliestAllowedRenewalDate = earliestDateObj.toISOString().split("T")[0];

  const isExpired = daysRemaining <= 0;
  const isWithin30Days = daysRemaining > 0 && daysRemaining <= 30;
  const isEligible = isExpired || isWithin30Days;

  let ruleTitle = "";
  let message = "";
  let statusBadgeText = "";
  let statusBadgeVariant: "success" | "warning" | "danger" | "neutral" = "neutral";

  if (isExpired) {
    ruleTitle = isAr ? "عقد منتهي - متاح للتجديد" : "Expired Lease - Eligible for Renewal";
    message = isAr
      ? `العقد #${lease.leaseNumber} منتهي الصلاحية منذ (${Math.abs(daysRemaining)}) يوماً (تاريخ الانتهاء: ${lease.endDate}). وهو متاح للتجديد الآن.`
      : `Contract #${lease.leaseNumber} expired (${Math.abs(daysRemaining)}) days ago (End Date: ${lease.endDate}). It is eligible for renewal now.`;
    statusBadgeText = isAr ? `🔴 منتهي (متاح للتجديد)` : `🔴 Expired (Eligible)`;
    statusBadgeVariant = "danger";
  } else if (isWithin30Days) {
    ruleTitle = isAr ? "خلال فترة السماح بالتجديد (أقل من 30 يوماً)" : "Within 30-Day Renewal Window";
    message = isAr
      ? `العقد #${lease.leaseNumber} ينتهي خلال (${daysRemaining}) يوماً (تاريخ الانتهاء: ${lease.endDate}). يقع ضمن مهلة الـ 30 يوماً المسموح فيها ببدء إجراءات التجديد.`
      : `Contract #${lease.leaseNumber} expires in (${daysRemaining}) days (End Date: ${lease.endDate}). It is within the allowed 30-day renewal window.`;
    statusBadgeText = isAr ? `🟡 ينتهي خلال ${daysRemaining} يوم (متاح للتجديد)` : `🟡 Expiring in ${daysRemaining}d (Eligible)`;
    statusBadgeVariant = "warning";
  } else {
    ruleTitle = isAr ? "تجديد مبكر غير مسموح به" : "Early Renewal Not Allowed";
    message = isAr
      ? `لا يمكن تجديد العقد #${lease.leaseNumber} حالياً. تنص اللائحة على عدم إمكانية تجديد العقد إلا عند انتهائه أو خلال فترة شهر (30 يوماً) قبل تاريخ الانتهاء.\nالمتبقي على انتهاء هذا العقد (${daysRemaining}) يوماً (تاريخ الانتهاء: ${lease.endDate}).\nأقرب موعد مسموح به لبدء التجديد هو: ${earliestAllowedRenewalDate}.`
      : `Contract #${lease.leaseNumber} cannot be renewed yet. Company policy allows renewal only upon expiration or within 30 days prior to the expiration date.\nRemaining time: (${daysRemaining}) days (Expiry: ${lease.endDate}).\nEarliest allowed renewal date: ${earliestAllowedRenewalDate}.`;
    statusBadgeText = isAr ? `⏳ غير متاح للتجديد (متبقي ${daysRemaining} يوم)` : `⏳ Not Eligible (${daysRemaining}d left)`;
    statusBadgeVariant = "neutral";
  }

  return {
    isEligible,
    daysRemaining,
    isExpired,
    isWithin30Days,
    earliestAllowedRenewalDate,
    leaseEndDate: lease.endDate,
    ruleTitle,
    message,
    statusBadgeText,
    statusBadgeVariant,
  };
}
