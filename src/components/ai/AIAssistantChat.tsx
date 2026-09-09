import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles, RefreshCw, HelpCircle, Building2, FileText, AlertCircle, Mic, MicOff, Volume2, VolumeX, Globe, Languages, GripHorizontal } from "lucide-react";
import { motion, useDragControls } from "motion/react";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { ViewState, Tenant, Cheque } from "../../types";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AIAssistantChatProps {
  currentView?: ViewState;
  onNavigate?: (view: ViewState) => void;
  onOpenTenantProfile?: (tenant: Tenant) => void;
  onOpenPaymentModal?: (cheque: Cheque) => void;
  onOpenConvertToCaseModal?: (chequeIds: string[]) => void;
}

// Speech recognition deduplication & smart chunk merging helpers to prevent word repetition
const normalizeForSpeechMatch = (str: string): string => {
  return (str || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove diacritics
    .replace(/[أإآٱا]/g, "ا")
    .replace(/[ىيئ]/g, "ي")
    .replace(/[ةه]/g, "ه")
    .replace(/[^\w\s\u0600-\u06FF]/gi, "")
    .trim();
};

const mergeSpeechChunks = (baseText: string, newChunk: string): string => {
  const base = baseText.trim();
  const addition = newChunk.trim();
  if (!base) return addition;
  if (!addition) return base;

  const baseWords = base.split(/\s+/);
  const additionWords = addition.split(/\s+/);

  // Determine max word overlap between the end of base and the start of addition
  const maxCheck = Math.min(baseWords.length, additionWords.length, 8);
  let overlapCount = 0;

  for (let len = maxCheck; len >= 1; len--) {
    const baseSuffix = baseWords.slice(baseWords.length - len).map(normalizeForSpeechMatch).join(" ");
    const additionPrefix = additionWords.slice(0, len).map(normalizeForSpeechMatch).join(" ");

    if (baseSuffix === additionPrefix && baseSuffix.length > 0) {
      overlapCount = len;
      break;
    }
  }

  const uniqueAddition = additionWords.slice(overlapCount);
  if (uniqueAddition.length === 0) return base;

  return (base + " " + uniqueAddition.join(" ")).trim();
};

const deduplicateSpeechText = (text: string): string => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text.trim();

  const cleaned: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const normCurr = normalizeForSpeechMatch(word);

    // 1. Single word consecutive duplicate check
    if (cleaned.length > 0) {
      const normPrev = normalizeForSpeechMatch(cleaned[cleaned.length - 1]);
      if (normPrev === normCurr && normCurr.length > 0) {
        continue; // skip duplicate word
      }
    }

    // 2. Two-word phrase duplicate check ("في دبي في دبي")
    if (cleaned.length >= 2 && i <= words.length - 2) {
      const p1 = normalizeForSpeechMatch(cleaned[cleaned.length - 2]) + " " + normalizeForSpeechMatch(cleaned[cleaned.length - 1]);
      const p2 = normCurr + " " + normalizeForSpeechMatch(words[i + 1]);
      if (p1 === p2 && p1.replace(/\s/g, "").length > 0) {
        i++; // skip second word of repeated 2-word phrase
        continue;
      }
    }

    // 3. Three-word phrase duplicate check ("عرض القضايا الإيجارية عرض القضايا الإيجارية")
    if (cleaned.length >= 3 && i <= words.length - 3) {
      const p1 = normalizeForSpeechMatch(cleaned[cleaned.length - 3]) + " " + normalizeForSpeechMatch(cleaned[cleaned.length - 2]) + " " + normalizeForSpeechMatch(cleaned[cleaned.length - 1]);
      const p2 = normCurr + " " + normalizeForSpeechMatch(words[i + 1]) + " " + normalizeForSpeechMatch(words[i + 2]);
      if (p1 === p2 && p1.replace(/\s/g, "").length > 0) {
        i += 2; // skip second & third words of repeated 3-word phrase
        continue;
      }
    }

    cleaned.push(word);
  }

  return cleaned.join(" ");
};

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  currentView,
  onNavigate,
  onOpenTenantProfile,
  onOpenPaymentModal,
  onOpenConvertToCaseModal,
}) => {
  const { language } = useLanguage();
  const data = useData();
  const dragControls = useDragControls();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLangMode, setSpeechLangMode] = useState<"auto" | "ar" | "en">("auto");
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [detectedSpeechLang, setDetectedSpeechLang] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>("");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      role: "assistant",
      content: language === "ar"
        ? "مرحباً بك! أنا مساعد صقر الذكي (Falcon AI). يمكنني تنفيذ كافة المهام والبحث الدقيق عبر جميع أجزاء البرنامج (المباني، الوحدات، المستأجرين، عقود الإيجار، الشيكات المرتجعة والتعثر، التحصيلات، القضايا وRDC، الجلسات، طلبات الصيانة والفنيين، التقارير، والأرشيف) — باستثناء إعدادات النظام، سجل التدقيق، ومركز استعادة البيانات لدواعي الأمان والسرية.\n\nكيف يمكنني مساعدتك بالصوت أو الكتابة اليوم؟"
        : "Welcome! I am Falcon AI Assistant. I can execute tasks and perform high-precision search across all system modules (Properties, Units, Tenants, Leases, Bounced Cheques, Collections, RDC Cases, Hearings, Maintenance & Technicians, Reports, and Archive) — excluding System Settings, Audit Logs, and Data Recovery for security governance.\n\nHow may I assist you today via text or voice?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.aiReady === "boolean" && !data.aiReady) {
          setAiEnabled(false);
          setMessages((prev) => [
            ...prev,
            {
              id: "sys-api-missing",
              role: "assistant",
              content: language === "ar"
                ? "⚠️ تنبيه النظام: تم تعطيل ميزات الذكاء الاصطناعي بسبب عدم وجود مفتاح `GEMINI_API_KEY` أو أنه غير صالح. يرجى تكوين المفتاح في إعدادات البيئة (Secrets) الخاص بك لإعادة التفعيل."
                : "⚠️ System Alert: AI features are currently disabled because the `GEMINI_API_KEY` is missing or invalid. Please configure the key in your environment Secrets to enable AI capabilities.",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        }
      })
      .catch((err) => console.warn("Failed to check AI health status:", err));
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // Determine language code for speech recognition
  const getRecognitionLang = () => {
    if (speechLangMode === "ar") return "ar-AE";
    if (speechLangMode === "en") return "en-US";
    // In "auto" bilingual mode, ar-AE in modern Chromium engines natively supports mixed Arabic and English code-switching
    return "ar-AE";
  };

  // Initialize Speech Recognition Engine on Demand
  const initSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = getRecognitionLang();
      return recognitionRef.current;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getRecognitionLang();

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let sessionFinal = "";
      let sessionInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          sessionFinal = mergeSpeechChunks(sessionFinal, transcriptChunk);
        } else {
          sessionInterim = mergeSpeechChunks(sessionInterim, transcriptChunk);
        }
      }

      if (sessionFinal) {
        accumulatedTranscriptRef.current = mergeSpeechChunks(accumulatedTranscriptRef.current, sessionFinal);
      }

      const rawCombined = sessionInterim
        ? mergeSpeechChunks(accumulatedTranscriptRef.current, sessionInterim)
        : accumulatedTranscriptRef.current;

      const cleanedFull = deduplicateSpeechText(rawCombined);
      setInput(cleanedFull);

      // Detect language script of live input
      const arabicChars = (cleanedFull.match(/[\u0600-\u06FF]/g) || []).length;
      const englishChars = (cleanedFull.match(/[a-zA-Z]/g) || []).length;
      if (arabicChars > 0 && englishChars > 0) {
        setDetectedSpeechLang(language === "ar" ? "ثنائي اللغة (عربي + English)" : "Bilingual (Arabic + English)");
      } else if (arabicChars > 0) {
        setDetectedSpeechLang("العربية (Arabic)");
      } else if (englishChars > 0) {
        setDetectedSpeechLang("English (إنجليزية)");
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // If still flagged as listening, auto-restart to maintain continuous bilingual listening
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  // Update recognition language dynamically when speechLangMode changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = getRecognitionLang();
    }
  }, [speechLangMode, language]);

  const toggleListening = () => {
    // Check if user has consented to using the microphone & camera in this session/app lifetime
    const savedConsent = localStorage.getItem("mic_camera_permission_granted");
    if (savedConsent !== "true") {
      const confirmMsg = language === "ar"
        ? "يرجى العلم أن المساعد الذكي يحتاج للوصول إلى الميكروفون ليتمكن من الاستماع إلى صوتك وتحويله إلى نصوص تلقائياً. هل ترغب في السماح بذلك وحفظ هذا الاختيار لمنع السؤال مرة أخرى؟"
        : "Please note that the smart assistant needs access to your microphone to listen and transcribe your voice input. Would you like to grant permission and save this choice to prevent being asked again?";
      
      const userApproved = window.confirm(confirmMsg);
      if (!userApproved) {
        return;
      }
      try {
        localStorage.setItem("mic_camera_permission_granted", "true");
      } catch (e) {}
    }

    const recognition = initSpeechRecognition();
    if (!recognition) {
      alert(language === "ar" 
        ? "خاصية التعرف على الصوت غير مدعومة في متصفحك. يرجى استخدام متصفح حديث مثل Chrome أو Edge."
        : "Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        accumulatedTranscriptRef.current = deduplicateSpeechText(input); // preserve and clean existing text
        recognition.lang = getRecognitionLang();
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.error("Error starting speech recognition:", e);
      }
    }
  };

  // Smart Bilingual Text-To-Speech
  const speakText = (text: string, msgId: string) => {
    if (!("speechSynthesis" in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Auto-detect dominant language of text to select optimal voice
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    const isArabicDominant = arabicCount >= englishCount;

    utterance.lang = isArabicDominant ? "ar-SA" : "en-US";
    utterance.rate = 1.0;

    // Try finding installed system voice for highest clarity
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const matchVoice = voices.find(v => 
        isArabicDominant 
          ? (v.lang.startsWith("ar") || (v.name || "").toLowerCase().includes("arabic"))
          : (v.lang.startsWith("en") || (v.name || "").toLowerCase().includes("english"))
      );
      if (matchVoice) {
        utterance.voice = matchVoice;
      }
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || loading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: Message = {
      id: "usr-" + Date.now(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) {
      setInput("");
      accumulatedTranscriptRef.current = "";
    }
    setLoading(true);

    try {
      const projectContext = {
        owners: data.owners,
        properties: data.properties,
        units: data.units,
        tenants: data.tenants,
        leases: data.leases,
        cheques: data.cheques,
        cases: data.cases,
        collections: data.collections,
        maintenanceRequests: data.maintenanceRequests,
        notifications: data.notifications,
      };

      const res = await fetch("/api/ai/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          projectContext,
          language,
        }),
      });

      const jsonText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(jsonText);
      } catch (parseErr) {
        console.warn("[AIAssistantChat] Response was not valid JSON, using local heuristic chat engine. Raw:", jsonText);
        throw new Error("Invalid JSON");
      }

      if (json.success && json.reply) {
        const botMsg: Message = {
          id: "bot-" + Date.now(),
          role: "assistant",
          content: json.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);

        // Process Action Side Effects
        if (json.action && json.action.type !== "NONE") {
          const { type, params } = json.action;
          
          if (type === "OPEN_VIEW" && onNavigate && params?.viewName) {
            onNavigate(params.viewName as ViewState);
          } 
          else if (type === "OPEN_TENANT" && onOpenTenantProfile && params?.tenantId) {
            const tenantObj = data.tenants.find((t: any) => t.id === params.tenantId);
            if (tenantObj) {
              onOpenTenantProfile(tenantObj);
            }
          } 
          else if (type === "OPEN_PAYMENT" && onOpenPaymentModal && params?.chequeId) {
            const chequeObj = data.cheques.find((c: any) => c.id === params.chequeId);
            if (chequeObj) {
              onOpenPaymentModal(chequeObj);
            }
          } 
          else if (type === "SEND_NOTIFICATION" && params?.chequeId) {
            if (params.channel === "email") {
              data.dispatchEmailReminder(params.chequeId);
            } else if (params.channel === "whatsapp") {
              data.dispatchWhatsAppReminder(params.chequeId);
            }
          }
        }

        if (autoSpeak) {
          speakText(json.reply, botMsg.id);
        }
      } else {
        throw new Error("Invalid response status");
      }
    } catch (err) {
      console.warn("[AIAssistantChat] Gemini request failed or rate-limited. Triggering high-availability local rules engine.");
      
      // Compute intelligent local response from context
      const query = textToSend.toLowerCase();
      const isAr = language === "ar";
      const bouncedList = data.cheques.filter((c: any) => c.originalStatus === "BOUNCED" || c.status === "BOUNCED");
      const totalExposure = bouncedList.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
      const highRiskTenants = data.tenants.filter((t: any) => t.riskLevel === "HIGH" || (t.riskScore && t.riskScore >= 70));
      const activeCases = data.cases.filter((c: any) => c.status !== "RESOLVED");
      const openMaintenance = (data.maintenanceRequests || []).filter((r: any) => r.status === "OPEN" || r.status === "IN_PROGRESS");

      let localReply = "";

      // Restricted sections check
      if (
        query.includes("setting") || query.includes("إعداد") || query.includes("اعداد") ||
        query.includes("audit") || query.includes("تدقيق") || query.includes("رقابة") ||
        query.includes("recovery") || query.includes("rollback") || query.includes("استعادة") || query.includes("تراجع")
      ) {
        localReply = isAr
          ? "عذراً، وفقاً لسياسات الأمان والحوكمة بالنظام، يُمنع التعامل الآلي للمساعد الذكي مع (إعدادات النظام، سجل التدقيق والرقابة، ومركز استعادة البيانات والتراجع). يمكنك الوصول إليها مباشرة عبر القائمة الرئيسية."
          : "Apologies! Automated AI operations are restricted on (System Settings, Audit Logs, and Data Recovery) per security governance policies.";
      }
      else if (query.includes("maint") || query.includes("صيانة") || query.includes("فني") || query.includes("بلاغ") || query.includes("عطل")) {
        localReply = isAr
          ? `يتوفر حالياً عدد **${openMaintenance.length} طلب صيانة نشط/قيد المتابعة** بالنظام من إجمالي **${(data.maintenanceRequests || []).length} طلب صيانة**. جاري الانتقال لقائمة الصيانة.`
          : `There are currently **${openMaintenance.length} active maintenance orders** in progress out of **${(data.maintenanceRequests || []).length} total tickets**. Navigating to Maintenance.`;
        if (onNavigate) onNavigate("MAINTENANCE");
      }
      else if (query.includes("bounced") || query.includes("exposure") || query.includes("شيكات مرتجعة") || query.includes("مرتجع") || query.includes("تعثر")) {
        localReply = isAr
          ? `حسب البيانات اللحظية بالنظام، يبلغ إجمالي التعثر المالي والشيكات المرتجعة **AED ${totalExposure.toLocaleString()}** موزعة على **${bouncedList.length} شيك مرتجع**.`
          : `According to live system data, the total bounced cheques exposure is **AED ${totalExposure.toLocaleString()}** across **${bouncedList.length} bounced instruments**.`;
        if (onNavigate) onNavigate("BOUNCED_CHEQUES");
      } 
      else if (query.includes("high risk") || query.includes("risk") || query.includes("tenant") || query.includes("مستأجر") || query.includes("خطورة")) {
        const tenantNames = highRiskTenants.slice(0, 5).map((t: any) => `- **${isAr ? (t.nameAr || t.nameEn) : (t.nameEn || t.nameAr)}** (${t.code}) - Risk Score: ${t.riskScore || 80}`).join("\n");
        localReply = isAr
          ? `لدينا حالياً **${highRiskTenants.length} مستأجرين بمستوى خطورة مرتفع**:\n\n${tenantNames || "لا يوجد مستأجرون عالي الخطورة حالياً بالنظام."}`
          : `We currently have **${highRiskTenants.length} high-risk tenants** on file:\n\n${tenantNames || "No high-risk tenants detected."}`;
        if (onNavigate) onNavigate("TENANTS");
      } 
      else if (query.includes("case") || query.includes("dispute") || query.includes("rdc") || query.includes("قضية") || query.includes("قضايا") || query.includes("نزاع")) {
        localReply = isAr
          ? `يوجد حالياً **${activeCases.length} قضايا إيجارية نشطة** بمركز فض المنازعات (RDC) ومحاكم دبي العقارية.`
          : `There are currently **${activeCases.length} active rental dispute cases** filed at the RDC.`;
        if (onNavigate) onNavigate("CASES");
      } 
      else if (query.includes("property") || query.includes("unit") || query.includes("عقار") || query.includes("بناية") || query.includes("وحدة")) {
        localReply = isAr
          ? `يدير النظام حالياً **${data.properties.length} عقارات رئيسية** تضم **${data.units.length} وحدة إيجارية**.`
          : `The system manages **${data.properties.length} properties** containing **${data.units.length} rental units**.`;
        if (onNavigate) onNavigate("PROPERTIES");
      } 
      else {
        localReply = isAr
          ? `مرحباً بك في نظام **${data.companyProfile.nameAr}**.\n\nإحصائيات سريعة بالنظام:\n- المباني والعقارات: **${data.properties.length}**\n- الوحدات العقارية: **${data.units.length}**\n- المستأجرين: **${data.tenants.length}**\n- إجمالي الشيكات المرتجعة: **AED ${totalExposure.toLocaleString()}** (${bouncedList.length} شيك)\n- طلبات الصيانة النشطة: **${openMaintenance.length}**`
          : `Welcome to **${data.companyProfile.nameEn}**!\n\nSystem Quick Statistics:\n- Properties: **${data.properties.length}**\n- Units: **${data.units.length}**\n- Tenants: **${data.tenants.length}**\n- Bounced Exposure: **AED ${totalExposure.toLocaleString()}** (${bouncedList.length} cheques)\n- Active Maintenance: **${openMaintenance.length}**`;
      }

      const botMsg: Message = {
        id: "bot-local-" + Date.now(),
        role: "assistant",
        content: localReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = language === "ar" ? [
    "ابحث عن طلبات الصيانة الحرجة",
    "ما إجمالي الشيكات المرتجعة والتعثر؟",
    "عرض القضايا الإيجارية في RDC",
    "ابحث عن المستأجر يحيى والعقد النشط",
    "تصفح تقويم الجلسات القضائية",
    "عرض التقارير المالية والتحصيلات",
  ] : [
    "Search urgent maintenance tickets",
    "What is the total bounced cheques exposure?",
    "Show RDC rental dispute cases",
    "Find tenant Yahya and active lease",
    "View judicial hearings calendar",
    "Show financial reports & collections",
  ];

  return (
    <motion.div 
      className={`fixed bottom-6 ${language === "ar" ? "left-6" : "right-6"} z-50 flex flex-col ${language === "ar" ? "items-start" : "items-end"} pointer-events-auto`}
    >
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white p-4 rounded-full shadow-2xl hover:shadow-amber-900/30 transition-all duration-300 transform border border-amber-500/30"
          title={language === "ar" ? "مساعد صقر الذكي" : "Falcon AI Assistant"}
        >
          <div className="relative pointer-events-none">
            <Bot className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-amber-800 rounded-full"></span>
          </div>
        </button>
      )}

      {/* Chat Window Modal / Drawer */}
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="w-[92vw] sm:w-[380px] h-[670px] max-h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden font-sans"
          onPointerDown={(e) => e.stopPropagation()} // Stop drag for the content so they can scroll
        >
          {/* Header */}
          <div 
            onPointerDown={(e) => {
              // This is empty, but we let it bubble up to the parent motion.div to drag
            }}
            className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <GripHorizontal className="w-4 h-4 text-slate-500" />
                  {language === "ar" ? "مساعد صقر الذكي" : "Falcon AI Assistant"}
                  <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    BILINGUAL
                  </span>
                </h3>
                <p className="text-xs text-amber-200/90 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-amber-400" />
                  {language === "ar" ? "تعرف تلقائي صوتي (عربي + English)" : "Auto Voice Speech (Arabic + English)"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Auto Speak Toggle Button */}
              <button
                type="button"
                onClick={() => setAutoSpeak(!autoSpeak)}
                title={autoSpeak ? (language === "ar" ? "إيقاف القراءة الصوتية الآلية" : "Disable Auto-Read") : (language === "ar" ? "تفعيل القراءة الصوتية الآلية" : "Enable Auto-Read")}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  autoSpeak ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bilingual Speech Control Sub-Header */}
          <div className="bg-slate-800/90 text-slate-200 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-amber-400" />
              {language === "ar" ? "وضع التعرف الصوتي:" : "Voice Recognition Mode:"}
            </span>

            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setSpeechLangMode("auto")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  speechLangMode === "auto"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title={language === "ar" ? "الكتشاف التلقائي والدمج بين اللغتين" : "Auto Dual Language Code-Switching"}
              >
                🌐 {language === "ar" ? "تلقائي (عربي+EN)" : "Auto (Ar+En)"}
              </button>
              <button
                type="button"
                onClick={() => setSpeechLangMode("ar")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  speechLangMode === "ar"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇦🇪 عربي
              </button>
              <button
                type="button"
                onClick={() => setSpeechLangMode("en")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  speechLangMode === "en"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[88%] ${
                  m.role === "user" ? "ms-auto flex-row-reverse" : "me-auto"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                    m.role === "user"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-900 text-amber-400 border border-slate-800"
                  }`}
                >
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
                    m.role === "user"
                      ? "bg-amber-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none whitespace-pre-wrap"
                  }`}
                >
                  <div className="font-medium">{m.content}</div>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100/20">
                    <div
                      className={`text-[10px] font-mono ${
                        m.role === "user" ? "text-amber-200" : "text-slate-400"
                      }`}
                    >
                      {m.timestamp}
                    </div>

                    {/* Speaker Button for Assistant Messages */}
                    {m.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => speakText(m.content, m.id)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          speakingMsgId === m.id
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : "text-slate-400 hover:text-amber-700 hover:bg-slate-100"
                        }`}
                        title={speakingMsgId === m.id ? (language === "ar" ? "إيقاف القراءة" : "Stop speaking") : (language === "ar" ? "قراءة بصوت عالٍ باللغة المكتشفة" : "Read aloud in detected language")}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 me-auto items-center">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-amber-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-amber-700 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-xs text-slate-400 ms-1 font-medium">
                    {language === "ar" ? "جارِ معالجة طلبك وفهم اللغة..." : "Analyzing voice & text input..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          {aiEnabled && (
            <div className="px-3 py-2 bg-white border-t border-slate-200 flex gap-1.5 overflow-x-auto no-scrollbar">
              {quickPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(promptText)}
                  className="whitespace-nowrap bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-amber-200/60 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  {promptText}
                </button>
              ))}
            </div>
          )}

          {/* Listening Live Banner with Language Waves */}
          {isListening && aiEnabled && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-rose-50 to-amber-50 border-t border-rose-200 text-rose-900 text-xs font-bold flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping absolute"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 relative"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-rose-950 font-bold">
                    {language === "ar" ? "جاري الاستماع التلقائي لصوتك..." : "Listening live to your speech..."}
                  </span>
                  {detectedSpeechLang && (
                    <span className="text-[10px] text-amber-800 font-semibold">
                      {language === "ar" ? `اللغة المكتشفة: ${detectedSpeechLang}` : `Detected Language: ${detectedSpeechLang}`}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
              >
                {language === "ar" ? "إنهاء وتثبيت النص" : "Stop & Keep Text"}
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={!aiEnabled}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                !aiEnabled ? "bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed" :
                isListening
                  ? "bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse cursor-pointer"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
              }`}
              title={!aiEnabled ? "" : isListening ? (language === "ar" ? "إيقاف الاستماع" : "Stop listening") : (language === "ar" ? "التحدث صوتياً (عربي / English)" : "Speak voice input (Arabic / English)")}
            >
              {isListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={input}
              disabled={!aiEnabled}
              onChange={(e) => {
                setInput(e.target.value);
                accumulatedTranscriptRef.current = e.target.value;
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                !aiEnabled 
                  ? (language === "ar" ? "المساعد الذكي معطل لعدم وجود مفتاح API..." : "AI disabled due to missing API key...")
                  : isListening
                    ? (language === "ar" ? "تحدث الآن باللغة العربية أو الإنجليزية..." : "Speak now in Arabic or English...")
                    : (language === "ar" ? "اكتب أو تحدث صوتياً بالعربية أو الإنجليزية..." : "Type or speak in Arabic or English...")
              }
              className={`flex-1 border rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                !aiEnabled ? "bg-slate-100 cursor-not-allowed opacity-70" :
                isListening ? "bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20 font-medium" : "bg-slate-100 border-slate-200 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              }`}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading || !aiEnabled}
              className="w-11 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md transition-all flex-shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
