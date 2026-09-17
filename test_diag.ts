import { testGmailConnectionOnServer, testWhatsAppConnection } from './src/services/communicationProviderService';
import { runComprehensiveDiagnostics } from './src/server-utils/centralConfigManager';

async function run() {
  console.log("Testing Diags...");
  try {
    const res = await runComprehensiveDiagnostics("https://ais-dev-bsquhlujfbnwkxcrk2ezlu-405724254259.europe-west3.run.app");
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
