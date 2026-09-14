const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

// 1. Remove createUserWithEmailAndPassword from imports
code = code.replace("  createUserWithEmailAndPassword,", "");

// 2. Remove INITIAL_OWNER_USER if it exists
// 3. Prevent resetUserPassword for OWNER and TENANT
code = code.replace(`  const resetUserPassword = (userId: string, newPassword?: string): string => {`, `  const resetUserPassword = (userId: string, newPassword?: string): string => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && (targetUser.role === "OWNER" || targetUser.role === "TENANT")) {
      console.warn("resetUserPassword called for Owner/Tenant. This is forbidden. Use Firebase Secure Reset.");
      return "";
    }`);

// 4. In saveUser, strip password for OWNER and TENANT
code = code.replace(`    // Hash plaintext passwords on save if not already hashed
    if (finalUser.password && finalUser.password.length < 20 && !finalUser.password.endsWith("==") && finalUser.password.length !== 64) {
      finalUser.password = sha256(finalUser.password);
    }`, `    // Do not allow password fields for Owner/Tenant portal authentication
    if (finalUser.role === "OWNER" || finalUser.role === "TENANT") {
      delete finalUser.password;
    } else if (finalUser.password && finalUser.password.length < 20 && !finalUser.password.endsWith("==") && finalUser.password.length !== 64) {
      finalUser.password = sha256(finalUser.password);
    }`);

// 5. Remove email fallback in resolveUserProfile for OWNER and TENANT
code = code.replace(`    // 2. Check current in-memory / local state by email
    if (!match && fEmail) {
      match = currentUsersList.find(u => (u.email || "").trim().toLowerCase() === fEmail);
    }`, `    // 2. Check current in-memory / local state by email
    if (!match && fEmail) {
      const emailMatch = currentUsersList.find(u => (u.email || "").trim().toLowerCase() === fEmail);
      if (emailMatch && emailMatch.role !== "OWNER" && emailMatch.role !== "TENANT") {
        match = emailMatch;
      }
    }`);

code = code.replace(`      // 3c. Query collection by email
      if (!match && fEmail) {
        try {
          const qEmail = query(collection(db, "users"), where("email", "==", fEmail));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            match = snapEmail.docs[0].data() as User;
          }
        } catch (err: any) {
          console.warn("[AuthContext] Query users by email notice:", err?.message);
        }
      }`, `      // 3c. Query collection by email
      if (!match && fEmail) {
        try {
          const qEmail = query(collection(db, "users"), where("email", "==", fEmail));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const emailMatch = snapEmail.docs[0].data() as User;
            if (emailMatch.role !== "OWNER" && emailMatch.role !== "TENANT") {
              match = emailMatch;
            }
          }
        } catch (err: any) {
          console.warn("[AuthContext] Query users by email notice:", err?.message);
        }
      }`);

code = code.replace(`      // 3d. Check users_by_email lookup document
      if (!match && fEmail) {
        try {
          const emailMapDoc = await getDoc(doc(db, "users_by_email", fEmail));
          if (emailMapDoc.exists()) {
            const mapData = emailMapDoc.data();
            if (mapData?.id) {
              const uDoc = await getDoc(doc(db, "users", mapData.id));
              if (uDoc.exists()) {
                match = uDoc.data() as User;
              }
            }
          }
        } catch (err: any) {
          console.warn("[AuthContext] Email map lookup notice:", err?.message);
        }
      }`, `      // 3d. Check users_by_email lookup document
      if (!match && fEmail) {
        try {
          const emailMapDoc = await getDoc(doc(db, "users_by_email", fEmail));
          if (emailMapDoc.exists()) {
            const mapData = emailMapDoc.data();
            if (mapData?.id) {
              const uDoc = await getDoc(doc(db, "users", mapData.id));
              if (uDoc.exists()) {
                const uDocData = uDoc.data() as User;
                if (uDocData.role !== "OWNER" && uDocData.role !== "TENANT") {
                  match = uDocData;
                }
              }
            }
          }
        } catch (err: any) {
          console.warn("[AuthContext] Email map lookup notice:", err?.message);
        }
      }`);

// Remove localStorage loginMode setting in useEffect
code = code.replace(`  useEffect(() => {
    try {
      if (loginMode) {
        localStorage.setItem("ef_login_mode", loginMode);
      }
    } catch (e) {
      console.warn("[AuthContext] Unable to save login mode:", e);
    }
  }, [loginMode]);`, `  // ef_login_mode localStorage behavior removed for security`);

// Remove clientManaged fallback from provisionPortalAccount
code = code.replace(`      if (data.clientManaged) {
        const res = provisionService({
          ...params,
          existingUsers: users,
          saveUser,
        });
        return { success: true, user: res.user, isNew: res.isNew, message: res.message };
      }`, ``);

fs.writeFileSync('src/context/AuthContext.tsx', code);
