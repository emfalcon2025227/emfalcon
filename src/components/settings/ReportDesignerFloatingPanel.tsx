import React, { useState, useEffect } from 'react';
import { Paintbrush, X, Save, Image as ImageIcon, Code, Sliders, Check, Eye, Plus, LayoutTemplate, Trash2, MousePointer2, Move, Type, Palette, EyeOff, Undo2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const safeJSONParse = (str: string | undefined, defaultVal: any = {}) => {
    if (!str) return defaultVal;
    try { return JSON.parse(str); } catch (e) { return defaultVal; }
};

const getCssPath = (el: HTMLElement | null): string => {
    if (!el || el.nodeType !== 1) return '';
    const path: string[] = [];
    let current: HTMLElement | null = el;

    while (current && current.nodeType === 1) {
        let selector = current.nodeName.toLowerCase();

        if (current.id) {
            selector += '#' + current.id;
            path.unshift(selector);
            break;
        } else {
            let sib = current;
            let nth = 1;
            while ((sib = sib.previousElementSibling as HTMLElement)) {
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        current = current.parentElement;

        if (current && (current.classList?.contains('printable-document') || current.id === 'report-print-area' || current.classList?.contains('report-sheet') || current.id === 'receipt-print-area')) {
            const rootSelector = current.id ? `#${current.id}` : `.${current.classList[0]}`;
            path.unshift(rootSelector);
            break;
        }
    }
    return path.join(" > ");
};

const generateVisualCSS = (overrides: Record<string, React.CSSProperties>) => {
    let css = '';
    for (const [selector, rules] of Object.entries(overrides)) {
        if (!rules || Object.keys(rules).length === 0) continue;
        css += `${selector} {\n`;
        for (const [prop, value] of Object.entries(rules)) {
            if (value === undefined || value === null || value === '') continue;
            const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
            css += `  ${kebabProp}: ${value} !important;\n`;
        }
        css += `}\n`;
    }
    return css;
};

export const ReportDesignerFloatingPanel: React.FC = () => {
  const { companyProfile, updateCompanyProfile } = useData();
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VISUAL'>('GENERAL');
  
  // Panel dragging state
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const t = (ar: string, en: string) => language === 'ar' ? ar : en;
  
  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'SYSTEM_OWNER';

  const [draftBg, setDraftBg] = useState(companyProfile?.reportBackgroundUrl || '');
  const [draftCss, setDraftCss] = useState(companyProfile?.customReportCss || '');
  const [draftOpacity, setDraftOpacity] = useState(companyProfile?.reportBackgroundOpacity ?? 0.15);
  const [draftVisualOverrides, setDraftVisualOverrides] = useState<Record<string, React.CSSProperties>>(safeJSONParse(companyProfile?.visualOverrides));
  
  const [isSaved, setIsSaved] = useState(false);
  
  // Template states
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Visual Editor states
  const [isVisualMode, setIsVisualMode] = useState(false);
  const [selectedSelector, setSelectedSelector] = useState<string>('');
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);

  // Sync with global profile when opened
  useEffect(() => {
    if (!isOpen) {
      setDraftBg(companyProfile?.reportBackgroundUrl || '');
      setDraftCss(companyProfile?.customReportCss || '');
      setDraftOpacity(companyProfile?.reportBackgroundOpacity ?? 0.15);
      setDraftVisualOverrides(safeJSONParse(companyProfile?.visualOverrides));
      setSelectedTemplateId('');
      setIsSavingTemplate(false);
      setIsVisualMode(false);
      setSelectedSelector('');
      setSelectedElement(null);
      // Reset position when closed
      setPanelPos({ x: 0, y: 0 });
    }
  }, [companyProfile, isOpen]);

  // Handle Panel Dragging
  useEffect(() => {
    if (!isDraggingPanel) return;
    const handleMouseMove = (e: MouseEvent) => {
        setPanelPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDraggingPanel(false);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPanel, dragStart]);

  const handlePanelMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setIsDraggingPanel(true);
      setDragStart({
          x: e.clientX - panelPos.x,
          y: e.clientY - panelPos.y
      });
  };

  // Handle element selection for visual mode
  useEffect(() => {
    if (!isVisualMode) return;

    let hoveredEl: HTMLElement | null = null;
    let originalOutline = '';

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.designer-panel') || target.closest('.designer-trigger')) return;
        const printArea = target.closest('.printable-document, .report-sheet, #report-print-area, #receipt-print-area');
        if (printArea) {
            hoveredEl = target;
            originalOutline = target.style.outline;
            target.style.outline = '2px dashed #6366f1';
            target.style.cursor = 'crosshair';
        }
    };

    const onMouseOut = (e: MouseEvent) => {
        if (hoveredEl) {
            hoveredEl.style.outline = originalOutline;
            hoveredEl.style.cursor = '';
            hoveredEl = null;
        }
    };

    const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.designer-panel') || target.closest('.designer-trigger')) return;
        const printArea = target.closest('.printable-document, .report-sheet, #report-print-area, #receipt-print-area');
        if (printArea) {
            e.preventDefault();
            e.stopPropagation();
            if (hoveredEl) {
                hoveredEl.style.outline = originalOutline;
                hoveredEl.style.cursor = '';
            }
            setSelectedElement(target);
            setSelectedSelector(getCssPath(target));
        }
    };

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('click', onClick, true);

    return () => {
        if (hoveredEl) {
            hoveredEl.style.outline = originalOutline;
            hoveredEl.style.cursor = '';
        }
        document.removeEventListener('mouseover', onMouseOver);
        document.removeEventListener('mouseout', onMouseOut);
        document.removeEventListener('click', onClick, true);
    };
  }, [isVisualMode]);

  // Handle element dragging in visual mode
  useEffect(() => {
    if (!isVisualMode || !selectedElement || !selectedSelector) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initTx = 0, initTy = 0;

    const onMouseDown = (e: MouseEvent) => {
        if (e.target === selectedElement || selectedElement.contains(e.target as Node)) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('.designer-panel')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const transform = draftVisualOverrides[selectedSelector]?.transform || '';
            const match = typeof transform === 'string' ? transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/) : null;
            if (match) {
                initTx = parseFloat(match[1]);
                initTy = parseFloat(match[2]);
            } else {
                initTx = 0;
                initTy = 0;
            }
            e.preventDefault();
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        setDraftVisualOverrides(prev => ({
            ...prev,
            [selectedSelector]: {
                ...(prev[selectedSelector] || {}),
                transform: `translate(${initTx + dx}px, ${initTy + dy}px)`
            }
        }));
    };

    const onMouseUp = () => {
        isDragging = false;
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isVisualMode, selectedElement, selectedSelector, draftVisualOverrides]);

  const handleApplyGlobal = () => {
    if (companyProfile) {
      updateCompanyProfile({
        ...companyProfile,
        reportBackgroundUrl: draftBg,
        customReportCss: draftCss,
        reportBackgroundOpacity: draftOpacity,
        visualOverrides: JSON.stringify(draftVisualOverrides)
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleSaveAsTemplate = () => {
    if (!companyProfile || !templateName.trim()) return;

    const newTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      backgroundUrl: draftBg,
      backgroundOpacity: draftOpacity,
      customCss: draftCss,
      visualOverrides: JSON.stringify(draftVisualOverrides),
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...(companyProfile.savedReportTemplates || []), newTemplate];
    
    updateCompanyProfile({
      ...companyProfile,
      savedReportTemplates: updatedTemplates
    });
    
    setSelectedTemplateId(newTemplate.id);
    setTemplateName('');
    setIsSavingTemplate(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleLoadTemplate = (tId: string) => {
    setSelectedTemplateId(tId);
    
    if (tId === 'CURRENT_ACTIVE') {
      setDraftBg(companyProfile?.reportBackgroundUrl || '');
      setDraftCss(companyProfile?.customReportCss || '');
      setDraftOpacity(companyProfile?.reportBackgroundOpacity ?? 0.15);
      setDraftVisualOverrides(safeJSONParse(companyProfile?.visualOverrides));
      return;
    }
    
    const tmpl = companyProfile?.savedReportTemplates?.find(t => t.id === tId);
    if (tmpl) {
      setDraftBg(tmpl.backgroundUrl || '');
      setDraftCss(tmpl.customCss || '');
      setDraftOpacity(tmpl.backgroundOpacity ?? 0.15);
      setDraftVisualOverrides(safeJSONParse(tmpl.visualOverrides));
    }
  };

  const handleDeleteTemplate = (idToDelete: string) => {
    if (!companyProfile) return;
    
    const confirmDelete = window.confirm(t("هل أنت متأكد من حذف هذا القالب؟", "Are you sure you want to delete this template?"));
    if (!confirmDelete) return;
    
    const updatedTemplates = companyProfile.savedReportTemplates?.filter(t => t.id !== idToDelete) || [];
    
    updateCompanyProfile({
      ...companyProfile,
      savedReportTemplates: updatedTemplates
    });
    
    if (selectedTemplateId === idToDelete) {
      setSelectedTemplateId('CURRENT_ACTIVE');
      setDraftBg(companyProfile?.reportBackgroundUrl || '');
      setDraftCss(companyProfile?.customReportCss || '');
      setDraftOpacity(companyProfile?.reportBackgroundOpacity ?? 0.15);
      setDraftVisualOverrides(safeJSONParse(companyProfile?.visualOverrides));
    }
  };

  const updateSelectedElementRule = (prop: keyof React.CSSProperties, value: any) => {
      if (!selectedSelector) return;
      setDraftVisualOverrides(prev => {
          const rules = { ...(prev[selectedSelector] || {}) };
          if (value === undefined || value === '') {
              delete rules[prop];
          } else {
              rules[prop] = value as any;
          }
          return { ...prev, [selectedSelector]: rules };
      });
  };

  const isRtl = language === 'ar';
  const templates = companyProfile?.savedReportTemplates || [];
  const currentRules = selectedSelector ? (draftVisualOverrides[selectedSelector] || {}) : {};

  // Compute active styles (what user sees right now, either saved or drafted)
  const activeCss = isOpen ? draftCss : (companyProfile?.customReportCss || '');
  const activeBg = isOpen ? draftBg : (companyProfile?.reportBackgroundUrl || '');
  const activeOpacity = isOpen ? draftOpacity : (companyProfile?.reportBackgroundOpacity ?? 0.15);
  const activeVisualOverrides = isOpen ? draftVisualOverrides : safeJSONParse(companyProfile?.visualOverrides);
  const generatedVisualCss = generateVisualCSS(activeVisualOverrides);

  return (
    <>
      {/* Global Live Preview Styles - Always Injected so regular users see the design */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Live Custom CSS */
        ${activeCss}
        
        /* Visual Editor CSS */
        ${generatedVisualCss}

        /* Live Background Override */
        #printable-report-card::before, #report-print-area::before, .report-sheet::before, .printable-document::before, #receipt-print-area::before {
          background-image: url('${activeBg}') !important;
          opacity: ${activeOpacity} !important;
        }
      `}} />

      {/* Admin UI */}
      {isAdmin && (
        <>
          {/* Floating Button */}
          {!isOpen && (
            <button
              onClick={() => setIsOpen(true)}
              className={`designer-trigger fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-[9999] bg-slate-900 hover:bg-indigo-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 group border-4 border-white/20`}
              title={t("المصمم المباشر للتقارير", "Live Report Designer")}
            >
              <Paintbrush className="w-6 h-6" />
              <span className={`absolute -top-12 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none shadow-xl border border-slate-700`}>
                {t("المصمم المباشر للتقارير", "Live Report Designer")}
              </span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>
              <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full"></span>
            </button>
          )}

          {/* Floating Panel */}
          {isOpen && (
            <div 
              className={`designer-panel fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-[10000] w-[400px] bg-white rounded-2xl shadow-2xl border-2 border-indigo-500 overflow-hidden flex flex-col max-h-[85vh]`}
              style={{ transform: `translate3d(${panelPos.x}px, ${panelPos.y}px, 0)`, transition: isDraggingPanel ? 'none' : 'transform 0.1s ease-out' }}
            >
              
              {/* Header */}
              <div 
                className="bg-slate-900 p-4 text-white flex items-center justify-between shadow-md relative z-10 cursor-move"
                onMouseDown={handlePanelMouseDown}
              >
                <div className="flex items-center gap-2">
                  <Paintbrush className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-sm">{t("المصمم المباشر للتقارير", "Live Report Designer")}</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-1.5 rounded-lg hover:bg-white/20">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                  <button 
                      onClick={() => { setActiveTab('GENERAL'); setIsVisualMode(false); }}
                      className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'GENERAL' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      {t("إعدادات القالب", "Template Settings")}
                  </button>
                  <button 
                      onClick={() => setActiveTab('VISUAL')}
                      className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'VISUAL' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <MousePointer2 className="w-3.5 h-3.5" />
                      {t("المحرر المرئي", "Visual Editor")}
                  </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
                
                {activeTab === 'GENERAL' && (
                    <>
                        {/* Template Management Section */}
                        <div className="space-y-3 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                            {t("القوالب المحفوظة", "Saved Templates")}
                            </label>
                            {!isSavingTemplate && (
                            <button 
                                onClick={() => setIsSavingTemplate(true)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" />
                                {t("حفظ كقالب جديد", "Save as New")}
                            </button>
                            )}
                        </div>
                        
                        {isSavingTemplate ? (
                            <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder={t("اسم القالب الجديد (مثال: تقرير شهري)", "New template name (e.g., Monthly Report)")}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button 
                                onClick={handleSaveAsTemplate}
                                disabled={!templateName.trim()}
                                className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                {t("تأكيد الحفظ", "Confirm Save")}
                                </button>
                                <button 
                                onClick={() => setIsSavingTemplate(false)}
                                className="bg-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg hover:bg-slate-300"
                                >
                                {t("إلغاء", "Cancel")}
                                </button>
                            </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                            {/* Current Active Option */}
                            <div 
                                onClick={() => handleLoadTemplate('CURRENT_ACTIVE')}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                                selectedTemplateId === 'CURRENT_ACTIVE' || !selectedTemplateId 
                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="w-12 h-8 rounded border border-slate-300 bg-white flex items-center justify-center shrink-0 relative overflow-hidden">
                                {companyProfile?.reportBackgroundUrl ? (
                                    <div 
                                    className="absolute inset-0 bg-cover bg-center" 
                                    style={{ backgroundImage: `url(${companyProfile.reportBackgroundUrl})`, opacity: companyProfile.reportBackgroundOpacity ?? 0.15 }} 
                                    />
                                ) : (
                                    <LayoutTemplate className="w-4 h-4 text-slate-300 relative z-10" />
                                )}
                                </div>
                                <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{t("التنسيق الحالي النشط", "Current Active Styling")}</p>
                                <p className="text-[10px] text-slate-500 truncate">{t("المطبق حالياً", "Currently applied")}</p>
                                </div>
                            </div>

                            {/* Saved Templates List */}
                            {templates.map(tmpl => (
                                <div 
                                key={tmpl.id}
                                onClick={() => handleLoadTemplate(tmpl.id)}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors group ${
                                    selectedTemplateId === tmpl.id 
                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                                >
                                <div className="w-12 h-8 rounded border border-slate-300 bg-white flex items-center justify-center shrink-0 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlZWUiPjwvcmVjdD4KPHJlY3QgeT0iNCIgeD0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2VlZSI+PC9yZWN0Pgo8L3N2Zz4=')]">
                                    {tmpl.backgroundUrl ? (
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center" 
                                        style={{ backgroundImage: `url(${tmpl.backgroundUrl})`, opacity: tmpl.backgroundOpacity ?? 0.15 }} 
                                    />
                                    ) : (
                                    <Code className="w-4 h-4 text-slate-300 relative z-10" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{tmpl.name}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{tmpl.createdAt ? new Date(tmpl.createdAt).toLocaleDateString() : 'Template'}</p>
                                </div>
                                <div className="shrink-0 flex gap-1">
                                    {selectedTemplateId === tmpl.id && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-md transition-colors"
                                        title={t("حذف القالب", "Delete Template")}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    )}
                                </div>
                                </div>
                            ))}
                            </div>
                        )}
                        </div>

                        {/* Background URL */}
                        <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <ImageIcon className="w-4 h-4 text-indigo-600" />
                            {t("رابط الخلفية (Watermark)", "Background URL")}
                        </label>
                        <input
                            type="text"
                            value={draftBg}
                            onChange={(e) => setDraftBg(e.target.value)}
                            dir="ltr"
                            className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm bg-white"
                            placeholder="https://..."
                        />
                        </div>

                        {/* Opacity */}
                        <div className="space-y-1.5 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                        <label className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-indigo-600" />
                            {t("شفافية الخلفية", "Background Opacity")}
                            </span>
                            <span className="text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-md">{Math.round(draftOpacity * 100)}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={draftOpacity}
                            onChange={(e) => setDraftOpacity(Number(e.target.value))}
                            className="w-full accent-indigo-600 mt-2 cursor-pointer"
                        />
                        </div>

                        {/* Custom CSS */}
                        <div className="flex-1 flex flex-col space-y-1.5 min-h-[160px]">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <Code className="w-4 h-4 text-indigo-600" />
                            {t("أكواد CSS المخصصة", "Custom CSS")}
                        </label>
                        <textarea
                            value={draftCss}
                            onChange={(e) => setDraftCss(e.target.value)}
                            dir="ltr"
                            className="w-full flex-1 text-[11px] font-mono p-3 bg-slate-900 text-green-400 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner min-h-[160px]"
                            placeholder="/* e.g. #report-print-area th { background: #f00 !important; } */"
                        />
                        </div>
                    </>
                )}

                {activeTab === 'VISUAL' && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center space-y-3">
                            <button
                                onClick={() => setIsVisualMode(!isVisualMode)}
                                className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors border ${
                                    isVisualMode 
                                        ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'
                                        : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                <MousePointer2 className="w-4 h-4" />
                                {isVisualMode ? t("إيقاف التحديد", "Stop Selection") : t("تفعيل تحديد العناصر لتعديلها", "Enable Element Selection")}
                            </button>
                            {isVisualMode && (
                                <p className="text-[11px] text-indigo-700">
                                    {t("انقر على أي نص، جدول، أو مساحة في التقرير لتعديلها. اسحب العنصر لتحريكه.", "Click on any text, table, or area in the report to edit it. Drag to move.")}
                                </p>
                            )}
                        </div>

                        {selectedSelector && (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm relative">
                                <button 
                                    onClick={() => { setSelectedSelector(''); setSelectedElement(null); setIsVisualMode(true); }}
                                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1 rounded-md"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                <div className="space-y-1 pr-6">
                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                        <Palette className="w-4 h-4 text-indigo-500" />
                                        {t("خصائص العنصر المحدد", "Selected Element Properties")}
                                    </h4>
                                    <p className="text-[9px] font-mono text-slate-400 truncate bg-slate-50 p-1 rounded border border-slate-100" dir="ltr">
                                        {selectedSelector}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Text Color */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600">{t("لون النص", "Text Color")}</label>
                                        <div className="flex items-center gap-2 border border-slate-200 p-1 rounded-lg">
                                            <input 
                                                type="color" 
                                                value={currentRules.color || '#000000'} 
                                                onChange={(e) => updateSelectedElementRule('color', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                                            />
                                            <span className="text-[10px] font-mono text-slate-500">{currentRules.color || 'Default'}</span>
                                        </div>
                                    </div>
                                    {/* Background Color */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600">{t("لون الخلفية", "Background")}</label>
                                        <div className="flex items-center gap-2 border border-slate-200 p-1 rounded-lg">
                                            <input 
                                                type="color" 
                                                value={currentRules.backgroundColor || '#ffffff'} 
                                                onChange={(e) => updateSelectedElementRule('backgroundColor', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                                            />
                                            <span className="text-[10px] font-mono text-slate-500">{currentRules.backgroundColor || 'Default'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Font Size */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-600 flex items-center justify-between">
                                        <span className="flex items-center gap-1"><Type className="w-3 h-3" /> {t("حجم الخط", "Font Size")}</span>
                                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 rounded">{currentRules.fontSize || 'Default'}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="8" max="72" step="1" 
                                        value={parseInt(currentRules.fontSize as string) || 14}
                                        onChange={(e) => updateSelectedElementRule('fontSize', `${e.target.value}px`)}
                                        className="w-full accent-indigo-500"
                                    />
                                </div>

                                {/* Movement/Position Note */}
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                                    <Move className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-amber-800">{t("تحريك العنصر", "Move Element")}</p>
                                        <p className="text-[10px] text-amber-700 leading-tight">
                                            {t("انقر واسحب العنصر المحدد مباشرة داخل التقرير لتحريكه يميناً ويساراً.", "Click and drag the selected element directly inside the report to move it.")}
                                        </p>
                                        {currentRules.transform && (
                                            <button 
                                                onClick={() => updateSelectedElementRule('transform', '')}
                                                className="text-[10px] text-amber-600 hover:text-amber-800 underline mt-1 block"
                                            >
                                                {t("إعادة لمكانه الأصلي", "Reset Position")}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Hide Element */}
                                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={currentRules.display === 'none'}
                                        onChange={(e) => updateSelectedElementRule('display', e.target.checked ? 'none' : '')}
                                        className="rounded text-rose-500 focus:ring-rose-500"
                                    />
                                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                        <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                                        {t("إخفاء هذا العنصر من التقرير", "Hide this element from report")}
                                    </span>
                                </label>

                                <button 
                                    onClick={() => {
                                        setDraftVisualOverrides(prev => {
                                            const next = {...prev};
                                            delete next[selectedSelector];
                                            return next;
                                        });
                                    }}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                                >
                                    <Undo2 className="w-3 h-3" />
                                    {t("مسح كافة تعديلات هذا العنصر", "Clear all modifications for this element")}
                                </button>
                            </div>
                        )}
                    </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-10 flex flex-col gap-2">
                <button
                  onClick={handleApplyGlobal}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] ${
                    isSaved ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isSaved ? <><Check className="w-5 h-5" /> {t("تم الحفظ والاعتماد", "Applied & Saved")}</> : <><Save className="w-5 h-5" /> {t("حفظ كافة التعديلات واعتمادها", "Save All Changes & Apply")}</>}
                </button>
                <p className="text-[10px] font-bold text-center text-slate-500 mt-1 flex items-center justify-center gap-1">
                  <Eye className="w-3 h-3" />
                  {t("المستخدم العادي لن يرى هذه اللوحة", "Regular users will not see this panel")}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
