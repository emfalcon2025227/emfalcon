import { getEmailTransporter } from "./server.js";
import { loadStoredSecrets } from "./src/server-utils/googleDriveIntegrationService.js";

const configs = { gmail: { smtpUser: process.env.SMTP_USER, smtpHost: "smtp.gmail.com", smtpPort: 465, encryption: "SSL", senderName: "Emirates Falcon System", enabled: true, status: "CONFIGURED" } };
const secrets = loadStoredSecrets();
const emailConfig = getEmailTransporter(configs, secrets);
console.log("Email config:", !!emailConfig.transporter);
