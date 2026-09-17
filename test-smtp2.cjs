const nodemailer = require('nodemailer');
async function test() {
   const pass = process.env.GMAIL_APP_PASSWORD;
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
