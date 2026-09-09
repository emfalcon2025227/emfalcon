import React, { useState } from "react";
import { Plus, Search, KeyRound, Building, User, Edit2, Layers, Trash2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Unit } from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { getPropertyTypeLabel } from "../../data/propertyOptions";
import { matchAnyArabicSearch } from "../../utils/arabicTextNormalizer";
import { getUnitOccupyingLeases, getUnitEffectiveOccupancy } from "../../utils/unitOccupancyGovernance";
import { Unit360Workspace } from "./Unit360Workspace";
import { DraggableWrapper } from "../common/DraggableWrapper";

export const UnitsView: React.FC = () => {
  const { t, language } = useLanguage();
  const { units, properties, tenants, leases, addUnit, updateUnit, deleteUnit } = useData();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("DELETE_RECORDS");
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [selected360UnitId, setSelected360UnitId] = useState<string | null>(null);

  const handleDelete = (unit: Unit) => {
    setUnitToDelete(unit);
  };

  const confirmDelete = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (unitToDelete) {
      deleteUnit(unitToDelete.id, options);
      setUnitToDelete(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => {
    const saved = sessionStorage.getItem("ef_unit_initial_filter");
    if (saved) {
      sessionStorage.removeItem("ef_unit_initial_filter");
      return saved;
    }
    return "ALL";
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form State
  const [unitNumber, setUnitNumber] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [floor, setFloor] = useState("");
  const [unitType, setUnitType] = useState<Unit["unitType"]>("" as any);
  const [annualRent, setAnnualRent] = useState(0);
  const [areaSqFt, setAreaSqFt] = useState(0);
  const [status, setStatus] = useState<Unit["status"]>("VACANT");
  const [electricityMeter, setElectricityMeter] = useState("");

  const filteredUnits = units.filter((u) => {
    const prop = properties.find((p) => p.id === u.propertyId);
    const tenant = tenants.find((t) => t.id === u.currentTenantId);

    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          u.unitNumber,
          u.floor,
          u.electricityMeter,
          prop?.nameAr,
          prop?.nameEn,
          prop?.code,
          prop?.community,
          tenant?.nameAr,
          tenant?.nameEn,
          tenant?.code,
          tenant?.phone,
        ],
        searchTerm
      );

    const matchProp = selectedProperty === "ALL" || u.propertyId === selectedProperty;
    const uStatus = (u.status || "").toUpperCase().trim();
    const matchStatus =
      selectedStatus === "ALL" ||
      uStatus === selectedStatus.toUpperCase() ||
      (selectedStatus === "OCCUPIED" && (uStatus === "OCCUPIED" || uStatus === "RENTED"));

    return matchTerm && matchProp && matchStatus;
  });

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setUnitNumber("");
    setPropertyId("");
    setFloor("");
    setUnitType("" as any);
    setAnnualRent(0);
    setAreaSqFt(0);
    setStatus("VACANT");
    setElectricityMeter("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitNumber(unit.unitNumber || "");
    setPropertyId(unit.propertyId || "");
    setFloor(unit.floor || "");
    setUnitType(unit.unitType || ("" as any));
    setAnnualRent(unit.annualRent || 0);
    setAreaSqFt(unit.areaSqFt || 0);
    setStatus(unit.status || "VACANT");
    setElectricityMeter(unit.electricityMeter || "");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUnit) {
      updateUnit(editingUnit.id, {
        unitNumber,
        propertyId,
        floor,
        type: (unitType as any) || "2BR",
        unitType,
        annualRent,
        areaSqFt,
        status,
        previousStatus: status !== "OCCUPIED" ? status : (editingUnit.previousStatus || "VACANT"),
        electricityMeter,
      });
    } else {
      addUnit({
        unitNumber,
        propertyId,
        floor,
        type: (unitType as any) || "2BR",
        unitType,
        annualRent,
        areaSqFt,
        status,
        previousStatus: status !== "OCCUPIED" ? status : "VACANT",
        electricityMeter,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DraggableWrapper formId="UNITS" elementId="header-info">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t("navUnits")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "مخزون الوحدات العقارية، أسعار الإيجار السنوية، وحالة الإشغال"
                : "Inventory of rental apartments, commercial units, and occupancy status"}
            </p>
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="UNITS" elementId="btn-add-unit">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === "ar" ? "إضافة وحدة جديدة" : "Add New Unit"}</span>
          </button>
        </DraggableWrapper>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DraggableWrapper formId="UNITS" elementId="filter-search">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث برقم الوحدة، العقار، المستأجر..." : "Search by unit #, property, tenant..."}
              className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
            />
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="UNITS" elementId="filter-property">
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة العقارات" : "All Properties" },
                ...properties.map((p) => ({
                  id: p.id,
                  label: language === "ar" ? p.nameAr : p.nameEn,
                })),
              ]}
              value={selectedProperty}
              onChange={(val) => setSelectedProperty(val)}
              placeholder={language === "ar" ? "فلترة بالعقار..." : "Filter property..."}
              searchPlaceholder={language === "ar" ? "ابحث بالعقار..." : "Search property..."}
            />
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="UNITS" elementId="filter-status">
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة الحالات" : "All Statuses" },
                { id: "VACANT", label: language === "ar" ? "شاغرة (خالية)" : "VACANT", badge: language === "ar" ? "🟢 شاغرة" : "🟢 VACANT" },
                { id: "OCCUPIED", label: language === "ar" ? "مؤجرة" : "OCCUPIED", badge: language === "ar" ? "🔴 مؤجرة" : "🔴 OCCUPIED" },
                { id: "MAINTENANCE", label: language === "ar" ? "قيد الصيانة" : "MAINTENANCE", badge: language === "ar" ? "🟡 صيانة" : "🟡 MAINTENANCE" },
              ]}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              placeholder={language === "ar" ? "فلترة بالحالة..." : "Filter status..."}
              searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
            />
          </div>
        </DraggableWrapper>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-start">{language === "ar" ? "رقم الوحدة" : "Unit #"}</th>
                <th className="py-3 px-4 text-start">{t("navProperties")}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "النوع والمساحة" : "Type & Area"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الإيجار السنوي" : "Annual Rent"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر الحالي" : "Current Tenant"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUnits.map((unit) => {
                const prop = properties.find((p) => p.id === unit.propertyId);
                const tenant = tenants.find((t) => t.id === unit.currentTenantId);

                return (
                  <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                        <span className="font-mono">{unit.unitNumber}</span>
                        <span className="text-[10px] text-slate-400 font-normal">F{unit.floor}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : "N/A"}
                      </div>
                      <div className="text-[10px] text-slate-400">{prop?.emirate}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {(unit.unitType || unit.type || "UNIT").replace(/_/g, " ")}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{unit.areaSqFt} Sq.Ft</div>
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      AED {Number(unit.annualRent || 0).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      {tenant ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">
                              {language === "ar" ? tenant.nameAr : tenant.nameEn}
                            </span>
                          </div>
                          {unit.currentLeaseId && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {leases.find((l) => l.id === unit.currentLeaseId)?.leaseNumber}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          unit.status === "VACANT"
                            ? "success"
                            : unit.status === "OCCUPIED"
                            ? "danger"
                            : "warning"
                        }
                        size="sm"
                      >
                        {unit.status === "VACANT"
                          ? language === "ar"
                            ? "🟢 شاغرة (خالية)"
                            : "🟢 VACANT"
                          : unit.status === "OCCUPIED"
                          ? language === "ar"
                            ? "🔴 مؤجرة"
                            : "🔴 OCCUPIED"
                          : unit.status === "MAINTENANCE"
                          ? language === "ar"
                            ? "🟡 قيد الصيانة"
                            : "🟡 MAINTENANCE"
                          : unit.status}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelected360UnitId(unit.id)}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                        >
                          360°
                        </button>
                        <button
                          onClick={() => handleOpenEdit(unit)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title={t("edit")}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(unit)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title={language === "ar" ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUnits.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>

      {/* Add / Edit Unit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUnit ? (language === "ar" ? "تعديل بيانات الوحدة" : "Edit Unit") : (language === "ar" ? "إضافة وحدة جديدة" : "Add New Unit")}
        subtitle={language === "ar" ? "تسجيل رقم الشقة أو المحل، المساحة، والإيجار السنوي مع معاينة فورية للبيانات المجمعة" : "Unit specifications, floor, pricing, and live compiled summary"}
        icon={<KeyRound className="w-5 h-5" />}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 pb-40">
          {/* Compiled Unit Information Summary Box */}
          {(() => {
            const selectedPropObj = properties.find((p) => p.id === propertyId);
            return (
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  <span>{language === "ar" ? "📋 معلومات مجمعة عن الوحدة (معاينة فورية للبيانات المدخلة):" : "📋 Compiled Unit Summary & Live Preview:"}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "رقم الوحدة" : "Unit #"}</span>
                    <span className="font-mono font-black text-slate-900">{unitNumber || "---"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "العقار" : "Property"}</span>
                    <span className="font-semibold truncate block text-slate-900" title={selectedPropObj ? (language === "ar" ? selectedPropObj.nameAr : selectedPropObj.nameEn) : ""}>
                      {selectedPropObj ? (language === "ar" ? selectedPropObj.nameAr : selectedPropObj.nameEn) : "---"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "الطابق" : "Floor"}</span>
                    <span className="font-bold text-slate-900">{floor || "---"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "نوع الوحدة" : "Type"}</span>
                    <span className="font-semibold text-slate-900 truncate block">{unitType ? unitType.replace(/_/g, " ") : "---"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "الإيجار السنوي" : "Annual Rent"}</span>
                    <span className="font-mono font-bold text-amber-800">{annualRent ? `${Number(annualRent).toLocaleString()} AED` : "---"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "الحالة" : "Status"}</span>
                    <span className="font-bold">
                      {status === "VACANT" 
                        ? (language === "ar" ? "🟢 شاغرة" : "🟢 VACANT") 
                        : status === "OCCUPIED" 
                        ? (language === "ar" ? "🔴 مؤجرة" : "🔴 OCCUPIED") 
                        : (language === "ar" ? "🟡 صيانة" : "🟡 MAINTENANCE")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block text-[10px] font-bold">{language === "ar" ? "رقم العداد" : "Meter #"}</span>
                    <span className="font-mono font-bold text-slate-900">{electricityMeter || "---"}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Row 1: Unit Number & Property (stretched) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-unit-number">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم الوحدة" : "Unit Number"} *
                </label>
                <input
                  type="text"
                  required
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="101 / Shop 3"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                />
              </div>
            </DraggableWrapper>
            <div className="sm:col-span-2">
              <DraggableWrapper formId="UNIT_MODAL" elementId="field-property">
                <SearchableSelect
                  label={t("navProperties")}
                  required
                  options={properties.map((p) => ({
                    id: p.id,
                    label: language === "ar" ? p.nameAr : p.nameEn,
                    subLabel: p.community ? `${p.community} (${p.emirate})` : p.emirate,
                    badge: getPropertyTypeLabel(p.type, language),
                  }))}
                  value={propertyId}
                  onChange={(val) => setPropertyId(val)}
                  placeholder={language === "ar" ? "-- ابحث واختر العقار --" : "-- Select Property --"}
                  searchPlaceholder={language === "ar" ? "ابحث بأسماء العقارات..." : "Search property..."}
                />
              </DraggableWrapper>
            </div>
          </div>

          {/* Row 2: Floor, Area, Annual Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-floor">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الطابق" : "Floor"} *
                </label>
                <input
                  type="text"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="1"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all font-semibold"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-area">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "المساحة (قدم مربع)" : "Area (Sq. Ft)"} *
                </label>
                <input
                  type="number"
                  min={100}
                  required
                  value={areaSqFt}
                  onChange={(e) => setAreaSqFt(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-annual-rent">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الإيجار السنوي (درهم)" : "Annual Rent (AED)"} *
                </label>
                <input
                  type="number"
                  min={1000}
                  required
                  value={annualRent}
                  onChange={(e) => setAnnualRent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                />
              </div>
            </DraggableWrapper>
          </div>

          {/* Row 3: Unit Type, Status, Electricity Meter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-unit-type">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "نوع الوحدة" : "Unit Type"} *
                </label>
                <SearchableSelect
                  options={[
                    { id: "STUDIO", label: "STUDIO (استوديو)" },
                    { id: "ONE_BEDROOM", label: "1 BEDROOM (غرفة وصالة)" },
                    { id: "TWO_BEDROOM", label: "2 BEDROOMS (غرفتين وصالة)" },
                    { id: "THREE_BEDROOM", label: "3 BEDROOMS (3 غرف وصالة)" },
                    { id: "PENTHOUSE", label: "PENTHOUSE (بنتهاوس)" },
                    { id: "OFFICE", label: "OFFICE (مكتب تجاري)" },
                    { id: "RETAIL_SHOP", label: "RETAIL SHOP (محل تجاري)" },
                    { id: "WAREHOUSE", label: "WAREHOUSE (مستودع)" },
                  ]}
                  value={unitType || ""}
                  onChange={(val) => setUnitType(val as any)}
                  placeholder={language === "ar" ? "اختر نوع الوحدة..." : "Select unit type..."}
                  searchPlaceholder={language === "ar" ? "ابحث بالنوع..." : "Search type..."}
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-status">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "حالة الوحدة" : "Unit Status"} *
                  </label>
                  {editingUnit && getUnitOccupyingLeases(editingUnit.id, leases).length > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      {language === "ar" ? "مرتبطة بعقد قائم" : "Linked to Lease"}
                    </span>
                  )}
                </div>
                {editingUnit && getUnitOccupyingLeases(editingUnit.id, leases).length > 0 && (
                  <div className="mb-2 p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    ⚠️ {language === "ar" 
                      ? `الوحدة مرتبطة بعقد إيجار نشط/غير ملغى #${getUnitOccupyingLeases(editingUnit.id, leases)[0].leaseNumber} [${getUnitOccupyingLeases(editingUnit.id, leases)[0].contractStatus}]. انتهاء مدة العقد لا يفرغ الوحدة تلقائياً؛ لا يمكن تحويلها إلى شاغرة إلا بعد فسخ العقد أو إلغائه من إدارة العقود.`
                      : `Unit is linked to active/uncancelled lease #${getUnitOccupyingLeases(editingUnit.id, leases)[0].leaseNumber} [${getUnitOccupyingLeases(editingUnit.id, leases)[0].contractStatus}]. Contract expiry does not automatically vacate the unit.`}
                  </div>
                )}
                <SearchableSelect
                  options={[
                    { 
                      id: "VACANT", 
                      label: language === "ar" ? "شاغرة (خالية)" : "VACANT", 
                      badge: language === "ar" ? "🟢 شاغرة" : "🟢 VACANT",
                      disabled: Boolean(editingUnit && getUnitOccupyingLeases(editingUnit.id, leases).length > 0)
                    },
                    { id: "OCCUPIED", label: language === "ar" ? "مؤجرة" : "OCCUPIED", badge: language === "ar" ? "🔴 مؤجرة" : "🔴 OCCUPIED" },
                    { id: "MAINTENANCE", label: language === "ar" ? "قيد الصيانة" : "MAINTENANCE", badge: language === "ar" ? "🟡 صيانة" : "🟡 MAINTENANCE" },
                  ]}
                  value={status}
                  onChange={(val) => {
                    if (editingUnit && val === "VACANT" && getUnitOccupyingLeases(editingUnit.id, leases).length > 0) {
                      alert(language === "ar" ? "لا يمكن جعل الوحدة شاغرة لوجود عقد إيجار قائم غير ملغى أو مفسوخ." : "Cannot set unit to VACANT while an uncancelled lease exists.");
                      return;
                    }
                    setStatus(val as any);
                  }}
                  placeholder={language === "ar" ? "اختر حالة الوحدة..." : "Select unit status..."}
                  searchPlaceholder={language === "ar" ? "ابحث بالحالة..." : "Search status..."}
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="UNIT_MODAL" elementId="field-electricity-meter">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم عداد الكهرباء (DEWA / SEWA / ADDC)" : "Electricity Meter #"}
                </label>
                <input
                  type="text"
                  value={electricityMeter}
                  onChange={(e) => setElectricityMeter(e.target.value)}
                  placeholder="20394812"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none transition-all"
                />
              </div>
            </DraggableWrapper>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors"
            >
              {t("save")}
            </button>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      {unitToDelete && (() => {
        const prop = properties.find(p => p.id === unitToDelete.propertyId);
        return (
          <ConfirmDeleteModal
            isOpen={!!unitToDelete}
            onClose={() => setUnitToDelete(null)}
            onConfirm={confirmDelete}
            title={language === "ar" ? "حذف بيانات الوحدة العقارية" : "Delete Unit"}
            itemName={`${language === "ar" ? "الوحدة" : "Unit"} ${unitToDelete.unitNumber} - ${prop ? (language === "ar" ? prop.nameAr : prop.nameEn) : ""}`}
            itemCode={unitToDelete.unitNumber}
            itemType={language === "ar" ? "وحدة عقارية" : "Real Estate Unit"}
            entityType="UNIT"
            entityId={unitToDelete.id}
            statusAtDeletion={unitToDelete.status}
          />
        );
      })()}
      {/* Unit 360 Workspace Modal */}
      {selected360UnitId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Unit360Workspace
              unitId={selected360UnitId}
              onClose={() => setSelected360UnitId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
