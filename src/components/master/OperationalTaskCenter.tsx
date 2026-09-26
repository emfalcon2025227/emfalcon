import React, { useState, useMemo } from "react";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  Building2,
  Home,
  Users,
  UserCheck,
  Gavel,
  Wrench,
  Download,
  Printer,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useData } from "../../context/DataContext";
import { useLanguage } from "../../context/LanguageContext";
import { SearchableSelect } from "../common/SearchableSelect";
import { OperationalTask, OperationalTaskPriority, OperationalTaskStatus } from "../../types";

export const OperationalTaskCenter: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { properties, units, tenants, owners, leases, cases, maintenanceRequests } = useData();

  // Initial demo tasks generated deterministically from real active operational requirements
  const [tasks, setTasks] = useState<OperationalTask[]>(() => {
    const initialList: OperationalTask[] = [];

    // Lease Renewal Tasks
    leases.filter((l) => l.contractStatus === "UNDER_RENEWAL" || l.contractStatus === "ACTIVE").slice(0, 3).forEach((l, idx) => {
      initialList.push({
        id: `task-lease-${l.id}`,
        taskNumber: `TSK-${String(idx + 1).padStart(4, "0")}`,
        title: isAr ? `متابعة تجديد عقد الإيجار ${l.leaseNumber || l.id}` : `Follow up Lease Renewal ${l.leaseNumber || l.id}`,
        description: isAr
          ? `التواصل مع المستأجر لبحث تجديد العقد السنوي قبل انتهاء الفترة المحددة`
          : `Contact tenant regarding annual lease renewal ahead of expiration date`,
        leaseId: l.id,
        tenantId: l.tenantId,
        propertyId: l.propertyId,
        priority: "HIGH",
        status: "OPEN",
        dueDate: l.endDate || "2026-06-30",
        createdAt: "2026-01-15",
        createdById: "admin",
        createdByName: "Super Admin",
        assignedUserName: "Property Manager",
      });
    });

    // Maintenance Follow-up Tasks
    maintenanceRequests.slice(0, 2).forEach((m, idx) => {
      initialList.push({
        id: `task-mnt-${m.id}`,
        taskNumber: `TSK-${String(initialList.length + 1).padStart(4, "0")}`,
        title: isAr ? `فحص ومعاينة صيانة ${m.category}` : `Inspect & Verify Maintenance ${m.category}`,
        description: m.issueDescription,
        maintenanceRequestId: m.id,
        propertyId: m.propertyId,
        unitId: m.unitId,
        priority: m.priority === "URGENT" ? "URGENT" : "MEDIUM",
        status: m.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
        dueDate: "2026-03-15",
        createdAt: "2026-02-01",
        createdById: "admin",
        createdByName: "Super Admin",
        assignedUserName: "Maintenance Engineer",
      });
    });

    return initialList;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNum = t.taskNumber.toLowerCase().includes(q);
        if (!matchTitle && !matchNum) return false;
      }
      if (selectedPriority !== "ALL" && t.priority !== selectedPriority) return false;
      if (selectedStatus !== "ALL" && t.status !== selectedStatus) return false;
      return true;
    });
  }, [tasks, searchQuery, selectedPriority, selectedStatus]);

  // Toggle Task Completion
  const handleToggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const nextStatus: OperationalTaskStatus = t.status === "COMPLETED" ? "OPEN" : "COMPLETED";
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === "COMPLETED" ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = filteredTasks.map((t) => ({
      [isAr ? "رقم المهمة" : "Task Number"]: t.taskNumber,
      [isAr ? "عنوان المهمة" : "Title"]: t.title,
      [isAr ? "الأولوية" : "Priority"]: t.priority,
      [isAr ? "الحالة" : "Status"]: t.status,
      [isAr ? "تاريخ الاستحقاق" : "Due Date"]: t.dueDate,
      [isAr ? "المكلف بها" : "Assigned To"]: t.assignedUserName || "---",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Operational_Tasks");
    XLSX.writeFile(wb, `Operational_Tasks_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? "مركز المهام والمتابعات التشغيلية" : "Operational Task & Follow-up Center"}</span>
          </h1>
          <p className="text-xs text-slate-300">
            {isAr
              ? "متابعة المواعيد النهائية لتجديد العقود والصيانة والقضايا والتحصيلات"
              : "Track operational deadlines, lease renewals, maintenance workflows, and follow-ups"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? "تصدير المهام" : "Export Tasks"}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? "طباعة" : "Print"}</span>
          </button>
        </div>
      </div>

      {/* Task Controls & Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "ابحث بعنوان المهمة أو الرقم..." : "Search task title..."}
              className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع الأولويات" : "All Priorities" },
              { id: "URGENT", label: isAr ? "عاجل جداً" : "Urgent" },
              { id: "HIGH", label: isAr ? "مرتفع" : "High" },
              { id: "MEDIUM", label: isAr ? "متوسط" : "Medium" },
              { id: "LOW", label: isAr ? "منخفض" : "Low" },
            ]}
            value={selectedPriority}
            onChange={(val) => setSelectedPriority(val)}
            placeholder={isAr ? "اختر الأولوية..." : "Select priority..."}
          />

          <SearchableSelect
            options={[
              { id: "ALL", label: isAr ? "جميع الحالات" : "All Statuses" },
              { id: "OPEN", label: isAr ? "مفتوحة" : "Open" },
              { id: "IN_PROGRESS", label: isAr ? "قيد التنفيذ" : "In Progress" },
              { id: "COMPLETED", label: isAr ? "مكتملة" : "Completed" },
            ]}
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            placeholder={isAr ? "اختر الحالة..." : "Select status..."}
          />
        </div>

        {/* Task List */}
        <div className="space-y-3 pt-2">
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                t.status === "COMPLETED"
                  ? "bg-slate-50/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-75"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-xs"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleTaskStatus(t.id)}
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition mt-0.5 ${
                    t.status === "COMPLETED"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-300 dark:border-slate-600 hover:border-indigo-600"
                  }`}
                >
                  {t.status === "COMPLETED" && <CheckCircle2 className="w-4 h-4" />}
                </button>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-400">{t.taskNumber}</span>
                    <span
                      className={`text-xs font-bold ${
                        t.status === "COMPLETED"
                          ? "line-through text-slate-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {t.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.priority === "URGENT"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : t.priority === "HIGH"
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.description}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{isAr ? "الاستحقاق:" : "Due:"} {t.dueDate}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{t.assignedUserName || "Admin"}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    t.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
