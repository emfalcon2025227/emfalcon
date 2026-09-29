import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export const PendingAdministrativeFeeAlert: React.FC = () => {
  const { commissions } = useData();
  const { language } = useLanguage();
  const { navigateTo, currentView } = useNavigation();
  const { loginMode, currentUser } = useAuth();

  const isPortalUser =
    loginMode === "TENANT" ||
    loginMode === "OWNER" ||
    currentUser?.role === "TENANT" ||
    currentUser?.role === "OWNER" ||
    currentUser?.role === "PROPERTY_OWNER" ||
    currentView === "OWNER_PORTAL" ||
    currentView === "TENANT_PORTAL";

  // Find all pending ADMIN_FEE records based strictly on financial truth
  const pendingAdminFees = useMemo(() => {
    if (isPortalUser) return [];
    return commissions.filter((c) => {
      // Must be ADMIN_FEE
      if (c.commissionType !== "ADMIN_FEE") return false;
      
      // Exclude reversed, cancelled, and voided/waived (approved exemptions)
      if (c.status === "REVERSED" || c.status === "CANCELLED" || c.status === "WAIVED") return false;
      
      const collected = c.collectedAmount || 0;
      const outstanding = c.totalCommissionAmount - collected;
      
      // Must have positive outstanding balance
      return c.totalCommissionAmount > collected && outstanding > 0;
    });
  }, [commissions, isPortalUser]);

  if (isPortalUser || pendingAdminFees.length === 0) return null;

  const totalOutstanding = pendingAdminFees.reduce(
    (sum, fee) => sum + (fee.totalCommissionAmount - (fee.collectedAmount || 0)), 
    0
  );

  return (
    <div className="bg-rose-50 border-y border-rose-200 py-3 px-3 sm:px-5 lg:px-6 shrink-0 print:hidden shadow-sm">
      <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
        <div className="flex items-start md:items-center gap-3 text-rose-800">
          <div className="p-1.5 bg-rose-100 text-rose-600 rounded-full animate-pulse shrink-0">
             <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-rose-900 leading-snug">
              {language === "ar" 
                ? `تنبيه: يوجد (${pendingAdminFees.length}) رسوم إدارية معلقة`
                : `PENDING ADMINISTRATIVE FEES: (${pendingAdminFees.length}) records require collection`}
            </p>
            <p className="text-rose-700 text-xs mt-0.5 font-bold">
              {language === "ar" 
                ? `إجمالي المبلغ المستحق: ${totalOutstanding.toLocaleString()} درهم`
                : `Total Outstanding: ${totalOutstanding.toLocaleString()} AED`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => {
              navigateTo("FINANCIALS");
              // Wait for render then dispatch
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-pending-admin-fees'));
              }, 100);
            }}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all text-xs cursor-pointer"
          >
            <span>{language === "ar" ? "عرض الرسوم المعلقة" : "View Pending Fees"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
