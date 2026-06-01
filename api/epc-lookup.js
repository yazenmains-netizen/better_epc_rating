const https = require('https');

const EPC_HOST = 'api.get-energy-performance-data.communities.gov.uk';

function epcGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: EPC_HOST, path, method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
          catch { resolve({ status: res.statusCode, body: null }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const postcode = (req.query.postcode || '').trim().toUpperCase();
  if (!postcode) return res.status(400).json({ error: 'Postcode required' });

  const token = process.env.EPC_BEARER_TOKEN;
  if (!token) return res.status(500).json({ error: 'API not configured' });

  try {
    const { status, body } = await epcGet(
      `/api/domestic/search?postcode=${encodeURIComponent(postcode)}&size=25`,
      token
    );

    if (status === 200 && body?.data?.length) {
      const byUprn = {};
      for (const cert of body.data) {
        const key = cert.uprn || (cert.addressLine1 + cert.postcode);
        if (!byUprn[key] || cert.registrationDate > byUprn[key].registrationDate) {
          byUprn[key] = cert;
        }
      }

      const properties = Object.values(byUprn)
        .sort((a, b) => a.addressLine1?.localeCompare(b.addressLine1))
        .map(p => ({
          uprn: p.uprn,
          address: [p.addressLine1, p.addressLine2, p.addressLine3, p.addressLine4].filter(Boolean).join(', '),
          postcode: p.postcode,
          band: (p.currentEnergyEfficiencyBand || '').toUpperCase(),
          registered: p.registrationDate,
        }));

      return res.status(200).json({ properties });
    }

    return res.status(404).json({ error: 'No EPC certificates found for this postcode. The property may not have an EPC on record yet.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch EPC data. Please try again.' });
  }
};
