const http = require('http');
http.get('http://localhost:5173/src/main.jsx', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode));
});
