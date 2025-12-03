#!/usr/bin/env node

const http = require('http');
const url = require('url');
const fs = require('fs');
const sql = require('mssql');

const PORT = process.env.PORT || 3000;

// Load .env file if exists
try {
  const envFile = fs.readFileSync('.env', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
} catch (e) { /* .env not found */ }

// Database config
const dbConfig = {
  server: process.env.DB_HOST || 'majorprojectdatabase.database.windows.net',
  database: process.env.DB_NAME || 'majorappdb',
  user: process.env.DB_USER || 'somen',
  password: process.env.DB_PASSWORD || 'MyP@ss123',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Query database
async function queryDatabase(query) {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error('DB Error:', err.message);
    return null;
  }
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

const htmlPage = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Somen API</title>
  <style>body{font-family:Arial;background:#667eea;padding:40px;color:#222} .card{background:#fff;border-radius:8px;padding:20px;max-width:600px;margin:0 auto} button{background:#667eea;color:#fff;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;margin:5px}</style>
</head>
<body>
  <div class="card">
    <h1>Somen API</h1>
    <button onclick="testEndpoint('/api/data')">Get All Database Users</button>
    <button onclick="testEndpoint('/api/data/filter?status=active')">Filter Active</button>
    <button onclick="testEndpoint('/api/data/filter?status=pending')">Filter Pending</button>
    <pre id="response" style="background:#f5f5f5;padding:12px;border-radius:6px;margin-top:20px">Click a button</pre>
  </div>
  <script>
    async function testEndpoint(ep) {
      document.getElementById('response').textContent = 'Loading...';
      try {
        const r = await fetch(ep, { cache: 'no-store' });
        const d = await r.json();
        document.getElementById('response').textContent = JSON.stringify(d, null, 2);
      } catch (e) {
        document.getElementById('response').textContent = 'Error: ' + e.message;
      }
    }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname || '/';
  const q = parsed.query || {};

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  try {
    // GET /api/data - Get all users
    if (path === '/api/data') {
      const dbData = await queryDatabase('SELECT TOP 100 * FROM Users');
      if (dbData) {
        return sendJSON(res, 200, { success: true, source: 'database', data: dbData, count: dbData.length });
      }
      return sendJSON(res, 200, { success: false, message: 'Database not connected', data: [], count: 0 });
    }

    // GET /api/data/filter?status=X - Filter users
    if (path === '/api/data/filter') {
      const status = q.status;
      if (!status) return sendJSON(res, 400, { success: false, error: 'Missing status parameter' });
      
      const dbData = await queryDatabase(`SELECT * FROM Users WHERE status = '${status}'`);
      if (dbData) {
        return sendJSON(res, 200, { success: true, source: 'database', filter: status, data: dbData, count: dbData.length });
      }
      return sendJSON(res, 200, { success: false, message: 'Database not connected', filter: status, data: [], count: 0 });
    }

    // Home page
    if (path === '/') {
      return sendHTML(res, htmlPage);
    }

    return sendJSON(res, 404, { error: 'Not Found', endpoints: ['/api/data', '/api/data/filter?status=X'] });
  } catch (err) {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, () => console.log('Server on port', PORT));
