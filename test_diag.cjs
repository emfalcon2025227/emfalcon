const { runComprehensiveDiagnostics } = require('./dist/server.cjs');
async function test() {
  const origin = "https://ais-dev-bsquhlujfbnwkxcrk2ezlu-405724254259.europe-west3.run.app";
  const res = await runComprehensiveDiagnostics(origin);
  console.log(JSON.stringify(res, null, 2));
}
test().catch(console.error);
