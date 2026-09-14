const fs = require('fs');
let code = fs.readFileSync('src/components/settings/PortalAccountsSettings.tsx', 'utf8');

// Replace accountRows logic
code = code.replace(/const accountRows = useMemo\(\(\) => \{[\s\S]*?\}, \[owners, tenants, portalRole, users\]\);/, `
  const accountRows = useMemo(() => {
    let combined = [];
    if (portalRoleFilter === "ALL" || portalRoleFilter === "OWNER") {
      owners.forEach(o => combined.push({ record: o, portalRole: "OWNER" as const, email: o.email }));
    }
    if (portalRoleFilter === "ALL" || portalRoleFilter === "TENANT") {
      tenants.forEach(t => combined.push({ record: t, portalRole: "TENANT" as const, email: t.email }));
    }
    return combined.map((item) => {
      const info = getPortalAccountInfo(item.record.id, item.portalRole, item.email);
      return { ...item, info };
    }).sort((a, b) => {
      const order: Record<string, number> = { NOT_PROVISIONED: 1, PENDING_ACTIVATION: 2, SUSPENDED: 3, ACTIVE: 4, UNKNOWN: 5 };
      return (order[a.info.status as string] ?? 99) - (order[b.info.status as string] ?? 99);
    });
  }, [owners, tenants, portalRoleFilter, users, getPortalAccountInfo]);
`);

// Replace handleSendActivation references to portalRole
code = code.replace(/const handleSendActivation = async \(targetId: string, name: string, email: string\) => \{/, `const handleSendActivation = async (targetId: string, name: string, email: string, portalRole: "OWNER" | "TENANT") => {`);

// In the render of handleSendActivation
code = code.replace(/handleSendActivation\(row\.record\.id, row\.record\.nameAr \|\| row\.record\.nameEn, row\.email\)/g, `handleSendActivation(row.record.id, row.record.nameAr || row.record.nameEn, row.email, row.portalRole)`);

// Replace handleEditEmail references to portalRole
code = code.replace(/const handleEditEmail = async \(e: React\.FormEvent\) => \{[\s\S]*?const isOwner = portalRole === "OWNER";/m, `const handleEditEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmailTarget) return;
    setEditError(null);
    if (!editEmail || !editEmail.includes("@")) {
      setEditError("بريد إلكتروني غير صالح");
      return;
    }
    const cleanEmail = editEmail.trim().toLowerCase();
    
    // determine role
    const isOwner = editingEmailTarget.id.startsWith("own-") || editingEmailTarget.id.startsWith("OWN-");
`);

// Add role filter UI
code = code.replace(/<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">/m, `<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setPortalRoleFilter("ALL")} className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-all \${portalRoleFilter === "ALL" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}\`}>الكل</button>
          <button onClick={() => setPortalRoleFilter("OWNER")} className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-all \${portalRoleFilter === "OWNER" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}\`}>الملاك</button>
          <button onClick={() => setPortalRoleFilter("TENANT")} className={\`px-3 py-1.5 text-xs font-bold rounded-md transition-all \${portalRoleFilter === "TENANT" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}\`}>المستأجرين</button>
        </div>`);

// Display Role Badge in table
code = code.replace(/<td className="p-3 text-start">/m, `<td className="p-3 text-start">
                      <div className="mb-1">
                        <Badge variant={row.portalRole === "OWNER" ? "indigo" : "teal"}>{row.portalRole === "OWNER" ? "مالك" : "مستأجر"}</Badge>
                      </div>`);

// Also change the handleSendActivation where it references portalRole
code = code.replace(/const provRes = await provisionPortalAccount\(\{[\s\S]*?portalRole,[\s\S]*?targetId,/, `const provRes = await provisionPortalAccount({
        portalRole,
        targetId,`);

fs.writeFileSync('src/components/settings/PortalAccountsSettings.tsx', code);
