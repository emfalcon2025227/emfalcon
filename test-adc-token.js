import { GoogleAuth } from 'google-auth-library';
async function main() {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (token && token.token) {
     const payloadBase64 = token.token.split('.')[1];
     if (payloadBase64) {
         try {
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
            console.log("Token payload:", payload);
         } catch(e) {
            console.log("Could not decode payload", e.message);
         }
     } else {
         console.log("Not a JWT token");
     }
  }
}
main().catch(console.error);
