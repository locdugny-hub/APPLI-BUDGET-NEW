const { config, serviceAccessToken, verifyDeviceToken } = require('./_google');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = String(req.headers.authorization || '');
    const deviceToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const device = verifyDeviceToken(deviceToken);
    if (!device) return res.status(401).json({ error: 'Device not paired' });

    const { spreadsheetId } = config();
    const input = req.body || {};
    const path = String(input.path || '');
    const method = String(input.method || 'GET').toUpperCase();
    if (!path.startsWith('/') && path !== '') return res.status(400).json({ error: 'Invalid path' });
    if (!['GET','POST','PUT'].includes(method)) return res.status(400).json({ error: 'Invalid method' });

    const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
    const url = new URL(base + path);
    for (const pair of (input.params || [])) {
      if (Array.isArray(pair) && pair.length === 2 && pair[0] != null && pair[1] != null) {
        url.searchParams.append(String(pair[0]), String(pair[1]));
      }
    }

    const accessToken = await serviceAccessToken();
    const options = {
      method,
      headers: { Authorization: 'Bearer ' + accessToken }
    };
    if (input.body != null && method !== 'GET') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(input.body);
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(text || '{}');
  } catch (e) {
    return res.status(503).json({ error: e && e.message ? e.message : 'Backend unavailable' });
  }
};
