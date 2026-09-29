import React from "react";
import { useData } from "../../context/DataContext";
import { CompanyLetterheadTemplate } from "../../types";

interface CompanyLetterheadFrameProps {
  children: React.ReactNode;
  showLetterhead?: boolean;
  className?: string;
  customLetterhead?: CompanyLetterheadTemplate | null;
}

export const CompanyLetterheadFrame: React.FC<CompanyLetterheadFrameProps> = ({
  children,
  showLetterhead = true,
  className = "",
  customLetterhead,
}) => {
  const { activeLetterheadTemplate, companyProfile } = useData();

  const letterhead =
    customLetterhead !== undefined
      ? customLetterhead
      : activeLetterheadTemplate ||
        (companyProfile?.letterheadTemplates || []).find((t) => t.isActive);

  if (!showLetterhead || !letterhead || !letterhead.fileUrl) {
    return <div className={`relative ${className}`}>{children}</div>;
  }

  const isImage =
    !letterhead.fileType ||
    (letterhead.fileType || "").toLowerCase().includes("png") ||
    (letterhead.fileType || "").toLowerCase().includes("jpg") ||
    (letterhead.fileType || "").toLowerCase().includes("jpeg") ||
    (letterhead.fileType || "").toLowerCase().includes("image") ||
    (letterhead.fileUrl || "").startsWith("data:image/") ||
    (letterhead.fileUrl || "").startsWith("blob:") ||
    !(letterhead.fileType || "").toLowerCase().includes("pdf");

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Printable Background Letterhead Layer */}
      {isImage && (
        <div className="absolute inset-0 z-0 pointer-events-none select-none print:absolute print:inset-0 print:w-full print:h-full">
          <img
            src={letterhead.fileUrl}
            alt="Company Letterhead Background"
            className="w-full h-full object-fill opacity-95"
          />
        </div>
      )}

      {/* Document Content Layer */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export const useCompanyLetterhead = () => {
  const { activeLetterheadTemplate, companyProfile } = useData();
  const activeTemplate =
    activeLetterheadTemplate ||
    (companyProfile?.letterheadTemplates || []).find((t) => t.isActive);

  return {
    activeLetterhead: activeTemplate,
    hasActiveLetterhead: !!activeTemplate && !!activeTemplate.fileUrl,
    logoUrl: companyProfile?.logoUrl || companyProfile?.logoBase64 || companyProfile?.logo,
  };
};
