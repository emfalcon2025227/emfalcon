const fs = require('fs');
let code = fs.readFileSync('src/components/settings/PortalAccountsSettings.tsx', 'utf8');

// Fix 1: Type overlap comparison. `info.status` might not be able to equal "INVALID_EMAIL" since it's `PortalAccountStatus`. We can cast it.
code = code.replace(
  /const isInvalid = info\.status === "INVALID_EMAIL";/g,
  'const isInvalid = !email || !email.includes("@");'
);

code = code.replace(
  /const order = \{ INVALID_EMAIL: 0, NOT_PROVISIONED: 1, PENDING_ACTIVATION: 2, SUSPENDED: 3, ACTIVE: 4, UNKNOWN: 5 \};/g,
  'const order: Record<string, number> = { NOT_PROVISIONED: 1, PENDING_ACTIVATION: 2, SUSPENDED: 3, ACTIVE: 4, UNKNOWN: 5 };'
);

code = code.replace(
  /\(order\[a\.info\.status as keyof typeof order\] \?\? 99\)/g,
  '(order[a.info.status as string] ?? 99)'
);
code = code.replace(
  /\(order\[b\.info\.status as keyof typeof order\] \?\? 99\)/g,
  '(order[b.info.status as string] ?? 99)'
);

// Fix 2: Badge variants
code = code.replace(
  /isInvalid \? "destructive" : isNotProvisioned \? "outline" : isSuspended \? "destructive" : isPending \? "warning" : "success"/g,
  'isInvalid ? "danger" : isNotProvisioned ? "default" : isSuspended ? "danger" : isPending ? "warning" : "success"'
);

// Fix 3: info.message
code = code.replace(
  /<span className="opacity-90">\{info\.message\}<\/span>/g,
  '<span className="opacity-90">{language === "ar" ? "البريد الإلكتروني غير صالح أو غير مكتمل" : "The email address is invalid or incomplete"}</span>'
);

fs.writeFileSync('src/components/settings/PortalAccountsSettings.tsx', code);
