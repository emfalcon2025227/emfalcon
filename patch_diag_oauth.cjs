const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');

file = file.replace(`    results.push({
      serviceId: "GOOGLE_OAUTH",
      serviceNameAr: "مصادقة Google OAuth وإعادة التوجيه",
      serviceNameEn: "Google OAuth & Redirect URI Match",
      category: "Google Drive",
      status: "PASS",
      latencyMs: latency,
      lastChecked: nowIso,
      messageAr: \`رابط إعادة التوجيه متطابق تماماً (\${calcCallback}) وجاهز للتفويض\`,
      messageEn: \`Redirect URI matched with origin (\${calcCallback})\`,
    });`, `    const configuredRedirect = process.env.GOOGLE_REDIRECT_URI || "https://emfalcon.ai.studio/api/integrations/google-drive/callback";
    const matchStatus = (calcCallback === configuredRedirect) ? "PASS" : "WARNING";
    
    results.push({
      serviceId: "GOOGLE_OAUTH",
      serviceNameAr: "مصادقة Google OAuth وإعادة التوجيه",
      serviceNameEn: "Google OAuth & Redirect URI Match",
      category: "Google Drive",
      status: matchStatus,
      latencyMs: latency,
      lastChecked: nowIso,
      messageAr: matchStatus === "PASS" 
        ? \`رابط إعادة التوجيه متطابق تماماً (\${calcCallback}) وجاهز للتفويض\`
        : \`تطابق غير صالح (MISMATCH): Configured: \${configuredRedirect} - Actual: \${calcCallback}\`,
      messageEn: matchStatus === "PASS"
        ? \`Redirect URI matched with origin (\${calcCallback})\`
        : \`REDIRECT_URI_MISMATCH - Configured: \${configuredRedirect} - Actual: \${calcCallback}\`,
    });`);

fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
