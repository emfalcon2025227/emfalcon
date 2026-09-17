const fs = require('fs');

let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

const targetStr = `        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              نطاق النظام الفعلي (Application Origin)
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
              {matrixData?.origin || (typeof window !== "undefined" ? window.location.origin : "")}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 relative">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                رابط إعادة التوجيه المحسوب (Calculated Callback URI)
              </div>
              <button
                onClick={() =>
                  handleCopyText(
                    matrixData?.calculatedCallbackUri || \`\${window.location.origin}/api/integrations/google-drive/callback\`,
                    "CALLBACK_URI"
                  )
                }
                className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                نسخ
              </button>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all pr-8">
              {matrixData?.calculatedCallbackUri || \`\${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/google-drive/callback\`}
            </div>
          </div>
        </div>`;

const newStr = `        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Application Origin
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
              {matrixData?.origin || (typeof window !== "undefined" ? window.location.origin : "")}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 relative">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Calculated Callback
              </div>
              <button
                onClick={() =>
                  handleCopyText(
                    matrixData?.calculatedCallbackUri || \`\${window.location.origin}/api/integrations/google-drive/callback\`,
                    "CALLBACK_URI"
                  )
                }
                className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                نسخ
              </button>
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all pr-8">
              {matrixData?.calculatedCallbackUri || \`\${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/google-drive/callback\`}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Configured GOOGLE_REDIRECT_URI
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
              {matrixData?.configuredRedirectUri || "NOT_CONFIGURED"}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Match Status
            </div>
            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
              {!matrixData?.configuredRedirectUri ? (
                <span className="text-yellow-600">NOT_CONFIGURED</span>
              ) : matrixData?.configuredRedirectUri === matrixData?.calculatedCallbackUri ? (
                <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> MATCH</span>
              ) : (
                <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> MISMATCH</span>
              )}
            </div>
          </div>
        </div>`;

file = file.replace(targetStr, newStr);
fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Patched UI.");
