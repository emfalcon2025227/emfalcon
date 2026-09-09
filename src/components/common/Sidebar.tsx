import React from "react";
import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  BadgePercent,
  Scale,
  Calendar,
  Wrench,
  Building,
  Users,
  KeyRound,
  FileSpreadsheet,
  FolderLock,
  MessageSquare,
  Sliders,
  BarChart3,
  UploadCloud,
  ShieldCheck,
  History,
  FileCheck,
  RotateCcw,
  RotateCw,
  Settings as SettingsIcon,
  Activity,
  X,
  Printer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { Permission, ViewState } from "../../types";
import { isBouncedWithoutLegalAction } from "../../utils/chequeUtils";

export type NavView = ViewState;

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemConfig {
  id: NavView;
  labelKey: any;
  icon: React.ReactNode;
  requiredPermission?: Permission;
  badgeCount?: number;
  badgeVariant?: "danger" | "warning" | "info" | "neutral";
  sectionHeaderKey?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const { hasPermission, currentUser, loginMode } = useAuth();
  console.log("Sidebar: currentUser =", currentUser, "loginMode =", loginMode);
  const { cheques, cases, notifications, units, leases, maintenanceRequests } = useData();

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    navFinancialsHeader: false,
    navCoreOperations: false,
    navMasterData: false,
    electronicArchive: false,
    reportExecutiveSummary: false,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const bouncedActiveCount = cheques.filter((c) =>
    isBouncedWithoutLegalAction(c, cases)
  ).length;

  const getSectionBadge = (sectionKey: string) => {
    if (sectionKey === "navFinancialsHeader" && bouncedActiveCount > 0) {
      return { count: bouncedActiveCount, variant: "danger" as const };
    }
    if (sectionKey === "navCoreOperations") {
      const total = activeCasesCount + openMaintenanceCount;
      if (total > 0) return { count: total, variant: "warning" as const };
    }
    if (sectionKey === "electronicArchive" && pendingRemindersCount > 0) {
      return { count: pendingRemindersCount, variant: "info" as const };
    }
    return null;
  };
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
  const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

  const dueCurrentMonthCount = cheques.filter((c) => {
    const s = (c.status || "").toUpperCase().trim();
    if (s !== "PENDING" && s !== "DEPOSITED" && s !== "POST_DATED") return false;
    const d = new Date(c.dueDate);
    return d >= startOfCurrentMonth && d <= endOfCurrentMonth;
  }).length;

  const activeCasesCount = cases.filter((c) => {
    const s = (c.status || "").toUpperCase().trim();
    return s !== "CLOSED" && s !== "ARCHIVED" && s !== "SETTLED";
  }).length;
  const pendingRemindersCount = notifications.filter(
    (n) => (n.type === "THREE_DAY_REMINDER" || n.type === "SEVEN_DAY_REMINDER") && (n.status || "").toUpperCase() === "PENDING"
  ).length;
  const openMaintenanceCount = (maintenanceRequests || []).filter((m) => {
    const s = (m.status || "").toUpperCase().trim();
    return s === "OPEN" || s === "IN_PROGRESS" || s === "ASSIGNED" || s === "PENDING";
  }).length;

  const isTenantMode = loginMode === "TENANT";

  const allNavItems: NavItemConfig[] = [
    {
      id: "DASHBOARD",
      labelKey: "navDashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      requiredPermission: "VIEW_DASHBOARD",
    },
    {
      id: "TENANT_PORTAL",
      labelKey: "navTenantPortal",
      icon: <LayoutDashboard className="w-4 h-4" />,
      requiredPermission: "TENANT_VIEW_OWN_DATA",
    },
    {
      id: "OWNER_PORTAL",
      labelKey: language === "ar" ? "بوابة المالك الاستثمارية" : "Owner Portal",
      icon: <LayoutDashboard className="w-4 h-4" />,
      requiredPermission: "OWNER_VIEW_OWN_DATA",
    },
    // Financial Center & Admin Fees
    {
      id: "FINANCIALS",
      labelKey: "navFinancials",
      icon: <BadgePercent className="w-4 h-4" />,
      requiredPermission: "RECORD_COLLECTIONS",
      sectionHeaderKey: "navFinancialsHeader",
    },
    {
      id: "CHEQUE_OPERATIONS",
      labelKey: "navChequeOperations",
      icon: <CreditCard className="w-4 h-4" />,
      requiredPermission: "MANAGE_CHEQUES",
      badgeCount: bouncedActiveCount > 0 ? bouncedActiveCount : undefined,
      badgeVariant: "danger",
    },
    {
      id: "COLLECTIONS_CENTER",
      labelKey: language === "ar" ? "مركز التحصيل" : "Collection Center",
      icon: <History className="w-4 h-4" />,
      requiredPermission: "RECORD_COLLECTIONS",
    },
    {
      id: "PRINT_CENTER",
      labelKey: language === "ar" ? "مركز طباعة السندات والإيصالات" : "Receipt & Voucher Printing",
      icon: <Printer className="w-4 h-4" />,
      requiredPermission: "RECORD_COLLECTIONS",
    },
    // Core Operational Modules
    {
      id: "LEASES",
      labelKey: "navLeases",
      icon: <FileSpreadsheet className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
      sectionHeaderKey: "navCoreOperations",
    },
    {
      id: "RENEW_LEASE",
      labelKey: language === "ar" ? "تجديد العقود (المتكامل)" : "Lease Renewal",
      icon: <RotateCw className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
    },
    {
      id: "CASES",
      labelKey: "navCases",
      icon: <Scale className="w-4 h-4" />,
      requiredPermission: "MANAGE_CASES",
      badgeCount: activeCasesCount,
      badgeVariant: "warning",
    },
    {
      id: "HEARINGS",
      labelKey: "navHearings",
      icon: <Calendar className="w-4 h-4" />,
      requiredPermission: "MANAGE_HEARINGS",
    },
    {
      id: "MAINTENANCE",
      labelKey: "navMaintenance",
      icon: <Wrench className="w-4 h-4" />,
      requiredPermission: "VIEW_MAINTENANCE",
      badgeCount: openMaintenanceCount > 0 ? openMaintenanceCount : undefined,
      badgeVariant: "warning",
    },
    // Master Data
    {
      id: "OWNERS",
      labelKey: "navOwners",
      icon: <Users className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
      sectionHeaderKey: "navMasterData",
    },
    {
      id: "PROPERTIES",
      labelKey: "navProperties",
      icon: <Building className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
    },
    {
      id: "PROPERTY_REVIEW",
      labelKey: language === "ar" ? "مراجعة المحفظة العقارية" : "Property Portfolio Review",
      icon: <Building className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
    },
    {
      id: "UNITS",
      labelKey: "navUnits",
      icon: <KeyRound className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
    },
    {
      id: "TENANTS",
      labelKey: "navTenants",
      icon: <Users className="w-4 h-4" />,
      requiredPermission: "MANAGE_MASTER_DATA",
    },
    // Communications & Security Archive
    {
      id: "COMMUNICATION_CENTER",
      labelKey: language === "ar" ? "مركز الاتصال الموحد" : "Unified Communication",
      icon: <MessageSquare className="w-4 h-4" />,
      requiredPermission: "DISPATCH_NOTIFICATIONS",
      sectionHeaderKey: "electronicArchive",
    },
    {
      id: "ARCHIVE",
      labelKey: "navArchive",
      icon: <FolderLock className="w-4 h-4" />,
      requiredPermission: "MANAGE_ARCHIVE",
    },
    {
      id: "AUDIT_LOGS",
      labelKey: "navAuditLogs",
      icon: <History className="w-4 h-4" />,
      requiredPermission: "MANAGE_ARCHIVE",
    },
    {
      id: "DATA_RECOVERY",
      labelKey: "navDataRecovery",
      icon: <RotateCcw className="w-4 h-4" />,
      requiredPermission: "DELETE_RECORDS",
    },
    {
      id: "NOTIFICATIONS",
      labelKey: "navNotifications",
      icon: <MessageSquare className="w-4 h-4" />,
      requiredPermission: "DISPATCH_NOTIFICATIONS",
      badgeCount: pendingRemindersCount > 0 ? pendingRemindersCount : undefined,
      badgeVariant: "info",
    },
    // Reports & Operations
    {
      id: "OPERATIONAL_CONTROL",
      labelKey: language === "ar" ? "مركز الرقابة التشغيلية" : "Operational Control",
      icon: <Activity className="w-4 h-4" />,
      requiredPermission: "VIEW_DASHBOARD",
      sectionHeaderKey: "reportExecutiveSummary",
    },
    {
      id: "PROPERTY_OPERATIONS",
      labelKey: "navPropertyOperations",
      icon: <Building className="w-4 h-4" />,
      requiredPermission: "VIEW_DASHBOARD",
    },
    {
      id: "DOCUMENT_CONTROL",
      labelKey: "navDocumentControl",
      icon: <FolderLock className="w-4 h-4" />,
      requiredPermission: "MANAGE_ARCHIVE",
    },
    {
      id: "TASK_CENTER",
      labelKey: "navTaskCenter",
      icon: <FileCheck className="w-4 h-4" />,
      requiredPermission: "VIEW_DASHBOARD",
    },
    {
      id: "REPORTS",
      labelKey: "navReports",
      icon: <BarChart3 className="w-4 h-4" />,
      requiredPermission: "VIEW_REPORTS",
    },
    {
      id: "SETTINGS",
      labelKey: "navSettingsAndKPIs",
      icon: <SettingsIcon className="w-4 h-4" />,
      requiredPermission: "CONFIGURE_RISK",
    },
    {
      id: "ADMIN_CENTER",
      labelKey: "navAdminCenter",
      icon: <ShieldCheck className="w-4 h-4" />,
      requiredPermission: "CONFIGURE_RISK",
    },
  ];

  const isOwnerMode = loginMode === "OWNER" || currentUser?.role === "OWNER" || currentUser?.role === "PROPERTY_OWNER";

  const navItems = allNavItems.filter(item => {
    if (isTenantMode) {
      return item.id === "TENANT_PORTAL" || item.id === "SETTINGS";
    }
    if (isOwnerMode) {
      return item.id === "OWNER_PORTAL" || item.id === "PROPERTY_REVIEW" || item.id === "COMMUNICATION_CENTER" || item.id === "SETTINGS";
    }
    return item.id !== "TENANT_PORTAL" && item.id !== "OWNER_PORTAL" && item.id !== "PROPERTY_REVIEW";
  });

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-main-sidebar"
        className={`fixed top-0 bottom-0 start-0 z-40 w-72 bg-white border-e border-slate-200/90 flex flex-col transition-all duration-300 ease-in-out lg:static lg:h-full lg:max-h-full lg:translate-x-0 lg:rtl:translate-x-0 lg:shrink-0 print:hidden ${
          isOpen
            ? "translate-x-0 rtl:translate-x-0 shadow-2xl lg:shadow-none"
            : "-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0"
        }`}
      >
        {/* Mobile Close Button */}
        <div className="p-3 border-b border-slate-100 flex justify-end lg:hidden shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-1.5 scrollbar-thin">
          {navItems.map((item, index) => {
            if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
              return null;
            }

            const isActive = currentView === item.id;
            const currentSectionKey = item.sectionHeaderKey;
            
            // Find if this item belongs to a collapsed section
            // We need to look back at the items to find which section we are currently in
            let itemSection: string | undefined = undefined;
            for (let i = index; i >= 0; i--) {
              if (navItems[i].sectionHeaderKey) {
                itemSection = navItems[i].sectionHeaderKey;
                break;
              }
            }

            const isCollapsed = itemSection ? !expandedSections[itemSection] : false;

            return (
              <React.Fragment key={item.id}>
                {item.sectionHeaderKey && (() => {
                  const sectionBadge = getSectionBadge(item.sectionHeaderKey);
                  const isExpanded = Boolean(expandedSections[item.sectionHeaderKey]);
                  return (
                    <button
                      type="button"
                      onClick={() => toggleSection(item.sectionHeaderKey!)}
                      className="w-full flex items-center justify-between mt-3 mb-1 px-3 py-2 bg-slate-100/90 hover:bg-slate-200/80 rounded-lg group cursor-pointer transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-800 group-hover:text-slate-950 transition-colors truncate">
                          {t(item.sectionHeaderKey as any)}
                        </p>
                        {!isExpanded && sectionBadge && sectionBadge.count > 0 && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                              sectionBadge.variant === "danger"
                                ? "bg-rose-100 text-rose-700"
                                : sectionBadge.variant === "warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {sectionBadge.count}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 group-hover:text-slate-800 transition-colors shrink-0 ms-1">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        )}
                      </span>
                    </button>
                  );
                })()}

                {(!itemSection || !isCollapsed) && (
                  <button
                    id={`nav-link-${(item.id || "").toLowerCase().replace(/_/g, "-")}`}
                    type="button"
                    onClick={() => {
                      onSelectView(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 text-start group cursor-pointer ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 transition-colors ${
                          isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                    </div>

                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          isActive
                            ? "bg-amber-400 text-slate-950"
                            : item.badgeVariant === "danger"
                            ? "bg-rose-100 text-rose-700 font-bold"
                            : "bg-amber-100 text-amber-800 font-bold"
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    )}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </aside>
    </>
  );
};
