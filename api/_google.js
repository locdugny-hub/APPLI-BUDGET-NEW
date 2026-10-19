const crypto = require('crypto');

function config() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.BUDGET_SHEET_ID || '1wROfa9JN1467IjJJaRjc-qn6rymFygIgfVb4AFWPgGU';
  if (!raw) throw new Error('Backend Google non configuré.');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key || !sa.token_uri) throw new Error('Compte de service invalide.');
  return { sa, spreadsheetId };
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

let cachedToken = null;
let cachedTokenExpiry = 0;

async function serviceAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60000) return cachedToken;
  const { sa } = config();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + payload;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign(sa.private_key).toString('base64url');
  const assertion = unsigned + '.' + signature;

  const response = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error('Authentification Google du serveur impossible.');
  }
  cachedToken = json.access_token;
  cachedTokenExpiry = Date.now() + (Number(json.expires_in || 3600) * 1000);
  return cachedToken;
}

function signingKey() {
  const { sa } = config();
  return crypto.createHash('sha256').update(sa.private_key).digest();
}

function signDeviceToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verifyDeviceToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch (_) { return null; }
  if (!payload || payload.v !== 1 || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

module.exports = { config, serviceAccessToken, signDeviceToken, verifyDeviceToken };
