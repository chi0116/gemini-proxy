export default async function handler(req, res) {
  // 1. 設置所有 CORS 標頭，允許 Excel Online 存取
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. 處理瀏覽器的 OPTIONS Preflight 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 3. 取得 API Key 並直接向 Google API 發送請求（由美國 Vercel 伺服器發出，無地域限制）
    const apiKey = req.query.key || process.env.GEMINI_API_KEY;
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const googleResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await googleResponse.json();
    return res.status(googleResponse.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
