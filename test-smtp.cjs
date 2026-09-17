const nodemailer = require('nodemailer');
const fs = require('fs');

async function test() {
   let pass = process.env.SMTP_APP_PASSWORD;
   if (!pass) {
       try {
           const secrets = JSON.parse(fs.readFileSync('.secrets.json', 'utf8'));
           pass = secrets.smtpAppPassword;
       } catch(e) {}
   }
   
   if (!pass) {
       console.log("No SMTP Password found");
       return;
   }
   
   const transporter = nodemailer.createTransport({
       host: 'smtp.gmail.com',
       port: 465,
       secure: true,
       auth: {
           user: 'emfalcon2025227@gmail.com',
           pass: pass
       }
   });
   
   try {
       await transporter.verify();
       console.log("SMTP Auth: PASS");
   } catch(e) {
       console.log("SMTP Auth: FAIL -", e.message);
   }
}
test();
