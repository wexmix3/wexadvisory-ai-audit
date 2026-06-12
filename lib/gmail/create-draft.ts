// Creates a Gmail draft via the Gmail REST API using OAuth2.
// Uses raw fetch — no googleapis package required.
// Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth2 env vars not configured (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail token refresh failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// Builds a MIME message with an optional PDF attachment.
// Gmail API accepts base64url-encoded RFC 2822 messages.
function buildMimeMessage(params: {
  to: string;
  from: string;
  subject: string;
  bodyHtml: string;
  attachment?: { filename: string; content: Buffer };
}): string {
  const { to, from, subject, bodyHtml, attachment } = params;
  const boundary = `boundary_${Date.now().toString(36)}`;

  const header = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
  ].join('\r\n');

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    bodyHtml,
    '',
  ].join('\r\n');

  let attachPart = '';
  if (attachment) {
    attachPart = [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content.toString('base64'),
      '',
    ].join('\r\n');
  }

  const message = `${header}\r\n${htmlPart}${attachPart}--${boundary}--`;

  // Gmail API requires base64url encoding (no padding, url-safe chars)
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createGmailDraft(params: {
  to: string;
  subject: string;
  bodyHtml: string;
  attachment?: { filename: string; content: Buffer };
}): Promise<string> {
  const accessToken = await getAccessToken();

  const raw = buildMimeMessage({
    to: params.to,
    from: 'Max Wexley <maxwexley@wexadvisory.com>',
    subject: params.subject,
    bodyHtml: params.bodyHtml,
    attachment: params.attachment,
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail draft creation failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}
