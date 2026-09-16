import fetch from 'node-fetch';
async function test() {
  const url = "http://localhost:3000/api/admin/system-config";
  const res = await fetch(url);
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get('content-type'));
  const text = await res.text();
  console.log("Body length:", text.length);
  console.log("Body preview:", text.substring(0, 100));
}
test();
