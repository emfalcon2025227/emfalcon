import React, { useState, useEffect } from "react";
import { Scale, Lock } from "lucide-react";
import { Modal } from "../common/Modal";
import { SearchableSelect, SearchableOption } from "../common/SearchableSelect";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { getPropertyTypeLabel } from "../../data/propertyOptions";

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useLanguage();
  const { tenants, properties, units, leases, owners, addCase, legalSettings, getNextCaseNumber } = useData();

  const [leaseId, setLeaseId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [courtReferenceNumber, setCourtReferenceNumber] = useState("");
  const [courtName, setCourtName] = useState("Sharjah Rental Dispute Tribunal");
  const [claimAmount, setClaimAmount] = useState("");
  const [responsibleUserName, setResponsibleUserName] = useState("غير محدد");

  useEffect(() => {
    if (isOpen) {
      setCaseNumber(getNextCaseNumber());
    }
  }, [isOpen, getNextCaseNumber]);

  if (!isOpen) return null;

  // Auto-fill when Lease Contract is selected
  const handleLeaseChange = (lId: string) => {
    setLeaseId(lId);
    if (!lId) return;
    const lObj = leases.find((l) => l.id === lId);
    if (lObj) {
      setTenantId(lObj.tenantId);
      setPropertyId(lObj.propertyId);
      setUnitId(lObj.unitId);
      if (lObj.annualRent && !claimAmount) {
        setClaimAmount(String(lObj.annualRent));
      }
    }
  };

  // Auto-fill when Tenant is selected
  const handleTenantChange = (tId: string) => {
    setTenantId(tId);
    if (!tId) return;
    const activeLease = leases.find((l) => l.tenantId === tId && l.contractStatus === "ACTIVE") || leases.find((l) => l.tenantId === tId);
    if (activeLease) {
      setLeaseId(activeLease.id);
      setPropertyId(activeLease.propertyId);
      setUnitId(activeLease.unitId);
      if (activeLease.annualRent && !claimAmount) {
        setClaimAmount(String(activeLease.annualRent));
      }
    }
  };

  // Auto-fill when Property is selected
  const handlePropertyChange = (pId: string) => {
    setPropertyId(pId);
    const pUnits = units.filter((u) => u.propertyId === pId);
    if (pUnits.length > 0) {
      setUnitId(pUnits[0].id);
    } else {
      setUnitId("");
    }
  };

  // Auto-fill when Unit is selected
  const handleUnitChange = (uId: string) => {
    setUnitId(uId);
    if (!uId) return;
    const uObj = units.find((u) => u.id === uId);
    if (uObj && uObj.propertyId) {
      setPropertyId(uObj.propertyId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !propertyId || !unitId || !caseNumber) {
      alert(language === "ar" ? "يرجى تعبئة الحقول الإجبارية" : "Please fill required fields");
      return;
    }

    const prop = properties.find((p) => p.id === propertyId);

    addCase({
      tenantId,
      ownerId: prop?.ownerId || "ow-01",
      propertyId,
      unitId,
      leaseId: leaseId || "",
      caseNumber,
      courtReferenceNumber,
      courtName,
      claimAmount: Number(claimAmount) || 0,
      legalFeesClaimed: 0,
      totalPaid: 0,
      outstanding: Number(claimAmount) || 0,
      outstandingAmount: Number(claimAmount) || 0,
      status: "NEW",
      priority: "NORMAL",
      responsibleUserId: "usr-01",
      responsibleUserName,
      filingDate: new Date().toISOString().split("T")[0],
      documents: [],
      caseDocuments: [],
      sessions: [],
      linkedChequeIds: [],
      linkedExpenseIds: [],
      bouncedChequeFeePerUnit: legalSettings?.defaultBouncedChequeFee || 500,
    });

    onClose();

    // Reset Form
    setLeaseId("");
    setTenantId("");
    setPropertyId("");
    setUnitId("");
    setCaseNumber("");
    setCourtReferenceNumber("");
    setClaimAmount("");
  };

  // Searchable Options
  const leaseOptions: SearchableOption[] = leases.map((l) => {
    const prop = properties.find((p) => p.id === l.propertyId);
    const ten = tenants.find((t) => t.id === l.tenantId);
    return {
      id: l.id,
      label: l.leaseNumber,
      subLabel: `${ten ? (language === "ar" ? ten.nameAr : ten.nameEn) : ""} ${prop ? `• ${language === "ar" ? prop.nameAr : prop.nameEn}` : ""}`,
      badge: l.contractStatus,
    };
  });

  const tenantOptions: SearchableOption[] = tenants.map((t) => ({
    id: t.id,
    label: language === "ar" ? t.nameAr : t.nameEn,
    subLabel: `${t.code} • ${t.phone || t.email || ""}`,
    badge: t.type === "INDIVIDUAL" ? (language === "ar" ? "فرد" : "Individual") : (language === "ar" ? "شركة" : "Corporate"),
  }));

  const propertyOptions: SearchableOption[] = properties.map((p) => {
    const ow = owners.find((o) => o.id === p.ownerId);
    return {
      id: p.id,
      label: language === "ar" ? p.nameAr : p.nameEn,
      subLabel: p.community ? `${p.community} (${ow ? (language === "ar" ? ow.nameAr : ow.nameEn) : p.emirate})` : (ow ? (language === "ar" ? ow.nameAr : ow.nameEn) : p.emirate),
      badge: getPropertyTypeLabel(p.type, language),
    };
  });

  const unitOptions: SearchableOption[] = (propertyId ? units.filter((u) => u.propertyId === propertyId) : units).map((u) => {
    const prop = properties.find((p) => p.id === u.propertyId);
    return {
      id: u.id,
      label: `${language === "ar" ? "الوحدة" : "Unit"} ${u.unitNumber}`,
      subLabel: prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "",
      badge: u.status,
    };
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === "ar" ? "إدراج قضية إيجارية جديدة" : "Add New Dispute Case"}
      subtitle={language === "ar" ? "تسجيل بيانات الدعوى القضائية لدى لجان فض المنازعات مع معاينة فورية للبيانات" : "Register rental dispute case with live compiled details"}
      icon={<Scale className="w-5 h-5" />}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Live Compiled Dispute Case Information Text Box */}
        {(() => {
          const ten = tenants.find((t) => t.id === tenantId);
          const prop = properties.find((p) => p.id === propertyId);
          const unit = units.find((u) => u.id === unitId);
          const lease = leases.find((l) => l.id === leaseId);
          const owner = owners.find((o) => o.id === prop?.ownerId);
          const tenantName = ten ? (language === "ar" ? ten.nameAr : ten.nameEn) : "";
          const propName = prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "";
          const ownerName = owner ? (language === "ar" ? owner.nameAr : owner.nameEn) : "";

          return (
            <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                <Scale className="w-4 h-4 text-amber-700" />
                <span>
                  {language === "ar"
                    ? "📋 معلومات مجمعة عن القضية (معاينة فورية للبيانات المدخلة):"
                    : "📋 Compiled Dispute Case Summary & Live Preview:"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم القضية الداخلي:" : "Case #:"}</span>
                  <strong className="font-mono text-amber-950">{caseNumber || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الرقم المرجعي بالمحكمة:" : "Court Ref #:"}</span>
                  <strong className="font-mono text-amber-950">{courtReferenceNumber || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "مبلغ المطالبة:" : "Claim Amount:"}</span>
                  <strong className="font-mono text-rose-950 font-bold">
                    {claimAmount ? `${Number(claimAmount).toLocaleString("en-US")} AED` : "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المستأجر (المدعى عليه):" : "Tenant:"}</span>
                  <strong className="text-amber-950 truncate block" title={tenantName || "—"}>{tenantName || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "العقار والوحدة:" : "Property & Unit:"}</span>
                  <strong className="text-amber-950 truncate block">
                    {propName || "—"} {unit ? `• وحدة ${unit.unitNumber}` : ""}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم العقد الإيجاري:" : "Lease #:"}</span>
                  <strong className="font-mono text-amber-950">{lease?.leaseNumber || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المالك (المدعي):" : "Owner:"}</span>
                  <strong className="text-amber-950 truncate block" title={ownerName || "—"}>{ownerName || "—"}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المحكمة المختصة:" : "Court:"}</span>
                  <strong className="text-amber-950 truncate block" title={courtName}>{courtName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المستشار القانوني:" : "Counsel:"}</span>
                  <strong className="text-amber-950 truncate block">{responsibleUserName}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الحالة المبدئية:" : "Initial Status:"}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {language === "ar" ? "مفتوحة وقيد التداول" : "Open / Active"}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label={language === "ar" ? "عقد الإيجار المرتبط" : "Lease Contract"}
            options={leaseOptions}
            value={leaseId}
            onChange={(val) => handleLeaseChange(val)}
            placeholder={language === "ar" ? "-- ابحث واختر عقد الإيجار --" : "-- Select Lease Contract --"}
            searchPlaceholder={language === "ar" ? "ابحث برقم العقد..." : "Search lease no..."}
          />

          <SearchableSelect
            label={language === "ar" ? "المستأجر" : "Tenant"}
            required
            options={tenantOptions}
            value={tenantId}
            onChange={(val) => handleTenantChange(val)}
            placeholder={language === "ar" ? "-- ابحث واختر المستأجر --" : "-- Select Tenant --"}
            searchPlaceholder={language === "ar" ? "ابحث بالاسم أو الكود..." : "Search tenant name or code..."}
          />

          <SearchableSelect
            label={language === "ar" ? "العقار" : "Property"}
            required
            options={propertyOptions}
            value={propertyId}
            onChange={(val) => handlePropertyChange(val)}
            placeholder={language === "ar" ? "-- ابحث واختر العقار --" : "-- Select Property --"}
            searchPlaceholder={language === "ar" ? "ابحث بأسماء العقارات..." : "Search property..."}
          />

          <SearchableSelect
            label={language === "ar" ? "الوحدة" : "Unit"}
            required
            options={unitOptions}
            value={unitId}
            onChange={(val) => handleUnitChange(val)}
            placeholder={language === "ar" ? "-- ابحث واختر الوحدة --" : "-- Select Unit --"}
            searchPlaceholder={language === "ar" ? "ابحث برقم الوحدة..." : "Search unit no..."}
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">{language === "ar" ? "رقم القضية (الداخلي)" : "Internal Case Number"} *</label>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                <Lock className="w-3 h-3 text-amber-700" />
                {language === "ar" ? "مسلسل تلقائي (محمي)" : "Auto-Locked"}
              </span>
            </div>
            <input
              required
              readOnly
              disabled
              type="text"
              value={caseNumber}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none shadow-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">{language === "ar" ? "الرقم المرجعي للمحكمة" : "Court Reference Number"}</label>
            <input
              type="text"
              value={courtReferenceNumber}
              onChange={(e) => setCourtReferenceNumber(e.target.value)}
              placeholder="RDSC/2026/1234"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">{language === "ar" ? "اسم المحكمة / المركز" : "Court Name"}</label>
            <input
              type="text"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">{language === "ar" ? "قيمة المطالبة (درهم)" : "Claim Amount (AED)"} *</label>
            <input
              type="number"
              min="0"
              required
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-2"
          >
            <Scale className="w-4 h-4" />
            <span>{language === "ar" ? "إدراج القضية" : "Add Case"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
