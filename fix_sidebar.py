import re

with open('src/components/common/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = 'import { useCloudConnectivity } from "../../context/CloudConnectivityContext";\n'

# Insert it after the first import block
content = re.sub(r'import \{[^}]*\} from "lucide-react";', r'\g<0>\n' + import_statement, content)

# Inject cloudState
content = content.replace(
    "const { currentUser, isTenantMode, loginMode } = useDataContext();",
    "const { currentUser, isTenantMode, loginMode } = useDataContext();\n  const cloudState = useCloudConnectivity();"
)

status_block = """
        <div className="p-4 border-t border-slate-200/60 shrink-0">
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-700">
              {language === "ar" ? "حالة اتصال النظام" : "System Connection"}
            </span>
            {cloudState === "ONLINE" && (
              <span className="flex items-center gap-2 text-emerald-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                {language === "ar" ? "متصل بالسحابة" : "Cloud Online"}
              </span>
            )}
            {cloudState === "OFFLINE" && (
              <span className="flex flex-col text-rose-600 font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                  {language === "ar" ? "غير متصل بالسحابة" : "Cloud Offline"}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  {language === "ar" ? "وضع القراءة فقط" : "Read-Only Mode"}
                </span>
              </span>
            )}
            {cloudState === "RECONNECTING" && (
              <span className="flex items-center gap-2 text-amber-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 animate-pulse"></span>
                {language === "ar" ? "جارٍ إعادة الاتصال..." : "Reconnecting..."}
              </span>
            )}
          </div>
        </div>
"""

content = content.replace(
    "        </div>\n      </aside>",
    f"        </div>\n{status_block}      </aside>"
)

with open('src/components/common/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
