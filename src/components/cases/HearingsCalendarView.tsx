import React, { useState } from "react";
import { Calendar as CalendarIcon, Clock, Scale, User, Building, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useNavigation } from "../../context/NavigationContext";
import { CloseBackButton } from "../common/CloseBackButton";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";

export const HearingsCalendarView: React.FC = () => {
  const { t, language } = useLanguage();
  const { canGoBack } = useNavigation();
  const { cases, tenants, properties, units } = useData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourt, setFilterCourt] = useState("ALL");

  // Flatten all hearings across cases
  const allHearings = cases.flatMap((c) => {
    const list = c.hearings || c.sessions || [];
    return list.map((h) => ({
      ...h,
      hearingDate: (h as any).hearingDate || h.date || "",
      hearingTime: (h as any).hearingTime || h.time || "",
      courtRoom: (h as any).courtRoom || "Hall 4",
      caseNumber: c.caseNumber,
      courtName: c.courtName,
      courtReferenceNumber: (c as any).courtReferenceNumber || (c as any).ejariNumber || "",
      tenantId: c.tenantId,
      propertyId: c.propertyId,
      unitId: c.unitId,
      claimAmount: c.claimAmount,
      responsibleUserName: (c as any).responsibleUserName || (c as any).responsibleLegalOfficer || "Advocate",
    }));
  }).sort((a, b) => new Date(a.hearingDate).getTime() - new Date(b.hearingDate).getTime());

  const filteredHearings = allHearings.filter((h) => {
    const term = searchTerm.toLowerCase();
    const tenant = tenants.find((t) => t.id === h.tenantId);
    const matchTerm =
      h.caseNumber.toLowerCase().includes(term) ||
      (h.courtReferenceNumber && h.courtReferenceNumber.toLowerCase().includes(term)) ||
      (tenant && (tenant.nameEn.toLowerCase().includes(term) || tenant.nameAr.includes(term))) ||
      h.courtRoom.toLowerCase().includes(term);

    const matchCourt = filterCourt === "ALL" || h.courtName.includes(filterCourt);

    return matchTerm && matchCourt;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navHearings")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "أجندة مواعيد الجلسات القضائية، قاعات المحاكم، وقرارات اللجان الإيجارية"
              : "Judicial calendar, court session schedule, chamber rooms, and bench decisions"}
          </p>
        </div>
        {canGoBack && <CloseBackButton />}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم القضية، المستأجر، القاعة..." : "Search case #, tenant, court hall..."}
            className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
          />
        </div>

        <div className="w-48 shrink-0">
          <SearchableSelect
            options={[
              { id: "ALL", label: language === "ar" ? "كافة المحاكم" : "All Judicial Courts" },
              { id: "RDSC", label: "RDSC Dubai (فض المنازعات دبي)" },
              { id: "ADJD", label: "ADJD Abu Dhabi (قضاء أبوظبي)" },
              { id: "Sharjah", label: "Sharjah Tribunal (لجنة الشارقة)" },
            ]}
            value={filterCourt}
            onChange={(val) => setFilterCourt(val)}
            placeholder={language === "ar" ? "المحكمة..." : "Judicial Court..."}
            searchPlaceholder={language === "ar" ? "ابحث عن محكمة..." : "Search court..."}
          />
        </div>
      </div>

      {/* Hearings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHearings.map((h) => {
          const tenant = tenants.find((t) => t.id === h.tenantId);
          const prop = properties.find((p) => p.id === h.propertyId);
          const unit = units.find((u) => u.id === h.unitId);

          const isPast = new Date(h.hearingDate).getTime() < new Date().getTime();

          return (
            <div
              key={h.id}
              className={`p-5 rounded-2xl border transition-all space-y-3 ${
                h.status === "COMPLETED"
                  ? "bg-slate-50/70 border-slate-200"
                  : "bg-white border-purple-200/80 shadow-xs hover:border-purple-300"
              }`}
            >
              {/* Date Ribbon */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-mono font-black text-slate-900 text-xs">{h.hearingDate}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{h.hearingTime}</div>
                  </div>
                </div>

                <Badge variant={h.status === "COMPLETED" ? "success" : "purple"} size="sm">
                  {h.status}
                </Badge>
              </div>

              {/* Case & Court Info */}
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">{language === "ar" ? "رقم القضية والمحكمة:" : "Case & Court:"}</span>
                  <span className="font-mono font-bold text-purple-950">{h.caseNumber}</span>
                  <div className="text-[10px] text-slate-500 font-semibold truncate">{h.courtName}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">{language === "ar" ? "المستأجر المدعى عليه:" : "Defendant Tenant:"}</span>
                  <span className="font-bold text-slate-800">{tenant ? (language === "ar" ? tenant.nameAr : tenant.nameEn) : "N/A"}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">{language === "ar" ? "قاعة المحكمة والدائرة:" : "Chamber / Hall:"}</span>
                  <span className="font-semibold text-slate-800">{h.courtRoom}</span>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">{language === "ar" ? "المستشار المكلف:" : "Assigned Counsel:"}</span>
                  <span className="font-semibold text-slate-700 text-[11px]">{h.responsibleUserName}</span>
                </div>
              </div>

              {h.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-200/80">
                  {h.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredHearings.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200/80 text-xs">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p>{language === "ar" ? "لا توجد جلسات مطابقة لمعايير البحث" : "No hearings found matching criteria"}</p>
        </div>
      )}
    </div>
  );
};
