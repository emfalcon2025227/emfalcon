const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');
file = file.replace(`      serviceId: "GMAIL_SMTP",
      serviceNameAr: "خدمة إرسال البريد (Gmail SMTP)",
      serviceNameEn: "Gmail SMTP Outbound Service",
      category: "Communications",
      status: "PASS",
      latencyMs: 159,
      lastChecked: nowIso,
      messageAr: "تم الاتصال بنجاح. مصادقة SMTP لحساب (emfalcon2025227@gmail.com) تمت بنجاح.",
      messageEn: "SMTP Authentication successful for emfalcon2025227@gmail.com."`, `      serviceId: "GMAIL_SMTP",
      serviceNameAr: "خدمة إرسال البريد (Gmail SMTP)",
      serviceNameEn: "Gmail SMTP Outbound Service",
      category: "Communications",
      status: "PASS",
      latencyMs: Date.now() - tSmtpStart,
      lastChecked: nowIso,
      messageAr: "تم الاتصال بنجاح. مصادقة SMTP لحساب (emfalcon2025227@gmail.com) تمت بنجاح.",
      messageEn: "SMTP Authentication successful for emfalcon2025227@gmail.com."`);
fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
