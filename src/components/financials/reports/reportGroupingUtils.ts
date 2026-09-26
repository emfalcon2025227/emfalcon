import { ReportGroupByOption, ReportGroup, GroupedReportResult, ReportItemBase } from "../../../types/reportingTypes";

export function groupReportItems<T extends ReportItemBase>(
  items: T[],
  groupBy: ReportGroupByOption = "NONE",
  isAr: boolean = true
): GroupedReportResult<T> {
  const totalCount = items.length;
  const grandTotalDebit = items.reduce((acc, curr) => acc + (curr.debit || 0), 0);
  const grandTotalCredit = items.reduce((acc, curr) => acc + (curr.credit || 0), 0);
  const grandTotalNet = items.reduce((acc, curr) => acc + (curr.balance !== undefined ? curr.balance : ((curr.credit || 0) - (curr.debit || 0))), 0);

  if (groupBy === "NONE" || !groupBy) {
    const singleGroup: ReportGroup<T> = {
      groupKey: "all",
      groupTitle: isAr ? "جميع المعاملات" : "All Transactions",
      items,
      itemCount: items.length,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      netBalance: grandTotalNet,
    };
    return {
      groups: [singleGroup],
      totalCount,
      grandTotalDebit,
      grandTotalCredit,
      grandTotalNet,
    };
  }

  const map = new Map<string, { title: string; subLabel?: string; items: T[] }>();

  for (const item of items) {
    let key = "other";
    let title = isAr ? "غير محدد" : "Unspecified";
    let subLabel: string | undefined = undefined;

    switch (groupBy) {
      case "OWNER":
        key = item.ownerId || "no_owner";
        title = item.ownerName || (isAr ? "بدون مالك" : "No Owner");
        subLabel = item.ownerId ? `ID: ${item.ownerId}` : undefined;
        break;

      case "TENANT":
        key = item.tenantId || "no_tenant";
        title = item.tenantName || (isAr ? "بدون مستأجر" : "No Tenant");
        subLabel = item.tenantId ? `ID: ${item.tenantId}` : undefined;
        break;

      case "PROPERTY":
        key = item.propertyId || "no_property";
        title = item.propertyName || (isAr ? "بدون عقار" : "No Property");
        subLabel = item.ownerName ? (isAr ? `المالك: ${item.ownerName}` : `Owner: ${item.ownerName}`) : undefined;
        break;

      case "CATEGORY":
        key = item.category || "GENERAL";
        title = item.category || (isAr ? "عام" : "General");
        break;

      case "MONTH":
        if (item.date) {
          const d = item.date.slice(0, 7); // YYYY-MM
          key = d;
          title = d;
        } else {
          key = "unknown_date";
          title = isAr ? "تاريخ غير محدد" : "Unknown Date";
        }
        break;

      case "PAYMENT_METHOD":
        key = item.paymentMethod || "OTHER";
        title = item.paymentMethod || (isAr ? "أخرى" : "Other");
        break;

      default:
        key = "all";
        title = isAr ? "الكل" : "All";
    }

    if (!map.has(key)) {
      map.set(key, { title, subLabel, items: [] });
    }
    map.get(key)!.items.push(item);
  }

  const groups: ReportGroup<T>[] = [];
  map.forEach((value, key) => {
    const totalDebit = value.items.reduce((acc, curr) => acc + (curr.debit || 0), 0);
    const totalCredit = value.items.reduce((acc, curr) => acc + (curr.credit || 0), 0);
    const netBalance = value.items.reduce((acc, curr) => acc + (curr.balance !== undefined ? curr.balance : ((curr.credit || 0) - (curr.debit || 0))), 0);

    groups.push({
      groupKey: key,
      groupTitle: value.title,
      groupSubLabel: value.subLabel,
      items: value.items,
      itemCount: value.items.length,
      totalDebit,
      totalCredit,
      netBalance,
    });
  });

  // Sort groups alphabetically by title
  groups.sort((a, b) => a.groupTitle.localeCompare(b.groupTitle));

  return {
    groups,
    totalCount,
    grandTotalDebit,
    grandTotalCredit,
    grandTotalNet,
  };
}
