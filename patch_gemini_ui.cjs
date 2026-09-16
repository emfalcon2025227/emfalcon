const fs = require('fs');
let file = fs.readFileSync('src/components/admin/CentralSystemConfigCenter.tsx', 'utf8');

const regexInput = /<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">\s*مفتاح واجهة الذكاء الاصطناعي \(GEMINI_API_KEY\)\s*<\/label>\s*<input\s*type="password"\s*value=\{formData\.geminiApiKey\}\s*onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, geminiApiKey: e\.target\.value \}\)\}\s*placeholder="AIzaSy\.\.\. \(اترك فارغاً للاحتفاظ بالسر الحالي\)"\s*className="w-full text-xs font-mono p-2\.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"\s*\/>/m;

const replacementInput = `<label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    مفتاح واجهة الذكاء الاصطناعي (GEMINI_API_KEY)
                  </label>
                  <div className="w-full text-xs font-mono p-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg">
                    [Managed by Server Environment] تدار من قبل بيئة الخادم ولا يمكن حفظها من هنا
                  </div>`;

file = file.replace(regexInput, replacementInput);
fs.writeFileSync('src/components/admin/CentralSystemConfigCenter.tsx', file);
console.log("Patched Gemini UI in modal.");
