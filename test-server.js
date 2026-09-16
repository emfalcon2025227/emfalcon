const http = require('http');
http.createServer((req, res) => {
  res.writeHead(403, {'Content-Type': 'application/json'});
  res.end('{"error": "test"}');
}).listen(3001);
