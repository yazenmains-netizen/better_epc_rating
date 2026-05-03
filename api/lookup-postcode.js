export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: 'Postcode required' });

  const apiKey = process.env.IDEALPOSTCODES_API_KEY;
  const url = `https://api.idealpostcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${apiKey}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(500).json({ code: 5000, message: 'Lookup failed' });
  }
}
