import fetch from 'node-fetch';

const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString('base64');
const payload = Buffer.from(JSON.stringify({ user_id: "fake-user-123", email: "m_hamed@msn.com" })).toString('base64');
const dummyToken = `${header}.${payload}.signature`;

async function test() {
  const url = "http://localhost:3000/api/admin/system-config";
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${dummyToken}` } });
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get('content-type'));
  const text = await res.text();
  console.log("Body preview:", text.substring(0, 100));
}
test();
