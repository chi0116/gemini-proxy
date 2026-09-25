// api/proxy.js
module.exports = async (req, res) => {
  // 1. 強制寫入完整的 CORS 跨域 Header
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. 處理瀏覽器的 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers['authorization'] || '';

    // 安全處理傳入的 Request Body
    const requestBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // 3. 由 Vercel 海外伺服器轉發請求至 OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://excel.script',
        'X-Title': 'Excel Schedule Parser'
      },
      body: requestBody
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Proxy Internal Error' });
  }
};
