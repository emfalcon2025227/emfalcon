import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from "lucide-react";
import { Cheque, Language } from "../../types";

interface CollectionsCalendarProps {
  cheques: Cheque[];
  language: Language;
}

export const CollectionsCalendar: React.FC<CollectionsCalendarProps> = ({ cheques, language }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const monthData = useMemo(() => {
    const days = [];
    // Padding for the first week
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: null, date: "", upcoming: [], missed: [], totalCheques: 0 });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayCheques = cheques.filter(c => c.dueDate === dateStr);
      
      const upcoming = dayCheques.filter(c => 
        (c.status === "PENDING" || c.status === "POST_DATED") && 
        new Date(c.dueDate) >= new Date(new Date().setHours(0,0,0,0))
      );
      
      const missed = dayCheques.filter(c => 
        new Date(c.dueDate) < new Date(new Date().setHours(0,0,0,0)) && 
        c.outstanding > 0 &&
        c.status !== "COLLECTED" &&
        c.status !== "CLEARED"
      );

      days.push({
        day: i,
        date: dateStr,
        upcoming,
        missed,
        totalCheques: dayCheques.length
      });
    }
    return days;
  }, [currentMonth, currentYear, cheques]);

  const [selectedDay, setSelectedDay] = useState<any>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;
    const margin = { top: 40, right: 20, bottom: 20, left: 20 };
    const cellSize = (width - margin.left - margin.right) / 7;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const daysOfWeek = language === "ar" 
      ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Header - Days of week
    g.selectAll(".day-label")
      .data(daysOfWeek)
      .enter()
      .append("text")
      .attr("class", "day-label")
      .attr("x", (d, i) => i * cellSize + cellSize / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("fill", "#64748b")
      .text(d => d);

    // Calendar Grid
    const dayGroups = g.selectAll(".day-group")
      .data(monthData)
      .enter()
      .append("g")
      .attr("class", "day-group")
      .attr("transform", (d, i) => {
        const x = (i % 7) * cellSize;
        const y = Math.floor(i / 7) * cellSize;
        return `translate(${x},${y})`;
      })
      .on("click", (event, d) => {
        if (d.day) setSelectedDay(d);
      });

    dayGroups.append("rect")
      .attr("width", cellSize - 4)
      .attr("height", cellSize - 4)
      .attr("rx", 12)
      .attr("fill", d => {
        if (!d.day) return "transparent";
        if (d.date === new Date().toISOString().split("T")[0]) return "#f0f9ff";
        return "#ffffff";
      })
      .attr("stroke", d => {
        if (!d.day) return "transparent";
        if (d.date === new Date().toISOString().split("T")[0]) return "#0ea5e9";
        return "#e2e8f0";
      })
      .attr("stroke-width", d => d.date === new Date().toISOString().split("T")[0] ? 2 : 1)
      .attr("cursor", d => d.day ? "pointer" : "default")
      .on("mouseover", function() {
        d3.select(this).attr("stroke", "#94a3b8");
      })
      .on("mouseout", function(event, d) {
        if (d.date === new Date().toISOString().split("T")[0]) {
          d3.select(this).attr("stroke", "#0ea5e9");
        } else {
          d3.select(this).attr("stroke", "#e2e8f0");
        }
      });

    dayGroups.filter(d => d.day !== null)
      .append("text")
      .attr("x", 10)
      .attr("y", 20)
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .attr("fill", "#1e293b")
      .text(d => d.day);

    // Indicator for upcoming
    dayGroups.filter(d => d.day !== null && d.upcoming.length > 0)
      .append("circle")
      .attr("cx", cellSize - 15)
      .attr("cy", 20)
      .attr("r", 5)
      .attr("fill", "#10b981");

    // Indicator for missed
    dayGroups.filter(d => d.day !== null && d.missed.length > 0)
      .append("circle")
      .attr("cx", cellSize - 15)
      .attr("cy", 35)
      .attr("r", 5)
      .attr("fill", "#ef4444");

    // Text labels for indicators
    dayGroups.filter(d => d.day !== null && d.upcoming.length > 0)
      .append("text")
      .attr("x", cellSize - 25)
      .attr("y", 24)
      .attr("text-anchor", "end")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#065f46")
      .text(d => d.upcoming.length);

    dayGroups.filter(d => d.day !== null && d.missed.length > 0)
      .append("text")
      .attr("x", cellSize - 25)
      .attr("y", 39)
      .attr("text-anchor", "end")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#991b1b")
      .text(d => d.missed.length);

  }, [monthData, language]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
    setSelectedDay(null);
  };

  const monthNames = language === "ar"
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] text-slate-500 font-bold">
                  {language === "ar" ? "إيداعات قادمة" : "Upcoming Deposits"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                <span className="text-[10px] text-slate-500 font-bold">
                  {language === "ar" ? "تحصيلات متأخرة" : "Missed Collections"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
          >
            {language === "ar" ? "اليوم" : "Today"}
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="min-w-[800px] flex justify-center">
          <svg
            ref={svgRef}
            width={800}
            height={550}
            viewBox="0 0 800 550"
            className="max-w-full h-auto"
          ></svg>
        </div>
      </div>

      {selectedDay && (selectedDay.upcoming.length > 0 || selectedDay.missed.length > 0) && (
        <div className="p-4 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600" />
              <span>{language === "ar" ? "تفاصيل اليوم:" : "Day Details:"} {selectedDay.date}</span>
            </h4>
            <button 
              onClick={() => setSelectedDay(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              {language === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedDay.upcoming.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  {language === "ar" ? "إيداعات شيكات قادمة" : "Upcoming Cheque Deposits"}
                </div>
                <div className="space-y-2">
                  {selectedDay.upcoming.map((chq: Cheque) => (
                    <div key={chq.id} className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-slate-900">{chq.chequeNumber}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{chq.bankName}</div>
                        </div>
                        <div className="text-xs font-black text-emerald-700">AED {chq.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDay.missed.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                  {language === "ar" ? "تحصيلات متأخرة (شيكات مرتجعة/معلقة)" : "Missed Collections (Bounced/Pending)"}
                </div>
                <div className="space-y-2">
                  {selectedDay.missed.map((chq: Cheque) => (
                    <div key={chq.id} className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-slate-900">{chq.chequeNumber}</div>
                          <div className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">{chq.status}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-rose-700">AED {chq.outstanding.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{language === "ar" ? "من أصل" : "of"} {chq.amount.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
