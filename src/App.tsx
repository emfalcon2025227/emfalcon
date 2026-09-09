import React, { useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, X, Bell, ShieldCheck } from "lucide-react";
import { initInputLanguageManager } from "./services/inputLanguageManager";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import { LayoutProvider, useLayout } from "./context/LayoutContext";
import { NavigationProvider, useNavigation } from "./context/NavigationContext";
import { ViewState, Tenant, Cheque, Lease } from "./types";
import { Header } from "./components/common/Header";
import { Sidebar } from "./components/common/Sidebar";
import { LayoutEditToggle } from "./components/common/LayoutEditToggle";
import { LoginView } from "./components/auth/LoginView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { OwnersView } from "./components/master/OwnersView";
import { PropertiesView } from "./components/master/PropertiesView";
import { UnitsView } from "./components/master/UnitsView";
import { TenantsView } from "./components/master/TenantsView";
import { LeasesView } from "./components/master/LeasesView";
import { RenewalView } from "./components/leases/RenewalView";
import { ChequeOperationsView } from "./components/cheques/ChequeOperationsView";
import { CollectionsView } from "./components/collections/CollectionsView";
import { FinancialsView } from "./components/financials/FinancialsView";
import { CasesView } from "./components/cases/CasesView";
import { HearingsCalendarView } from "./components/cases/HearingsCalendarView";
import { ReportsView } from "./components/reports/ReportsView";
import { ArchiveView } from "./components/archive/ArchiveView";
import { AuditLogsView } from "./components/audit/AuditLogsView";
import { NotificationsView } from "./components/notifications/NotificationsView";
import { DataRecoveryView } from "./components/admin/DataRecoveryView";
import { SettingsView } from "./components/settings/SettingsView";
import { AdministrationControlCenter } from "./components/admin/AdministrationControlCenter";
import { MaintenanceView } from "./components/maintenance/MaintenanceView";
import { CollectionCenter } from "./components/collections/CollectionCenter";
import { PendingAdministrativeFeeAlert } from "./components/collections/PendingAdministrativeFeeAlert";
import { TenantPortalView } from "./components/portal/TenantPortalView";
import { ForcePasswordChangeModal } from "./components/auth/ForcePasswordChangeModal";
import { PropertyOperationsDashboard } from "./components/master/PropertyOperationsDashboard";
import { DocumentControlCenter } from "./components/documents/DocumentControlCenter";
import { OperationalTaskCenter } from "./components/master/OperationalTaskCenter";
import { OperationalControlCenter } from "./components/operations/OperationalControlCenter";
import { Property360Workspace } from "./components/master/Property360Workspace";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Unit360Workspace } from "./components/master/Unit360Workspace";
import { Tenant360Workspace } from "./components/master/Tenant360Workspace";
import { Owner360Workspace } from "./components/master/Owner360Workspace";
import { RecordPaymentModal } from "./components/collections/RecordPaymentModal";
import { ReceiptVoucherModal } from "./components/collections/ReceiptVoucherModal";
import { ConvertToCaseModal } from "./components/cases/ConvertToCaseModal";
import { LegalNoticeGeneratorModal } from "./components/common/LegalNoticeGeneratorModal";
import { AIAssistantChat } from "./components/ai/AIAssistantChat";
import { ReportDesignerFloatingPanel } from "./components/settings/ReportDesignerFloatingPanel";
import { ReceiptAndVoucherPrintingCenter } from "./components/printing/ReceiptAndVoucherPrintingCenter";
import { CollectionRecord } from "./types";
import { PublicReceiptVerification } from "./components/public/PublicReceiptVerification";
import { OwnerPortalView } from "./components/owner-portal/OwnerPortalView";
import { PropertyReviewOverview } from "./components/properties/PropertyReviewOverview";
import { UnifiedCommunicationCenter } from "./components/communication/UnifiedCommunicationCenter";

const MainAppContent: React.FC = () => {
  const { language } = useLanguage();
  const { isAuthenticated, currentUser, loginMode } = useAuth();
  const isOwner = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SYSTEM_OWNER';
  const isTenantMode = loginMode === "TENANT";
  const isOwnerMode = loginMode === "OWNER" || currentUser?.role === "OWNER" || currentUser?.role === "PROPERTY_OWNER";

  const {
    currentView,
    navigateTo,
    selectedPropertyIdFor360,
    setSelectedPropertyIdFor360,
    selectedUnitIdFor360,
    setSelectedUnitIdFor360,
    selectedTenantIdFor360,
    setSelectedTenantIdFor360,
    selectedOwnerIdFor360,
    setSelectedOwnerIdFor360,
    closeCurrent360,
  } = useNavigation();

  const setCurrentView = (view: ViewState) => navigateTo(view);

  const [selectedLeaseForRenewal, setSelectedLeaseForRenewal] = useState<Lease | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQuotaDismissed, setIsQuotaDismissed] = useState(() => {
    return localStorage.getItem("ef_quota_dismissed") === "true";
  });

  // Initialize global automatic input language manager
  useEffect(() => {
    const cleanup = initInputLanguageManager();
    return cleanup;
  }, []);

  // Auto-redirect tenant and owner users to their portals on login
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (loginMode === "TENANT") {
        if (currentView !== "TENANT_PORTAL" && currentView !== "SETTINGS") {
          setCurrentView("TENANT_PORTAL");
        }
      } else if (isOwnerMode) {
        if (currentView !== "OWNER_PORTAL" && currentView !== "SETTINGS" && currentView !== "PROPERTY_REVIEW" && currentView !== "COMMUNICATION_CENTER") {
          setCurrentView("OWNER_PORTAL");
        }
      } else if (currentView === "TENANT_PORTAL") {
        setCurrentView("DASHBOARD");
      }
    }
  }, [isAuthenticated, loginMode, isOwnerMode, currentUser?.id]);

  // Global Cross-View Modal Triggers
  const { collections, tenants, cheques, isQuotaExceeded, companyProfile, owners } = useData();
  const { syncPortalAccounts } = useAuth();
  const [collectionCheque, setCollectionCheque] = useState<Cheque | null>(null);
  const [issuedReceipt, setIssuedReceipt] = useState<CollectionRecord | null>(null);
  const [convertCaseChequeIds, setConvertCaseChequeIds] = useState<string[]>([]);

  // Automatic Owner & Tenant Portal Account Provisioning & Synchronization
  useEffect(() => {
    if (owners.length > 0 || tenants.length > 0) {
      syncPortalAccounts(owners, tenants);
    }
  }, [owners, tenants]);

  // Manager Floating Approval Toast Notification State
  const [managerFloatingToast, setManagerFloatingToast] = useState<{
    show: boolean;
    leaseNumber: string;
    unitNumber: string;
  }>({ show: false, leaseNumber: "", unitNumber: "" });

  useEffect(() => {
    const handleFloatingToast = (e: any) => {
      if (e.detail) {
        setManagerFloatingToast({
          show: true,
          leaseNumber: e.detail.leaseNumber || "",
          unitNumber: e.detail.unitNumber || "",
        });
      }
    };
    window.addEventListener("show-manager-floating-toast", handleFloatingToast);
    return () => window.removeEventListener("show-manager-floating-toast", handleFloatingToast);
  }, []);

  // Support dispatching navigate-to-view custom events
  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail && e.detail.view) {
        if (e.detail.lease) {
          setSelectedLeaseForRenewal(e.detail.lease);
        }
        setCurrentView(e.detail.view);
      }
    };
    window.addEventListener("navigate-to-view", handleNavigate);
    return () => window.removeEventListener("navigate-to-view", handleNavigate);
  }, []);

  // Deep Link States for Legal Notice Modal printing
  const [printNoticeTenant, setPrintNoticeTenant] = useState<Tenant | null>(null);
  const [printNoticeCheques, setPrintNoticeCheques] = useState<Cheque[]>([]);
  const [printNoticeType, setPrintNoticeType] = useState<"EVICTION_NOTICE_30_DAYS" | "CHEQUE_PAYMENT_DEMAND" | "RDC_STATEMENT_OF_CLAIM" | "AMICABLE_SETTLEMENT_DEED">("EVICTION_NOTICE_30_DAYS");
  const [isPrintNoticeOpen, setIsPrintNoticeOpen] = useState(false);

  // URL query parameters deep link listener
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    
    // 1. Receipt Voucher Modal Deep Link
    const receiptId = params.get("printReceiptId");
    if (receiptId && collections.length > 0) {
      const rcp = collections.find((c) => c.id === receiptId);
      if (rcp) {
        setIssuedReceipt(rcp);
        setCurrentView("COLLECTIONS");
        
        // Clear params to prevent looping or annoying refreshes
        const url = new URL(window.location.href);
        url.searchParams.delete("printReceiptId");
        window.history.replaceState({}, "", url.toString());
      }
    }

    // 2. Legal Notice Generator Modal Deep Link
    const printNotice = params.get("printNotice");
    if (printNotice === "true" && tenants.length > 0) {
      const tenantId = params.get("tenantId");
      const chequeId = params.get("chequeId");
      const noticeType = params.get("noticeType") as any;

      const t = tenants.find((item) => item.id === tenantId);
      const c = cheques.find((item) => item.id === chequeId);

      if (t) {
        setPrintNoticeTenant(t);
        if (c) setPrintNoticeCheques([c]);
        if (noticeType) setPrintNoticeType(noticeType);
        setIsPrintNoticeOpen(true);
        setCurrentView("BOUNCED_CHEQUES");

        const url = new URL(window.location.href);
        url.searchParams.delete("printNotice");
        url.searchParams.delete("tenantId");
        url.searchParams.delete("chequeId");
        url.searchParams.delete("noticeType");
        window.history.replaceState({}, "", url.toString());
      }
    }

    // 3. Maintenance Views Deep Links (Switch view; component useEffect handles modal trigger)
    const printWorkOrderId = params.get("printWorkOrderId");
    const printOwnerStatement = params.get("printOwnerStatement");
    if (printWorkOrderId || printOwnerStatement === "true") {
      setCurrentView("MAINTENANCE");
    }

    // 4. Reports View Deep Links (Switch view; ReportsView useEffect handles print mode)
    const printReportType = params.get("printReportType");
    if (printReportType) {
      setCurrentView("REPORTS");
    }
  }, [isAuthenticated, collections, tenants, cheques]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div
      dir={language === "ar" ? "rtl" : "ltr"}
      className={`h-screen h-dvh max-h-screen bg-slate-100 print:bg-white flex flex-col font-sans overflow-hidden print:h-auto print:max-h-none print:min-h-0 print:overflow-visible ${
        language === "ar" ? "font-cairo" : ""
      }`}
    >
      <style>{`
        div#root:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3) {
          background-color: #f0fbf0 !important;
        }
      `}</style>
      
      {companyProfile?.customReportCss && (
        <style dangerouslySetInnerHTML={{ __html: companyProfile.customReportCss }} />
      )}
      
      {companyProfile?.reportBackgroundUrl && (
        <style dangerouslySetInnerHTML={{ __html: `
          #printable-report-card, #report-print-area, .report-sheet, .printable-document {
            position: relative;
            background-color: transparent !important;
          }
          #printable-report-card::before, #report-print-area::before, .report-sheet::before, .printable-document::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('${companyProfile.reportBackgroundUrl}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: ${companyProfile.reportBackgroundOpacity ?? 0.15};
            pointer-events: none;
            z-index: 0;
          }
          #printable-report-card > *, #report-print-area > *, .report-sheet > *, .printable-document > * {
            position: relative;
            z-index: 1;
          }
          @media print {
            #printable-report-card::before, #report-print-area::before, .report-sheet::before, .printable-document::before {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />
      )}

      {/* Top Header */}
      <Header
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenNotifications={() => setCurrentView("NOTIFICATIONS")}
        onOpenGlobalSearch={() => setCurrentView("CHEQUE_OPERATIONS")}
      />

      {!isTenantMode && !isOwnerMode && currentView !== "TENANT_PORTAL" && currentView !== "OWNER_PORTAL" && (
        <div className="shrink-0 print:hidden">
          <PendingAdministrativeFeeAlert />
        </div>
      )}

      {isQuotaExceeded && !isQuotaDismissed && (
        <div className="bg-amber-50 border-y border-amber-200 py-3 px-4 sm:px-6 lg:px-8 shrink-0 print:hidden">
          <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
            <div className="flex items-start md:items-center gap-3 text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5 md:mt-0" />
              <div>
                <p className="font-semibold text-amber-900 leading-snug">
                  {language === "ar" ? "تنبيه: تم تجاوز حصة الاستعلام المجانية اليومية لقاعدة البيانات" : "Firestore Daily Free Read Quota Exceeded"}
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  {language === "ar" 
                    ? "يقوم النظام حالياً بالعمل تلقائياً عبر قاعدة البيانات الاحتياطية المحلية (Offline System) لضمان استمرارية عرض البيانات."
                    : "The system is running on a secure local offline fallback database to ensure service continuity."
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start md:self-auto">
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0196715356/firestore/databases/ai-studio-remixremixremix-1f3ed13b-ad6e-42e5-91b7-9eb0225a5b58/data?openUpgradeDialog=true"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all text-xs"
              >
                <span>{language === "ar" ? "ترقية الخطة وإزالة القيود" : "Upgrade Plan / Remove Limits"}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => {
                  setIsQuotaDismissed(true);
                  try {
                    localStorage.setItem("ef_quota_dismissed", "true");
                  } catch (e) {}
                }}
                className="text-amber-700 hover:text-amber-950 p-1.5 hover:bg-amber-100 rounded-lg transition-all flex items-center justify-center shrink-0"
                title={language === "ar" ? "إغلاق التنبيه" : "Dismiss warning"}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden print:overflow-visible print:block print:h-auto">
        {/* Sidebar Navigation */}
        <Sidebar
          currentView={currentView as any}
          onSelectView={(view) => {
            setCurrentView(view as ViewState);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Content View Canvas */}
        <main
          id="app-main-content-canvas"
          className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-auto p-3 sm:p-5 lg:p-6 w-full print:overflow-visible print:h-auto print:p-0"
        >
          <div className="w-full print:max-w-none print:mx-0">
            {currentView === "DASHBOARD" && !isTenantMode && (
              <DashboardView
                onNavigateToCheques={() => setCurrentView("CHEQUE_OPERATIONS")}
                onNavigateToBouncedCheques={() => setCurrentView("CHEQUE_OPERATIONS")}
                onNavigateToCases={() => setCurrentView("CASES")}
                onNavigateToCollections={() => setCurrentView("COLLECTIONS")}
                onNavigateToUnits={() => setCurrentView("UNITS")}
                onNavigateToLeases={() => setCurrentView("LEASES")}
                onNavigateToProperties={() => setCurrentView("PROPERTIES")}
                onNavigateToTenants={() => setCurrentView("TENANTS")}
                onNavigateToOwners={() => setCurrentView("OWNERS")}
                onNavigateToMaintenance={() => setCurrentView("MAINTENANCE")}
                onSelectTenant={(t) => setSelectedTenantIdFor360(t.id)}
              />
            )}

            {currentView === "OWNERS" && !isTenantMode && <OwnersView />}
            {currentView === "PROPERTIES" && !isTenantMode && (
              <PropertiesView
                onNavigateToUnits={() => setCurrentView("UNITS")}
                onNavigateToLeases={() => setCurrentView("LEASES")}
              />
            )}
            {currentView === "UNITS" && !isTenantMode && <UnitsView />}
            {currentView === "TENANTS" && !isTenantMode && (
              <TenantsView onSelectTenant={(t) => setSelectedTenantIdFor360(t.id)} />
            )}
            {currentView === "LEASES" && !isTenantMode && (
              <LeasesView
                onNavigateToRenewLease={(lease) => {
                  setSelectedLeaseForRenewal(lease);
                  setCurrentView("RENEW_LEASE");
                }}
              />
            )}

            {currentView === "RENEW_LEASE" && !isTenantMode && (
              <RenewalView
                lease={selectedLeaseForRenewal}
                onBack={() => setCurrentView("LEASES")}
                onComplete={() => {
                  setCurrentView("LEASES");
                }}
              />
            )}

            {(currentView === "CHEQUE_OPERATIONS" || currentView === "CHEQUES" || currentView === "BOUNCED_CHEQUES" || currentView === "DUE_CHEQUES") && !isTenantMode && (
              <ChequeOperationsView
                initialTab={currentView === "BOUNCED_CHEQUES" ? "RETURNED" : "PDC"}
                onOpenCollectionModal={(chq) => setCollectionCheque(chq)}
                onOpenConvertToCaseModal={(ids) => setConvertCaseChequeIds(ids)}
              />
            )}

            {currentView === "COLLECTIONS" && !isTenantMode && <CollectionsView />}
            {currentView === "FINANCIALS" && !isTenantMode && (
              <ErrorBoundary>
                <FinancialsView />
              </ErrorBoundary>
            )}
            {currentView === "COLLECTIONS_CENTER" && !isTenantMode && <CollectionCenter />}
            {currentView === "PRINT_CENTER" && !isTenantMode && <ReceiptAndVoucherPrintingCenter />}
            {currentView === "CASES" && !isTenantMode && <CasesView />}
            {currentView === "HEARINGS" && !isTenantMode && <HearingsCalendarView />}
            {currentView === "MAINTENANCE" && !isTenantMode && <MaintenanceView />}
            {currentView === "REPORTS" && !isTenantMode && <ReportsView />}
            {currentView === "ARCHIVE" && !isTenantMode && <ArchiveView />}
            {currentView === "AUDIT_LOGS" && !isTenantMode && <AuditLogsView />}
            {currentView === "DATA_RECOVERY" && !isTenantMode && <DataRecoveryView />}
            {currentView === "NOTIFICATIONS" && <NotificationsView />}
            {currentView === "SETTINGS" && <SettingsView />}
            {currentView === "ADMIN_CENTER" && !isTenantMode && <AdministrationControlCenter />}
            {currentView === "PROPERTY_OPERATIONS" && !isTenantMode && (
              <PropertyOperationsDashboard
                onNavigateToProperty={(pId) => setSelectedPropertyIdFor360(pId)}
                onNavigateToUnit={(uId) => setSelectedUnitIdFor360(uId)}
                onNavigateToTenant={(tId) => setSelectedTenantIdFor360(tId)}
                onNavigateToLeases={() => setCurrentView("LEASES")}
                onNavigateToMaintenance={() => setCurrentView("MAINTENANCE")}
                onNavigateToCases={() => setCurrentView("CASES")}
                onNavigateToDocuments={() => setCurrentView("DOCUMENT_CONTROL")}
              />
            )}
            {currentView === "DOCUMENT_CONTROL" && !isTenantMode && <DocumentControlCenter />}
            {currentView === "TASK_CENTER" && !isTenantMode && <OperationalTaskCenter />}
            {currentView === "OPERATIONAL_CONTROL" && !isTenantMode && (
              <OperationalControlCenter
                onNavigateToProperty={(pId) => setSelectedPropertyIdFor360(pId)}
                onNavigateToUnit={(uId) => setSelectedUnitIdFor360(uId)}
                onNavigateToTenant={(tId) => setSelectedTenantIdFor360(tId)}
                onNavigateToOwner={(oId) => setSelectedOwnerIdFor360(oId)}
                onNavigateToLeases={() => setCurrentView("LEASES")}
                onNavigateToMaintenance={() => setCurrentView("MAINTENANCE")}
                onNavigateToCases={() => setCurrentView("CASES")}
                onNavigateToDocuments={() => setCurrentView("DOCUMENT_CONTROL")}
                onNavigateToTasks={() => setCurrentView("TASK_CENTER")}
                onNavigateToBouncedCheques={() => setCurrentView("BOUNCED_CHEQUES")}
                onNavigateToFinancials={() => setCurrentView("FINANCIALS")}
              />
            )}
            {currentView === "TENANT_PORTAL" && <TenantPortalView />}
            {currentView === "OWNER_PORTAL" && <OwnerPortalView />}
            {currentView === "PROPERTY_REVIEW" && <PropertyReviewOverview />}
            {currentView === "COMMUNICATION_CENTER" && <UnifiedCommunicationCenter />}
          </div>
        </main>
      </div>

      {/* Cross-View Record Payment Modal */}
      <RecordPaymentModal
        isOpen={!!collectionCheque}
        onClose={() => setCollectionCheque(null)}
        cheque={collectionCheque}
        onPaymentSuccess={(rcp) => {
          setCollectionCheque(null);
          setIssuedReceipt(rcp);
        }}
      />

      {/* Cross-View Receipt Voucher Modal */}
      <ReceiptVoucherModal
        isOpen={!!issuedReceipt}
        onClose={() => setIssuedReceipt(null)}
        receipt={issuedReceipt}
      />

      {/* Cross-View Convert Cheques to Legal Dispute Case */}
      <ConvertToCaseModal
        isOpen={convertCaseChequeIds.length > 0}
        onClose={() => setConvertCaseChequeIds([])}
        chequeIds={convertCaseChequeIds}
      />

      {/* Global deep-linked Legal Notice Generator Modal */}
      {isPrintNoticeOpen && (
        <LegalNoticeGeneratorModal
          isOpen={isPrintNoticeOpen}
          onClose={() => setIsPrintNoticeOpen(false)}
          initialTenant={printNoticeTenant}
          initialCheques={printNoticeCheques}
          defaultNoticeType={printNoticeType}
        />
      )}

      {/* Phase 24: 360-Degree Workspace Overlays */}
      {selectedPropertyIdFor360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center">
          <div className="w-full max-w-6xl">
            <Property360Workspace
              propertyId={selectedPropertyIdFor360}
              onClose={() => setSelectedPropertyIdFor360(null)}
              onNavigateToOwner={(ownerId) => {
                setSelectedPropertyIdFor360(null);
                setSelectedOwnerIdFor360(ownerId);
              }}
              onNavigateToUnit={(unitId) => {
                setSelectedPropertyIdFor360(null);
                setSelectedUnitIdFor360(unitId);
              }}
              onNavigateToTenant={(tenantId) => {
                setSelectedPropertyIdFor360(null);
                setSelectedTenantIdFor360(tenantId);
              }}
            />
          </div>
        </div>
      )}

      {selectedUnitIdFor360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Unit360Workspace
              unitId={selectedUnitIdFor360}
              onClose={() => setSelectedUnitIdFor360(null)}
              onNavigateToProperty={(propertyId) => {
                setSelectedUnitIdFor360(null);
                setSelectedPropertyIdFor360(propertyId);
              }}
              onNavigateToTenant={(tenantId) => {
                setSelectedUnitIdFor360(null);
                setSelectedTenantIdFor360(tenantId);
              }}
            />
          </div>
        </div>
      )}

      {selectedTenantIdFor360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Tenant360Workspace
              tenantId={selectedTenantIdFor360}
              onClose={() => setSelectedTenantIdFor360(null)}
              onNavigateToUnit={(unitId) => {
                setSelectedTenantIdFor360(null);
                setSelectedUnitIdFor360(unitId);
              }}
              onNavigateToProperty={(propertyId) => {
                setSelectedTenantIdFor360(null);
                setSelectedPropertyIdFor360(propertyId);
              }}
              onNavigateToOwner={(ownerId) => {
                setSelectedTenantIdFor360(null);
                setSelectedOwnerIdFor360(ownerId);
              }}
              onNavigateToLease={() => {
                setSelectedTenantIdFor360(null);
                setCurrentView("LEASES");
              }}
            />
          </div>
        </div>
      )}

      {selectedOwnerIdFor360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Owner360Workspace
              ownerId={selectedOwnerIdFor360}
              onClose={() => setSelectedOwnerIdFor360(null)}
              onNavigateToProperty={(propertyId) => {
                setSelectedOwnerIdFor360(null);
                setSelectedPropertyIdFor360(propertyId);
              }}
            />
          </div>
        </div>
      )}

      {/* Floating Manager Approval Toast Notification */}
      {managerFloatingToast.show && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-xl bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-500 animate-bounce flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
            <Bell className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-400">
                {language === "ar" ? "تنبيه إداري عائم: مطلوب الاعتماد الوجوبي للمسؤول" : "Manager Approval Required Alert"}
              </h4>
              <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-bold">عاجل</span>
            </div>
            <p className="text-xs text-slate-200 font-bold leading-relaxed">
              {language === "ar"
                ? `تم تحويل حالة الوحدة (${managerFloatingToast.unitNumber ? `#${managerFloatingToast.unitNumber}` : ""}) تلقائياً من (شاغرة) إلى (مؤجرة OCCUPIED) وتحديث جميع جداول وسجلات قاعدة البيانات. يرجى الاطلاع والاعتماد الإداري لعقد الإيجار رقم (${managerFloatingToast.leaseNumber}).`
                : `Unit #${managerFloatingToast.unitNumber} automatically updated to OCCUPIED and all database records synchronized. Urgent manager approval required for Lease #${managerFloatingToast.leaseNumber}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setManagerFloatingToast((prev) => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating AI Assistant Chatbot with agentic capabilities */}
      {isOwner && (
        <AIAssistantChat
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          onOpenTenantProfile={(tenant) => setSelectedTenantIdFor360(tenant.id)}
          onOpenPaymentModal={(cheque) => setCollectionCheque(cheque)}
          onOpenConvertToCaseModal={(chequeIds) => setConvertCaseChequeIds(chequeIds)}
        />
      )}

      {/* Live Report Designer */}
      <ReportDesignerFloatingPanel />

      {/* Force Password Change Modal for Portal First-time logins */}
      <ForcePasswordChangeModal />
    </div>
  );
};


export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/verify/receipt/")) {
    const token = path.replace("/verify/receipt/", "");
    return (
      <ErrorBoundary>
        <LanguageProvider>
          <PublicReceiptVerification token={token} />
        </LanguageProvider>
      </ErrorBoundary>
    );
  }

  return (

    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <DataProvider>
            <LayoutProvider>
              <NavigationProvider>
                <MainAppContent />
              </NavigationProvider>
            </LayoutProvider>
          </DataProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
