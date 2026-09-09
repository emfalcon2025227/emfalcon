import React, { useState, useRef } from "react";
import { Plus, Search, Building2, Phone, Mail, CreditCard, Edit2, ShieldCheck, Trash2, FileSpreadsheet, Upload, FileText, X, ExternalLink, Sparkles, Languages, Percent, Eye, RefreshCw, Lock } from "lucide-react";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { Owner, ElectronicArchiveItem } from "../../types";
import { Modal } from "../common/Modal";
import { Badge } from "../common/Badge";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";
import { SearchableSelect } from "../common/SearchableSelect";
import { DraggableWrapper } from "../common/DraggableWrapper";
import { matchAnyArabicSearch, normalizeArabicText } from "../../utils/arabicTextNormalizer";
import { Owner360Workspace } from "./Owner360Workspace";
import { getBilingualSuggestion, getLocalBilingualSuggestion } from "../../utils/bilingualNaming";
import { SmartDocumentCaptureModal } from "../ai/SmartDocumentCaptureModal";
import { DocumentPreviewModal } from "../common/DocumentPreviewModal";


export const OwnersView: React.FC = () => {
  const { t, language } = useLanguage();
  const { owners, properties, units, addOwner, updateOwner, deleteOwner, importOwnersBatch, archive, addArchiveItem, deleteArchiveItem, uploadAndArchiveDocument, getNextOwnerCode } = useData();
  const { hasPermission, currentUser, provisionPortalAccount, getPortalAccountInfo } = useAuth();
  
  const canDelete = hasPermission("DELETE_RECORDS");
  const [selected360OwnerId, setSelected360OwnerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ownerFileInputRef = useRef<HTMLInputElement>(null);
  const [tempRecordId, setTempRecordId] = useState("");
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [previewDocument, setPreviewDocument] = useState<ElectronicArchiveItem | null>(null);

  const currentRecordId = editingOwner ? editingOwner.id : tempRecordId;
  const attachedDocs = archive.filter((a) => a.recordId === currentRecordId || a.entityId === currentRecordId);




  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);

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
            joined.includes("مالك") ||
            joined.includes("owner") ||
            joined.includes("هاتف") ||
            joined.includes("phone") ||
            joined.includes("mobile") ||
            joined.includes("جوال") ||
            joined.includes("code") ||
            joined.includes("كود") ||
            joined.includes("هوية") ||
            joined.includes("id")
          ) {
            headerRowIndex = r;
            break;
          }
        }

        const data = XLSX.utils.sheet_to_json<any>(ws, { range: headerRowIndex, defval: "" });

        // Helper normalizers
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
        const seenInFileNames = new Set<string>();

        const parsedRows = data
          .map((row, index) => {
            const nameAr = getRowVal(row, [
              "NameAr",
              "nameAr",
              "Name_Ar",
              "اسم المالك",
              "الاسم بالعربي",
              "الاسم العربي",
              "اسم العميل",
              "الاسم التجاري",
              "المالك",
              "الاسم",
              "Name",
              "Arabic Name",
            ]);
            const nameEn = getRowVal(row, [
              "NameEn",
              "nameEn",
              "Name_En",
              "English Name",
              "Owner Name",
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

            const finalNameAr = nameAr || nameEn || firstCell || (language === "ar" ? `مالك ${index + 1}` : `Owner ${index + 1}`);
            const finalNameEn = nameEn || nameAr || finalNameAr;

            const code =
              getRowVal(row, ["Code", "code", "الكود", "كود المالك", "رمز المالك", "رقم المالك", "Owner ID", "Owner Code"]) ||
              `OWN-${Date.now() % 10000}`;

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

            const trn = getRowVal(row, [
              "TRN",
              "trn",
              "TaxRegNo",
              "taxRegNo",
              "رقم ضريبي",
              "الرقم الضريبي",
              "رقم التسجيل الضريبي",
            ]);

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

            const bankName = getRowVal(row, ["BankName", "bankName", "Bank", "البنك", "اسم البنك", "المصرف", "اسم المصرف"]);
            const iban = getRowVal(row, ["IBAN", "iban", "الآيبان", "الايبان", "رقم الآيبان", "رقم الحساب الدولي"]);
            const accountNumber = getRowVal(row, ["AccountNumber", "accountNumber", "رقم الحساب", "الحساب", "Account No", "Account"]);
            const notes = getRowVal(row, ["Notes", "notes", "ملاحظات", "بيان", "الوصف", "Remark", "Remarks"]);

            const normEId = normalizeId(emiratesId);
            const normCd = normalizeTxt(code);
            const normPh = normalizePh(phone);
            const normNAr = normalizeTxt(finalNameAr);
            const normNEn = normalizeTxt(finalNameEn);

            // Check if matches an existing owner in DB
            const matchedOwner = owners.find((o) => {
              const matchId = normEId && normEId.length >= 8 && normalizeId(o.emiratesId) === normEId;
              const matchPhone = normPh && normPh.length >= 8 && normalizePh(o.phone) === normPh;
              const matchNameAr = normNAr && normNAr.length >= 3 && normalizeTxt(o.nameAr) === normNAr;
              const matchNameEn = normNEn && normNEn.length >= 3 && normalizeTxt(o.nameEn) === normNEn;
              return matchId || matchPhone || matchNameAr || matchNameEn;
            });

            // Check if duplicate within the same uploaded file (only for real non-empty identifiers)
            let isDuplicateInFile = false;
            if (normEId && normEId.length >= 8) {
              if (seenInFileEIds.has(normEId)) isDuplicateInFile = true;
              seenInFileEIds.add(normEId);
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
              emiratesId,
              trn,
              email,
              phone,
              bankName,
              iban,
              accountNumber,
              status: "ACTIVE",
              notes,
              selected: true,
              isExisting: !!matchedOwner,
              matchedOwnerName: matchedOwner ? (language === "ar" ? matchedOwner.nameAr : matchedOwner.nameEn) : undefined,
              matchedOwnerCode: matchedOwner?.code,
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

  const confirmImportOwners = async () => {
    const selectedRows = importPreviewRows.filter(r => r.selected);
    if (selectedRows.length === 0) return;

    setIsImporting(true);
    try {
      const res = await importOwnersBatch(selectedRows.map(row => ({
        code: row.code,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        emiratesId: row.emiratesId,
        trn: row.trn,
        email: row.email,
        phone: row.phone,
        bankName: row.bankName,
        iban: row.iban,
        accountNumber: row.accountNumber,
        status: row.status,
        notes: row.notes,
      })));

      setIsImportPreviewOpen(false);
      setImportPreviewRows([]);
      setImportFeedback({
        message: language === "ar" 
          ? `تم الاستيراد بنجاح دون أي تكرار! (${res.importedCount} مالك جديد، وتحديث ${res.updatedCount} مالك مسجل)`
          : `Successfully imported without duplication! (${res.importedCount} new owners, ${res.updatedCount} existing owners updated)`,
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

  const downloadOwnerTemplate = () => {
    const templateData = [
      {
        "Code": "OWN-101",
        "NameAr": "شركة العقارات الفاخرة",
        "NameEn": "Luxury Real Estate LLC",
        "EmiratesId": "784-1980-1234567-1",
        "TRN": "100123456700003",
        "Email": "owner@example.ae",
        "Phone": "+971501234567",
        "BankName": "Abu Dhabi Commercial Bank (ADCB)",
        "IBAN": "AE090240001234567890123",
        "AccountNumber": "1122334455",
        "Notes": "مثال توضيحي - قم بحذف هذا السطر قبل الاستيراد"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OwnersTemplate");
    XLSX.writeFile(wb, "Owners_Import_Template.xlsx");
  };

  const handleDelete = (owner: Owner) => {
    setOwnerToDelete(owner);
  };

  const confirmDelete = (options?: { keepAttachments?: boolean; reason?: string }) => {
    if (ownerToDelete) {
      deleteOwner(ownerToDelete.id, options);
      setOwnerToDelete(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [emiratesId, setEmiratesId] = useState("");
  const [trn, setTrn] = useState("");
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [specialAdminFeeRate, setSpecialAdminFeeRate] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // Emirates ID Verification State
  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [identitySource, setIdentitySource] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [captureDate, setCaptureDate] = useState("");
  const [readerInformation, setReaderInformation] = useState("");
  const [isEidModalOpen, setIsEidModalOpen] = useState(false);

  const [smartCaptureArchiveDoc, setSmartCaptureArchiveDoc] = useState<{ base64: string, mime: string } | null>(null);
  const [isUploadingOwnerDoc, setIsUploadingOwnerDoc] = useState(false);


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

  const handleOwnerFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingOwnerDoc) return;

    setIsUploadingOwnerDoc(true);
    setSmartCaptureArchiveDoc(null);

    try {
      await uploadAndArchiveDocument(file, {
        category: "OWNERS",
        entityType: "OWNER",
        entityId: currentRecordId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        uploadedByUserId: currentUser?.id || "u-1",
        uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
        tags: ["owner", "id", "attachment"],
      });
      if (ownerFileInputRef.current) ownerFileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload failed", err);
      alert(language === "ar" ? "فشل رفع المستند" : "Document upload failed");
    } finally {
      setIsUploadingOwnerDoc(false);
    }
  };

  const filteredOwners = owners.filter((o) => {
    if (!searchTerm.trim()) return true;
    return matchAnyArabicSearch(
      [o.nameEn, o.nameAr, o.code, o.phone, o.email, o.emiratesId, o.tradeLicenseNo, o.bankName, o.accountNumber, o.trn],
      searchTerm
    );
  });

  const handleOpenAdd = () => {
    setEditingOwner(null);
    setSmartCaptureArchiveDoc(null);
    setCode(getNextOwnerCode());
    setTempRecordId("temp-" + Date.now());
    setNameEn("");
    setNameAr("");
    setEmiratesId("");
    setTrn("");
    setTradeLicenseNo("");
    setEmail("");
    setPhone("+971");
    setBankName("Abu Dhabi Commercial Bank (ADCB)");
    setIban("AE");
    setAccountNumber("");
    setSpecialAdminFeeRate("");
    setNotes("");
    setFullNameAr("");
    setFullNameEn("");
    setDateOfBirth("");
    setGender("");
    setNationality("");
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

  const handleOpenEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setSmartCaptureArchiveDoc(null);
    setCode(owner.code);
    setTempRecordId(owner.id);
    setNameEn(owner.nameEn);
    setNameAr(owner.nameAr);
    setEmiratesId(owner.emiratesId);
    setTrn(owner.trn || "");
    setTradeLicenseNo(owner.tradeLicenseNo || "");
    setEmail(owner.email);
    setPhone(owner.phone);
    setBankName(owner.bankName);
    setIban(owner.iban);
    setAccountNumber(owner.accountNumber);
    setSpecialAdminFeeRate(owner.specialAdminFeeRate !== undefined ? owner.specialAdminFeeRate : "");
    setNotes(owner.notes || "");
    setFullNameAr(owner.fullNameAr || "");
    setFullNameEn(owner.fullNameEn || "");
    setDateOfBirth(owner.dateOfBirth || "");
    setGender(owner.gender || "");
    setNationality(owner.nationality || "");
    setCardNumber(owner.cardNumber || "");
    setIssueDate(owner.issueDate || "");
    setExpiryDate(owner.expiryDate || "");
    setIdentitySource(owner.identitySource || "");
    setVerificationStatus(owner.verificationStatus || "");
    setCaptureDate(owner.captureDate || "");
    setReaderInformation(owner.readerInformation || "");
    setIsNameEnGenerated(false);
    setIsNameArGenerated(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trn.trim() && !/^\d{15}$/.test(trn.trim())) {
      alert(language === "ar" ? "رقم التسجيل الضريبي TRN يجب أن يكون 15 رقماً بالضبط (مثال: 100123456700003)" : "TRN must be exactly 15 numeric digits (e.g. 100123456700003)");
      return;
    }
    const trnVal = trn.trim() ? trn.trim() : undefined;
    if (editingOwner) {
      updateOwner(editingOwner.id, {
        code,
        nameEn,
        nameAr,
        emiratesId,
        trn: trnVal,
        tradeLicenseNo,
        email,
        phone,
        bankName,
        iban,
        accountNumber,
        specialAdminFeeRate: specialAdminFeeRate === "" ? undefined : Number(specialAdminFeeRate),
        notes,
        fullNameAr,
        fullNameEn,
        dateOfBirth,
        gender,
        nationality,
        cardNumber,
        issueDate,
        expiryDate,
        identitySource: identitySource as any,
        verificationStatus: verificationStatus as any,
        captureDate,
        readerInformation,
      });
      provisionPortalAccount({
        portalRole: "OWNER",
        targetId: editingOwner.id,
        email,
        nameEn,
        nameAr,
        phone,
      });
    } else {
      
      const newOwner = addOwner({
        code,
        nameEn,
        nameAr,
        emiratesId,
        trn: trnVal,
        tradeLicenseNo,
        email,
        phone,
        bankName,
        iban,
        accountNumber,
        status: "ACTIVE",
        specialAdminFeeRate: specialAdminFeeRate === "" ? undefined : Number(specialAdminFeeRate),
        notes,
        fullNameAr,
        fullNameEn,
        dateOfBirth,
        gender,
        nationality,
        cardNumber,
        issueDate,
        expiryDate,
        identitySource: identitySource as any,
        verificationStatus: verificationStatus as any,
        captureDate,
        readerInformation,
      });
      if (newOwner) {
        provisionPortalAccount({
          portalRole: "OWNER",
          targetId: newOwner.id,
          email,
          nameEn,
          nameAr,
          phone,
        });
      }
      if (newOwner && smartCaptureArchiveDoc) {
        await uploadAndArchiveDocument(smartCaptureArchiveDoc.base64, {
          category: "EMIRATES_ID",
          entityType: "OWNER",
          entityId: newOwner.id,
          fileName: `EID_${newOwner.emiratesId}`,
          mimeType: smartCaptureArchiveDoc.mime,
          uploadedByUserId: currentUser?.id || "u-1",
          uploadedByName: currentUser?.nameAr || currentUser?.username || "Admin",
          tags: ["EMIRATES_ID", "OCR", "SMART_CAPTURE"],
        });
      }
      setSmartCaptureArchiveDoc(null);

    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Import Notification Banner */}
      {importFeedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
          importFeedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>{importFeedback.message}</span>
          </div>
          <button 
            onClick={() => setImportFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t("navOwners")}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "ar"
              ? "إدارة حسابات ملاك العقارات، الحسابات المصرفية، وصكوك الملكية"
              : "Manage property owners, corporate portfolios, and bank details"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <DraggableWrapper formId="OWNERS" elementId="btn-excel-template">
            <button
              onClick={downloadOwnerTemplate}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              title={language === "ar" ? "تحميل نموذج إكسل فارغ" : "Download Excel Template"}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span>{language === "ar" ? "تحميل نموذج إكسل" : "Excel Template"}</span>
            </button>
          </DraggableWrapper>

          <DraggableWrapper formId="OWNERS" elementId="btn-import-excel">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{language === "ar" ? "استيراد من إكسل" : "Import Excel"}</span>
            </button>
          </DraggableWrapper>

          <DraggableWrapper formId="OWNERS" elementId="btn-add-owner">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ar" ? "إضافة مالك جديد" : "Add New Owner"}</span>
            </button>
          </DraggableWrapper>
        </div>
      </div>

      {/* Search Bar */}
      <DraggableWrapper formId="OWNERS" elementId="search-bar">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "ar" ? "بحث بالاسم، الكود، الهاتف، أو البريد..." : "Search by name, code, phone, or email..."}
              className="w-full ps-10 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-hidden transition-all text-slate-800"
            />
          </div>
        </div>
      </DraggableWrapper>

      {/* Owners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOwners.map((owner) => {
          const ownerProperties = properties.filter((p) => p.ownerId === owner.id);
          const ownerUnitsCount = ownerProperties.reduce((sum, p) => sum + p.totalUnits, 0);
          const portalInfo = getPortalAccountInfo(owner.id, "OWNER", owner.email);

          return (
            <DraggableWrapper key={owner.id} formId="OWNERS" elementId={`card-${owner.id}`}>
              <div
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                        {owner.code}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${portalInfo.statusColorClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{language === "ar" ? portalInfo.statusLabelAr : portalInfo.statusLabelEn}</span>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">
                      {language === "ar" ? owner.nameAr : owner.nameEn}
                    </h3>
                    <p className="text-xs text-slate-500">{language === "ar" ? owner.nameEn : owner.nameAr}</p>
                  </div>

                  <Badge variant="success" size="sm">
                    {t("activeStatus")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong className="text-slate-800">{ownerProperties.length}</strong> {t("navProperties")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong className="text-slate-800">{ownerUnitsCount}</strong> {t("navUnits")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{owner.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{owner.email}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-700">{language === "ar" ? "رقم التسجيل الضريبي (TRN)" : "TRN"}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-900 shrink-0">
                    {owner.trn || (language === "ar" ? "غير مسجل" : "Not Registered")}
                  </span>
                </div>

                <div className="mt-3 text-xs bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-700 truncate">{owner.bankName}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-900 shrink-0">
                    {owner.iban.substring(0, 8)}...{owner.iban.substring(owner.iban.length - 4)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => setSelected360OwnerId(owner.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/70 transition-colors cursor-pointer"
                >
                  <span>360° {language === "ar" ? "لوحة المالك" : "Workspace"}</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(owner)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t("edit")}</span>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(owner)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                      title={language === "ar" ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DraggableWrapper>
        );
      })}
      </div>

      {filteredOwners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">{t("noDataFound")}</p>
        </div>
      )}

      {/* Add / Edit Owner Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingOwner ? (language === "ar" ? "تعديل بيانات المالك" : "Edit Owner") : (language === "ar" ? "إضافة مالك جديد" : "Add Owner")}
        subtitle={language === "ar" ? "تسجيل بيانات المالك والحسابات البنكية المعتمدة مع معاينة فورية" : "Owner identity and registered bank accounts with live compiled preview"}
        icon={<Building2 className="w-5 h-5" />}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Live Compiled Owner Information Text Box */}
          <div className="p-4 bg-amber-50/80 border-2 border-amber-300/80 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <Building2 className="w-4 h-4 text-amber-700" />
              <span>
                {language === "ar"
                  ? "📋 معلومات مجمعة عن المالك (معاينة فورية للبيانات المدخلة):"
                  : "📋 Compiled Owner Summary & Live Preview:"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs text-amber-950 bg-white p-3.5 rounded-xl border border-amber-200">
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "كود المالك:" : "Code:"}</span>
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
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم الهاتف:" : "Phone:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={phone || "—"}>{phone || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الهوية الوطنية / الرخصة:" : "Emirates ID / License:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={emiratesId || tradeLicenseNo || "—"}>
                  {emiratesId || tradeLicenseNo || "—"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "الجنسية:" : "Nationality:"}</span>
                <strong className="text-amber-950">{nationality || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "البنك المعتمد:" : "Bank:"}</span>
                <strong className="text-amber-950 truncate block" title={bankName || "—"}>{bankName || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "رقم الآيبان (IBAN):" : "IBAN:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={iban || "—"}>{iban || "—"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "عمولة الإدارة:" : "Mgmt Fee:"}</span>
                <strong className="text-amber-950">{specialAdminFeeRate !== "" ? `${specialAdminFeeRate}%` : "افتراضية (حسب العقد)"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-amber-800/80 block">{language === "ar" ? "البريد الإلكتروني:" : "Email:"}</span>
                <strong className="font-mono text-amber-950 truncate block" title={email || "—"}>{email || "—"}</strong>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-code">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "كود المالك" : "Owner Code"} *
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
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-name-ar">
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
                    placeholder="مؤسسة الشيخ سلطان..."
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
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-name-en">
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
                    placeholder="Sheikh Sultan Investments..."
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
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-emirates-id">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === "ar" ? "رقم الهوية الإماراتية" : "Emirates ID"} *
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
                  required
                  value={emiratesId}
                  onChange={(e) => setEmiratesId(e.target.value)}
                  placeholder="784-1975-1234567-1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
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
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-nationality">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الجنسية" : "Nationality"}
                </label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-dob">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-gender">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "الجنس" : "Gender"}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                >
                  <option value="">{language === "ar" ? "غير محدد" : "Unspecified"}</option>
                  <option value="MALE">{language === "ar" ? "ذكر" : "Male"}</option>
                  <option value="FEMALE">{language === "ar" ? "أنثى" : "Female"}</option>
                </select>
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-expiry">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "تاريخ إنتهاء الهوية" : "ID Expiry Date"}
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-trn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم التسجيل الضريبي TRN (15 رقماً)" : "Tax Registration Number (TRN)"}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={trn}
                  onChange={(e) => setTrn(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="100123456700003"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-trade-license">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم الرخصة التجارية" : "Trade License No."}
                </label>
                <input
                  type="text"
                  value={tradeLicenseNo}
                  onChange={(e) => setTradeLicenseNo(e.target.value)}
                  placeholder="CN-1029384"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-email">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "البريد الإلكتروني" : "Email Address"} *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@domain.ae"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
            <DraggableWrapper formId="OWNER_MODAL" elementId="field-phone">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "ar" ? "رقم الهاتف / الموبايل" : "Phone Number"} *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971501234567"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </DraggableWrapper>
          </div>

          {/* Bank Account Section */}
          <DraggableWrapper formId="OWNER_MODAL" elementId="section-bank-account">
            <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-3">
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-700" />
                <span>{language === "ar" ? "البيانات المصرفية وتحويل الإيجارات" : "Bank Account & Rent Remittance"}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t("bankName")} *
                  </label>
                  <SearchableSelect
                    options={[
                      { id: "Abu Dhabi Commercial Bank (ADCB)", label: "Abu Dhabi Commercial Bank (ADCB)" },
                      { id: "Emirates NBD", label: "Emirates NBD" },
                      { id: "First Abu Dhabi Bank (FAB)", label: "First Abu Dhabi Bank (FAB)" },
                      { id: "Dubai Islamic Bank (DIB)", label: "Dubai Islamic Bank (DIB)" },
                      { id: "Mashreq Bank", label: "Mashreq Bank" },
                      { id: "RAKBANK", label: "RAKBANK" },
                      { id: "Commercial Bank of Dubai (CBD)", label: "Commercial Bank of Dubai (CBD)" },
                      { id: "Sharjah Islamic Bank (SIB)", label: "Sharjah Islamic Bank (SIB)" },
                    ]}
                    value={bankName}
                    onChange={(val) => setBankName(val)}
                    placeholder={language === "ar" ? "اختر البنك..." : "Select bank..."}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "رقم الآيبان (IBAN)" : "IBAN"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={iban}
                    onChange={(e) => setIban(e.target.value.toUpperCase())}
                    placeholder="AE090240001122334455667"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "رقم الحساب المصرفي" : "Account Number"}
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1122334455667"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </DraggableWrapper>

          <DraggableWrapper formId="OWNER_MODAL" elementId="field-admin-fee-override">
            <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200/70 space-y-3">
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-indigo-700" />
                <span>{language === "ar" ? "تخصيص نسبة الرسوم الإدارية (اختياري)" : "Special Administrative Fee Rate (Optional)"}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === "ar" ? "النسبة المخصصة لهذا المالك (%)" : "Owner-Specific Rate (%)"}
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
                      ? "* إذا تم تحديد نسبة هنا، فستقوم بتجاوز نسبة الرسوم الإدارية الافتراضية للنظام في كافة عقود هذا المالك." 
                      : "* If set, this rate overrides the system default for all contracts belonging to this owner."}
                  </p>
                </div>
              </div>
            </div>
          </DraggableWrapper>

          <DraggableWrapper formId="OWNER_MODAL" elementId="field-notes">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === "ar" ? "ملاحظات إضافية" : "Notes"}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VIP Investor..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>
          </DraggableWrapper>

          {/* File Attachments Section */}
          <DraggableWrapper formId="OWNER_MODAL" elementId="section-attachments">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {language === "ar" ? "المستندات والملفات المرفقة (الهوية، جواز السفر، الرخصة)" : "Attached Documents & IDs"}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {language === "ar" ? "قم برفق وإرفاق المستندات الخاصة بهذا المالك للأرشيف الآمن" : "Upload ID and related documents for secure archive"}
                  </p>
                </div>
                <input
                  type="file"
                  ref={ownerFileInputRef}
                  onChange={handleOwnerFileAttach}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingOwnerDoc}
                  onClick={() => ownerFileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors shadow-xs ${isUploadingOwnerDoc ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isUploadingOwnerDoc ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingOwnerDoc ? (language === "ar" ? "جاري الرفع والأرشفة..." : "Uploading...") : (language === "ar" ? "تحميل وارفاق ملف" : "Upload & Attach File")}</span>
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

          <DraggableWrapper formId="OWNER_MODAL" elementId="section-actions">
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
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs"
              >
                {t("save")}
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

      {/* Excel Import Preview Modal */}
      {isImportPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {language === "ar" ? "معاينة واختيار بيانات الملاك المستوردة من إكسل" : "Preview & Select Excel Import Owners"}
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
                <div className="text-[10px] text-emerald-600 font-bold">{language === "ar" ? "ملاك جدد (إضافة)" : "New Owners (Add)"}</div>
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
                    <th className="py-3 px-4">رقم الهوية</th>
                    <th className="py-3 px-4">الهاتف</th>
                    <th className="py-3 px-4">البنك / الآيبان</th>
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
                            {row.matchedOwnerName && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {language === "ar" ? `مطابق لـ: ${row.matchedOwnerName}` : `Matches: ${row.matchedOwnerName}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 w-fit">
                            {language === "ar" ? "مالك جديد" : "New Owner"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-700">{row.code}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <div>{row.nameAr}</div>
                        <div className="text-[10px] text-slate-400">{row.nameEn}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">{row.emiratesId}</td>
                      <td className="py-2.5 px-4">{row.phone}</td>
                      <td className="py-2.5 px-4">
                        <div className="text-[11px] font-medium">{row.bankName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{row.iban}</div>
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
                onClick={confirmImportOwners}
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
      {ownerToDelete && (() => {
        const linkedProps = properties.filter((p) => p.ownerId === ownerToDelete.id);
        const linkedUnitsCount = linkedProps.reduce((sum, p) => sum + (units.filter(u => u.propertyId === p.id).length || p.totalUnits), 0);
        return (
          <ConfirmDeleteModal
            isOpen={!!ownerToDelete}
            onClose={() => setOwnerToDelete(null)}
            onConfirm={confirmDelete}
            title={language === "ar" ? "حذف حساب المالك" : "Delete Owner Profile"}
            itemName={language === "ar" ? ownerToDelete.nameAr : ownerToDelete.nameEn}
            itemCode={ownerToDelete.code}
            itemType={language === "ar" ? "مالك عقارات" : "Property Owner"}
            entityType="OWNER"
            entityId={ownerToDelete.id}
            statusAtDeletion={ownerToDelete.status}
            linkedItemsCount={linkedProps.length}
            linkedItemsLabel={language === "ar" ? `عقار مسجل (${linkedUnitsCount} وحدة)` : `properties registered (${linkedUnitsCount} units)`}
          />
        );
      })()}

      {/* Owner 360 Workspace Modal */}
      {selected360OwnerId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 lg:p-6 flex justify-center">
          <div className="w-full max-w-[96vw] 2xl:max-w-full">
            <Owner360Workspace
              ownerId={selected360OwnerId}
              onClose={() => setSelected360OwnerId(null)}
            />
          </div>
        </div>
      )}

      {/* Emirates ID Scanner Modal */}
      <SmartDocumentCaptureModal
        isOpen={isEidModalOpen}
        onClose={() => setIsEidModalOpen(false)}
        documentType="EMIRATES_ID"
        onApprove={(result, imageBase64, mimeType, saveToArchive) => {
          if (result.emiratesIdNumber?.value) setEmiratesId(result.emiratesIdNumber.value);
          if (result.arabicName?.value) setFullNameAr(result.arabicName.value);
          if (result.englishName?.value) setFullNameEn(result.englishName.value);
          if (result.dateOfBirth?.value) setDateOfBirth(result.dateOfBirth.value);
          if (result.gender?.value) setGender(result.gender.value);
          if (result.nationality?.value) setNationality(result.nationality.value);
          if (result.cardNumber?.value) setCardNumber(result.cardNumber.value);
          if (result.issueDate?.value) setIssueDate(result.issueDate.value);
          if (result.expiryDate?.value) setExpiryDate(result.expiryDate.value);
          
          if (!nameEn && result.englishName?.value) setNameEn(result.englishName.value);
          if (!nameAr && result.arabicName?.value) setNameAr(result.arabicName.value);
          
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
