import { GoogleAuth } from 'google-auth-library';
async function main() {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
  });
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();
  let email = "unknown";
  if (client.credentials && client.credentials.client_email) {
      email = client.credentials.client_email;
  } else if (client.email) {
      email = client.email;
  }
  console.log("ADC Principal:", email);
  console.log("ADC Project:", projectId);
}
main().catch(console.error);
