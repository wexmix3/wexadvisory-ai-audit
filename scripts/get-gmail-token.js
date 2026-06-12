// One-time script to get your Gmail OAuth2 refresh token.
// Run: node scripts/get-gmail-token.js
//
// Before running:
// 1. Go to https://console.cloud.google.com/
// 2. Create/select a project
// 3. Enable the Gmail API (APIs & Services > Library > Gmail API)
// 4. Create OAuth 2.0 credentials (APIs & Services > Credentials > Create > OAuth client ID > Desktop app)
// 5. Copy the Client ID and Client Secret into the fields below

const CLIENT_ID = 'PASTE_CLIENT_ID_HERE';
const CLIENT_SECRET = 'PASTE_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n=== STEP 1: Open this URL in your browser ===\n');
console.log(authUrl);
console.log('\n=== STEP 2: Authorize the app, then paste the code below ===\n');

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the authorization code: ', async (code) => {
  rl.close();

  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();

  if (!data.refresh_token) {
    console.error('\nFailed to get refresh token:', data);
    process.exit(1);
  }

  console.log('\n=== STEP 3: Add these to your .env.local and Vercel env vars ===\n');
  console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('\nDone. Refresh token does not expire unless you revoke access.\n');
});
