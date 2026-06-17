// One-time script to get your Gmail OAuth2 refresh token.
// Run: node scripts/get-gmail-token.js
//
// Before running:
// 1. Go to https://console.cloud.google.com/
// 2. APIs & Services > Credentials > your OAuth client
// 3. Add http://localhost:3456 to Authorized redirect URIs and Save
// 4. Paste your Client ID and Client Secret below

const CLIENT_ID = 'PASTE_CLIENT_ID_HERE';
const CLIENT_SECRET = 'PASTE_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'http://localhost:3456';
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

const http = require('http');
const url = require('url');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n=== Open this URL in your browser ===\n');
console.log(authUrl);
console.log('\nWaiting for Google to redirect back...\n');

const server = http.createServer(async (req, res) => {
  const code = new url.URL(req.url, 'http://localhost:3456').searchParams.get('code');
  if (!code) {
    res.end('No code found. Try again.');
    return;
  }

  res.end('<h2>Authorization successful! You can close this tab.</h2>');
  server.close();

  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await tokenRes.json();

  if (!data.refresh_token) {
    console.error('Failed to get refresh token:', data);
    process.exit(1);
  }

  console.log('\n=== Add these to your .env.local and Vercel env vars ===\n');
  console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('\nDone. This token does not expire.\n');
});

server.listen(3456);
