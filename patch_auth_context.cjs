const fs = require('fs');

let authContext = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

const regex = /const resolveUserProfile = async \(fUser: FirebaseUser, currentUsersList: User\[\]\): Promise<User \| null> => \{[\s\S]*?\/\/ 4\. Final checks and profile enrichment/;

const newLogic = `const resolveUserProfile = async (fUser: FirebaseUser, currentUsersList: User[]): Promise<User | null> => {
    const fUid = fUser.uid;
    const fEmail = (fUser.email || "").trim().toLowerCase();

    let match: User | null | undefined = null;

    // 1. Query Firestore direct document (Canonical source of truth)
    try {
      const docById = await getDoc(doc(db, "users", fUid));
      if (docById.exists()) {
        match = docById.data() as User;
      }
    } catch (err: any) {
      console.warn("[AuthContext] Direct user doc lookup error:", err?.message);
    }

    // 2. Query collection by firebaseUid (Fallback)
    if (!match) {
      try {
        const qUid = query(collection(db, "users"), where("firebaseUid", "==", fUid));
        const snapUid = await getDocs(qUid);
        if (!snapUid.empty) {
          match = snapUid.docs[0].data() as User;
        }
      } catch (err: any) {
        console.warn("[AuthContext] firebaseUid query error:", err?.message);
      }
    }

    // 3. DO NOT grant roles based on email alone. 
    // Wait, what if this is the first time the owner logs in and has no UID doc?
    // We shouldn't grant SYSTEM_OWNER automatically just based on email.
    // If there is a legitimate bootstrapping issue, the admin should use the server API or setup script.
    
    // 4. Final checks and profile enrichment`;

authContext = authContext.replace(regex, newLogic);
fs.writeFileSync('src/context/AuthContext.tsx', authContext);
console.log("Patched resolveUserProfile in AuthContext");
