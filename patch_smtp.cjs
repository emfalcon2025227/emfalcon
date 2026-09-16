const fs = require('fs');
let file = fs.readFileSync('src/server-utils/centralConfigManager.ts', 'utf8');

const smtpRegex = /\/\/ 7\. Gmail SMTP Connection Check[\s\S]*? \/\/ 8\. Meta WhatsApp Business API Reachability/m;

const replacementSmtp = `// 7. Gmail SMTP Connection Check (Actual Authentication Test)
  const tSmtpStart = Date.now();
  let configs: any = {};
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    try { configs = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8")); } catch(e) {}
  }
  const secrets = loadStoredSecrets();
  const hasSmtp = Boolean(secrets.smtpAppPassword);
  const smtpUser = configs.gmail?.smtpUser || "emfalcon2025227@gmail.com";
  const smtpHost = configs.gmail?.smtpHost || "smtp.gmail.com";
  const smtpPort = configs.gmail?.smtpPort || 465;

  if (hasSmtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: secrets.smtpAppPassword,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });

      // Verify connection configuration (this performs the SMTP handshake and authentication)
      await transporter.verify();

      results.push({
        serviceId: "GMAIL_SMTP",
        serviceNameAr: "خدمة إرسال البريد (Gmail SMTP)",
        serviceNameEn: "Gmail SMTP Outbound Service",
        category: "Communications",
        status: "PASS",
        latencyMs: Date.now() - tSmtpStart,
        lastChecked: nowIso,
        messageAr: \`تم الاتصال بنجاح. مصادقة SMTP لحساب (\${smtpUser}) تمت بنجاح.\`,
        messageEn: \`SMTP Authentication successful for \${smtpUser}.\`,
      });
    } catch (err: any) {
      results.push({
        serviceId: "GMAIL_SMTP",
        serviceNameAr: "خدمة إرسال البريد (Gmail SMTP)",
        serviceNameEn: "Gmail SMTP Outbound Service",
        category: "Communications",
        status: "FAIL",
        latencyMs: Date.now() - tSmtpStart,
        lastChecked: nowIso,
        messageAr: \`فشل مصادقة SMTP: \${err.message}\`,
        messageEn: \`SMTP Authentication failed: \${err.message}\`,
        safeRecoveryActionAr: "التحقق من كلمة مرور التطبيق وصحة بريد المستخدم",
        safeRecoveryActionEn: "Verify Gmail App Password and username",
      });
    }
  } else {
    results.push({
      serviceId: "GMAIL_SMTP",
      serviceNameAr: "خدمة إرسال البريد (Gmail SMTP)",
      serviceNameEn: "Gmail SMTP Outbound Service",
      category: "Communications",
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      lastChecked: nowIso,
      messageAr: "لم يتم حفظ كلمة مرور التطبيق (Gmail App Password) في الخزنة الآمنة",
      messageEn: "Gmail App Password not configured in vault",
      safeRecoveryActionAr: "توليد كلمة مرور تطبيق من حساب Google وإدخالها في الإعدادات",
      safeRecoveryActionEn: "Generate a Google 16-character App Password and save in settings",
    });
  }

  // 8. Meta WhatsApp Business API Reachability`;

file = file.replace(smtpRegex, replacementSmtp);
fs.writeFileSync('src/server-utils/centralConfigManager.ts', file);
console.log("Patched SMTP diagnostics.");
