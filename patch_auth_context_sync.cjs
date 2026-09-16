const fs = require('fs');

let authContext = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
const lines = authContext.split('\n');

const startIdx = lines.findIndex(l => l.includes('const resolveUserProfile = async'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.includes('return updatedProfile;'));

if (startIdx !== -1 && endIdx !== -1) {
  const newLogic = `  const resolveUserProfile = async (fUser: FirebaseUser, currentUsersList: User[]): Promise<User | null> => {
    const fUid = fUser.uid;

    let match: User | null = null;

    // 1. Direct doc lookup by uid (Canonical Identity)
    try {
      const docById = await getDoc(doc(db, "users", fUid));
      if (docById.exists()) {
        match = docById.data() as User;
      }
    } catch (err: any) {
      console.warn("[AuthContext] Direct user doc lookup error:", err?.message);
    }

    // 2. Fallback query by firebaseUid
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

    if (!match) {
      console.warn("[AuthContext] No canonical user profile found for verified UID:", fUid);
      return null;
    }

    // Keep doc in Firestore synchronized ONLY for lastLogin to avoid migration
    setDoc(doc(db, "users", match.id), { lastLogin: new Date().toISOString() }, { merge: true }).catch(() => {});

    return match;`;
  
  lines.splice(startIdx, endIdx - startIdx + 1, newLogic);
  fs.writeFileSync('src/context/AuthContext.tsx', lines.join('\n'));
  console.log("Patched resolveUserProfile properly");
} else {
  console.log("Could not find bounds", startIdx, endIdx);
}
