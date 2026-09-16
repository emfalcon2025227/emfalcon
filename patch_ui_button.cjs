const fs = require('fs');
let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

const regexBtn = /<button\s*onClick=\{handleRunDiagnostics\}\s*disabled=\{runningDiagnostics\}\s*className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all"\s*>\s*<RefreshCw className=\{`w-4 h-4 \$\{runningDiagnostics \? "animate-spin" : ""\}`\} \/>\s*<span>تشغيل التشخيص \(Run Diagnostic\)<\/span>\s*<\/button>/m;

const replacementBtn = `<button
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <RefreshCw className={\`w-4 h-4 \${runningDiagnostics ? "animate-spin" : ""}\`} />
              <span>تشغيل التشخيص (Run Diagnostic)</span>
            </button>

            <button
              onClick={() => {
                prompt("لفتح مجلد بدء التشغيل في ويندوز، انسخ المسار التالي وافتحه في Run (Win + R):", "shell:startup");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <HardDrive className="w-4 h-4" />
              <span>فتح مجلد بدء التشغيل (Open Startup Folder)</span>
            </button>`;

file = file.replace(regexBtn, replacementBtn);

fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Patched CentralSystemConfigCenter.");
