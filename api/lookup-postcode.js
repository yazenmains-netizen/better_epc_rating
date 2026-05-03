const https = require('https');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const postcode = (req.query.postcode || '').trim();
  if (!postcode) return res.status(400).json({ error: 'Postcode required' });

  const apiKey = process.env.IDEALPOSTCODES_API_KEY;
  const path = '/v1/postcodes/' + encodeURIComponent(postcode) + '?api_key=' + apiKey;

  const request = https.get(
    { hostname: 'api.idealpostcodes.co.uk', path: path, headers: { 'Accept': 'application/json' } },
    function (upstream) {
      let body = '';
      upstream.on('data', function (chunk) { body += chunk; });
      upstream.on('end', function () {
        try {
          res.status(upstream.statusCode).json(JSON.parse(body));
        } catch {
          res.status(502).json({ code: 5000, message: 'Bad upstream response' });
        }
      });
    }
  );

  request.on('error', function (err) {
    res.status(500).json({ code: 5000, message: err.message });
  });

  request.end();
};
