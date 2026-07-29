const crypto = require('crypto');

function buildSignature(publicId, apiSecret, timestamp) {
  const payload = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  return crypto.createHash('sha1').update(payload).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { public_id: publicId } = req.body || {};
  if (!publicId) {
    res.status(400).json({ error: 'public_id is required' });
    return;
  }

  const cloudName = process.env.CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'Cloudinary configuration is missing' });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildSignature(publicId, apiSecret, timestamp);
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;

  try {
    const form = new URLSearchParams();
    form.append('public_id', publicId);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);

    const response = await fetch(url, {
      method: 'POST',
      body: form,
    });

    const data = await response.json();
    if (!response.ok || (data.result !== 'ok' && data.result !== 'not found')) {
      res.status(500).json({ error: 'Cloudinary delete failed', details: data });
      return;
    }

    res.status(200).json({ success: true, result: data });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    res.status(500).json({ error: 'Cloudinary delete request failed' });
  }
};
