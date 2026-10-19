const { config, signDeviceToken } = require('./_google');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = String(req.headers.authorization || '');
    const googleToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!googleToken) return res.status(401).json({ error: 'Google token required' });

    const { spreadsheetId } = config();
    const check = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '?fields=spreadsheetId',
      { headers: { Authorization: 'Bearer ' + googleToken } }
    );
    if (!check.ok) return res.status(401).json({ error: 'Google verification failed' });

    const now = Math.floor(Date.now() / 1000);
    const token = signDeviceToken({
      v: 1,
      sheet: spreadsheetId,
      iat: now,
      exp: now + 10 * 365 * 24 * 3600
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token });
  } catch (e) {
    return res.status(503).json({ error: e && e.message ? e.message : 'Backend unavailable' });
  }
};
