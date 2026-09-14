const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

// 1. Remove auto-creation in Google sign in
code = code.replace(
  /\} else \{\n\s*const userEmail = \(fUser\.email \|\| ""\)\.toLowerCase\(\);\n\s*const newGoogleUser: User = \{[\s\S]*?setUsers\(prev => \[\.\.\.prev, newGoogleUser\]\);\n\s*setLoadingAuth\(false\);\n\s*return \{ success: true \};\n\s*\}/,
  `} else {
        setLoadingAuth(false);
        return { success: false, error: "تم التحقق من بيانات الدخول، لكن لم يتم العثور على ملف تعريف مرتبط بهذا البريد الإلكتروني" };
      }`
);

fs.writeFileSync('src/context/AuthContext.tsx', code);
