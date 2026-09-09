import React, { useState, useRef } from "react";
import { Plus, Search, User, Phone, Mail, ShieldAlert, Edit2, Eye, Building2, Trash2, FileSpreadsheet, Upload, FileText, X, ExternalLink, Sparkles, Languages, Percent, CreditCard, ShieldCheck, RefreshCw, Lock } from "lucide-react";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Tenant, RiskLevel, ElectronicArchiveItem } from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { SearchableSelect } from "../common/SearchableSelect";
import { DraggableWrapper } from "../common/DraggableWrapper";
import { Tenant360Workspace } from "./Tenant360Workspace";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { matchAnyArabicSearch, normalizeArabicText } from "../../utils/arabicTextNormalizer";
import { getBilingualSuggestion, getLocalBilingualSuggestion } from "../../utils/bilingualNaming";
import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";
import { DocumentPreviewModal } from "../common/DocumentPreviewModal";


interface TenantsViewProps {
  onSelectTenant?: (tenant: Tenant) => void;
}

export const TenantsView: React.FC<TenantsViewProps> = ({ onSelectTenant }) => {
  const { t, language } = useLanguage();
  const { tenants, addTenant, updateTenant, recalculateTenantRisk, deleteTenant, importTenantsBatch, archive, addArchiveItem, deleteArchiveItem, uploadAndArchiveDocument, getNextTenantCode } = useData();
  const { hasPermission, currentUser, users, provisionPortalAccount } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tenantFileInputRef = useRef<HTMLInputElement>(null);
  const [tempRecordId, setTempRecordId] = useState("");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [previewDocument, setPreviewDocument] = useState<ElectronicArchiveItem | null>(null);

  const currentRecordId = editingTenant ? editingTenant.id : tempRecordId;
  const attachedDocs = archive.filter((a) => a.recordId === currentRecordId || a.entityId === currentRecordId);



  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // 1. Scan for the header row in case of top title/banner rows
        const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const rowArr = (rawRows[r] || []).map((c) => String(c).trim().toLowerCase());
          const joined = rowArr.join(" ");
          if (
            joined.includes("name") ||
            joined.includes("اسم") ||
            joined.includes("مستأجر") ||
            joined.includes("tenant") ||
            joined.includes("هاتف") ||
            joined.includes("phone") ||
            joined.includes("mobile") ||
            joined.includes("جوال") ||
            joined.includes("code") ||
            joined.includes("كود") ||
            joined.includes("هوية") ||
            joined.includes("id") ||
            joined.includes("جواز") ||
            joined.includes("passport") ||
            joined.includes("رخصة") ||
            joined.includes("license")
          ) {
            headerRowIndex = r;
            break;
          }
        }

        const data = XLSX.utils.sheet_to_json<any>(ws, { range: headerRowIndex, defval: "" });

        const normalizeTxt = (s?: string) => normalizeArabicText(s, true);
        const normalizePh = (s?: string) => (s || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
        const normalizeId = (s?: string) => (s || "").replace(/[^\w]/g, "").toUpperCase();

        const getRowVal = (row: any, aliases: string[]): string => {
          for (const a of aliases) {
            if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== "") {
              return String(row[a]).trim();
            }
          }
          const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, "");
          const normAliases = aliases.map(norm);
          for (const [key, val] of Object.entries(row)) {
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              const normKey = norm(key);
              if (normAliases.some((na) => normKey === na || normKey.includes(na) || na.includes(normKey))) {
                return String(val).trim();
              }
            }
          }
          return "";
        };

        const seenInFileEIds = new Set<string>();
        const seenInFilePhones = new Set<string>();
        const seenInFilePassports = new Set<string>();
        const seenInFileTradeLicenses = new Set<string>();
        const seenInFileNames = new Set<string>();

        const parsedRows = data
          .map((row, index) => {
            const nameAr = getRowVal(row, [
              "NameAr",
              "nameAr",
              "Name_Ar",
              "اسم المستأجر",
              "الاسم بالعربي",
              "الاسم العربي",
              "اسم العميل",
              "الاسم التجاري",
              "المستأجر",
              "الاسم",
              "Name",
              "Arabic Name",
            ]);
            const nameEn = getRowVal(row, [
              "NameEn",
              "nameEn",
              "Name_En",
              "English Name",
              "Tenant Name",
              "Name",
              "الاسم بالانجليزي",
              "الاسم بالإنجليزية",
              "الاسم الإنجليزي",
            ]);

            const rowVals = Object.values(row)
              .map((v) => String(v).trim())
              .filter((v) => v !== "");
            if (rowVals.length === 0) return null;

            // Skip template instruction lines if present
            const firstCell = String(rowVals[0] || "");
            if (firstCell.includes("مثال توضيحي") || firstCell.includes("قم بحذف هذا السطر")) {
              return null;
            }

            const finalNameAr = nameAr || nameEn || firstCell || (language === "ar" ? `مستأجر ${index + 1}` : `Tenant ${index + 1}`);
            const finalNameEn = nameEn || nameAr || finalNameAr;

            const code =
              getRowVal(row, ["Code", "code", "الكود", "كود المستأجر", "رمز المستأجر", "رقم المستأجر", "Tenant ID", "Tenant Code"]) ||
              `TNT-${Date.now() % 10000}`;

            const rawType = getRowVal(row, ["Type", "type", "النوع", "نوع المستأجر", "Tenant Type"]);
            const type =
              rawType.includes("شرك") || rawType.toUpperCase().includes("CORP") || rawType.toUpperCase().includes("COMPANY")
                ? "CORPORATE"
                : "INDIVIDUAL";

            const email = getRowVal(row, ["Email", "email", "البريد", "البريد الالكتروني", "البريد الإلكتروني", "E-mail", "Mail"]);
            const phone = getRowVal(row, [
              "Phone",
              "phone",
              "Mobile",
              "mobile",
              "الهاتف",
              "رقم الهاتف",
              "الجوال",
              "رقم الجوال",
              "الموبايل",
              "Tel",
              "Telephone",
            ]);

            const emiratesId = getRowVal(row, [
              "EmiratesId",
              "emiratesId",
              "Emirates ID",
              "الهوية",
              "رقم الهوية",
              "بطاقة الهوية",
              "Civil ID",
              "National ID",
              "ID Number",
            ]);

            const passportNumber = getRowVal(row, [
              "PassportNumber",
              "passportNumber",
              "Passport",
              "جواز السفر",
              "رقم الجواز",
              "الجواز",
              "Passport No",
            ]);

            const tradeLicenseNo = getRowVal(row, [
              "TradeLicenseNo",
              "tradeLicenseNo",
              "Trade License",
              "الرخصة التجارية",
              "رقم الرخصة",
              "الرخصة",
              "السجل التجاري",
              "License No",
            ]);

            const nationality =
              getRowVal(row, ["Nationality", "nationality", "الجنسية", "البلد", "Country"]) ||
              (language === "ar" ? "الإمارات العربية المتحدة" : "United Arab Emirates");

            const normEId = normalizeId(emiratesId);
            const normTrade = normalizeId(tradeLicenseNo);
            const normPass = normalizeId(passportNumber);
            const normCd = normalizeTxt(code);
            const normPh = normalizePh(phone);
            const normNAr = normalizeTxt(finalNameAr);
            const normNEn = normalizeTxt(finalNameEn);

            // Check if matches an existing tenant in DB
            const matchedTenant = tenants.find((t) => {
              const matchId = normEId && normEId.length >= 8 && normalizeId(t.emiratesId) === normEId;
              const matchTrade = normTrade && normTrade.length >= 4 && normalizeId(t.tradeLicenseNo) === normTrade;
              const matchPass = normPass && normPass.length >= 6 && normalizeId(t.passportNumber || t.passportNo) === normPass;
              const matchPhone = normPh && normPh.length >= 8 && normalizePh(t.phone) === normPh;
              const matchNameAr = normNAr && normNAr.length >= 3 && normalizeTxt(t.nameAr) === normNAr;
              const matchNameEn = normNEn && normNEn.length >= 3 && normalizeTxt(t.nameEn) === normNEn;
              return matchId || matchTrade || matchPass || matchPhone || matchNameAr || matchNameEn;
            });

            // In-file duplicate checking (only for real non-empty identifiers)
            let isDuplicateInFile = false;
            if (normEId && normEId.length >= 8) {
              if (seenInFileEIds.has(normEId)) isDuplicateInFile = true;
              seenInFileEIds.add(normEId);
            }
            if (normTrade && normTrade.length >= 4) {
              if (seenInFileTradeLicenses.has(normTrade)) isDuplicateInFile = true;
              seenInFileTradeLicenses.add(normTrade);
            }
            if (normPass && normPass.length >= 6) {
              if (seenInFilePassports.has(normPass)) isDuplicateInFile = true;
              seenInFilePassports.add(normPass);
            }
            if (normPh && normPh.length >= 8) {
              if (seenInFilePhones.has(normPh)) isDuplicateInFile = true;
              seenInFilePhones.add(normPh);
            }
            if (normNAr && normNAr.length >= 3) {
              if (seenInFileNames.has(normNAr)) isDuplicateInFile = true;
              seenInFileNames.add(normNAr);
            }

            return {
              id: index,
              code,
              nameEn: finalNameEn,
              nameAr: finalNameAr,
              type,
              email,
              phone,
              emiratesId,
              passportNumber,
              tradeLicenseNo,
              nationality,
              status: "ACTIVE",
              selected: true,
              isExisting: !!matchedTenant,
              matchedTenantName: matchedTenant ? (language === "ar" ? matchedTenant.nameAr : matchedTenant.nameEn) : undefined,
              matchedTenantCode: matchedTenant?.code,
              isDuplicateInFile,
            };
          })
          .filter(Boolean) as any[];

        if (parsedRows.length === 0) {
          setImportFeedback({
            message: language === "ar" ? "لم يتم العثور على بيانات صالحة في ملف الاكسل" : "No valid records found in Excel file",
            type: "error",
          });
          return;
        }

        setImportPreviewRows(parsedRows);
        setIsImportPreviewOpen(true);
      } catch (err) {
        console.error("Excel import error:", err);
        setImportFeedback({
          message: language === "ar" ? "حدث خطأ أثناء قراءة ملف الاكسل. يرجى التأكد من صحة التنسيق." : "Error reading Excel file. Please check format.",
          type: "error",
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImportTenants = async () => {
    const selectedRows = importPreviewRows.filter(r => r.selected);
    if (selectedRows.length === 0) return;

    setIsImporting(true);
    try {
      const res = await importTenantsBatch(selectedRows.map(row => ({
        code: row.code,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        type: row.type,
        email: row.email,
        phone: row.phone,
        emiratesId: row.emiratesId,
        passportNumber: row.passportNumber,
        tradeLicenseNo: row.tradeLicenseNo,
        nationality: row.nationality,
        status: row.status,
      })));

      setIsImportPreviewOpen(false);
      setImportPreviewRows([]);
      setImportFeedback({
        message: language === "ar" 
          ? `تم الاستيراد بنجاح دون أي تكرار! (${res.importedCount} مستأجر جديد، وتحديث ${res.updatedCount} مستأجر مسجل)`
          : `Successfully imported without duplication! (${res.importedCount} new tenants, ${res.updatedCount} existing tenants updated)`,
        type: "success",
      });
      setTimeout(() => setImportFeedback(null), 6000);
    } catch (err) {
      console.error("Batch import error:", err);
      setImportFeedback({
        message: language === "ar" ? "حدث خطأ أثناء تنفيذ الاستيراد" : "Error executing import",
        type: "error",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTenantTemplate = () => {
    const templateData = [
      {
        "Code": "TNT-101",
        "NameAr": "محمد أحمد المحمود",
        "NameEn": "Mohammed Ahmed Al Mahmoud",
        "Type": "INDIVIDUAL",
        "EmiratesId": "784-1990-7654321-1",
        "PassportNumber": "",
        "TradeLicenseNo": "",
        "Nationality": "United Arab Emirates",
        "Email": "tenant@example.ae",
        "Phone": "+971509876543"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TenantsTemplate");
    XLSX.writeFile(wb, "Tenants_Import_Template.xlsx");
  };

  const handleDelete = (tenant: Tenant, e: React.MouseEvent) => {
    e.stopPropagation();
    setTenantToDelete(tenant);
  };

  const confirmDelete = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (tenantToDelete) {
      deleteTenant(tenantToDelete.id, options);
      setTenantToDelete(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected360TenantId, setSelected360TenantId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [type, setType] = useState<Tenant["type"]>("INDIVIDUAL");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+971");
  const [emiratesId, setEmiratesId] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [nationality, setNationality] = useState("United Arab Emirates");
  const [specialAdminFeeRate, setSpecialAdminFeeRate] = useState<number | "">("");

  // Emirates ID Verification State
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [identitySource, setIdentitySource] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [captureDate, setCaptureDate] = useState("");
  const [readerInformation, setReaderInformation] = useState("");
  const [isEidModalOpen, setIsEidModalOpen] = useState(false);

  const [smartCaptureArchiveDoc, setSmartCaptureArchiveDoc] = useState<{ base64: string, mime: string } | null>(null);
  const [isUploadingTenantDoc, setIsUploadingTenantDoc] = useState(false);
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);


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

  const handleTenantFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingTenantDoc) return;

    setIsUploadingTenantDoc(true);
    // Clear smartCaptureArchiveDoc so submitting the form doesn't re-upload
    setSmartCaptureArchiveDoc(null);

    try {
      await uploadAndArchiveDocument(file, {
        fileName: file.name,
        category: "TENANTS",
        mimeType: file.type || "application/pdf",
        entityType: "TENANT",
        entityId: currentRecordId,
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
        tags: ["tenant", "id", "attachment"],
        description: `Tenant Document: ${nameAr || nameEn || code}`,
      });
    } catch (err) {
      console.error("Failed to upload tenant document:", err);
      alert(language === "ar" ? "تعذر رفع المستند. يرجى المحاولة مرة أخرى." : "Failed to upload document. Please try again.");
    } finally {
      setIsUploadingTenantDoc(false);
      if (tenantFileInputRef.current) tenantFileInputRef.current.value = "";
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchTerm =
      !searchTerm.trim() ||
      matchAnyArabicSearch(
        [
          tenant.nameEn,
          tenant.nameAr,
          tenant.code,
          tenant.phone,
          tenant.email,
          tenant.emiratesId,
          tenant.passportNumber,
          tenant.passportNo,
          tenant.tradeLicenseNo,
          tenant.nationality,
        ],
        searchTerm
      );

    const matchRisk = selectedRisk === "ALL" || tenant.riskLevel === selectedRisk;
    const matchType = selectedType === "ALL" || tenant.type === selectedType;

    return matchTerm && matchRisk && matchType;
  });

  const handleOpenAdd = () => {
    setEditingTenant(null);
    setSmartCaptureArchiveDoc(null);
    setCode(getNextTenantCode());
    setTempRecordId("temp-" + Date.now());
    setNameEn("");
    setNameAr("");
    setType("INDIVIDUAL");
    setEmail("");
    setPhone("+97150");
    setEmiratesId("");
    setPassportNumber("");
    setTradeLicenseNo("");
    setNationality("United Arab Emirates");
    setSpecialAdminFeeRate("");
    setFullNameAr("");
    setFullNameEn("");
    setDateOfBirth("");
    setGender("");
    setCardNumber("");
    setIssueDate("");
    setExpiryDate("");
    setIdentitySource("");
    setVerificationStatus("");
    setCaptureDate("");
    setReaderInformation("");
    setIsNameEnGenerated(false);
    setIsNameArGenerated(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tenant: Tenant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTenant(tenant);
    setSmartCaptureArchiveDoc(null);
    setCode(tenant.code);
    setTempRecordId(tenant.id);
    setNameEn(tenant.nameEn);
    setNameAr(tenant.nameAr);
    setType(tenant.type);
    setEmail(tenant.email);
    setPhone(tenant.phone);
    setEmiratesId(tenant.emiratesId || "");
    setPassportNumber(tenant.passportNumber || "");
    setTradeLicenseNo(tenant.tradeLicenseNo || "");
    setNationality(tenant.nationality || "United Arab Emirates");
    setSpecialAdminFeeRate(tenant.specialAdminFeeRate !== undefined ? tenant.specialAdminFeeRate : "");
    setFullNameAr(tenant.fullNameAr || "");
    setFullNameEn(tenant.fullNameEn || "");
    setDateOfBirth(tenant.dateOfBirth || "");
    setGender(tenant.gender || "");
    setCardNumber(tenant.cardNumber || "");
    setIssueDate(tenant.issueDate || "");
    setExpiryDate(tenant.expiryDate || "");
    setIdentitySource(tenant.identitySource || "");
    setVerificationStatus(tenant.verificationStatus || "");
    setCaptureDate(tenant.captureDate || "");
    setReaderInformation(tenant.readerInformation || "");
    setIsNameEnGenerated(false);
    setIsNameArGenerated(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTenant) return;

    setIsSubmittingTenant(true);
    try {
      if (editingTenant) {
        updateTenant(editingTenant.id, {
          code,
          nameEn,
          nameAr,
          type,
          email,
          phone,
          emiratesId,
          passportNumber,
          tradeLicenseNo,
          nationality,
          specialAdminFeeRate: specialAdminFeeRate === "" ? undefined : Number(specialAdminFeeRate),
          fullNameAr,
          fullNameEn,
          dateOfBirth,
          gender,
          cardNumber,
          issueDate,
          expiryDate,
          identitySource: identitySource as any,
          verificationStatus: verificationStatus as any,
          captureDate,
          readerInformation,
        });
        
        provisionPortalAccount({
          portalRole: "TENANT",
          targetId: editingTenant.id,
          email,
          nameEn,
          nameAr,
          phone,
        });

        if (smartCaptureArchiveDoc && uploadAndArchiveDocument) {
          await uploadAndArchiveDocument(smartCaptureArchiveDoc.base64, {
            fileName: `EID_${emiratesId || editingTenant.emiratesId || editingTenant.code}.jpg`,
            category: "EMIRATES_ID",
            mimeType: smartCaptureArchiveDoc.mime || "image/jpeg",
            entityType: "TENANT",
            entityId: editingTenant.id,
            uploadedByUserId: currentUser?.id || "u-1",
            uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
            tags: ["EMIRATES_ID", "OCR", "SMART_CAPTURE"],
            description: `Emirates ID for Tenant ${nameAr || nameEn || editingTenant.nameAr}`,
          });
        }
        setSmartCaptureArchiveDoc(null);
      } else {
        const newTenant = addTenant({
          code,
          nameEn,
          nameAr,
          type,
          email,
          phone,
          emiratesId,
          passportNumber,
          tradeLicenseNo,
          nationality,
          status: "ACTIVE",
          specialAdminFeeRate: specialAdminFeeRate === "" ? undefined : Number(specialAdminFeeRate),
          fullNameAr,
          fullNameEn,
          dateOfBirth,
          gender,
          cardNumber,
          issueDate,
          expiryDate,
          identitySource: identitySource as any,
          verificationStatus: verificationStatus as any,
          captureDate,
          readerInformation,
        });
        if (newTenant && smartCaptureArchiveDoc && uploadAndArchiveDocument) {
          await uploadAndArchiveDocument(smartCaptureArchiveDoc.base64, {
            fileName: `EID_${newTenant.emiratesId}`,
            category: "EMIRATES_ID",
            mimeType: smartCaptureArchiveDoc.mime || "image/jpeg",
            entityType: "TENANT",
            entityId: newTenant.id,
            uploadedByUserId: currentUser?.id || "u-1",
            uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
            tags: ["EMIRATES_ID", "OCR", "SMART_CAPTURE"],
            description: `Emirates ID for Tenant ${newTenant.nameAr || newTenant.nameEn}`,
          });
        }
        setSmartCaptureArchiveDoc(null);

        if (newTenant) {
          provisionPortalAccount({
            portalRole: "TENANT",
            targetId: newTenant.id,
            email,
            nameEn,
            nameAr,
            phone,
          });
        }
      }
      setIsModalOpen(false);
    } catch (submitErr) {
      console.error("Failed to submit tenant:", submitErr);
      alert(language === "ar" ? "حدث خطأ أثناء حفظ بيانات المستأجر." : "Error occurred while saving tenant record.");
    } finally {
      setIsSubmittingTenant(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Notification Banner */}
      {importFeedback && (
        <DraggableWrapper formId="TENANTS" elementId="banner-import">
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
            importFeedback.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 flex-shrink-0" />
              <span>{importFeedback.message}</span>
            </div>
            <button 
              onClick={() => setImportFeedback(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        </DraggableWrapper>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DraggableWrapper formId="TENANTS" elementId="header-info">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t("navTenants")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar"
                ? "سجل المستأجرين، التقييم الائتماني الذكي، وملف العميل الشامل 360°"
                : "Tenant directory, behavioral credit risk index, and 360° master profile"}
            </p>
          </div>
        </DraggableWrapper>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <DraggableWrapper formId="TENANTS" elementId="btn-excel-template">
            <button
              onClick={downloadTenantTemplate}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              title={language === "ar" ? "تحميل نموذج إكسل فارغ" : "Download Excel Template"}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span>{language === "ar" ? "تحميل نموذج إكسل" : "Excel Template"}</span>
            </button>
          </DraggableWrapper>

          <DraggableWrapper formId="TENANTS" elementId="btn-import-excel">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{language === "ar" ? "استيراد من إكسل" : "Import Excel"}</span>
            </button>
          </DraggableWrapper>

          <DraggableWrapper formId="TENANTS" elementId="btn-add-tenant">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ar" ? "إضافة مستأجر جديد" : "Add New Tenant"}</span>
            </button>
          </DraggableWrapper>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DraggableWrapper formId="TENANTS" elementId="filter-search">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث بالاسم، الهوية، الهاتف..." : "Search by name, ID, phone..."}
              className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
            />
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="TENANTS" elementId="filter-risk">
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة مستويات المخاطر" : "All Risk Levels" },
                { id: "LOW", label: "LOW Risk (مخاطر منخفضة)" },
                { id: "MEDIUM", label: "MEDIUM Risk (مخاطر متوسطة)" },
                { id: "HIGH", label: "HIGH Risk (مخاطر مرتفعة)" },
              ]}
              value={selectedRisk}
              onChange={(val) => setSelectedRisk(val)}
              placeholder={language === "ar" ? "مستوى المخاطر..." : "Risk level..."}
              searchPlaceholder={language === "ar" ? "ابحث بالمخاطر..." : "Search risk..."}
            />
          </div>
        </DraggableWrapper>

        <DraggableWrapper formId="TENANTS" elementId="filter-type">
          <div>
            <SearchableSelect
              options={[
                { id: "ALL", label: language === "ar" ? "كافة الأنواع" : "All Entity Types" },
                { id: "INDIVIDUAL", label: "INDIVIDUAL (أفراد)" },
                { id: "CORPORATE", label: "CORPORATE (شركات)" },
              ]}
              value={selectedType}
              onChange={(val) => setSelectedType(val)}
              placeholder={language === "ar" ? "نوع المستأجر..." : "Tenant type..."}
              searchPlaceholder={language === "ar" ? "ابحث بالنوع..." : "Search type..."}
            />
          </div>
        </DraggableWrapper>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4 text-start">{language === "ar" ? "المستأجر والكود" : "Tenant & Code"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "النوع والهوية" : "Type & KYC"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "بيانات التواصل" : "Contact"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "مؤشر المخاطر" : "Risk Score"}</th>
                <th className="py-3 px-4 text-start">{language === "ar" ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 text-end">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => {
                    if (onSelectTenant) {
                      onSelectTenant(tenant);
                    } else {
                      setSelected360TenantId(tenant.id);
                    }
                  }}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0 text-xs">
                        {tenant.type === "CORPORATE" ? (
                          <Building2 className="w-4 h-4 text-amber-700" />
                        ) : (
                          <User className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {language === "ar" ? tenant.nameAr : tenant.nameEn}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{tenant.code}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{tenant.type}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {tenant.emiratesId || tenant.tradeLicenseNo || tenant.passportNumber || "N/A"}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-mono text-slate-800">{tenant.phone}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{tenant.email}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          tenant.riskLevel === "HIGH"
                            ? "danger"
                            : tenant.riskLevel === "MEDIUM"
                            ? "warning"
                            : "success"
                        }
                        size="sm"
                      >
                        {tenant.riskLevel} ({tenant.riskScore}/100)
                      </Badge>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Badge variant="success" size="sm">
                      {tenant.status}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 text-end">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (onSelectTenant) {
                            onSelectTenant(tenant);
                          } else {
                            setSelected360TenantId(tenant.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                        title={language === "ar" ? "عرض الملف الشامل" : "View 360° Profile"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleOpenEdit(tenant, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title={t("edit")}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => handleDelete(tenant, e)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={language === "ar" ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTenants.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            {t("noDataFound")}
          </div>
        )}
      </div>

      {/* Add / Edit Tenant Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTenant ? (language === "ar" ? "تعديل بيانات المستأجر" : "Edit Tenant") : (language === "ar" ? "إضافة مستأجر جديد" : "Add Tenant")}
        subtitle={language === "ar" ? "تسجيل بيانات الهوية الوطنية والتواصل مع معاينة فورية للبيانات" : "KYC compliance and contact credentials with live compiled preview"}
        icon={<User className="w-5 h-5" />}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Live Compiled Tenant Information Text Box */}
          <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <User className="w-4 h-4 text-amber-700" />
              <span>
                {language === "ar"
                  ? "📋 معلومات مجمعة عن المستأجر (معاينة فورية للبيانات المدخلة):"
                  : "📋 Compiled Tenant Summary & Live Preview:"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "كود المستأجر:" : "Code:"}</span>
                <strong className="font-mono text-amber-950">{code || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الاسم (عربي):" : "Name (Ar):"}</span>
                <strong className="text-amber-950 truncate block" title={nameAr || "—"}>{nameAr || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الاسم (إنجليزي):" : "Name (En):"}</span>
                <strong className="text-amber-950 truncate block" title={nameEn || "—"}>{nameEn || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "نوع المستأجر:" : "Type:"}</span>
                <strong className="text-amber-950">
                  {type === "CORPORATE" ? (language === "ar" ? "شركات / تجاري" : "Corporate") : (language === "ar" ? "فردي / سكني" : "Individual")}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم الهاتف:" : "Phone:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={phone || "—"}>{phone || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الهوية / الجواز:" : "Emirates ID / Passport:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={emiratesId || passportNumber || tradeLicenseNo || "—"}>
                  {emiratesId || passportNumber || tradeLicenseNo || "—"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الجنسية:" : "Nationality:"}</span>
                <strong className="text-amber-950 truncate block">{nationality || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "البريد الإلكتروني:" : "Email:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={email || "—"}>{email || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "المصدر التحققي:" : "Verification:"}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {verificationStatus === "VERIFIED" ? (language === "ar" ? "موثق (KYC)" : "Verified") : (language === "ar" ? "قيد التدقيق" : "Pending")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "عمولة الإدارة:" : "Mgmt Fee:"}</span>
                <strong className="text-amber-950">{specialAdminFeeRate !== "" ? `${specialAdminFeeRate}%` : "افتراضية"}</strong>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-code">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "كود المستأجر" : "Tenant Code"} *
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                    <Lock className="w-3 h-3 text-amber-700" />
                    {language === "ar" ? "مسلسل تلقائي (محمي)" : "Auto-Locked"}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  readOnly
                  disabled
                  value={code}
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none shadow-xs"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-name-ar">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "الاسم (بالعربية)" : "Name (Arabic)"} *
                  </label>
                  {nameAr && (
                    <button
                      type="button"
                      onClick={forceTranslateArToEn}
                      disabled={isTranslatingAr}
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
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
                    placeholder="سالم راشد الكتبي..."
                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:bg-white focus:outline-none transition-all ${
                      isNameArGenerated 
                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/10 focus:border-amber-500" 
                        : "bg-slate-50 border-slate-200 focus:border-indigo-500"
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
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-name-en">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "الاسم (بالإنجليزية)" : "Name (English)"} *
                  </label>
                  {nameEn && (
                    <button
                      type="button"
                      onClick={forceTranslateEnToAr}
                      disabled={isTranslatingEn}
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
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
                    required
                    value={nameEn}
                    onChange={(e) => {
                      setNameEn(e.target.value);
                      setIsNameEnGenerated(false);
                    }}
                    onBlur={handleEnBlur}
                    placeholder="Salem Rashed Al Ketbi..."
                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:bg-white focus:outline-none transition-all ${
                      isNameEnGenerated 
                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/10 focus:border-amber-500" 
                        : "bg-slate-50 border-slate-200 focus:border-indigo-500"
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
            </DraggableWrapper>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-type">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "نوع المستأجر" : "Tenant Entity Type"} *
                </label>
                <SearchableSelect
                  options={[
                    { id: "INDIVIDUAL", label: "INDIVIDUAL (فرد)" },
                    { id: "CORPORATE", label: "CORPORATE (شركة / مؤسسة)" },
                  ]}
                  value={type}
                  onChange={(val) => setType(val as any)}
                  placeholder={language === "ar" ? "اختر نوع المستأجر..." : "Select type..."}
                  searchPlaceholder={language === "ar" ? "ابحث بالنوع..." : "Search type..."}
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-phone">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم الهاتف المتحرك" : "Mobile Phone"} *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971501234567"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-email">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "البريد الإلكتروني" : "Email Address"} *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="salem@domain.ae"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-emirates-id">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "رقم الهوية الإماراتية" : "Emirates ID"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEidModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200 transition-colors cursor-pointer"
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>{language === "ar" ? "قراءة الهوية الرقمية" : "Read Smart Card"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={emiratesId}
                  onChange={(e) => setEmiratesId(e.target.value)}
                  placeholder="784-1988-1234567-1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
                {verificationStatus === "VERIFIED" && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-bold">
                      {language === "ar" ? "تم التحقق من الهوية الأصلية" : "Verified Smart Card Reader"}
                    </span>
                  </div>
                )}
                {verificationStatus === "OCR_EXTRACTED" && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-bold">
                      {language === "ar" ? "مستخرج من وثيقة ضوئية (OCR)" : "Extracted from uploaded document"}
                    </span>
                  </div>
                )}
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-nationality">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الجنسية" : "Nationality"} *
                </label>
                <input
                  type="text"
                  required
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-dob">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-gender">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الجنس" : "Gender"}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">{language === "ar" ? "غير محدد" : "Unspecified"}</option>
                  <option value="MALE">{language === "ar" ? "ذكر" : "Male"}</option>
                  <option value="FEMALE">{language === "ar" ? "أنثى" : "Female"}</option>
                </select>
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-expiry">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "تاريخ إنتهاء الهوية" : "ID Expiry Date"}
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-passport">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم جواز السفر" : "Passport Number"}
                </label>
                <input
                  type="text"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="N1234567"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="TENANT_MODAL" elementId="field-trade-license">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الرخصة التجارية (للشركات)" : "Trade License #"}
                </label>
                <input
                  type="text"
                  value={tradeLicenseNo}
                  onChange={(e) => setTradeLicenseNo(e.target.value)}
                  placeholder="CN-987654"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </DraggableWrapper>
          </div>

          <DraggableWrapper formId="TENANT_MODAL" elementId="field-admin-fee-override">
            <div className="bg-indigo-50/50 border border-indigo-200 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-indigo-700" />
                <span>{language === "ar" ? "تخصيص نسبة الرسوم الإدارية (اختياري)" : "Special Administrative Fee Rate (Optional)"}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "النسبة المخصصة لهذا المستأجر (%)" : "Tenant-Specific Rate (%)"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={specialAdminFeeRate}
                      onChange={(e) => setSpecialAdminFeeRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder={language === "ar" ? "اتركه فارغاً لاستخدام النظام الافتراضي" : "Leave empty for system default"}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    {language === "ar" 
                      ? "* إذا تم تحديد نسبة هنا، فستقوم بتجاوز نسبة الرسوم الإدارية الافتراضية للنظام في كافة عقود هذا المستأجر." 
                      : "* If set, this rate overrides the system default for all contracts belonging to this tenant."}
                  </p>
                </div>
              </div>
            </div>
          </DraggableWrapper>

          {/* File Attachments Section */}
          <DraggableWrapper formId="TENANT_MODAL" elementId="section-attachments">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {language === "ar" ? "المستندات والملفات المرفقة (الهوية، جواز السفر، الرخصة)" : "Attached Documents & IDs"}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {language === "ar" ? "قم برفق وإرفاق المستندات الخاصة بهذا المستأجر للأرشيف الآمن" : "Upload ID and related documents for secure archive"}
                  </p>
                </div>
                <input
                  type="file"
                  ref={tenantFileInputRef}
                  onChange={handleTenantFileAttach}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingTenantDoc}
                  onClick={() => tenantFileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors shadow-xs ${isUploadingTenantDoc ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isUploadingTenantDoc ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingTenantDoc ? (language === "ar" ? "جاري الرفع والأرشفة..." : "Uploading...") : (language === "ar" ? "تحميل وارفاق ملف" : "Upload & Attach File")}</span>
                </button>
              </div>

              {attachedDocs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  {attachedDocs.map((doc, idx) => (
                    <div key={`${doc.id}-${idx}`} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{doc.fileName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({Math.round(doc.fileSize / 1024)} KB)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDocument(doc)}
                          className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer"
                          title={language === "ar" ? "معاينة المستند" : "Preview Document"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteArchiveItem(doc.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title={language === "ar" ? "حذف" : "Delete"}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DraggableWrapper>

          <DraggableWrapper formId="TENANT_MODAL" elementId="section-actions">
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmittingTenant}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingTenant ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === "ar" ? "جاري الحفظ والتكامل..." : "Saving..."}</span>
                  </>
                ) : (
                  t("save")
                )}
              </button>
            </div>
          </DraggableWrapper>
        </form>
      </Modal>

      {/* Native Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
        documents={attachedDocs}
      />

      {/* Tenant 360 Workspace Modal */}
      {selected360TenantId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Tenant360Workspace
              tenantId={selected360TenantId}
              onClose={() => setSelected360TenantId(null)}
            />
          </div>
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {isImportPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl 2xl:max-w-6xl p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {language === "ar" ? "معاينة واختيار بيانات المستأجرين المستوردة من إكسل" : "Preview & Select Excel Import Tenants"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "ar" 
                    ? `تم العثور على ${importPreviewRows.length} سجل. حدد السجلات التي تريد استيرادها أو قم بإلغاء العملية.`
                    : `Found ${importPreviewRows.length} records. Select the items you wish to import or cancel.`}
                </p>
              </div>
              <button 
                onClick={() => { setIsImportPreviewOpen(false); setImportPreviewRows([]); }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Stats Summary Bar */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 font-bold">{language === "ar" ? "إجمالي السجلات في الملف" : "Total in File"}</div>
                <div className="text-base font-black text-slate-900">{importPreviewRows.length}</div>
              </div>
              <div className="text-center border-x border-slate-200">
                <div className="text-[10px] text-emerald-600 font-bold">{language === "ar" ? "مستأجرين جدد (إضافة)" : "New Tenants (Add)"}</div>
                <div className="text-base font-black text-emerald-700">{importPreviewRows.filter(r => !r.isExisting).length}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-amber-600 font-bold">{language === "ar" ? "موجود مسبقاً (تحديث بيانات)" : "Existing (Update)"}</div>
                <div className="text-base font-black text-amber-700">{importPreviewRows.filter(r => r.isExisting).length}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportPreviewRows(prev => prev.map(r => ({ ...r, selected: true })))}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {language === "ar" ? "تحديد الكل" : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={() => setImportPreviewRows(prev => prev.map(r => ({ ...r, selected: false })))}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {language === "ar" ? "إلغاء تحديد الكل" : "Deselect All"}
                </button>
              </div>
              <div className="text-xs font-bold text-slate-600">
                {language === "ar" 
                  ? `المحدد للاستيراد: ${importPreviewRows.filter(r => r.selected).length} من ${importPreviewRows.length}`
                  : `Selected for import: ${importPreviewRows.filter(r => r.selected).length} of ${importPreviewRows.length}`}
              </div>
            </div>

            <div className="overflow-x-auto flex-1 border border-slate-200 rounded-2xl max-h-[45vh]">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">اختر</th>
                    <th className="py-3 px-4">حالة المطابقة</th>
                    <th className="py-3 px-4">الكود</th>
                    <th className="py-3 px-4">الاسم بالعربي / الإنجليزي</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">الهوية / الجواز</th>
                    <th className="py-3 px-4">الهاتف والبريد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {importPreviewRows.map((row) => (
                    <tr key={row.id} className={`hover:bg-slate-50 ${!row.selected ? "opacity-40 bg-slate-100/50" : ""}`}>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setImportPreviewRows(prev => prev.map(r => r.id === row.id ? { ...r, selected: checked } : r));
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        {row.isExisting ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 w-fit">
                              {language === "ar" ? "موجود مسبقاً (تحديث)" : "Existing (Update)"}
                            </span>
                            {row.matchedTenantName && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {language === "ar" ? `مطابق لـ: ${row.matchedTenantName}` : `Matches: ${row.matchedTenantName}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 w-fit">
                            {language === "ar" ? "مستأجر جديد" : "New Tenant"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-700">{row.code}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <div>{row.nameAr}</div>
                        <div className="text-[10px] text-slate-400">{row.nameEn}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.type === "CORPORATE" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {row.emiratesId || row.passportNumber || row.tradeLicenseNo || "-"}
                      </td>
                      <td className="py-2.5 px-4">
                        <div>{row.phone}</div>
                        <div className="text-[10px] text-slate-400">{row.email}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => { setIsImportPreviewOpen(false); setImportPreviewRows([]); }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {language === "ar" ? "إلغاء العملية" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmImportTenants}
                disabled={isImporting || importPreviewRows.filter(r => r.selected).length === 0}
                className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === "ar" ? "جاري الاستيراد والتكامل..." : "Importing..."}</span>
                  </>
                ) : (
                  <span>
                    {language === "ar"
                      ? `استيراد المحدد (${importPreviewRows.filter(r => r.selected).length}) دون تكرار`
                      : `Import Selected (${importPreviewRows.filter(r => r.selected).length}) No Dupes`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {tenantToDelete && (
        <ConfirmDeleteModal
          isOpen={!!tenantToDelete}
          onClose={() => setTenantToDelete(null)}
          onConfirm={confirmDelete}
          title={language === "ar" ? "حذف حساب المستأجر" : "Delete Tenant Profile"}
          itemName={language === "ar" ? tenantToDelete.nameAr : tenantToDelete.nameEn}
          itemCode={tenantToDelete.code}
          itemType={language === "ar" ? "مستأجر" : "Tenant"}
          entityType="TENANT"
          entityId={tenantToDelete.id}
          statusAtDeletion={tenantToDelete.status}
        />
      )}

      {/* Emirates ID Scanner Modal */}
      <SmartDocumentCaptureModal
        isOpen={isEidModalOpen}
        onClose={() => setIsEidModalOpen(false)}
        documentType="EMIRATES_ID"
        onApprove={(result, imageBase64, mimeType, saveToArchive) => {
          if (result.emiratesIdNumber?.value) {
            setEmiratesId(String(result.emiratesIdNumber.value).trim());
          }
          if (result.arabicName?.value) {
            const arVal = String(result.arabicName.value).trim();
            setFullNameAr(arVal);
            setNameAr(arVal);
            setIsNameArGenerated(false);
          }
          if (result.englishName?.value || result.fullName?.value) {
            const enVal = String(result.englishName?.value || result.fullName?.value).trim();
            setFullNameEn(enVal);
            setNameEn(enVal);
            setIsNameEnGenerated(false);
          }
          if (result.dateOfBirth?.value) setDateOfBirth(String(result.dateOfBirth.value).trim());
          if (result.gender?.value) setGender(String(result.gender.value).trim());
          if (result.cardNumber?.value) setCardNumber(String(result.cardNumber.value).trim());
          if (result.issueDate?.value) setIssueDate(String(result.issueDate.value).trim());
          if (result.expiryDate?.value) setExpiryDate(String(result.expiryDate.value).trim());
          if (result.nationality?.value) setNationality(String(result.nationality.value).trim());
          
          setVerificationStatus("OCR_EXTRACTED");
          setIdentitySource("AI_SMART_CAPTURE");
          setCaptureDate(new Date().toISOString().split("T")[0]);
          setReaderInformation("Gemini Multimodal OCR Intelligence");

          if (saveToArchive) {
            setSmartCaptureArchiveDoc({ base64: imageBase64, mime: mimeType });
          } else {
            setSmartCaptureArchiveDoc(null);
          }
          
          setIsEidModalOpen(false);
        }}
      />
    </div>
  );
};
