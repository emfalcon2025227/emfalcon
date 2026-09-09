import React, { useState, useRef } from "react";
import { Plus, Search, Building2, MapPin, Hash, Zap, Edit2, Trash2, FileSpreadsheet, Sparkles, ExternalLink, Languages, Lock } from "lucide-react";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Property } from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { SearchableSelect } from "../common/SearchableSelect";
import { AreaCombobox } from "../properties/AreaCombobox";
import { DraggableWrapper } from "../common/DraggableWrapper";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { getBilingualSuggestion, getLocalBilingualSuggestion } from "../../utils/bilingualNaming";
import { getPropertyTypeLabel } from "../../data/propertyOptions";
import { Property360Workspace } from "./Property360Workspace";

interface PropertiesViewProps {
  onNavigateToUnits?: () => void;
  onNavigateToLeases?: () => void;
}

export const PropertiesView: React.FC<PropertiesViewProps> = ({ onNavigateToUnits, onNavigateToLeases }) => {
  const { t, language } = useLanguage();
  const { properties, owners, units, addProperty, updateProperty, deleteProperty, importBatchData, archive, addArchiveItem, deleteArchiveItem, getNextPropertyCode } = useData();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("DELETE_RECORDS");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [selected360PropertyId, setSelected360PropertyId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.id || "");

  // Bilingual Naming States
  const [isNameEnGenerated, setIsNameEnGenerated] = useState(false);
  const [isNameArGenerated, setIsNameArGenerated] = useState(false);
  const [isTranslatingAr, setIsTranslatingAr] = useState(false);
  const [isTranslatingEn, setIsTranslatingEn] = useState(false);

  const handleArBlur = () => {
    if (nameAr.trim() && !nameEn.trim()) {
      const suggestion = getLocalBilingualSuggestion(nameAr, "ar");
      if (suggestion && !nameEn.trim()) {
        setNameEn(suggestion);
        setIsNameEnGenerated(true);
      }
    }
  };

  const handleEnBlur = () => {
    if (nameEn.trim() && !nameAr.trim()) {
      const suggestion = getLocalBilingualSuggestion(nameEn, "en");
      if (suggestion && !nameAr.trim()) {
        setNameAr(suggestion);
        setIsNameArGenerated(true);
      }
    }
  };

  const forceTranslateArToEn = async () => {
    if (nameAr.trim()) {
      setIsTranslatingAr(true);
      try {
        const suggestion = await getBilingualSuggestion(nameAr, "ar");
        if (suggestion) {
          setNameEn(suggestion);
          setIsNameEnGenerated(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsTranslatingAr(false);
      }
    }
  };

  const forceTranslateEnToAr = async () => {
    if (nameEn.trim()) {
      setIsTranslatingEn(true);
      try {
        const suggestion = await getBilingualSuggestion(nameEn, "en");
        if (suggestion) {
          setNameAr(suggestion);
          setIsNameArGenerated(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsTranslatingEn(false);
      }
    }
  };
  const [emirate, setEmirate] = useState("Sharjah");
  const [community, setCommunity] = useState("خورفكان");
  const [plotNumber, setPlotNumber] = useState("");
  const [buildingNo, setBuildingNo] = useState("");
  const [electricityAccountNo, setElectricityAccountNo] = useState("");
  const [totalUnits, setTotalUnits] = useState(1);
  const [type, setType] = useState<Property["type"]>("RESIDENTIAL_BUILDING");
  const [status, setStatus] = useState<Property["status"]>("ACTIVE");
  const [notes, setNotes] = useState("");

  const filteredProperties = properties.filter((p) => {
    const owner = owners.find((o) => o.id === p.ownerId);
    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          p.code,
          p.nameAr,
          p.nameEn,
          p.community,
          p.plotNumber,
          p.buildingNo,
          p.electricityAccountNo,
          owner?.nameAr,
          owner?.nameEn,
          owner?.code,
        ],
        searchTerm
      );
    const matchOwner = selectedOwnerId === "ALL" || p.ownerId === selectedOwnerId;
    const matchType = selectedType === "ALL" || p.type === selectedType;
    const matchStatus = selectedStatus === "ALL" || p.status === selectedStatus;

    return matchTerm && matchOwner && matchType && matchStatus;
  });

  const handleOpenAdd = () => {
    setEditingProperty(null);
    setCode(getNextPropertyCode());
    setNameAr("");
    setNameEn("");
    setOwnerId(owners[0]?.id || "");
    setEmirate("Sharjah");
    setCommunity("خورفكان");
    setPlotNumber("");
    setBuildingNo("");
    setElectricityAccountNo("");
    setTotalUnits(1);
    setType("RESIDENTIAL_BUILDING");
    setStatus("ACTIVE");
    setNotes("");
    setIsNameEnGenerated(false);
    setIsNameArGenerated(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prop: Property) => {
    setEditingProperty(prop);
    setCode(prop.code);
    setNameAr(prop.nameAr);
    setNameEn(prop.nameEn);
    setOwnerId(prop.ownerId);
    setEmirate(prop.emirate || "Sharjah");
    setCommunity(prop.community || "خورفكان");
    setPlotNumber(prop.plotNumber || "");
    setBuildingNo(prop.buildingNo || "");
    setElectricityAccountNo(prop.electricityAccountNo || "");
    setTotalUnits(prop.totalUnits || 1);
    setType(prop.type || "RESIDENTIAL_BUILDING");
    setStatus(prop.status || "ACTIVE");
    setNotes(prop.notes || "");
    setIsNameEnGenerated(false);
    setIsNameArGenerated(false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;

    const payload = {
      code: code || `PROP-${Date.now() % 10000}`,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      ownerId,
      emirate,
      community,
      plotNumber,
      buildingNo,
      electricityAccountNo,
      totalUnits: Number(totalUnits) || 1,
      type,
      status,
      notes,
    };

    if (editingProperty) {
      updateProperty(editingProperty.id, payload);
    } else {
      addProperty(payload);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (propertyToDelete) {
      deleteProperty(propertyToDelete.id);
      setPropertyToDelete(null);
    }
  };

  if (selected360PropertyId) {
    return (
      <Property360Workspace
        propertyId={selected360PropertyId}
        onClose={() => setSelected360PropertyId(null)}
        onNavigateToUnit={() => onNavigateToUnits && onNavigateToUnits()}
        onNavigateToLease={() => onNavigateToLeases && onNavigateToLeases()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DraggableWrapper formId="PROPERTIES" elementId="header-section">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {language === "ar" ? "إدارة العقارات" : "Properties Management"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {language === "ar"
                ? "إدارة وتتبع مباني وعقارات محفظة الاستثمار العقاري"
                : "Manage and track real estate portfolio buildings and properties"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ar" ? "إضافة عقار جديد" : "Add Property"}</span>
            </button>
          </div>
        </div>
      </DraggableWrapper>

      {/* Khorfakkan District Filter Chips */}
      <DraggableWrapper formId="PROPERTIES" elementId="district-chips">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-slate-400 text-[11px] font-bold shrink-0 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{language === "ar" ? "أحياء خورفكان:" : "Khorfakkan Districts:"}</span>
          </span>
          {["الكل", "حي اللؤلؤية", "الزبارة", "اليرموك", "المديفي", "الحراي السكنية", "الحراي الصناعية", "الصبيحية", "البردي", "شيص"].map((areaTag) => {
            const isActive = areaTag === "الكل" ? searchTerm === "" : searchTerm === areaTag;
            return (
              <button
                key={areaTag}
                type="button"
                onClick={() => {
                  if (areaTag === "الكل") setSearchTerm("");
                  else setSearchTerm(areaTag);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? "bg-amber-700 text-white border-amber-800 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-200"
                }`}
              >
                {areaTag}
              </button>
            );
          })}
        </div>
      </DraggableWrapper>

      {/* Filters Bar */}
      <DraggableWrapper formId="PROPERTIES" elementId="filters-bar">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث برقم العقار، الاسم، المنطقة، المالك، العداد..." : "Search by property code, name, community, owner..."}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all text-right"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">{language === "ar" ? "جميع الملاك" : "All Owners"}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {language === "ar" ? o.nameAr : o.nameEn}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">{language === "ar" ? "جميع الحالات" : "All Statuses"}</option>
              <option value="ACTIVE">{language === "ar" ? "نشط" : "Active"}</option>
              <option value="UNDER_MAINTENANCE">{language === "ar" ? "تحت الصيانة" : "Under Maintenance"}</option>
              <option value="INACTIVE">{language === "ar" ? "غير نشط" : "Inactive"}</option>
            </select>
          </div>
        </div>
      </DraggableWrapper>

      {/* Properties Grid / Table */}
      <DraggableWrapper formId="PROPERTIES" elementId="properties-grid">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
          {filteredProperties.map((prop) => {
            const owner = owners.find((o) => o.id === prop.ownerId);
            const propUnits = units.filter((u) => u.propertyId === prop.id);
            const vacantUnitsCount = propUnits.filter((u) => u.status === "VACANT").length;

            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/60 mb-1">
                        {prop.code}
                      </span>
                      <h3
                        onClick={() => setSelected360PropertyId(prop.id)}
                        className="text-base font-bold text-slate-900 hover:text-amber-700 cursor-pointer transition-colors"
                      >
                        {language === "ar" ? prop.nameAr : prop.nameEn}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        prop.status === "ACTIVE"
                          ? "success"
                          : prop.status === "UNDER_MAINTENANCE"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {prop.status === "ACTIVE"
                        ? language === "ar"
                          ? "نشط"
                          : "Active"
                        : prop.status === "UNDER_MAINTENANCE"
                        ? language === "ar"
                          ? "تحت الصيانة"
                          : "Maintenance"
                        : language === "ar"
                        ? "غير نشط"
                        : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">{getPropertyTypeLabel(prop.type, language)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{prop.community} ({prop.emirate})</span>
                    </div>
                    {owner && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                          {language === "ar" ? `المالك: ${owner.nameAr}` : `Owner: ${owner.nameEn}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{language === "ar" ? "الوحدات:" : "Units:"}</span>
                    <span className="font-bold text-slate-900">{propUnits.length} / {prop.totalUnits}</span>
                    {vacantUnitsCount > 0 && (
                      <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {vacantUnitsCount} {language === "ar" ? "شاغرة" : "vacant"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelected360PropertyId(prop.id)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-all"
                      title={language === "ar" ? "عرض 360 للعقار" : "Property 360"}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(prop)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                      title={language === "ar" ? "تعديل" : "Edit"}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setPropertyToDelete(prop)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                        title={language === "ar" ? "حذف" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DraggableWrapper>

      {/* Add / Edit Property Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProperty ? (language === "ar" ? "تعديل بيانات العقار" : "Edit Property") : (language === "ar" ? "إضافة عقار جديد" : "Add New Property")}
        subtitle={language === "ar" ? "تسجيل بيانات العقار والموقع والمالك مع معاينة فورية للبيانات المجمعة" : "Property profile, location, ownership, and live compiled summary"}
        icon={<Building2 className="w-5 h-5" />}
        maxWidth="4xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Live Compiled Property Information Text Box */}
          {(() => {
            const selectedOwner = owners.find((o) => o.id === ownerId);
            const ownerDisplayName = selectedOwner ? (language === "ar" ? selectedOwner.nameAr : selectedOwner.nameEn) : "";
            const getTypeName = (tVal: string) => {
              switch (tVal) {
                case "RESIDENTIAL_BUILDING": return language === "ar" ? "مبنى سكني" : "Residential Building";
                case "COMMERCIAL_BUILDING": return language === "ar" ? "مبنى تجاري" : "Commercial Building";
                case "MIXED_BUILDING": return language === "ar" ? "مبنى سكني تجاري" : "Mixed Building";
                case "VILLA": return language === "ar" ? "فيلا" : "Villa";
                case "WAREHOUSE": return language === "ar" ? "مستودع" : "Warehouse";
                case "SHOWROOM": return language === "ar" ? "معرض" : "Showroom";
                default: return tVal;
              }
            };
            const getStatusName = (sVal: string) => {
              switch (sVal) {
                case "ACTIVE": return language === "ar" ? "نشط" : "Active";
                case "UNDER_MAINTENANCE": return language === "ar" ? "تحت الصيانة" : "Under Maintenance";
                case "INACTIVE": return language === "ar" ? "غير نشط" : "Inactive";
                default: return sVal;
              }
            };

            return (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>
                    {language === "ar"
                      ? "📋 معلومات مجمعة عن العقار (معاينة فورية للبيانات المدخلة):"
                      : "📋 Compiled Property Summary & Live Preview:"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "كود العقار:" : "Code:"}</span>
                    <strong className="font-mono text-amber-950">{code || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "اسم العقار (عربي):" : "Name (Ar):"}</span>
                    <strong className="text-amber-950 truncate block" title={nameAr || "—"}>{nameAr || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "اسم العقار (إنجليزي):" : "Name (En):"}</span>
                    <strong className="text-amber-950 truncate block" title={nameEn || "—"}>{nameEn || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المالك المسجل:" : "Owner:"}</span>
                    <strong className="text-amber-950 truncate block" title={ownerDisplayName || "—"}>
                      {ownerDisplayName ? `${ownerDisplayName} (${selectedOwner?.code || ""})` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الإمارة والمنطقة:" : "Emirate & Area:"}</span>
                    <strong className="text-amber-950 truncate block">
                      {emirate} {community ? `• ${community}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "نوع العقار:" : "Type:"}</span>
                    <strong className="text-amber-950">{getTypeName(type)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "القطعة / المبنى:" : "Plot / Building:"}</span>
                    <strong className="text-amber-950">
                      {plotNumber ? `#${plotNumber}` : "—"} {buildingNo ? `/ مبنى ${buildingNo}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "إجمالي الوحدات:" : "Total Units:"}</span>
                    <strong className="text-amber-950">{totalUnits} {language === "ar" ? "وحدة" : "units"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "حساب الكهرباء:" : "Electricity A/C:"}</span>
                    <strong className="font-mono text-amber-950">{electricityAccountNo || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الحالة التشغيلية:" : "Status:"}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : status === "UNDER_MAINTENANCE"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}>
                      {getStatusName(status)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === "ar" ? "اسم العقار (عربي)*" : "Property Name (Arabic)*"}
                </label>
                {nameAr && (
                  <button
                    type="button"
                    onClick={forceTranslateArToEn}
                    disabled={isTranslatingAr}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 hover:text-amber-800 transition-colors cursor-pointer"
                    title={language === "ar" ? "ترجمة ونقل الحروف للإنجليزية" : "Translate and transliterate to English"}
                  >
                    <Sparkles className={`w-3 h-3 ${isTranslatingAr ? "animate-spin" : ""}`} />
                    <span>{language === "ar" ? "توليد بالإنجليزية" : "Generate English"}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => {
                    setNameAr(e.target.value);
                    setIsNameArGenerated(false);
                  }}
                  onBlur={handleArBlur}
                  placeholder="مثال: عمارة الكورنيش"
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-right transition-all ${
                    isNameArGenerated 
                      ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/10 focus:border-amber-500" 
                      : "bg-slate-50 border-slate-200 focus:border-amber-600"
                  }`}
                />
                {isNameArGenerated && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200">
                    <Languages className="w-2.5 h-2.5" />
                    <span>{language === "ar" ? "مقترح" : "Suggested"}</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === "ar" ? "اسم العقار (إنجليزي)" : "Property Name (English)"}
                </label>
                {nameEn && (
                  <button
                    type="button"
                    onClick={forceTranslateEnToAr}
                    disabled={isTranslatingEn}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 hover:text-amber-800 transition-colors cursor-pointer"
                    title={language === "ar" ? "ترجمة ونقل الحروف للعربية" : "Translate and transliterate to Arabic"}
                  >
                    <Sparkles className={`w-3 h-3 ${isTranslatingEn ? "animate-spin" : ""}`} />
                    <span>{language === "ar" ? "توليد بالعربية" : "Generate Arabic"}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => {
                    setNameEn(e.target.value);
                    setIsNameEnGenerated(false);
                  }}
                  onBlur={handleEnBlur}
                  placeholder="e.g. Corniche Building"
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${
                    isNameEnGenerated 
                      ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/10 focus:border-amber-500" 
                      : "bg-slate-50 border-slate-200 focus:border-amber-600"
                  }`}
                />
                {isNameEnGenerated && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200">
                    <Languages className="w-2.5 h-2.5" />
                    <span>{language === "ar" ? "مقترح" : "Suggested"}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">{language === "ar" ? "كود العقار" : "Property Code"} *</label>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                  <Lock className="w-3 h-3 text-amber-700" />
                  {language === "ar" ? "مسلسل تلقائي (محمي)" : "Auto-Locked"}
                </span>
              </div>
              <input
                type="text"
                readOnly
                disabled
                value={code}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "المالك*" : "Owner*"}</label>
              <SearchableSelect
                options={owners.map((o) => ({
                  id: o.id,
                  label: language === "ar" ? o.nameAr : o.nameEn,
                  subLabel: language === "ar" ? `المالك: ${o.code} - ${o.phone}` : `Owner: ${o.code} - ${o.phone}`,
                }))}
                value={ownerId}
                onChange={setOwnerId}
                placeholder={language === "ar" ? "اختر المالك..." : "Select owner..."}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "الإمارة" : "Emirate"}</label>
              <select
                value={emirate}
                onChange={(e) => setEmirate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="Sharjah">{language === "ar" ? "الشارقة" : "Sharjah"}</option>
                <option value="Dubai">{language === "ar" ? "دبي" : "Dubai"}</option>
                <option value="Ajman">{language === "ar" ? "عجمان" : "Ajman"}</option>
                <option value="Fujairah">{language === "ar" ? "الفجيرة" : "Fujairah"}</option>
              </select>
            </div>
            <div>
              <AreaCombobox
                value={community}
                onChange={setCommunity}
                label={language === "ar" ? "المنطقة / الحي" : "Community / District"}
                emirate={emirate}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "نوع العقار" : "Property Type"}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="RESIDENTIAL_BUILDING">{language === "ar" ? "مبنى سكني" : "Residential Building"}</option>
                <option value="COMMERCIAL_BUILDING">{language === "ar" ? "مبنى تجاري" : "Commercial Building"}</option>
                <option value="MIXED_BUILDING">{language === "ar" ? "مبنى سكني تجاري" : "Mixed Building"}</option>
                <option value="VILLA">{language === "ar" ? "فيلا" : "Villa"}</option>
                <option value="WAREHOUSE">{language === "ar" ? "مستودع" : "Warehouse"}</option>
                <option value="SHOWROOM">{language === "ar" ? "معرض" : "Showroom"}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "رقم القطعة" : "Plot Number"}</label>
              <input
                type="text"
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "رقم المبنى" : "Building No"}</label>
              <input
                type="text"
                value={buildingNo}
                onChange={(e) => setBuildingNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "إجمالي الوحدات" : "Total Units"}</label>
              <input
                type="number"
                min="1"
                value={totalUnits}
                onChange={(e) => setTotalUnits(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "حساب الكهرباء" : "Electricity Account No"}</label>
              <input
                type="text"
                value={electricityAccountNo}
                onChange={(e) => setElectricityAccountNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "الحالة" : "Status"}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="ACTIVE">{language === "ar" ? "نشط" : "Active"}</option>
                <option value="UNDER_MAINTENANCE">{language === "ar" ? "تحت الصيانة" : "Under Maintenance"}</option>
                <option value="INACTIVE">{language === "ar" ? "غير نشط" : "Inactive"}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{language === "ar" ? "ملاحظات" : "Notes"}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all"
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium transition-all shadow-sm"
            >
              {language === "ar" ? "حفظ العقار" : "Save Property"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(propertyToDelete)}
        onClose={() => setPropertyToDelete(null)}
        onConfirm={confirmDelete}
        title={language === "ar" ? "تأكيد حذف العقار" : "Confirm Delete Property"}
        itemName={
          language === "ar"
            ? `هل أنت متأكد من حذف العقار "${propertyToDelete?.nameAr}"؟`
            : `Are you sure you want to delete property "${propertyToDelete?.nameEn}"?`
        }
      />
    </div>
  );
};
