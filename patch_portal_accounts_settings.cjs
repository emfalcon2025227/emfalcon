const fs = require('fs');
let code = fs.readFileSync('src/components/settings/PortalAccountsSettings.tsx', 'utf8');

code = code.replace(/export const PortalAccountsSettings: React.FC<\{ portalRole: "OWNER" \| "TENANT" \}> = \(\{ portalRole \}\) => \{/, `export const PortalAccountsSettings: React.FC = () => {
  const [portalRoleFilter, setPortalRoleFilter] = useState<"ALL" | "OWNER" | "TENANT">("ALL");
`);

code = code.replace(/if \(portalRole === "OWNER"\) \{[\s\S]*?\} else \{[\s\S]*?\}/, `await syncPortalAccounts(owners, tenants);`);

// Need to fix target items mapping
// It currently uses portalRole to filter items:
code = code.replace(/const targetItems = useMemo\(\(\) => \{[\s\S]*?return filtered;/m, `const targetItems = useMemo(() => {
    let baseItems: any[] = [];
    if (portalRoleFilter === "ALL") {
      baseItems = [...owners.map(o => ({ ...o, _role: "OWNER" })), ...tenants.map(t => ({ ...t, _role: "TENANT" }))];
    } else if (portalRoleFilter === "OWNER") {
      baseItems = owners.map(o => ({ ...o, _role: "OWNER" }));
    } else {
      baseItems = tenants.map(t => ({ ...t, _role: "TENANT" }));
    }
    
    let filtered = baseItems.filter(item => {
      const matchSearch = item.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.email || "").toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      
      const info = getPortalAccountInfo(item.id, item._role as "OWNER" | "TENANT", item.email);
      if (statusFilter !== "ALL") {
        return info.status === statusFilter;
      }
      return true;
    });
    
    return filtered;`);

fs.writeFileSync('src/components/settings/PortalAccountsSettings.tsx', code);
