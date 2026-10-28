#!/usr/bin/env node
const http = require('http');

const args = process.argv.slice(2);
const title = args[0] || 'TabDeck Notification';
const message = args[1] || 'Task or process completed successfully.';
const level = args[2] || 'success'; // success, warning, error, info
const port = process.env.PORT || 3000;

const payload = JSON.stringify({ title, message, level });

const req = http.request({
  hostname: '127.0.0.1',
  port: port,
  path: '/api/notify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`[TabDeck] Notification sent to tablets (${level}): "${title}"`);
  });
});

req.on('error', (err) => {
  console.error('[TabDeck] Failed to send notification:', err.message);
});

req.write(payload);
req.end();
