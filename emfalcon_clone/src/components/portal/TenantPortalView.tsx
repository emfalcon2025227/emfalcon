import React, { useState, useMemo } from "react";
import {
  FileText,
  Wrench,
  AlertTriangle,
  History,
  ClipboardList,
  Bell,
  Search,
  Plus,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  ChevronRight,
  Info,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { MaintenanceRequest, Cheque, Lease } from "../../types";
import { isAuthorizedForTenantPortal } from "../../utils/portalNotificationFilter";
import { resolveTenantForUser, getActiveTenantLeases } from "../../utils/tenantLeaseHelper";
import { NewMaintenanceModal } from "../maintenance/NewMaintenanceModal";
import { TenantUpdateMaintenanceModal } from "./TenantUpdateMaintenanceModal";
import { Badge } from "../common/Badge";

export const TenantPortalView: React.FC = () => {
  const { 
    tenants, 
    leases, 
    cheques, 
    maintenanceRequests, 
    properties, 
    units,
    isDataLoaded
  } = useData();
  const { t, language, formatAED } = useLanguage();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "CHEQUES" | "MAINTENANCE" | "LEASES" | "NOTIFICATIONS">("OVERVIEW");
  const [isNewMaintenanceModalOpen, setIsNewMaintenanceModalOpen] = useState(false);
  const [selectedRequestForUpdate, setSelectedRequestForUpdate] = useState<MaintenanceRequest | null>(null);

  const { notifications } = useData();

  // Robustly resolve tenant using authoritative ERP linkage (tenantId, email, phone, or name)
  const tenant = useMemo(() => {
    return resolveTenantForUser(currentUser, tenants);
  }, [currentUser, tenants]);

  const resolvedTenantId = tenant?.id || currentUser?.tenantId;

  const tenantLeases = useMemo(() => {
    if (!resolvedTenantId) return [];
    return leases.filter(l => l.tenantId === resolvedTenantId);
  }, [resolvedTenantId, leases]);

  const activeLeases = useMemo(() => {
    if (!resolvedTenantId) return [];
    return getActiveTenantLeases(resolvedTenantId, leases);
  }, [resolvedTenantId, leases]);

  const hasActiveLease = useMemo(() => {
    return activeLeases.length > 0;
  }, [activeLeases]);

  const tenantCheques = useMemo(() => {
    if (!resolvedTenantId) return [];
    return cheques.filter(c => c.tenantId === resolvedTenantId);
  }, [resolvedTenantId, cheques]);

  const tenantMaintenance = useMemo(() => {
    if (!resolvedTenantId) return [];
    return maintenanceRequests.filter(m => m.tenantId === resolvedTenantId);
  }, [resolvedTenantId, maintenanceRequests]);

  const tenantNotifications = useMemo(() => {
    if (!resolvedTenantId) return [];
    return notifications.filter(n => isAuthorizedForTenantPortal(n, resolvedTenantId, tenant?.phone));
  }, [resolvedTenantId, notifications, tenant]);

  const bouncedCheques = useMemo(() => {
    return tenantCheques.filter(c => c.status === "BOUNCED");
  }, [tenantCheques]);

  const activeMaintenance = useMemo(() => {
    return tenantMaintenance.filter(m => m.status !== "COMPLETED" && m.status !== "CANCELLED" && m.status !== "REJECTED");
  }, [tenantMaintenance]);

  const returnedRequests = useMemo(() => {
    return tenantMaintenance.filter(m => m.status === "RETURNED");
  }, [tenantMaintenance]);

  if (!currentUser?.tenantId && !tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {language === "ar" ? "لم يتم ربط حسابك بملف مستأجر" : "Account Not Linked to Tenant Profile"}
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            {language === "ar" 
              ? "يرجى التواصل مع إدارة العقارات لربط حسابك الإلكتروني بعقد الإيجار الخاص بك لتتمكن من استخدام البوابة."
              : "Please contact property management to link your account to your lease to access the portal."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {language === "ar" ? `مرحباً، ${tenant?.nameAr || currentUser.nameAr}` : `Welcome, ${tenant?.nameEn || currentUser.nameEn}`}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            {language === "ar" ? "مرحباً بك في بوابة المستأجر الخاصة بك" : "Welcome to your tenant portal"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewMaintenanceModalOpen(true)}
            disabled={!hasActiveLease}
            title={!hasActiveLease ? (language === "ar" ? "يجب أن يكون لديك عقد إيجار فعال لتقديم طلب صيانة" : "You must have an active lease to submit a maintenance request") : ""}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all ${
              hasActiveLease
                ? "bg-amber-400 hover:bg-amber-500 text-slate-950"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
          >
            <Plus className="w-4 h-4" />
            {language === "ar" ? "طلب صيانة جديد" : "New Maintenance Request"}
          </button>
        </div>
      </div>

      {/* NO LEASE ALERT BANNER */}
      {isDataLoaded && !hasActiveLease && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              {language === "ar" ? "لا يوجد عقد إيجار فعال" : "No Active Lease"}
            </h3>
            <p className="text-xs text-amber-700 mt-1 font-medium">
              {language === "ar"
                ? "يجب أن يكون لديك عقد إيجار فعال لتتمكن من تقديم طلبات صيانة جديدة. يمكنك فقط عرض سجل طلباتك التاريخية."
                : "You must have an active lease to submit new maintenance requests. You can only view your historical requests."}
            </p>
          </div>
        </div>
      )}

      {/* RETURNED MAINTENANCE LOGIN ALERT BANNER */}
      {returnedRequests.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-5 urgent-flicker shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-rose-600"></div>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-600 text-white rounded-xl shadow-md animate-bounce shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-rose-900">
                  {language === "ar" ? "🚨 تنبيه هام: يوجد طلبات صيانة مرتجعة تتطلب إجراء منك!" : "🚨 Important Alert: Returned Maintenance Requests Require Your Action!"}
                </h3>
                <span className="px-3 py-1 bg-rose-600 text-white rounded-full text-xs font-black animate-pulse">
                  {returnedRequests.length} {language === "ar" ? "طلب مرتجع" : "Returned"}
                </span>
              </div>
              <p className="text-xs text-rose-800 font-medium leading-relaxed">
                {language === "ar"
                  ? "قامت إدارة العقارات بإرجاع بعض طلبات الصيانة الخاصة بك. يرجى مراجعة السبب أدناه وتحديث المرفقات أو المعلومات المطلوبة في أقرب وقت."
                  : "Property management has returned some of your maintenance requests. Please review the reason below and update required attachments or information."}
              </p>
              
              <div className="space-y-2 mt-3">
                {returnedRequests.map(req => (
                  <div key={req.id} className="bg-white/90 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">#{req.requestNumber} - {req.category}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          {req.priority}
                        </span>
                      </div>
                      <p className="text-xs text-rose-900 font-semibold mt-1">
                        <span className="font-bold">{language === "ar" ? "سبب الإرجاع: " : "Return Reason: "}</span>
                        {req.returnReason || (language === "ar" ? "تعديل البيانات أو المرفقات المطلوبة" : "Update required details or attachments")}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedRequestForUpdate(req)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer text-center"
                    >
                      {language === "ar" ? "عرض الطلب والتحديث" : "View & Update"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building className="w-5 h-5 text-indigo-600" />}
          label={language === "ar" ? "عقود الإيجار النشطة" : "Active Leases"}
          value={activeLeases.length.toString()}
          color="indigo"
          isLoading={!isDataLoaded}
        />
        <StatCard
          icon={<CreditCard className="w-5 h-5 text-rose-600" />}
          label={language === "ar" ? "شيكات مرتجعة" : "Bounced Cheques"}
          value={bouncedCheques.length.toString()}
          color="rose"
          highlight={bouncedCheques.length > 0}
          isLoading={!isDataLoaded}
        />
        <StatCard
          icon={<Wrench className="w-5 h-5 text-amber-600" />}
          label={language === "ar" ? "طلبات صيانة نشطة" : "Active Maintenance"}
          value={activeMaintenance.length.toString()}
          color="amber"
          isLoading={!isDataLoaded}
        />
        <StatCard
          icon={<Bell className="w-5 h-5 text-indigo-600" />}
          label={language === "ar" ? "التنبيهات والإشعارات" : "Notifications"}
          value={tenantNotifications.length.toString()}
          color="indigo"
          isLoading={!isDataLoaded}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <TabButton 
          active={activeTab === "OVERVIEW"} 
          onClick={() => setActiveTab("OVERVIEW")}
          label={language === "ar" ? "نظرة عامة" : "Overview"}
        />
        <TabButton 
          active={activeTab === "LEASES"} 
          onClick={() => setActiveTab("LEASES")}
          label={language === "ar" ? "عقود الإيجار" : "Leases"}
        />
        <TabButton 
          active={activeTab === "CHEQUES"} 
          onClick={() => setActiveTab("CHEQUES")}
          label={language === "ar" ? "الشيكات والمدفوعات" : "Cheques & Payments"}
        />
        <TabButton 
          active={activeTab === "MAINTENANCE"} 
          onClick={() => setActiveTab("MAINTENANCE")}
          label={language === "ar" ? "الصيانة والشكاوى" : "Maintenance & Complaints"}
        />
        <TabButton 
          active={activeTab === "NOTIFICATIONS"} 
          onClick={() => setActiveTab("NOTIFICATIONS")}
          label={language === "ar" ? "الإشعارات" : "Notifications"}
        />
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Maintenance */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  {language === "ar" ? "آخر طلبات الصيانة" : "Recent Maintenance"}
                </h3>
                <button 
                  onClick={() => setActiveTab("MAINTENANCE")}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  {language === "ar" ? "عرض الكل" : "View All"}
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {tenantMaintenance.slice(0, 5).map(m => (
                  <MaintenanceItem key={m.id} request={m} language={language} />
                ))}
                {tenantMaintenance.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    {language === "ar" ? "لا توجد طلبات صيانة حالياً" : "No maintenance requests found"}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Bounced Cheques */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-500" />
                  {language === "ar" ? "الشيكات المرتجعة" : "Bounced Cheques"}
                </h3>
                <button 
                  onClick={() => setActiveTab("CHEQUES")}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  {language === "ar" ? "عرض الكل" : "View All"}
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {bouncedCheques.slice(0, 5).map(c => (
                  <ChequeItem key={c.id} cheque={c} language={language} formatAED={formatAED} />
                ))}
                {bouncedCheques.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    {language === "ar" ? "لا توجد شيكات مرتجعة بحسابك" : "No bounced cheques found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "LEASES" && (
          <div className="space-y-4">
            {tenantLeases.map(lease => (
              <LeaseCard 
                key={lease.id} 
                lease={lease} 
                property={properties.find(p => p.id === lease.propertyId)}
                unit={units.find(u => u.id === lease.unitId)}
                language={language} 
                formatAED={formatAED} 
              />
            ))}
            {tenantLeases.length === 0 && (
              <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
                {language === "ar" ? "لا توجد عقود إيجار مسجلة" : "No leases registered"}
              </div>
            )}
          </div>
        )}

        {activeTab === "CHEQUES" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <th className="px-6 py-4">{language === "ar" ? "رقم الشيك" : "Cheque #"}</th>
                    <th className="px-6 py-4">{language === "ar" ? "البنك" : "Bank"}</th>
                    <th className="px-6 py-4">{language === "ar" ? "المبلغ" : "Amount"}</th>
                    <th className="px-6 py-4">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    <th className="px-6 py-4">{language === "ar" ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantCheques.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-900">{c.chequeNumber}</td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-medium">{c.bankName}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900">{formatAED(c.amount)}</td>
                      <td className="px-6 py-4 text-xs text-slate-600 font-medium">{c.dueDate}</td>
                      <td className="px-6 py-4 text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "MAINTENANCE" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-slate-800">
                {language === "ar" ? "طلبات الصيانة والشكاوى" : "Maintenance Requests & Complaints"}
              </h3>
            </div>
            {tenantMaintenance.map(request => (
              <MaintenanceCard key={request.id} request={request} language={language} />
            ))}
            {tenantMaintenance.length === 0 && (
              <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
                {language === "ar" ? "لا توجد طلبات صيانة سابقة" : "No maintenance history found"}
              </div>
            )}
          </div>
        )}

        {activeTab === "NOTIFICATIONS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-slate-800">
                {language === "ar" ? "سجل الإشعارات والتنبيهات" : "Notifications History"}
              </h3>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {tenantNotifications.map(notification => (
                  <div key={notification.id} className="p-4 hover:bg-slate-50 transition-all flex gap-4">
                    <div className="mt-1">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                        <Bell className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{notification.createdAt.split('T')[0]}</span>
                        <Badge variant="success" size="sm">{notification.status}</Badge>
                      </div>
                      <p className="text-xs font-bold text-slate-900 mb-1 leading-relaxed">
                        {notification.content}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span>{language === "ar" ? "عبر:" : "Via:"} {notification.channel}</span>
                        <span>•</span>
                        <span>{notification.recipient}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {tenantNotifications.length === 0 && (
                  <div className="p-12 text-center text-slate-400 italic text-xs">
                    {language === "ar" ? "لا توجد إشعارات حالياً" : "No notifications found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <NewMaintenanceModal 
        isOpen={isNewMaintenanceModalOpen}
        onClose={() => setIsNewMaintenanceModalOpen(false)}
        initialUnitId={activeLeases[0]?.unitId}
        initialPropertyId={activeLeases[0]?.propertyId}
      />

      <TenantUpdateMaintenanceModal
        request={selectedRequestForUpdate}
        isOpen={Boolean(selectedRequestForUpdate)}
        onClose={() => setSelectedRequestForUpdate(null)}
      />
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; highlight?: boolean; isLoading?: boolean }> = ({
  icon, label, value, color, highlight, isLoading
}) => (
  <div className={`p-5 rounded-2xl border bg-white shadow-xs transition-all ${highlight ? 'ring-2 ring-rose-500/20 border-rose-200' : 'border-slate-200 hover:border-slate-300'}`}>
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-xl bg-${color}-50`}>
        {icon}
      </div>
      {isLoading ? (
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-800 animate-spin"></div>
      ) : (
        <span className={`text-2xl font-black text-slate-900 ${highlight ? 'text-rose-600' : ''}`}>{value}</span>
      )}
    </div>
    <div className="mt-3">
      <span className="text-xs font-bold text-slate-500">{label}</span>
    </div>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 text-xs font-bold transition-all border-b-2 ${
      active 
        ? "text-indigo-600 border-indigo-600" 
        : "text-slate-500 border-transparent hover:text-slate-700"
    }`}
  >
    {label}
  </button>
);

const MaintenanceItem: React.FC<{ request: MaintenanceRequest; language: string }> = ({ request, language }) => {
  const isReturned = request.status === "RETURNED";
  return (
    <div className={`p-3.5 hover:bg-slate-50/80 transition-all flex items-center justify-between group ${isReturned ? 'bg-rose-50/60 urgent-flicker border-l-4 border-l-rose-500' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isReturned ? 'bg-rose-600 animate-ping' : getStatusDotColor(request.status)}`} />
        <div>
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>{request.category} - #{request.requestNumber}</span>
            {isReturned && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse">
                {language === "ar" ? "مرتجع للمستأجر" : "Returned"}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">{request.requestDate}</div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
    </div>
  );
};

const ChequeItem: React.FC<{ cheque: Cheque; language: string; formatAED: (v: number) => string }> = ({ cheque, language, formatAED }) => (
  <div className="p-3.5 hover:bg-slate-50/80 transition-all flex items-center justify-between group">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
        <CreditCard className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs font-bold text-slate-800">{language === "ar" ? "شيك مرتجع #" : "Bounced Cheque #"}{cheque.chequeNumber}</div>
        <div className="text-[10px] text-rose-500 font-bold">{formatAED(cheque.amount)}</div>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
  </div>
);

const LeaseCard: React.FC<{ lease: Lease; property: any; unit: any; language: string; formatAED: (v: number) => string }> = ({
  lease, property, unit, language, formatAED
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-black text-slate-900">
            {language === "ar" ? "عقد إيجار رقم" : "Lease #"}{lease.leaseNumber}
          </h4>
          <p className="text-xs text-slate-500 font-bold">
            {property?.nameAr || property?.nameEn} - {language === "ar" ? "وحدة" : "Unit"} {unit?.unitNumber}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight ${
          lease.contractStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>
          {lease.contractStatus}
        </span>
      </div>
    </div>
    
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-100">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "ar" ? "تاريخ البدء" : "Start Date"}</span>
        <div className="text-xs font-black text-slate-700">{lease.startDate}</div>
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "ar" ? "تاريخ الانتهاء" : "End Date"}</span>
        <div className="text-xs font-black text-slate-700">{lease.endDate}</div>
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "ar" ? "الإيجار السنوي" : "Annual Rent"}</span>
        <div className="text-xs font-black text-slate-900">{formatAED(lease.annualRent)}</div>
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "ar" ? "عدد الدفعات" : "Installments"}</span>
        <div className="text-xs font-black text-slate-700">{lease.installmentsCount}</div>
      </div>
    </div>
  </div>
);

const MaintenanceCard: React.FC<{ request: MaintenanceRequest; language: string }> = ({ request, language }) => {
  const isReturned = request.status === "RETURNED";
  return (
    <div className={`bg-white rounded-2xl border p-5 shadow-xs transition-all ${isReturned ? 'border-rose-500 urgent-flicker ring-2 ring-rose-500/30' : 'border-slate-200 hover:border-indigo-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl ${isReturned ? 'bg-rose-100 text-rose-700 animate-pulse' : getStatusBgColor(request.status)}`}>
            <Wrench className={`w-5 h-5 ${isReturned ? 'text-rose-600' : getStatusTextColor(request.status)}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-900">{request.category}</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getPriorityColor(request.priority)}`}>
                {request.priority}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">#{request.requestNumber} • {request.requestDate}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${isReturned ? 'bg-rose-600 text-white animate-bounce' : getStatusBadgeColor(request.status)}`}>
          {isReturned ? (language === "ar" ? "مرتجع للمستأجر (مطلوب إجراء)" : "Returned (Action Req.)") : request.status}
        </span>
      </div>
      {isReturned && (
        <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 font-medium">
            <span className="font-bold block mb-0.5">{language === "ar" ? "تنبيه إداري - تم إرجاع الطلب:" : "Management Notice - Request Returned:"}</span>
            {request.returnReason || (language === "ar" ? "يرجى مراجعة تفاصيل الطلب وتحديث البيانات أو المرفقات المطلوبة." : "Please review the request details and update information or required attachments.")}
          </div>
        </div>
      )}
      <div className="mt-4 p-3 bg-slate-50 rounded-xl">
        <p className="text-xs text-slate-600 font-medium leading-relaxed italic line-clamp-2">
          "{request.issueDescription}"
        </p>
      </div>
    </div>
  );
};

// Helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case "CLEARED": return "bg-emerald-50 text-emerald-700";
    case "BOUNCED": return "bg-rose-50 text-rose-700";
    case "PENDING": return "bg-amber-50 text-amber-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

const getStatusDotColor = (status: string) => {
  switch (status) {
    case "COMPLETED": return "bg-emerald-500";
    case "IN_PROGRESS": return "bg-amber-500";
    case "OPEN": return "bg-indigo-500";
    case "REJECTED": return "bg-rose-500";
    case "RETURNED": return "bg-rose-600";
    default: return "bg-slate-400";
  }
};

const getStatusBgColor = (status: string) => {
  switch (status) {
    case "COMPLETED": return "bg-emerald-50";
    case "IN_PROGRESS": return "bg-amber-50";
    case "OPEN": return "bg-indigo-50";
    case "REJECTED": return "bg-rose-50";
    case "RETURNED": return "bg-rose-50";
    default: return "bg-slate-50";
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case "COMPLETED": return "text-emerald-600";
    case "IN_PROGRESS": return "text-amber-600";
    case "OPEN": return "text-indigo-600";
    case "REJECTED": return "text-rose-600";
    case "RETURNED": return "text-rose-600";
    default: return "text-slate-600";
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "COMPLETED": return "bg-emerald-100 text-emerald-800";
    case "IN_PROGRESS": return "bg-amber-100 text-amber-800";
    case "OPEN": return "bg-indigo-100 text-indigo-800";
    case "REJECTED": return "bg-rose-100 text-rose-800";
    case "RETURNED": return "bg-rose-100 text-rose-800";
    default: return "bg-slate-100 text-slate-800";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "URGENT": return "bg-rose-100 text-rose-700";
    case "HIGH": return "bg-orange-100 text-orange-700";
    case "NORMAL": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-600";
  }
};
