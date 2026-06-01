const EPC_HOST = 'api.get-energy-performance-data.communities.gov.uk';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const postcode = (req.query.postcode || '').trim().toUpperCase();
  if (!postcode) return res.status(400).json({ error: 'Postcode required' });

  const token = process.env.EPC_BEARER_TOKEN;
  if (!token) return res.status(500).json({ error: 'API not configured' });

  try {
    const url = `https://${EPC_HOST}/api/domestic/search?postcode=${encodeURIComponent(postcode)}&size=25`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data?.data?.length) {
      const byUprn = {};
      for (const cert of data.data) {
        const key = cert.uprn || (cert.addressLine1 + cert.postcode);
        if (!byUprn[key] || cert.registrationDate > byUprn[key].registrationDate) {
          byUprn[key] = cert;
        }
      }

      const properties = Object.values(byUprn)
        .sort((a, b) => (a.addressLine1 || '').localeCompare(b.addressLine1 || ''))
        .map(p => ({
          uprn: p.uprn,
          address: [p.addressLine1, p.addressLine2, p.addressLine3, p.addressLine4].filter(Boolean).join(', '),
          postcode: p.postcode,
          band: (p.currentEnergyEfficiencyBand || '').toUpperCase(),
          registered: p.registrationDate,
        }));

      return res.status(200).json({ properties });
    }

    return res.status(404).json({ error: 'No EPC certificates found for this postcode.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
