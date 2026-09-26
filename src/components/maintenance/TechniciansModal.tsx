import React, { useState } from "react";
import {
  X,
  Wrench,
  User,
  Phone,
  Building,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  Briefcase,
  Layers,
  Star,
  ExternalLink,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { Technician } from "../../types";

interface TechniciansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechniciansModal: React.FC<TechniciansModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    technicians,
    maintenanceRequests,
    addTechnician,
    updateTechnician,
    deleteTechnician,
  } = useData();
  const { t, language } = useLanguage();
  const { currentUser, hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState("ALL");

  // Add/Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("سباكة");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingTechId(null);
    setName("");
    setCompany("");
    setPhone("");
    setServiceType("سباكة");
    setNotes("");
    setIsEditing(true);
  };

  const handleOpenEdit = (tech: Technician) => {
    setEditingTechId(tech.id);
    setName(tech.name);
    setCompany(tech.company || "");
    setPhone(tech.phone || "");
    setServiceType(tech.serviceType || "عام");
    setNotes(tech.notes || "");
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingTechId) {
      updateTechnician(editingTechId, {
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || "",
        serviceType: serviceType.trim() || "عام",
        notes: notes.trim() || undefined,
      });
    } else {
      addTechnician({
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || "",
        serviceType: serviceType.trim() || "عام",
        notes: notes.trim() || undefined,
        status: "ACTIVE",
      });
    }

    setIsEditing(false);
  };

  const handleDelete = (techId: string, techName: string) => {
    const activeRequests = maintenanceRequests.filter(
      (m) =>
        m.assignedTechnicianId === techId &&
        m.status !== "COMPLETED" &&
        m.status !== "CANCELLED" &&
        m.status !== "REJECTED"
    );

    if (activeRequests.length > 0) {
      alert(
        language === "ar"
          ? `لا يمكن حذف الفني (${techName}) لأن لديه ${activeRequests.length} طلبات صيانة نشطة غير منجزة.`
          : `Cannot delete technician (${techName}) because they have ${activeRequests.length} active maintenance requests.`
      );
      return;
    }

    if (
      confirm(
        language === "ar"
          ? `هل أنت متأكد من حذف الفني (${techName})؟`
          : `Are you sure you want to delete technician (${techName})?`
      )
    ) {
      deleteTechnician(techId);
    }
  };

  const filteredTechnicians = technicians.filter((tech) => {
    const searchLower = (searchQuery || "").toLowerCase();
    const matchesSearch =
      (tech.name || "").toLowerCase().includes(searchLower) ||
      (tech.company && tech.company.toLowerCase().includes(searchLower)) ||
      (tech.phone && tech.phone.includes(searchQuery)) ||
      (tech.serviceType && tech.serviceType.toLowerCase().includes(searchLower));

    const matchesType =
      selectedServiceType === "ALL" || tech.serviceType === selectedServiceType;

    return matchesSearch && matchesType;
  });

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div
        id="technicians-management-modal"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t("maintTechnicians")}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ar"
                  ? "دليل الفنيين ومقاولي الصيانة والشركات المعتمدة"
                  : "Technicians & maintenance contractors directory"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("maintAddTechnician")}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === "ar"
                  ? "بحث بالاسم، الشركة، الهاتف، التخصص..."
                  : "Search technician, company, phone..."
              }
              className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-48 shrink-0">
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة التخصصات" : "All Trades" },
                { id: "سباكة", label: "سباكة (Plumbing)" },
                { id: "كهرباء", label: "كهرباء (Electrical)" },
                { id: "تكييف", label: "تكييف (HVAC)" },
                { id: "مصاعد", label: "مصاعد (Elevators)" },
                { id: "نجارة", label: "نجارة (Carpentry)" },
                { id: "ألمنيوم وزجاج", label: "ألمنيوم وزجاج (Aluminum)" },
                { id: "مكافحة حشرات", label: "مكافحة حشرات (Pest Control)" },
                { id: "عام", label: "صيانة عامة (General)" },
              ]}
              value={selectedServiceType}
              onChange={(val) => setSelectedServiceType(val)}
              placeholder={language === "ar" ? "التخصص..." : "Trade..."}
              searchPlaceholder={language === "ar" ? "ابحث عن تخصص..." : "Search trade..."}
            />
          </div>
        </div>

        {/* List of Technicians */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTechnicians.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTechnicians.map((tech) => {
                const activeTickets = maintenanceRequests.filter(
                  (m) =>
                    m.assignedTechnicianId === tech.id &&
                    m.status !== "COMPLETED" &&
                    m.status !== "CANCELLED" &&
                    m.status !== "REJECTED"
                ).length;

                const completedTickets = maintenanceRequests.filter(
                  (m) =>
                    m.assignedTechnicianId === tech.id &&
                    m.status === "COMPLETED"
                ).length;

                return (
                  <div
                    key={tech.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              {tech.name}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {tech.serviceType || "عام"}
                            </span>
                          </div>
                          {tech.company && (
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              <span>{tech.company}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(tech)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                            title={t("edit")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tech.id, tech.name)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title={t("delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {tech.phone && (
                        <div className="mt-2">
                          <a
                            href={`tel:${tech.phone}`}
                            className="text-xs font-bold text-sky-800 hover:underline flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{tech.phone}</span>
                          </a>
                        </div>
                      )}

                      {tech.notes && (
                        <p className="text-[11px] text-slate-500 mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                          {tech.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">
                          {language === "ar" ? "الطلبات النشطة:" : "Active:"}{" "}
                          <span className="font-bold text-amber-800">{activeTickets}</span>
                        </span>
                        <span className="text-slate-500">
                          {language === "ar" ? "المنجزة:" : "Done:"}{" "}
                          <span className="font-bold text-emerald-800">{completedTickets}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              {language === "ar"
                ? "لا يوجد فنيون مطابقون للبحث."
                : "No technicians found."}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>

      {/* ADD / EDIT SUB-MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-500" />
              <span>
                {editingTechId
                  ? t("maintEditTechnician")
                  : t("maintAddTechnician")}
              </span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintTechName")} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم الفني أو المسؤول"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintTechCompany")}
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="اسم الشركة أو المؤسسة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t("maintTechPhone")}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-XXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <SearchableSelect
                  label={t("maintTechServiceType")}
                  options={[
                    { id: "سباكة", label: "سباكة", subLabel: "Plumbing" },
                    { id: "كهرباء", label: "كهرباء", subLabel: "Electrical" },
                    { id: "تكييف", label: "تكييف وتبريد", subLabel: "AC & HVAC" },
                    { id: "مصاعد", label: "مصاعد وسلالم متحركة", subLabel: "Elevators" },
                    { id: "نجارة", label: "نجارة وأبواب", subLabel: "Carpentry" },
                    { id: "ألمنيوم وزجاج", label: "ألمنيوم وزجاج", subLabel: "Aluminum & Glass" },
                    { id: "مكافحة حشرات", label: "مكافحة حشرات", subLabel: "Pest Control" },
                    { id: "عام", label: "صيانة عامة", subLabel: "General Maintenance" },
                  ]}
                  value={serviceType}
                  onChange={(val) => setServiceType(val)}
                  placeholder={language === "ar" ? "-- اختر التخصص --" : "-- Select Trade --"}
                  searchPlaceholder={language === "ar" ? "ابحث بالتخصص..." : "Search trade..."}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === "ar" ? "ملاحظات إضافية" : "Notes"}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي معلومات إضافية..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs cursor-pointer"
                >
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
