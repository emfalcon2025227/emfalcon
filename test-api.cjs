const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/connections/config',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer fake-token'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data.slice(0, 100)));
});
req.write('{}');
req.end();
