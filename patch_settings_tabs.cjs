const fs = require('fs');
let code = fs.readFileSync('src/components/settings/SettingsView.tsx', 'utf8');

code = code.replace(/"TENANT_ACCOUNTS" \| "OWNER_ACCOUNTS"/, `"PORTAL_ACCOUNTS"`);

code = code.replace(/<button\s+onClick=\{\(\) => setActiveTab\("TENANT_ACCOUNTS"\)\}[\s\S]*?<\/button>/, `
        <button
          onClick={() => setActiveTab("PORTAL_ACCOUNTS")}
          className={\`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 \${
            activeTab === "PORTAL_ACCOUNTS"
              ? "bg-amber-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50"
          }\`}
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>{language === "ar" ? "حسابات البوابات (الملاك والمستأجرين)" : "Portal Accounts (Owners & Tenants)"}</span>
        </button>
`);

code = code.replace(/<button\s+onClick=\{\(\) => setActiveTab\("OWNER_ACCOUNTS"\)\}[\s\S]*?<\/button>/, ``);

code = code.replace(/\{activeTab === "TENANT_ACCOUNTS" && <PortalAccountsSettings portalRole="TENANT" \/>\}/, `{activeTab === "PORTAL_ACCOUNTS" && <PortalAccountsSettings />}`);
code = code.replace(/\{activeTab === "OWNER_ACCOUNTS" && <PortalAccountsSettings portalRole="OWNER" \/>\}/, ``);

fs.writeFileSync('src/components/settings/SettingsView.tsx', code);
