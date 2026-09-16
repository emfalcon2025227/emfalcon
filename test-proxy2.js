import fetch from 'node-fetch';
async function test() {
  const url = "https://ais-dev-bsquhlujfbnwkxcrk2ezlu-405724254259.europe-west3.run.app/api/connections/test-smtp";
  const res = await fetch(url, { method: 'POST' });
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get('content-type'));
}
test();
