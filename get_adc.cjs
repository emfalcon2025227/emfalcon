const { GoogleAuth } = require('google-auth-library');
async function testADC() {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    let email = "unknown";
    if (client.email) {
      email = client.email;
    } else {
      const credentials = await auth.getCredentials();
      if (credentials && credentials.client_email) {
        email = credentials.client_email;
      }
    }
    console.log("ADC Principal:");
    console.log(email);
    console.log("ADC Target Project:");
    console.log(projectId);
  } catch (err) {
    console.log("Failed to get ADC:", err.message);
  }
}
testADC().catch(console.error);
