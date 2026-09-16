import fetch from 'node-fetch';
async function test() {
  const res = await fetch("http://localhost:3000/api/connections/test-smtp", { method: 'POST' });
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get('content-type'));
  const text = await res.text();
  console.log("Body length:", text.length);
  console.log("Body preview:", text.substring(0, 100));
}
test();
