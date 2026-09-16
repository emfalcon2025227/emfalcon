const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf8');

const regex = /function isSystemOwner\(\) \{\s*return isSignedIn\(\) && \(\s*request.auth.token.email == 'm_hamed@msn.com' \|\|\s*request.auth.token.email == 'emfalcon2025227@gmail.com' \|\|\s*getUserRole\(\) == 'SYSTEM_OWNER'\s*\);\s*\}/;

const replacement = `function isSystemOwner() {
      return isSignedIn() && (
        (request.auth.token.email != null && (
          request.auth.token.email == 'm_hamed@msn.com' ||
          request.auth.token.email == 'emfalcon2025227@gmail.com'
        )) ||
        getUserRole() == 'SYSTEM_OWNER'
      );
    }`;

rules = rules.replace(regex, replacement);
fs.writeFileSync('firestore.rules', rules);
console.log("Patched firestore.rules safely");
